import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/database";
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { metrics } from "@/lib/metrics";
import { emailService } from "@/lib/notifications/email.service";
import { logAuditEvent, AuditActions } from "@/lib/audit-log";

// Helper function to check if a user profile is complete
// Returns true if all required fields are filled
const isProfileComplete = (profile: {
  phone?: string | null;
  dateOfBirth?: Date | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
} | null): boolean => {
  if (!profile) {
    return false;
  }

  const hasPhone = profile.phone && profile.phone.length > 0;
  const hasDOB = profile.dateOfBirth !== null;
  const hasStreet = profile.streetAddress && profile.streetAddress.length > 0;
  const hasCity = profile.city && profile.city.length > 0;
  const hasState = profile.state && profile.state.length > 0;
  const hasZip = profile.zipCode && profile.zipCode.length > 0;

  return !!(hasPhone && hasDOB && hasStreet && hasCity && hasState && hasZip);
};

// Rate limiting for credentials login
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

const checkRateLimit = (email: string) => {
  const now = Date.now();
  const attempts = loginAttempts.get(email) || { count: 0, lastAttempt: 0 };

  if (now - attempts.lastAttempt > LOCKOUT_DURATION) {
    attempts.count = 0;
  }

  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    return { allowed: false };
  }

  return { allowed: true };
};

const recordFailedAttempt = (email: string) => {
  const now = Date.now();
  const attempts = loginAttempts.get(email) || { count: 0, lastAttempt: 0 };
  attempts.count += 1;
  attempts.lastAttempt = now;
  loginAttempts.set(email, attempts);
};

const resetFailedAttempts = (email: string) => {
  loginAttempts.delete(email);
};

export const authOptions: NextAuthOptions = {
  // No adapter - use pure JWT with database callbacks
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        userType: { label: "User Type", type: "text" }
      },
      async authorize(credentials) {

        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const email = credentials.email.toLowerCase();

          // Rate limiting check
          const rateLimitResult = checkRateLimit(email);
          if (!rateLimitResult.allowed) {
            logAuditEvent({
              adminId: email,
              adminEmail: email,
              action: AuditActions.LOGIN_RATE_LIMITED,
              resource: 'auth',
              details: { email, reason: 'Rate limit exceeded' },
            });
            throw new Error('Too many login attempts. Please try again in 15 minutes.');
          }

          // Find user with profile data
          const user = await prisma.user.findUnique({
            where: { email },
            include: {
              profile: true,
              caregiver: true,
              babysitter: true
            }
          });

          if (!user) {
            recordFailedAttempt(email);
            logAuditEvent({
              adminId: email,
              adminEmail: email,
              action: AuditActions.LOGIN_FAILED,
              resource: 'auth',
              details: { email, reason: 'User not found' },
            });
          // Track failed authentication
          metrics.authFailure("invalid_credentials");
          return null;
          }

          // Check if user type matches (if specified)
          if (credentials.userType) {
            // Special case: babysitters have userType 'CAREGIVER' with isBabysitter flag
            if (credentials.userType === 'babysitter') {
              // Babysitters must have isBabysitter=true AND userType='CAREGIVER'
              if (!user.isBabysitter || user.userType !== 'CAREGIVER') {
                recordFailedAttempt(email);
                metrics.authFailure("invalid_credentials");
                return null;
              }
            } else {
              const expectedUserType = credentials.userType === 'parent' ? 'PARENT' :
                                     credentials.userType === 'caregiver' ? 'CAREGIVER' :
                                     credentials.userType === 'admin' ? 'ADMIN' : null;

              if (expectedUserType && user.userType !== expectedUserType) {
                recordFailedAttempt(email);
                metrics.authFailure("invalid_credentials");
                return null;
              }
            }
          }

          // Verify password
          if (!user.passwordHash || typeof user.passwordHash !== 'string') {
            recordFailedAttempt(email);
          // Track failed authentication
          metrics.authFailure("invalid_credentials");
          return null;
          }

          const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
          if (!isValidPassword) {
            recordFailedAttempt(email);
            logAuditEvent({
              adminId: user.id,
              adminEmail: email,
              action: AuditActions.LOGIN_FAILED,
              resource: 'auth',
              details: { email, reason: 'Invalid password', userType: user.userType },
            });
          // Track failed authentication
          metrics.authFailure("invalid_credentials");
          return null;
          }

          // Check account status
          if (!user.isActive) {
            throw new Error('Account is deactivated. Please contact support.');
          }

          // Allow PENDING caregivers to login and complete their profile
          if (user.approvalStatus === 'PENDING' && user.userType !== 'CAREGIVER') {
            throw new Error('Account is pending approval. You will be notified once approved.');
          }

          if (user.approvalStatus === 'REJECTED') {
            throw new Error('Account has been rejected. Please contact support for more information.');
          }

          if (user.approvalStatus === 'SUSPENDED') {
            throw new Error('Account is suspended. Please contact support for assistance.');
          }

          // Reset failed attempts on successful login
          resetFailedAttempts(email);

          // Audit log for successful login
          logAuditEvent({
            adminId: user.id,
            adminEmail: email,
            action: AuditActions.LOGIN_SUCCESS,
            resource: 'auth',
            details: { userType: user.userType, email },
          });

          // Update last login timestamp
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
          });

          // Return user object for NextAuth
          // Include dual-role fields from database for proper session handling
          return {
            id: user.id,
            email: user.email,
            name: user.profile?.firstName && user.profile?.lastName
              ? `${user.profile.firstName} ${user.profile.lastName}`
              : user.name || 'User',
            image: user.profile?.avatar || user.image || undefined,
            userType: user.userType,
            approvalStatus: user.approvalStatus,
            isActive: user.isActive,
            profile: user.profile,
            caregiver: user.caregiver,
            isBabysitter: user.isBabysitter,
            babysitter: user.babysitter,
            // Dual-role support - include from database
            isParent: user.isParent,
            isCaregiver: user.isCaregiver,
            activeRole: user.activeRole || user.userType, // Default to userType if activeRole not set
          };
        } catch (error) {
          // Return null instead of throwing to prevent NextAuth from crashing
          const email = credentials?.email?.toLowerCase();
          if (email) {
            recordFailedAttempt(email);
          }
          return null;
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID || "",
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || "",
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) {
        return false;
      }

      try {
        // Check if user exists in database
        let dbUser = await prisma.user.findUnique({
          where: { email: user.email }, include: { profile: true }
        });

        if (!dbUser) {
          // Extract first and last name from Google/Facebook profile
          let firstName = '';
          let lastName = '';

          if (profile) {
            // Google provides given_name and family_name
            if ((profile as any).given_name) firstName = (profile as any).given_name;
            if ((profile as any).family_name) lastName = (profile as any).family_name;
          }

          // Fallback: split user.name if no profile data
          if (!firstName && !lastName && user.name) {
            const nameParts = user.name.split(' ');
            firstName = nameParts[0] || '';
            lastName = nameParts.slice(1).join(' ') || '';
          }

          // Track new user registration
          metrics.userRegistered("PARENT", "unknown");
          // Create new user with profile
          dbUser = await prisma.user.create({
            data: {
              email: user.email,
              name: user.name || "OAuth User",
              emailVerified: new Date(),
              image: user.image,
              userType: "PARENT",
              approvalStatus: "APPROVED", // Auto-approve Google OAuth users
              isActive: true,
              lastLogin: new Date(),
              // Dual role support - set isParent for new parent users
              isParent: true,
              isCaregiver: false,
              activeRole: "PARENT",
              profile: {
                create: {
                  firstName: firstName,
                  lastName: lastName,
                  avatar: user.image || null,
                  phone: '',
                  streetAddress: '',
                  city: '',
                  state: '',
                  zipCode: '',
                  country: 'CA',
                }
              }
            },
            include: { profile: true }
          });

          // Send welcome email to new OAuth user
          try {
            await emailService.sendWelcomeEmail(user.email, {
              firstName: firstName || 'User',
              lastName: lastName || '',
              userType: 'PARENT',
            });
          } catch (emailError) {
            // Log email failures without exposing user data in production
            if (process.env.NODE_ENV === 'development') {
              console.error('Failed to send welcome email:', emailError);
            }
            // Don't fail the OAuth flow if email fails
          }
        } else {
          // Update existing user
          await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              name: user.name || dbUser.name,
              image: user.image || dbUser.image,
              emailVerified: new Date(),
              lastLogin: new Date(),
            },
          });

          // Create profile if it doesn't exist
          if (!dbUser.profile) {
            let firstName = '';
            let lastName = '';

            if (profile) {
              if ((profile as any).given_name) firstName = (profile as any).given_name;
              if ((profile as any).family_name) lastName = (profile as any).family_name;
            }

            if (!firstName && !lastName && user.name) {
              const nameParts = user.name.split(' ');
              firstName = nameParts[0] || '';
              lastName = nameParts.slice(1).join(' ') || '';
            }

            await prisma.userProfile.create({
              data: {
                userId: dbUser.id,
                firstName: firstName,
                lastName: lastName,
                avatar: user.image || null,
                phone: '',
                streetAddress: '',
                city: '',
                state: '',
                zipCode: '',
                country: 'CA',
              }
            });
          }
        }

        // Track OAuth authentication success
        metrics.authSuccess(dbUser?.userType || "PARENT");

        // Profile completion is now handled client-side via the ProfileCompletionModal
        // No server-side redirect needed - this prevents refresh loop issues
        return true;
      } catch (error) {
        // Don't fail the OAuth flow for database issues
        return true;
      }
    },
    async session({ session, user, token }) {
      // IMPORTANT: Copy dual-role fields from JWT token first
      // These fields MUST be in the token to be sent to the client
      // The session callback runs server-side, but the client only receives what's in the token
      if (token) {
        session.user.needsProfileCompletion = token.needsProfileCompletion as boolean;
        session.user.isParent = token.isParent as boolean;
        session.user.isCaregiver = token.isCaregiver as boolean;
        session.user.isBabysitter = token.isBabysitter as boolean;
        session.user.activeRole = token.activeRole as any;
        session.user.userType = token.userType as any;
        session.user.approvalStatus = token.approvalStatus as string;
        session.user.isActive = token.isActive as boolean;
      }

      if (session?.user?.email) {
        try {
          // Always fetch fresh profile data from database to ensure apartment and other fields are current
          const dbUser = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: {
              profile: true,
              id: true,
              userType: true,
              approvalStatus: true,
              isActive: true,
              caregiver: true,
              // Dual role support
              isParent: true,
              isCaregiver: true,
              isBabysitter: true,
              activeRole: true,
            },
          });

          if (dbUser) {
            // Add profile completion status to session - override token value with fresh DB check
            const profileComplete = isProfileComplete(dbUser.profile);
            const needsCompletion = !profileComplete;

            // Build the session user object explicitly with spread to ensure all fields are included
            session.user = {
              ...session.user,
              id: dbUser.id,
              profile: dbUser.profile,
              userType: dbUser.activeRole || dbUser.userType, // Use activeRole as current effective userType
              approvalStatus: dbUser.approvalStatus,
              isActive: dbUser.isActive,
              caregiver: dbUser.caregiver,
              needsProfileCompletion: needsCompletion,
              // Dual role support
              isParent: dbUser.isParent,
              isCaregiver: dbUser.isCaregiver,
              isBabysitter: dbUser.isBabysitter,
              activeRole: dbUser.activeRole || dbUser.userType,
            };

          }
        } catch (error) {
          // Log error but don't fail the session - avoid exposing details in production
          if (process.env.NODE_ENV === 'development') {
            console.error('Session callback error:', error);
          }
        }
      }
      return session;
    },
    async jwt({ token, user, account }) {
      // Add user info to token on first sign in
      if (user && account) {
        // Handle credentials provider
        if (account.provider === 'credentials') {
          token.userType = (user as any).userType;
          token.approvalStatus = (user as any).approvalStatus;
          token.isActive = (user as any).isActive;
          token.profile = (user as any).profile;
          token.caregiver = (user as any).caregiver;
          token.needsProfileCompletion = false; // Credentials users have complete profiles
          // Dual role support for credentials provider
          token.isParent = (user as any).isParent;
          token.isCaregiver = (user as any).isCaregiver;
          token.isBabysitter = (user as any).isBabysitter;
          token.babysitter = (user as any).babysitter;
          token.activeRole = (user as any).activeRole || (user as any).userType;
        } else {
          // Handle OAuth providers (Google, Facebook)
          // Need to fetch from database since OAuth user object does not have these fields
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: user.email! },
              select: {
                id: true,
                userType: true,
                approvalStatus: true,
                isActive: true,
                // Dual role support
                isParent: true,
                isCaregiver: true,
                activeRole: true,
                profile: {
                  select: {
                    phone: true,
                    dateOfBirth: true,
                    streetAddress: true,
                    city: true,
                    state: true,
                    zipCode: true
                  }
                }
              }
            });
            if (dbUser) {
              token.userId = dbUser.id;
              token.userType = dbUser.userType;
              token.approvalStatus = dbUser.approvalStatus;
              token.isActive = dbUser.isActive;
              // Dual role support - store in JWT token
              token.isParent = dbUser.isParent;
              token.isCaregiver = dbUser.isCaregiver;
              token.activeRole = dbUser.activeRole;
              // Check if OAuth user needs to complete their profile
              token.needsProfileCompletion = !isProfileComplete(dbUser.profile);
            }
          } catch (error) {
            // Default to requiring profile completion if we can't check
            token.needsProfileCompletion = true;
          }
        }
        token.lastLogin = new Date().toISOString();
      } else if (token.email) {
        // On subsequent requests, refresh approvalStatus, isActive, dual-role fields, and profile completion status
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email as string },
            select: {
              approvalStatus: true,
              isActive: true,
              // Dual role support - refresh on every request
              isParent: true,
              isCaregiver: true,
              isBabysitter: true,
              activeRole: true,
              userType: true,
              profile: {
                select: {
                  phone: true,
                  dateOfBirth: true,
                  streetAddress: true,
                  city: true,
                  state: true,
                  zipCode: true
                }
              }
            }
          });
          if (dbUser) {
            token.approvalStatus = dbUser.approvalStatus;
            token.isActive = dbUser.isActive;
            // Dual role support - update on every request
            token.isParent = dbUser.isParent;
            token.isCaregiver = dbUser.isCaregiver;
            token.isBabysitter = dbUser.isBabysitter;
            token.activeRole = dbUser.activeRole;
            token.userType = dbUser.activeRole || dbUser.userType;
            // Update profile completion status
            token.needsProfileCompletion = !isProfileComplete(dbUser.profile);
          }
        } catch (error) {
          // Silently fail - keep existing token values
        }
      }
      return token;
    },
    async redirect({ url, baseUrl }) {
      // Handle custom redirects based on user type from token
      if (url.includes('/login/admin')) {
        return `${baseUrl}/admin`;
      }

      // Preserve OAuth callback URLs for caregiver/parent dashboards
      // These include oauth=true and userType params that are needed for profile completion
      if (url.includes('oauth=true') || url.includes('userType=')) {
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        if (new URL(url).origin === baseUrl) return url;
      }

      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days (more secure)
    updateAge: 24 * 60 * 60, // Extend session if user is active within 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
  useSecureCookies: process.env.NODE_ENV === "production",
};

import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/database";
import bcrypt from 'bcryptjs';
import { z } from 'zod';

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
            throw new Error('Too many login attempts. Please try again in 15 minutes.');
          }

          // Find user with profile data
          const user = await prisma.user.findUnique({
            where: { email },
            include: {
              profile: true,
              caregiver: true
            }
          });

          if (!user) {
            recordFailedAttempt(email);
            return null;
          }

          // Check if user type matches (if specified)
          if (credentials.userType) {
            const expectedUserType = credentials.userType === 'parent' ? 'PARENT' : 
                                   credentials.userType === 'caregiver' ? 'CAREGIVER' : 
                                   credentials.userType === 'admin' ? 'ADMIN' : null;
            
            if (expectedUserType && user.userType !== expectedUserType) {
              recordFailedAttempt(email);
              return null;
            }
          }

          // Verify password
          if (!user.passwordHash || typeof user.passwordHash !== 'string') {
            recordFailedAttempt(email);
            return null;
          }

          const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
          if (!isValidPassword) {
            recordFailedAttempt(email);
            return null;
          }

          // Check account status
          if (!user.isActive) {
            throw new Error('Account is deactivated. Please contact support.');
          }

          if (user.approvalStatus === 'PENDING') {
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

          // Update last login timestamp
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
          });

          // Return user object for NextAuth
          return {
            id: user.id,
            email: user.email,
            name: user.profile?.firstName && user.profile?.lastName 
              ? `${user.profile.firstName} ${user.profile.lastName}` 
              : user.name || 'User',
            image: user.profile?.avatar || user.image,
            userType: user.userType,
            approvalStatus: user.approvalStatus,
            isActive: user.isActive,
            profile: user.profile,
            caregiver: user.caregiver
          };
        } catch (error) {
          console.error('Credentials authorization error:', error);
          // Return null instead of throwing to prevent NextAuth from crashing
          recordFailedAttempt(email);
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
          where: { email: user.email },
        });

        if (!dbUser) {
          // Create new user with all required fields
          dbUser = await prisma.user.create({
            data: {
              email: user.email,
              name: user.name || "OAuth User",
              emailVerified: new Date(),
              image: user.image,
              userType: "PARENT",
              approvalStatus: "APPROVED", // Auto-approve Google OAuth users for testing
              isActive: true,
              lastLogin: new Date(),
            },
          });
          // User created successfully - don't log PII
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
          // User updated successfully - don't log PII
        }

        return true;
      } catch (error) {
        console.error("Database error in signIn:", error);
        // Don't fail the OAuth flow for database issues
        return true;
      }
    },
    async session({ session, user, token }) {
      if (session?.user?.email) {
        try {
          // If we have token data (from credentials provider), use it directly
          if (token.userType) {
            session.user.id = token.sub || session.user.id;
            session.user.userType = token.userType;
            session.user.approvalStatus = token.approvalStatus;
            session.user.isActive = token.isActive;
            session.user.profile = token.profile;
            session.user.caregiver = token.caregiver;
          } else {
            // Fallback for OAuth providers - fetch from database
            const dbUser = await prisma.user.findUnique({
              where: { email: session.user.email },
              select: {
                id: true,
                userType: true,
                approvalStatus: true,
                isActive: true,
              },
            });

            if (dbUser) {
              session.user.id = dbUser.id;
              session.user.userType = dbUser.userType;
              session.user.approvalStatus = dbUser.approvalStatus;
              session.user.isActive = dbUser.isActive;
            }
          }
        } catch (error) {
          console.error("Error fetching user session:", error);
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
        } else {
          // Handle OAuth providers (Google, Facebook)
          token.userType = (user as any).userType;
          token.approvalStatus = (user as any).approvalStatus;
          token.isActive = (user as any).isActive;
        }
        token.lastLogin = new Date().toISOString();
      }
      return token;
    },
    async redirect({ url, baseUrl }) {
      // Handle custom redirects based on user type from token
      if (url.includes('/login/caregiver')) {
        return `${baseUrl}/caregiver-dashboard`;
      }
      if (url.includes('/login/parent')) {
        return `${baseUrl}/parent-dashboard`;
      }
      if (url.includes('/login/admin')) {
        return `${baseUrl}/admin-dashboard`;
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
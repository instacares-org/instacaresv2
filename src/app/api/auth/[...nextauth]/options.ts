import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/database";

export const authOptions: NextAuthOptions = {
  // No adapter - use pure JWT with database callbacks
  providers: [
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
    signOut: "/logout", 
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
        } catch (error) {
          console.error("Error fetching user session:", error);
        }
      }
      return session;
    },
    async jwt({ token, user, account }) {
      // Add user info to token on first sign in
      if (user && account) {
        token.userType = user.userType;
        token.approvalStatus = user.approvalStatus;
        token.isActive = user.isActive;
        token.lastLogin = new Date().toISOString();
      }
      return token;
    },
    async redirect({ url, baseUrl }) {
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
  secret: process.env.NEXTAUTH_SECRET, // Remove fallback for security
  debug: process.env.NODE_ENV === "development",
  useSecureCookies: process.env.NODE_ENV === "production",
  url: "https://instacares.net",
};
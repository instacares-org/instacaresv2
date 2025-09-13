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
              approvalStatus: "PENDING", 
              isActive: true,
              lastLogin: new Date(),
            },
          });
          console.log("Created new OAuth user:", dbUser.email);
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
          console.log("Updated existing user:", dbUser.email);
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
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  session: {
    strategy: "jwt", // Use JWT instead of database sessions for better performance
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-key-for-production",
  debug: process.env.NODE_ENV === "development",
  url: "https://instacares.net",
};
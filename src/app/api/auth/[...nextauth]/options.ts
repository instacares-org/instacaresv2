import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/database";

// Custom adapter to handle required userType field
const customPrismaAdapter = {
  ...PrismaAdapter(prisma),
  async createUser(data: any) {
    // Add required fields that NextAuth doesn't provide
    const userData = {
      ...data,
      userType: "PARENT", // Default for OAuth users
      approvalStatus: "PENDING",
      isActive: true,
    };
    
    return await prisma.user.create({
      data: userData,
    });
  },
};

export const authOptions: NextAuthOptions = {
  adapter: customPrismaAdapter as any,
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
      
      // Custom adapter handles user creation with required fields
      // Just update lastLogin for existing users
      try {
        await prisma.user.update({
          where: { email: user.email },
          data: { lastLogin: new Date() },
        }).catch(() => {
          // User doesn't exist yet - adapter will create them
        });
        
        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
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
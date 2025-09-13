import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/database";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
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
      
      // With Prisma adapter enabled, it will handle user creation and account linking
      // We just need to ensure the user exists and allow the linking
      try {
        let dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (!dbUser) {
          // Create new user if doesn't exist
          dbUser = await prisma.user.create({
            data: {
              email: user.email,
              name: user.name || "OAuth User",
              emailVerified: new Date(),
              image: user.image,
              userType: "PARENT",
              approvalStatus: "PENDING",
              isActive: true,
            },
          });
        } else {
          // User exists - update their info from OAuth if needed
          await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              name: user.name || dbUser.name,
              image: user.image || dbUser.image,
              emailVerified: new Date(),
              lastLogin: new Date(),
            },
          });
        }

        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return true; // Allow OAuth to continue
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
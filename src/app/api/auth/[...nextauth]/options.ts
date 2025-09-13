import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/database";

export const authOptions: NextAuthOptions = {
  // adapter: PrismaAdapter(prisma) as any, // Temporarily disabled
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
      console.log("OAuth signIn callback:", { user, account: account?.provider, profile: !!profile });
      
      if (!user.email) {
        console.error("OAuth signIn failed: No user email");
        return false;
      }
      
      try {
        // Check if user already exists
        let dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (!dbUser) {
          // Create new user - simplified version
          console.log("Creating new OAuth user:", user.email);
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
          console.log("Created user with ID:", dbUser.id);
        } else {
          console.log("Found existing user:", dbUser.id);
        }

        console.log("OAuth signIn successful for:", user.email);
        return true;
      } catch (error) {
        console.error("Error during OAuth sign in:", error);
        // Allow sign-in to continue even if database fails
        console.log("Allowing OAuth signIn despite database error");
        return true;
      }
    },
    async session({ session, user, token }) {
      console.log("OAuth session callback:", { email: session?.user?.email });
      
      // Temporarily bypass database operations to test OAuth flow
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
  debug: true, // Enable debug temporarily
  url: "https://instacares.net",
};
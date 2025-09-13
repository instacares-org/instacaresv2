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
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: "openid email profile" // Only request basic scopes
        }
      }
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
          // Create new user with profile
          dbUser = await prisma.user.create({
            data: {
              email: user.email,
              name: user.name || profile?.name || "Unknown",
              emailVerified: new Date(),
              image: user.image || profile?.picture || profile?.image,
              userType: "PARENT", // Default to parent
              approvalStatus: "PENDING", // Require admin approval for OAuth users too
              isActive: true,
              profile: {
                create: {
                  firstName: user.name?.split(' ')[0] || "Unknown",
                  lastName: user.name?.split(' ').slice(1).join(' ') || "",
                  avatar: user.image || profile?.picture || profile?.image,
                }
              }
            },
          });
        } else if (!dbUser.profile) {
          // Create profile if it doesn't exist
          await prisma.userProfile.create({
            data: {
              userId: dbUser.id,
              firstName: user.name?.split(' ')[0] || dbUser.name?.split(' ')[0] || "Unknown",
              lastName: user.name?.split(' ').slice(1).join(' ') || dbUser.name?.split(' ').slice(1).join(' ') || "",
              avatar: user.image || dbUser.image,
            }
          });
        }

        // Update last login
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { 
            lastLogin: new Date(),
            image: user.image || dbUser.image, // Update image if changed
          }
        });

        console.log("OAuth signIn successful for:", user.email);
        return true;
      } catch (error) {
        console.error("Error during OAuth sign in:", error);
        console.error("User data:", { email: user.email, name: user.name });
        return false;
      }
    },
    async session({ session, user, token }) {
      console.log("OAuth session callback:", { email: session?.user?.email });
      
      if (session?.user?.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: {
              id: true,
              userType: true,
              emailVerified: true,
              approvalStatus: true,
              isActive: true,
            },
          });

          if (dbUser) {
            session.user.id = dbUser.id;
            session.user.userType = dbUser.userType;
            session.user.emailVerified = dbUser.emailVerified;
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
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};
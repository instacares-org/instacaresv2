import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import { prisma } from './database';
import { UserType } from '@prisma/client';
import type { Adapter } from 'next-auth/adapters';

// Create a custom adapter that includes userType for new users
function customPrismaAdapter(): Adapter {
  const baseAdapter = PrismaAdapter(prisma);
  
  // Store original createUser method
  const originalCreateUser = baseAdapter.createUser;
  
  console.log('🔧 Initializing custom adapter with base adapter:', {
    hasCreateUser: !!originalCreateUser,
    baseAdapterKeys: Object.keys(baseAdapter || {})
  });
  
  // Create our custom createUser function
  const customCreateUser = async (user: any) => {
    console.log('🎯 Custom adapter createUser called with:', JSON.stringify(user, null, 2));
    
    try {
      // Create user with required fields for our schema
      const newUser = await prisma.user.create({
        data: {
          name: user.name || null,
          email: user.email,
          image: user.image || null,
          emailVerified: user.emailVerified || null,
          userType: 'PARENT', // Default to PARENT for OAuth users
          approvalStatus: 'APPROVED', // Auto-approve OAuth users
          isActive: true, // FIXED: Explicitly set isActive to true for OAuth users
        },
      });
      
      console.log('✅ Successfully created user with custom adapter:', {
        id: newUser.id,
        email: newUser.email,
        userType: newUser.userType,
        approvalStatus: newUser.approvalStatus,
        isActive: newUser.isActive
      });
      
      // Return user in the expected format for NextAuth
      return {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        image: newUser.image,
        emailVerified: newUser.emailVerified,
      };
    } catch (error) {
      console.error('❌ Error creating user in custom adapter:', error);
      throw error;
    }
  };

  // Create our custom adapter object
  const customAdapter = {
    ...baseAdapter,
    createUser: customCreateUser,
  };
  
  console.log('🔧 Custom adapter created with methods:', Object.keys(customAdapter));
  
  return customAdapter;
}

export const authOptions: NextAuthOptions = {
  adapter: customPrismaAdapter(),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
      }
      
      // Add user info to token on first sign in OR refresh from DB
      if (user) {
        // Find the user in our database to get their full info
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
          select: { 
            id: true, 
            userType: true, 
            approvalStatus: true,
            isActive: true  // FIXED: Add isActive to token
          }
        });
        
        if (dbUser) {
          token.userType = dbUser.userType;
          token.approvalStatus = dbUser.approvalStatus;
          token.userId = dbUser.id;
          token.isActive = dbUser.isActive;  // FIXED: Include isActive in JWT
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      if (token) {
        session.accessToken = token.accessToken;
        session.user.id = token.userId as string;
        session.user.userType = token.userType as UserType;
        session.user.approvalStatus = token.approvalStatus as string;
        session.user.isActive = token.isActive as boolean;  // FIXED: Include isActive in session
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // Always allow OAuth sign ins - OAuth users are auto-approved
      if (account?.provider === 'google' || account?.provider === 'facebook') {
        try {
          // Check if user already exists
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! }
          });
          
          // If user doesn't exist, the adapter will create them with approvalStatus: 'APPROVED' and isActive: true
          if (!existingUser) {
            console.log('New OAuth user will be created and auto-approved:', user.email);
            return true;
          }
          
          // For existing users, ensure they are approved and active (OAuth users should always be active)
          if (existingUser.approvalStatus !== 'APPROVED' || !existingUser.isActive) {
            console.log('Updating existing OAuth user status:', user.email);
            // Auto-approve and activate existing OAuth users
            await prisma.user.update({
              where: { email: user.email! },
              data: { 
                approvalStatus: 'APPROVED',
                isActive: true,  // FIXED: Ensure existing OAuth users are active
                // Ensure they have the correct user type if not set
                userType: existingUser.userType || 'PARENT'
              }
            });
          }
          
          console.log('OAuth user sign-in approved:', user.email);
          return true;
        } catch (error) {
          console.error('Error in OAuth signIn callback:', error);
          // Still allow sign-in even if there's an error with approval status update
          return true;
        }
      }
      
      return true;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
  },
  debug: process.env.NODE_ENV === 'development',
};

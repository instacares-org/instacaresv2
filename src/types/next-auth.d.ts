import { UserType, UserProfile, Caregiver } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      image?: string;
      userType: UserType;
      approvalStatus: string;
      isActive?: boolean;
      emailVerified?: boolean;
      profile?: UserProfile | null;
      caregiver?: Caregiver | null;
      needsProfileCompletion?: boolean;
      lastLogin?: string;
      createdAt?: string;
      isBabysitter?: boolean;
      // Dual role support
      isParent?: boolean;
      isCaregiver?: boolean;
      activeRole?: UserType;
    };
    accessToken?: string;
  }

  interface User {
    id: string;
    email: string;
    name?: string;
    image?: string;
    userType?: UserType;
    approvalStatus?: string;
    isActive?: boolean;
    profile?: UserProfile | null;
    caregiver?: Caregiver | null;
    // Dual role support
    isParent?: boolean;
    isCaregiver?: boolean;
    activeRole?: UserType;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    userId?: string;
    userType?: UserType;
    approvalStatus?: string;
    isActive?: boolean;
    profile?: UserProfile | null;
    caregiver?: Caregiver | null;
    lastLogin?: string;
    needsProfileCompletion?: boolean;
    // Dual role support
    isParent?: boolean;
    isCaregiver?: boolean;
    activeRole?: UserType;
  }
}
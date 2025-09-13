import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      googleClientId: process.env.GOOGLE_CLIENT_ID?.substring(0, 15) + "...",
      nextAuthUrl: process.env.NEXTAUTH_URL || "not set",
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to get config" }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { verifyAdminAuth } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  try {
    // Get NextAuth session
    const session = await getServerSession(authOptions);

    // Test admin auth
    const adminAuth = await verifyAdminAuth(request);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      nextAuthSession: session ? {
        user: session.user,
        expires: session.expires
      } : null,
      adminAuth: adminAuth,
      headers: Object.fromEntries(request.headers.entries()),
      cookies: request.cookies.getAll()
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Test endpoint failed',
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
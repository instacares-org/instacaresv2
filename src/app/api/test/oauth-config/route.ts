import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const nextAuthSecret = process.env.NEXTAUTH_SECRET;
    const nextAuthUrl = process.env.NEXTAUTH_URL;
    
    return NextResponse.json({
      success: true,
      oauth_config: {
        google: {
          hasClientId: !!googleClientId,
          hasClientSecret: !!googleClientSecret,
          clientIdPreview: googleClientId ? `${googleClientId.substring(0, 20)}...` : 'NOT SET',
          clientSecretPreview: googleClientSecret ? `${googleClientSecret.substring(0, 10)}...` : 'NOT SET',
        },
        nextauth: {
          hasSecret: !!nextAuthSecret,
          hasUrl: !!nextAuthUrl,
          url: nextAuthUrl || 'NOT SET',
          secretPreview: nextAuthSecret ? `${nextAuthSecret.substring(0, 10)}...` : 'NOT SET',
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
        }
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to check OAuth configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { generateCSRFToken, setCSRFToken } from '@/lib/csrf';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export async function GET(request: NextRequest) {
  try {
    // Extract user ID if authenticated (for session-specific tokens)
    const session = await getServerSession(authOptions);
    const sessionId = session?.user?.id || undefined;
    
    // Generate a new CSRF token
    const csrfToken = generateCSRFToken(sessionId);
    
    // Create response
    const response = NextResponse.json({
      success: true,
      token: csrfToken,
    });
    
    // Set the CSRF token in cookies
    setCSRFToken(response, csrfToken, sessionId);
    
    return response;
    
  } catch (error) {
    console.error('Error generating CSRF token:', error);
    
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}

// Also allow POST for consistency with some frameworks
export const POST = GET;
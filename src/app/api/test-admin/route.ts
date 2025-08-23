import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key');
    const expectedKey = process.env.ADMIN_SECRET_KEY || 'demo-admin-key-2024';
    
    if (adminKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Invalid admin key' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    return NextResponse.json({
      message: 'Admin endpoint works!',
      receivedData: body,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    return NextResponse.json(
      { error: `Test endpoint error: ${error.message}` },
      { status: 500 }
    );
  }
}
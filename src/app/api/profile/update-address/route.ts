import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { geocodeAddress, validateCanadianCoordinates } from '@/lib/geocoding';



export async function PATCH(request: NextRequest) {
  try {
    // Get the authorization token from cookies
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify the token
    let userId: string;
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
      }
      const decoded = jwt.verify(token, secret) as { userId: string };
      userId = decoded.userId;
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Parse the request body
    const { streetAddress, apartment, city, state, zipCode, country } = await request.json();

    // Validate required fields
    if (!city || !state) {
      return NextResponse.json({ 
        error: 'City and state/province are required' 
      }, { status: 400 });
    }

    // Precise geocoding for exact street addresses
    let latitude: number | null = null;
    let longitude: number | null = null;
    let geocodingAccuracy: string = 'none';
    
    // Try to geocode the full address using our precise geocoding service
    try {
      console.log(`🗺️ Attempting precise geocoding for address...`);
      const geocodeResult = await geocodeAddress({
        streetAddress,
        city,
        state,
        zipCode,
        country: country || 'Canada'
      });
      
      if (geocodeResult) {
        // Validate coordinates are reasonable for Canada
        if (validateCanadianCoordinates(geocodeResult.latitude, geocodeResult.longitude)) {
          latitude = geocodeResult.latitude;
          longitude = geocodeResult.longitude;
          geocodingAccuracy = geocodeResult.accuracy || 'unknown';
          console.log(`✅ Precise geocoding successful: ${latitude}, ${longitude} (accuracy: ${geocodingAccuracy})`);
        } else {
          console.log(`❌ Geocoding returned invalid coordinates for Canada: ${geocodeResult.latitude}, ${geocodeResult.longitude}`);
        }
      } else {
        console.log(`⚠️ Could not geocode address: ${streetAddress}, ${city}, ${state}`);
      }
    } catch (error) {
      console.error(`❌ Geocoding error:`, error);
    }

    // Update or create the user profile with address information and coordinates
    const updatedProfile = await db.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        firstName: '', // These will be filled by other profile updates
        lastName: '',
        streetAddress,
        apartment,
        city,
        state,
        zipCode,
        country: country || 'US',
        latitude,
        longitude,
      },
      update: {
        streetAddress,
        apartment,
        city,
        state,
        zipCode,
        country: country || 'US',
        latitude,
        longitude,
      },
    });

    return NextResponse.json({
      success: true,
      profile: {
        streetAddress: updatedProfile.streetAddress,
        apartment: updatedProfile.apartment,
        city: updatedProfile.city,
        state: updatedProfile.state,
        zipCode: updatedProfile.zipCode,
        country: updatedProfile.country,
        latitude: updatedProfile.latitude,
        longitude: updatedProfile.longitude,
      },
      geocoding: {
        accuracy: geocodingAccuracy,
        coordinates: latitude && longitude ? { lat: latitude, lng: longitude } : null
      }
    });

  } catch (error) {
    console.error('Error updating address:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await db.$disconnect();
  }
}
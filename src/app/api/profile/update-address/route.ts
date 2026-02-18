import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { geocodeAddress, validateCanadianCoordinates } from '@/lib/geocoding';
import { UpdateAddressSchema, validateRequest } from '@/lib/api-validation';
import { getTimezoneFromLocation } from '@/lib/timezone';

export async function PATCH(request: NextRequest) {
  try {
    // Verify authentication using NextAuth
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Parse the request body
    const requestBody = await request.json();

    // Validate input using Zod schema
    const validation = validateRequest(UpdateAddressSchema, requestBody);

    if (!validation.success) {
      console.error('[SECURITY] Address update validation failed:', {
        userId,
        errors: validation.errors,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      });

      return NextResponse.json(
        {
          error: 'Invalid address data',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    const { streetAddress, apartment, city, state, zipCode, country, phone } = validation.data;

    // Precise geocoding for exact street addresses
    let latitude: number | null = null;
    let longitude: number | null = null;
    let geocodingAccuracy: string = 'none';

    // Try to geocode the full address using our precise geocoding service
    try {
      console.log(`🗺️ Attempting precise geocoding for address...`);
      const geocodeResult = await geocodeAddress({
        street: streetAddress,
        apartment: apartment,
        city: city,
        province: state,
        postalCode: zipCode,
        country: country || 'Canada'
      });

      if (geocodeResult) {
        // Validate coordinates are reasonable for Canada
        if (validateCanadianCoordinates(geocodeResult.lat, geocodeResult.lng)) {
          latitude = geocodeResult.lat;
          longitude = geocodeResult.lng;
          geocodingAccuracy = (geocodeResult as any).accuracy || 'unknown';
          console.log(`✅ Precise geocoding successful: ${latitude}, ${longitude} (accuracy: ${geocodingAccuracy})`);
        } else {
          console.log(`❌ Geocoding returned invalid coordinates for Canada: ${geocodeResult.lat}, ${geocodeResult.lng}`);
        }
      } else {
        console.log(`⚠️ Could not geocode address: ${streetAddress}, ${city}, ${state}`);
      }
    } catch (error) {
      console.error(`❌ Geocoding error:`, error);
    }

    // Calculate timezone from country and province/state
    const countryCode = country === 'Canada' ? 'CA' : (country === 'US' || country === 'United States' ? 'US' : country || 'CA');
    const userTimezone = getTimezoneFromLocation(countryCode, state);
    console.log(`🕐 Calculated timezone for ${state}, ${countryCode}: ${userTimezone}`);

    // Update or create the user profile with address information, phone, coordinates, and timezone
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
        phone,
        latitude,
        longitude,
        timezone: userTimezone,
      },
      update: {
        streetAddress,
        apartment,
        city,
        state,
        zipCode,
        country: country || 'US',
        ...(phone !== undefined && { phone }), // Only update phone if provided
        latitude,
        longitude,
        timezone: userTimezone,
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
        phone: updatedProfile.phone,
        latitude: updatedProfile.latitude,
        longitude: updatedProfile.longitude,
        timezone: updatedProfile.timezone,
      },
      geocoding: {
        accuracy: geocodingAccuracy,
        coordinates: latitude && longitude ? { lat: latitude, lng: longitude } : null
      }
    });

  } catch (error) {
    console.error('Error updating address:', error);
    // Log more details for debugging
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
}
}

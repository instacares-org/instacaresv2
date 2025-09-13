import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { registrationSchema, sanitizeString, normalizePhoneNumber, checkRateLimit } from '@/lib/validation';
import { logger, getClientInfo } from '@/lib/logger';
import { prisma, withTransaction } from '@/lib/database';
import { geocodeAddress } from '@/lib/geocoding';

export async function POST(request: NextRequest) {
  const clientInfo = getClientInfo(request);
  const startTime = Date.now();
  let requestBody: any = null;

  try {
    // Rate limiting check
    const rateLimitResult = checkRateLimit(clientInfo.ip, 3, 15 * 60 * 1000); // 3 attempts per 15 minutes
    if (!rateLimitResult.success) {
      logger.security('Registration rate limit exceeded', { 
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        error: rateLimitResult.error
      });
      
      return NextResponse.json(
        { error: rateLimitResult.error },
        { 
          status: 429,
          headers: {
            'Retry-After': '900', // 15 minutes in seconds
            'X-RateLimit-Limit': '3',
            'X-RateLimit-Remaining': rateLimitResult.remaining?.toString() || '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime?.toString() || '0'
          }
        }
      );
    }

    // Parse and validate request body
    try {
      requestBody = await request.json();
    } catch (error) {
      logger.warn('Invalid JSON in registration request', { ip: clientInfo.ip });
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    // Validate input using Zod schema
    const validationResult = registrationSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.reduce((acc, issue) => {
        acc[issue.path[0]] = issue.message;
        return acc;
      }, {} as Record<string, string>);

      logger.info('Registration validation failed', { 
        errors, 
        ip: clientInfo.ip,
        email: requestBody.email 
      });

      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      userType,
      agreeToTerms,
      streetAddress,
      apartment,
      city,
      province,
      postalCode
    } = validationResult.data;

    // Sanitize inputs
    const sanitizedFirstName = sanitizeString(firstName);
    const sanitizedLastName = sanitizeString(lastName);
    const normalizedPhone = normalizePhoneNumber(phone);

    // Convert userType to correct format
    const mappedUserType = userType === 'provider' ? 'CAREGIVER' : 'PARENT';

    // Check if user already exists (case-insensitive)
    const existingUser = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase()
      }
    });

    if (existingUser) {
      logger.warn('Registration attempt with existing email', { 
        email: email,
        ip: clientInfo.ip 
      });
      
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password with higher cost for production security
    const saltRounds = process.env.NODE_ENV === 'production' ? 12 : 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Prepare profile data with address if provided
    const profileData: any = {
      firstName: sanitizedFirstName,
      lastName: sanitizedLastName,
      phone: normalizedPhone,
    };

    // Add address fields if provided during signup
    if (streetAddress) profileData.streetAddress = sanitizeString(streetAddress);
    if (apartment) profileData.apartment = sanitizeString(apartment);
    if (city) profileData.city = sanitizeString(city);
    if (province) profileData.state = sanitizeString(province); // Map province to state field
    if (postalCode) profileData.zipCode = sanitizeString(postalCode);
    
    // Set country to Canada since we're focusing on Canadian addresses
    if (streetAddress || city || province || postalCode) {
      profileData.country = 'Canada';
      
      // Try to geocode the address to get coordinates
      try {
        const fullAddress = `${streetAddress || ''} ${city || ''} ${province || ''} ${postalCode || ''}`.trim();
        if (fullAddress.length > 5) { // Only geocode if we have meaningful address data
          const geocodeResult = await geocodeAddress(fullAddress);
          if (geocodeResult && geocodeResult.latitude && geocodeResult.longitude) {
            profileData.latitude = geocodeResult.latitude;
            profileData.longitude = geocodeResult.longitude;
            console.log(`📍 Geocoded address for ${email}: ${geocodeResult.latitude}, ${geocodeResult.longitude}`);
          }
        }
      } catch (geocodeError) {
        // Don't fail registration if geocoding fails
        console.warn('Failed to geocode address during registration:', geocodeError);
      }
    }

    // Create user with PENDING approval status
    const result = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        userType: mappedUserType,
        approvalStatus: 'PENDING', // New users require approval
        emailVerified: null, // Use null instead of false for DateTime field
        profile: {
          create: profileData
        }
      },
      include: {
        profile: true
      }
    });

    // Create notification for the user (separate from transaction for now)
    try {
      await prisma.notification.create({
        data: {
          userId: result.id,
          type: 'account_pending',
          title: 'Account pending approval',
          message: 'Your account has been created and is pending admin approval. You will be notified once approved.',
        }
      });
    } catch (notificationError) {
      logger.warn('Failed to create notification', { userId: result.id });
    }

    // Log successful registration (without sensitive data)
    logger.info('User registration successful', {
      userId: result.id,
      email: email,
      userType: mappedUserType,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      processingTime: Date.now() - startTime
    });

    // Return success response (never include password hash)
    return NextResponse.json({
      success: true,
      message: 'Account created successfully. Your account is pending approval.',
      user: {
        id: result.id,
        email: result.email,
        userType: result.userType,
        approvalStatus: result.approvalStatus,
        profile: {
          firstName: result.profile?.firstName,
          lastName: result.profile?.lastName,
          phone: result.profile?.phone,
          streetAddress: result.profile?.streetAddress,
          apartment: result.profile?.apartment,
          city: result.profile?.city,
          state: result.profile?.state,
          zipCode: result.profile?.zipCode,
          country: result.profile?.country,
          latitude: result.profile?.latitude,
          longitude: result.profile?.longitude
        }
      }
    }, {
      status: 201,
      headers: {
        'X-RateLimit-Remaining': rateLimitResult.remaining?.toString() || '2'
      }
    });

  } catch (error: any) {
    // Handle specific known errors - USER_EXISTS is now handled above
    // No need for this specific handling anymore

    // Log unexpected errors with full context
    logger.error('Registration failed', error, {
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      email: requestBody?.email,
      processingTime: Date.now() - startTime
    });

    // Generic error response (don't expose internal details)
    return NextResponse.json(
      { error: 'Unable to create account. Please try again later.' },
      { status: 500 }
    );
  }
}
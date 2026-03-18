import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { registrationSchema, sanitizeString, normalizePhoneNumber, checkRateLimit } from '@/lib/validation';
import { logger, getClientInfo } from '@/lib/logger';
import { prisma, withTransaction } from '@/lib/db';
import { geocodeAddress } from '@/lib/geocoding';
import { getTimezoneFromLocation } from '@/lib/timezone';
import { validateFileUpload, generateSecureFilename } from '@/lib/file-upload-validation';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { emailService } from '@/lib/notifications/email.service';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const clientInfo = getClientInfo(request);
  const startTime = Date.now();
  let requestBody: any = null;

  try {
    // Rate limiting check
    const rateLimitResult = await checkRateLimit(clientInfo.ip, 3, 15 * 60 * 1000); // 3 attempts per 15 minutes
    if (!rateLimitResult.success) {
      logger.security('Registration rate limit exceeded', {
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        error: rateLimitResult.error
      });

      return NextResponse.json(
        { success: false, error: rateLimitResult.error },
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

    // Parse request body - handle both JSON and FormData
    let avatarFile: File | null = null;
    const contentType = request.headers.get('content-type') || '';

    try {
      if (contentType.includes('multipart/form-data')) {
        // Handle FormData (with possible avatar file)
        const formData = await request.formData();
        requestBody = {};

        // Extract all form fields
        for (const [key, value] of formData.entries()) {
          if (key === 'avatar' && value instanceof File) {
            avatarFile = value;
          } else {
            // Convert string booleans to actual booleans
            if (value === 'true') {
              requestBody[key] = true;
            } else if (value === 'false') {
              requestBody[key] = false;
            } else {
              requestBody[key] = value;
            }
          }
        }
      } else {
        // Handle JSON (legacy support)
        requestBody = await request.json();
      }
    } catch (error) {
      logger.warn('Invalid request format', { ip: clientInfo.ip });
      return ApiErrors.badRequest('Invalid request format');
    }

    // Validate input using Zod schema
    const validationResult = registrationSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.reduce((acc, issue) => {
        const key = String(issue.path[0]);
        acc[key] = issue.message;
        return acc;
      }, {} as Record<string, string>);

      // Log validation errors only (no request body — may contain passwords)
      console.log('Registration validation failed:', {
        validationErrors: errors,
      });

      logger.info('Registration validation failed', {
        errors,
        ip: clientInfo.ip,
        receivedFields: Object.keys(requestBody || {}),
        missingFields: ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'phone', 'userType', 'agreeToTerms']
          .filter(field => !requestBody?.[field])
      });

      return ApiErrors.badRequest('Validation failed', errors);
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
      postalCode,
    } = validationResult.data;

    // Sanitize inputs
    const sanitizedFirstName = sanitizeString(firstName);
    const sanitizedLastName = sanitizeString(lastName);
    const normalizedPhone = normalizePhoneNumber(phone);

    // Convert userType to correct format
    // Babysitters are categorized as CAREGIVER type with isBabysitter flag
    const mappedUserType = userType === 'provider' ? 'CAREGIVER' : userType === 'babysitter' ? 'CAREGIVER' : 'PARENT';
    const isBabysitter = userType === 'babysitter';

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

      return ApiErrors.conflict('An account with this email already exists');
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

    // Handle avatar upload if provided
    if (avatarFile) {
      try {
        // Validate the avatar file
        const validation = await validateFileUpload(avatarFile, {
          allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
          maxSizeBytes: 50 * 1024 * 1024, // 50MB - modern phone photos can be very large
          checkMagicBytes: true
        });

        if (!validation.valid) {
          logger.warn('Invalid avatar file during registration', {
            email: email,
            error: validation.error
          });
          // Don't fail registration, just skip avatar
        } else {
          // Create a temporary user ID for filename (we'll use email hash)
          const tempUserId = Buffer.from(email).toString('base64').substring(0, 10);
          const filename = generateSecureFilename(avatarFile.name, tempUserId, 'avatar');

          // Ensure upload directory exists
          const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
          await mkdir(uploadDir, { recursive: true });

          // Process image: crop to square and resize with sharp
          const bytes = await avatarFile.arrayBuffer();
          const inputBuffer = Buffer.from(bytes);

          const metadata = await sharp(inputBuffer).metadata();
          const { width: imgW = 0, height: imgH = 0 } = metadata;

          const size = Math.min(imgW, imgH);
          const left = Math.floor((imgW - size) / 2);
          const top = Math.floor((imgH - size) / 2);

          const processedBuffer = await sharp(inputBuffer)
            .extract({ left, top, width: size, height: size })
            .resize(512, 512, { fit: 'cover', position: 'center' })
            .jpeg({ quality: 85 })
            .toBuffer();

          // Save processed file (change extension to .jpg)
          const jpgFilename = filename.replace(/\.[^.]+$/, '.jpg');
          const filePath = path.join(uploadDir, jpgFilename);
          await writeFile(filePath, processedBuffer);

          // Add avatar URL to profile data
          profileData.avatar = `/uploads/avatars/${jpgFilename}`;

          logger.info('Avatar uploaded during registration', {
            email: email,
            filename: jpgFilename,
            originalSize: avatarFile.size,
            processedSize: processedBuffer.length,
          });
        }
      } catch (avatarError) {
        logger.error('Failed to upload avatar during registration', {
          email: email,
          error: avatarError
        });
        // Don't fail registration if avatar upload fails
      }
    }

    // Add address fields if provided during signup
    if (streetAddress) profileData.streetAddress = sanitizeString(streetAddress);
    if (apartment) profileData.apartment = sanitizeString(apartment);
    if (city) profileData.city = sanitizeString(city);
    if (province) profileData.state = sanitizeString(province); // Map province to state field
    if (postalCode) profileData.zipCode = sanitizeString(postalCode);

    // Set country to Canada since we're focusing on Canadian addresses
    if (streetAddress || city || province || postalCode) {
      let formCountry = 'CA'; // Default to Canada for Canadian platform
      // Convert full country name to ISO code
      if (formCountry.toLowerCase() === 'canada') formCountry = 'CA';
      if (formCountry.toLowerCase() === 'united states') formCountry = 'US';
      profileData.country = formCountry;

      // Determine timezone based on province
      if (province) {
        const detectedTimezone = getTimezoneFromLocation('CA', province);
        profileData.timezone = detectedTimezone;
        profileData.detectedTimezone = detectedTimezone;
        profileData.timezoneConfirmed = true; // Auto-confirm based on address
      }

      // Try to geocode the address to get coordinates
      try {
        // Include apartment/unit number for maximum precision
        const fullAddress = `${streetAddress || ''} ${apartment || ''} ${city || ''} ${province || ''} ${postalCode || ''}`.trim();
        if (fullAddress.length > 5) { // Only geocode if we have meaningful address data
          const geocodeResult = await geocodeAddress(fullAddress);
          if (geocodeResult && geocodeResult.lat && geocodeResult.lng) {
            profileData.latitude = geocodeResult.lat;
            profileData.longitude = geocodeResult.lng;
            console.log("Geocoded address successfully", { lat: geocodeResult.lat, lng: geocodeResult.lng });
          }
        }
      } catch (geocodeError) {
        // Don't fail registration if geocoding fails
        console.warn('Failed to geocode address during registration:', geocodeError);
      }
    }

    // Check platform settings for auto-approval
    let shouldAutoApprove = false;
    try {
      const platformSettings = await prisma.platformSettings.findFirst();
      if (platformSettings) {
        if (mappedUserType === 'PARENT' && platformSettings.autoApproveParents) {
          shouldAutoApprove = true;
          logger.info('Auto-approving parent registration based on platform settings', { email });
        } else if (mappedUserType === 'CAREGIVER' && platformSettings.autoApproveCaregivers) {
          shouldAutoApprove = true;
          logger.info('Auto-approving caregiver registration based on platform settings', { email });
        }
      }
    } catch (settingsError) {
      logger.warn('Failed to fetch platform settings for auto-approval check', { error: settingsError });
      // Default to PENDING if we can't fetch settings
    }

    // Create user with appropriate approval status based on admin settings
    const result = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        userType: mappedUserType,
        activeRole: mappedUserType,
        isParent: mappedUserType === 'PARENT',
        isCaregiver: mappedUserType === 'CAREGIVER',
        isBabysitter: isBabysitter,
        approvalStatus: shouldAutoApprove ? 'APPROVED' : 'PENDING', // Auto-approve based on admin settings
        emailVerified: null, // Use null instead of false for DateTime field
        profile: {
          create: profileData
        }
      },
      include: {
        profile: true
      }
    });

    // Create caregiver profile if userType is CAREGIVER
    if (mappedUserType === 'CAREGIVER') {
      try {
        const caregiver = await prisma.caregiver.create({
          data: {
            userId: result.id,
            hourlyRate: 0, // Will be set later by caregiver
            experienceYears: 0, // Will be set later
          }
        });

        // Create caregiver verification record
        await prisma.caregiverVerification.create({
          data: {
            caregiverId: caregiver.id,
            idVerificationStatus: 'PENDING',
            backgroundCheckStatus: 'PENDING',
            insuranceStatus: 'PENDING',
            referencesStatus: 'PENDING',
          }
        });

        logger.info('Caregiver profile created during registration', { userId: result.id, caregiverId: caregiver.id });
      } catch (caregiverError) {
        logger.error('Failed to create caregiver profile', { userId: result.id, error: caregiverError });
        // Don't fail the entire registration, admin can create it later
      }
    }

    // Create babysitter profile if userType is babysitter
    if (isBabysitter) {
      try {
        // Parse babysitter data from request
        const babysitterDataStr = requestBody.babysitterData;
        const babysitterInfo = babysitterDataStr ? JSON.parse(babysitterDataStr) : {};

        // Update user to mark as babysitter
        await prisma.user.update({
          where: { id: result.id },
          data: { isBabysitter: true }
        });

        // Create babysitter profile with initial data
        const babysitter = await prisma.babysitter.create({
          data: {
            userId: result.id,
            bio: babysitterInfo.bio || '',
            experienceYears: babysitterInfo.experienceYears || 0,
            hourlyRate: babysitterInfo.hourlyRate || 20,
            status: 'PENDING_VERIFICATION',
            phoneVerified: false,
            emailVerified: false,
          }
        });

        logger.info('Babysitter profile created during registration', { userId: result.id, babysitterId: babysitter.id });
      } catch (babysitterError) {
        logger.error('Failed to create babysitter profile', { userId: result.id, error: babysitterError });
        // Don't fail the entire registration
      }
    }

    // Create notification for the user (separate from transaction for now)
    try {
      if (shouldAutoApprove) {
        await prisma.notification.create({
          data: {
            userId: result.id,
            type: 'account_approved',
            title: 'Account approved',
            message: 'Welcome! Your account has been created and approved. You can now log in and start using the platform.',
          }
        });
      } else {
        await prisma.notification.create({
          data: {
            userId: result.id,
            type: 'account_pending',
            title: 'Account pending approval',
            message: 'Your account has been created and is pending admin approval. You will be notified once approved.',
          }
        });
      }
    } catch (notificationError) {
      logger.warn('Failed to create notification', { userId: result.id });
    }

    // Send welcome email to the new user
    try {
      await emailService.sendWelcomeEmail(email.toLowerCase(), {
        firstName: sanitizedFirstName,
        lastName: sanitizedLastName,
        userType: mappedUserType as 'PARENT' | 'CAREGIVER',
      });
      logger.info('Welcome email sent', { userId: result.id, email: email });
    } catch (emailError) {
      // Don't fail registration if email fails
      logger.warn('Failed to send welcome email', { userId: result.id, error: emailError });
    }

    // Log successful registration (without sensitive data)
    logger.info('User registration successful', {
      userId: result.id,
      email: email,
      userType: mappedUserType,
      approvalStatus: shouldAutoApprove ? 'APPROVED' : 'PENDING',
      autoApproved: shouldAutoApprove,
      hasAvatar: !!profileData.avatar,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      processingTime: Date.now() - startTime
    });

    // Return success response (never include password hash)
    const successMessage = shouldAutoApprove
      ? 'Account created successfully. You can now log in.'
      : 'Account created successfully. Your account is pending approval.';

    return apiSuccess({
      user: {
        id: result.id,
        email: result.email,
        userType: result.userType,
        approvalStatus: result.approvalStatus,
        profile: {
          firstName: result.profile?.firstName,
          lastName: result.profile?.lastName,
          phone: result.profile?.phone,
          avatar: result.profile?.avatar,
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
    }, successMessage, 201);

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
    return ApiErrors.internal('Unable to create account. Please try again later.');
  }
}

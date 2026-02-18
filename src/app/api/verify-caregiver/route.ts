import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { logAuditEvent } from '@/lib/audit-log';

// API endpoint to verify caregiver accounts (ADMIN ONLY)
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Admin authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({
        error: 'Email is required'
      }, { status: 400 });
    }

    const { db } = await import('@/lib/db');

    // Find the user by email
    const user = await db.user.findUnique({
      where: { email },
      include: {
        caregiver: true,
        profile: true
      }
    });

    if (!user) {
      return NextResponse.json({
        error: 'User not found'
      }, { status: 404 });
    }

    if (!user.caregiver) {
      return NextResponse.json({
        error: 'User is not a caregiver'
      }, { status: 400 });
    }

    if (user.caregiver.isVerified) {
      return NextResponse.json({
        success: true,
        message: 'Caregiver is already verified',
        caregiver: {
          email: user.email,
          name: `${user.profile?.firstName} ${user.profile?.lastName}`,
          isVerified: user.caregiver.isVerified
        }
      });
    }

    // Update caregiver to verified status AND approve user
    const updatedCaregiver = await db.caregiver.update({
      where: { userId: user.id },
      data: { isVerified: true },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    // Also update user approval status to APPROVED
    await db.user.update({
      where: { id: user.id },
      data: { approvalStatus: "APPROVED" }
    });

    // Fix profile data if needed (country code and coordinates)
    const profile = user.profile;
    if (profile) {
      const updates: any = {};

      // Fix country code if its "Canada" instead of "CA"
      if (profile.country === "Canada" || profile.country === "canada") {
        updates.country = "CA";
      }

      // If missing coordinates, try to geocode or use default Toronto coords
      if (!profile.latitude || !profile.longitude) {
        // Default to Toronto coordinates if geocoding fails
        updates.latitude = 43.6532;
        updates.longitude = -79.3832;

        // Try to geocode if we have address info
        if (profile.city && profile.state) {
          try {
            const { geocodeAddress } = await import("@/lib/geocoding");
            const geocodeResult = await geocodeAddress({
              street: profile.streetAddress ?? undefined,
              apartment: profile.apartment ?? undefined,
              city: profile.city,
              province: profile.state,
              postalCode: profile.zipCode ?? undefined,
              country: updates.country || profile.country || "CA"
            });
            if (geocodeResult) {
              updates.latitude = geocodeResult.lat;
              updates.longitude = geocodeResult.lng;
            }
          } catch (err) {
            console.warn("Geocoding failed during verification, using default coords");
          }
        }
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        await db.userProfile.update({
          where: { userId: user.id },
          data: updates
        });
        console.log("Fixed profile data during verification:", updates);
      }
    }

    // Clear cache to refresh search results
    const { apiCache } = await import('@/lib/cache');
    apiCache.clear();
    console.log('Cache cleared after caregiver verification');

    // Log the admin action
    logAuditEvent({
      adminId: authResult.user.id,
      adminEmail: authResult.user.email,
      action: 'CAREGIVER_DETAILED_APPROVAL',
      resource: 'caregiver',
      resourceId: user.id,
      details: {
        caregiverEmail: email,
        caregiverName: `${user.profile?.firstName} ${user.profile?.lastName}`,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      message: 'Caregiver verified successfully',
      caregiver: {
        email: updatedCaregiver.user.email,
        name: `${updatedCaregiver.user.profile?.firstName} ${updatedCaregiver.user.profile?.lastName}`,
        isVerified: updatedCaregiver.isVerified,
        verifiedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Verify caregiver error:', error);
    return NextResponse.json({
      error: 'Failed to verify caregiver',
    }, { status: 500 });
  }
}

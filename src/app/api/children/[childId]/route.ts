import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { db } from '@/lib/db';
import { z } from 'zod';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';

const emergencyContactSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Contact name is required').max(200, 'Contact name too long').trim(),
  relationship: z.string().min(1, 'Relationship is required').max(100, 'Relationship too long').trim(),
  phone: z.string().min(7, 'Phone number must be at least 7 characters').max(20, 'Phone number too long').trim(),
  email: z.string().email('Invalid email').max(200, 'Email too long').optional().or(z.literal('')),
  canPickup: z.boolean().optional().default(false),
});

const updateChildSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100, 'First name too long').trim().optional(),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long').trim().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().max(50, 'Gender too long').optional(),
  allergies: z.any().optional(),
  medications: z.any().optional(),
  medicalConditions: z.any().optional(),
  emergencyMedicalInfo: z.string().max(1000, 'Emergency medical info too long').optional(),
  bloodType: z.string().max(10, 'Blood type too long').optional(),
  emergencyContacts: z.array(emergencyContactSchema).min(1, 'At least one emergency contact is required').optional(),
  dietaryRestrictions: z.any().optional(),
  specialInstructions: z.string().max(1000, 'Special instructions too long').optional(),
  pickupInstructions: z.string().max(1000, 'Pickup instructions too long').optional(),
  photoUrl: z.string().url('Invalid photo URL').max(500, 'Photo URL too long').optional(),
});

// DELETE /api/children/[childId] - Delete a specific child profile
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  try {
    // Verify parent authentication using withAuth middleware
    const authResult = await withAuth(request, 'PARENT', false);
    if (!authResult.isAuthorized) {
      console.error('Child DELETE - Auth failed');
      return authResult.response;
    }

    const parentUser = authResult.user!;
    const { childId } = await params;

    console.log('Child DELETE - Parent authenticated:', {
      userId: parentUser.id,
      email: parentUser.email,
      childId
    });

    // Verify child exists and belongs to the authenticated parent
    const child = await db.child.findFirst({
      where: {
        id: childId,
        parentId: parentUser.id
      }
    });

    if (!child) {
      return ApiErrors.notFound('Child profile not found or access denied');
    }

    // Check if child has any active bookings or check-ins
    const activeBookings = await db.booking.count({
      where: {
        parentId: parentUser.id,
        status: {
          in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS']
        }
      }
    });

    const activeCheckIns = await db.checkInOut.count({
      where: {
        childId: childId,
        status: {
          in: ['PENDING', 'CHECKED_IN']
        }
      }
    });

    if (activeBookings > 0 || activeCheckIns > 0) {
      return ApiErrors.badRequest('Cannot delete child profile with active bookings or check-ins. Please complete or cancel them first.');
    }

    // Delete the child profile
    await db.child.delete({
      where: { id: childId }
    });

    console.log('Child deleted:', { childId, deletedBy: parentUser.id });

    return apiSuccess(undefined, 'Child profile deleted successfully');

  } catch (error) {
    console.error('Error deleting child profile:', error);
    return ApiErrors.internal('Failed to delete child profile');
  }
}

// PUT /api/children/[childId] - Update a specific child profile
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  try {
    // Verify parent authentication using withAuth middleware
    const authResult = await withAuth(request, 'PARENT', false);
    if (!authResult.isAuthorized) {
      console.error('Child PUT - Auth failed');
      return authResult.response;
    }

    const parentUser = authResult.user!;
    const { childId } = await params;
    const body = await request.json();

    const parsed = updateChildSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }

    console.log('Child PUT - Parent authenticated:', {
      userId: parentUser.id,
      email: parentUser.email,
      childId,
      bodyKeys: Object.keys(parsed.data)
    });

    // Verify child exists and belongs to the authenticated parent
    const existingChild = await db.child.findFirst({
      where: {
        id: childId,
        parentId: parentUser.id
      }
    });

    if (!existingChild) {
      console.error('Child not found or access denied:', { childId, parentId: parentUser.id });
      return ApiErrors.notFound('Child profile not found or access denied');
    }

    const {
      firstName,
      lastName,
      dateOfBirth,
      gender,
      allergies,
      medications,
      medicalConditions,
      emergencyMedicalInfo,
      bloodType,
      emergencyContacts,
      dietaryRestrictions,
      specialInstructions,
      pickupInstructions,
      photoUrl
    } = parsed.data;

    // Update child profile
    const updatedChild = await db.child.update({
      where: { id: childId },
      data: {
        firstName: firstName || existingChild.firstName,
        lastName: lastName || existingChild.lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : existingChild.dateOfBirth,
        gender: gender !== undefined ? gender : existingChild.gender,
        allergies: allergies !== undefined ? allergies : existingChild.allergies,
        medications: medications !== undefined ? medications : existingChild.medications,
        medicalConditions: medicalConditions !== undefined ? medicalConditions : existingChild.medicalConditions,
        emergencyMedicalInfo: emergencyMedicalInfo !== undefined ? emergencyMedicalInfo : existingChild.emergencyMedicalInfo,
        bloodType: bloodType !== undefined ? bloodType : existingChild.bloodType,
        emergencyContacts: emergencyContacts !== undefined ? emergencyContacts : (existingChild.emergencyContacts ?? undefined),
        dietaryRestrictions: dietaryRestrictions !== undefined ? dietaryRestrictions : existingChild.dietaryRestrictions,
        specialInstructions: specialInstructions !== undefined ? specialInstructions : existingChild.specialInstructions,
        pickupInstructions: pickupInstructions !== undefined ? pickupInstructions : existingChild.pickupInstructions,
        photoUrl: photoUrl !== undefined ? photoUrl : existingChild.photoUrl,
      }
    });

    console.log('Child updated successfully:', { childId, updatedBy: parentUser.id });

    return apiSuccess(updatedChild, 'Child profile updated successfully');

  } catch (error) {
    console.error('Error updating child profile:', error);
    return ApiErrors.internal('Failed to update child profile');
  }
}

// GET /api/children/[childId] - Get a specific child profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  try {
    // Verify parent authentication using withAuth middleware
    const authResult = await withAuth(request, 'PARENT', false);
    if (!authResult.isAuthorized) {
      console.error('Child GET - Auth failed');
      return authResult.response;
    }

    const parentUser = authResult.user!;
    const { childId } = await params;

    console.log('Child GET - Parent authenticated:', {
      userId: parentUser.id,
      email: parentUser.email,
      childId
    });

    // Get child profile
    const child = await db.child.findFirst({
      where: {
        id: childId,
        parentId: parentUser.id
      }
    });

    if (!child) {
      return ApiErrors.notFound('Child profile not found or access denied');
    }

    return apiSuccess(child);

  } catch (error) {
    console.error('Error fetching child profile:', error);
    return ApiErrors.internal('Failed to fetch child profile');
  }
}

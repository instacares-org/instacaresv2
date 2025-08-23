import { NextRequest, NextResponse } from 'next/server';

// Debug endpoint to analyze caregiver data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'analyze';
    
    const { db } = await import('@/lib/db');
    
    // Get all caregivers with their profiles
    const caregivers = await db.caregiver.findMany({
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    // Analyze locations to identify US vs Canadian caregivers
    const analysis = caregivers.map(caregiver => ({
      id: caregiver.id,
      userId: caregiver.user.id,
      email: caregiver.user.email,
      name: `${caregiver.user.profile?.firstName || ''} ${caregiver.user.profile?.lastName || ''}`.trim(),
      city: caregiver.user.profile?.city,
      state: caregiver.user.profile?.state,
      country: caregiver.user.profile?.country,
      location: `${caregiver.user.profile?.city || ''}, ${caregiver.user.profile?.state || ''}`.trim(),
      isUSLocation: isUSLocation(caregiver.user.profile?.city, caregiver.user.profile?.state),
      createdAt: caregiver.createdAt,
      isVerified: caregiver.isVerified,
      totalBookings: caregiver.totalBookings,
    }));
    
    const usProfiles = analysis.filter(c => c.isUSLocation);
    const canadianProfiles = analysis.filter(c => !c.isUSLocation);
    
    if (action === 'cleanup') {
      // Delete US profiles and their associated data
      const userIdsToDelete = usProfiles.map(c => c.userId);
      const caregiverIdsToDelete = usProfiles.map(c => c.id);
      
      if (userIdsToDelete.length > 0) {
        console.log(`Deleting ${userIdsToDelete.length} US caregiver profiles...`);
        
        try {
          // Use a transaction to ensure all deletions succeed or fail together
          await db.$transaction(async (tx) => {
            // Delete in the most comprehensive order possible
            
            // 1. Delete all reviews where they are the reviewee or reviewer
            const reviews = await tx.review.deleteMany({
              where: {
                OR: [
                  { revieweeId: { in: userIdsToDelete } },
                  { reviewerId: { in: userIdsToDelete } }
                ]
              }
            });
            console.log(`Deleted ${reviews.count} reviews`);
            
            // 2. Delete all payments for bookings with these caregivers
            const payments = await tx.payment.deleteMany({
              where: {
                booking: {
                  OR: [
                    { caregiverId: { in: userIdsToDelete } },
                    { parentId: { in: userIdsToDelete } }
                  ]
                }
              }
            });
            console.log(`Deleted ${payments.count} payments`);
            
            // 3. Delete all bookings where they are involved (as caregiver or parent)
            const bookings = await tx.booking.deleteMany({
              where: {
                OR: [
                  { caregiverId: { in: userIdsToDelete } },
                  { parentId: { in: userIdsToDelete } }
                ]
              }
            });
            console.log(`Deleted ${bookings.count} bookings`);
            
            // 4. Delete all messages in rooms where they are involved
            const messages = await tx.message.deleteMany({
              where: {
                OR: [
                  { senderId: { in: userIdsToDelete } },
                  {
                    chatRoom: {
                      OR: [
                        { caregiverId: { in: userIdsToDelete } },
                        { parentId: { in: userIdsToDelete } }
                      ]
                    }
                  }
                ]
              }
            });
            console.log(`Deleted ${messages.count} messages`);
            
            // 5. Delete all chat rooms where they are involved
            const chatRooms = await tx.chatRoom.deleteMany({
              where: {
                OR: [
                  { caregiverId: { in: userIdsToDelete } },
                  { parentId: { in: userIdsToDelete } }
                ]
              }
            });
            console.log(`Deleted ${chatRooms.count} chat rooms`);
            
            // 6. Delete availability-related data (safely)
            try {
              const slotBookings = await tx.slotBooking.deleteMany({
                where: {
                  slot: {
                    caregiverId: { in: caregiverIdsToDelete }
                  }
                }
              });
              console.log(`Deleted ${slotBookings.count} slot bookings`);
            } catch (e) {
              console.log('No slotBooking table or access error:', e.message);
            }
            
            try {
              const reservations = await tx.bookingReservation.deleteMany({
                where: {
                  slot: {
                    caregiverId: { in: caregiverIdsToDelete }
                  }
                }
              });
              console.log(`Deleted ${reservations.count} booking reservations`);
            } catch (e) {
              console.log('No bookingReservation table or access error:', e.message);
            }
            
            try {
              const slots = await tx.availabilitySlot.deleteMany({
                where: { caregiverId: { in: caregiverIdsToDelete } }
              });
              console.log(`Deleted ${slots.count} availability slots`);
            } catch (e) {
              console.log('No availabilitySlot table or access error:', e.message);
            }
            
            // 7. Delete caregiver-specific data (safely)
            try {
              const photos = await tx.caregiverPhoto.deleteMany({
                where: { caregiverId: { in: caregiverIdsToDelete } }
              });
              console.log(`Deleted ${photos.count} caregiver photos`);
            } catch (e) {
              console.log('No caregiverPhoto table or access error:', e.message);
            }
            
            try {
              const services = await tx.caregiverService.deleteMany({
                where: { caregiverId: { in: caregiverIdsToDelete } }
              });
              console.log(`Deleted ${services.count} caregiver services`);
            } catch (e) {
              console.log('No caregiverService table or access error:', e.message);
            }
            
            // 8. Delete children profiles (if they are parents) - safely
            try {
              const children = await tx.child.deleteMany({
                where: { parentId: { in: userIdsToDelete } }
              });
              console.log(`Deleted ${children.count} children profiles`);
            } catch (e) {
              console.log('No child table or access error:', e.message);
            }
            
            // 9. Delete caregiver records
            const caregivers = await tx.caregiver.deleteMany({
              where: { userId: { in: userIdsToDelete } }
            });
            console.log(`Deleted ${caregivers.count} caregiver records`);
            
            // 10. Delete user profiles
            const profiles = await tx.userProfile.deleteMany({
              where: { userId: { in: userIdsToDelete } }
            });
            console.log(`Deleted ${profiles.count} user profiles`);
            
            // 11. Finally delete user records
            const users = await tx.user.deleteMany({
              where: { id: { in: userIdsToDelete } }
            });
            console.log(`Deleted ${users.count} user records`);
          });
          
        } catch (deleteError) {
          console.error('Error during deletion:', deleteError);
          throw deleteError;
        }
        
        // Clear cache
        const { apiCache } = await import('@/lib/cache');
        apiCache.clear();
        console.log('Cache cleared after caregiver cleanup');
        
        return NextResponse.json({
          success: true,
          message: 'US caregiver profiles deleted successfully',
          deletedProfiles: usProfiles.length,
          deletedUsers: userIdsToDelete,
          remainingProfiles: canadianProfiles.length
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      totalCaregivers: caregivers.length,
      usProfiles: usProfiles.length,
      canadianProfiles: canadianProfiles.length,
      usLocations: usProfiles,
      canadianLocations: canadianProfiles,
      analysis: {
        usProfiles: usProfiles.map(p => ({
          name: p.name,
          email: p.email,
          location: p.location,
          createdAt: p.createdAt
        })),
        canadianProfiles: canadianProfiles.map(p => ({
          name: p.name,
          email: p.email,
          location: p.location,
          createdAt: p.createdAt
        }))
      }
    });
    
  } catch (error) {
    console.error('Debug caregivers error:', error);
    return NextResponse.json({ 
      error: 'Failed to debug caregivers',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function isUSLocation(city?: string | null, state?: string | null): boolean {
  if (!city && !state) return false;
  
  const usLocations = [
    'queens', 'manhattan', 'bronx', 'brooklyn', 'staten island',
    'new york', 'ny', 'california', 'ca', 'texas', 'tx', 'florida', 'fl',
    'illinois', 'il', 'pennsylvania', 'pa', 'ohio', 'oh', 'georgia', 'ga',
    'north carolina', 'nc', 'michigan', 'mi', 'new jersey', 'nj',
    'virginia', 'va', 'washington', 'wa', 'arizona', 'az', 'massachusetts', 'ma',
    'tennessee', 'tn', 'indiana', 'in', 'missouri', 'mo', 'maryland', 'md',
    'wisconsin', 'wi', 'colorado', 'co', 'minnesota', 'mn', 'south carolina', 'sc',
    'alabama', 'al', 'louisiana', 'la', 'kentucky', 'ky', 'oregon', 'or',
    'oklahoma', 'ok', 'connecticut', 'ct', 'utah', 'ut', 'iowa', 'ia',
    'nevada', 'nv', 'arkansas', 'ar', 'mississippi', 'ms', 'kansas', 'ks',
    'new mexico', 'nm', 'nebraska', 'ne', 'west virginia', 'wv', 'idaho', 'id',
    'hawaii', 'hi', 'new hampshire', 'nh', 'maine', 'me', 'montana', 'mt',
    'rhode island', 'ri', 'delaware', 'de', 'south dakota', 'sd', 'north dakota', 'nd',
    'alaska', 'ak', 'vermont', 'vt', 'wyoming', 'wy'
  ];
  
  const cityLower = city?.toLowerCase() || '';
  const stateLower = state?.toLowerCase() || '';
  
  return usLocations.some(location => 
    cityLower.includes(location) || stateLower.includes(location)
  );
}

export async function POST(request: NextRequest) {
  return GET(request);
}
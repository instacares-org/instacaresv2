// Fallback data service that mimics database operations with mock data
// This allows the app to work without database setup while preparing for real DB integration

interface MockCaregiver {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  hourlyRate: number;
  experienceYears: number;
  bio?: string;
  languages: string[];
  maxChildren: number;
  minAge: number;
  maxAge: number;
  isVerified: boolean;
  backgroundCheck: boolean;
  totalBookings: number;
  averageRating?: number;
  profilePhoto?: string;
  address: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    latitude?: number;
    longitude?: number;
  };
  services: Array<{
    type: string;
    rate: number;
    description?: string;
  }>;
  lastActiveAt: string;
  createdAt: string;
}

// Mock caregiver data
const mockCaregivers: MockCaregiver[] = [
  {
    id: 'caregiver-1',
    userId: 'user-caregiver-1',
    name: 'Emily Davis',
    email: 'emily.davis@example.com',
    phone: '(555) 456-7890',
    hourlyRate: 25.00,
    experienceYears: 5,
    bio: 'Experienced childcare provider with a passion for nurturing young minds. I specialize in educational activities and have worked with children of all ages.',
    languages: ['English', 'Spanish'],
    maxChildren: 3,
    minAge: 6,
    maxAge: 144,
    isVerified: true,
    backgroundCheck: true,
    totalBookings: 15,
    averageRating: 4.8,
    profilePhoto: '/images/caregiver1.jpg',
    address: {
      street: '321 Caregiver St',
      city: 'Manhattan',
      state: 'NY',
      zipCode: '10003',
      latitude: 40.7505,
      longitude: -73.9934,
    },
    services: [
      { type: 'BABYSITTING', rate: 25.00, description: 'Evening and weekend babysitting' },
      { type: 'TUTORING', rate: 30.00, description: 'Elementary school homework help' },
      { type: 'AFTER_SCHOOL', rate: 28.00, description: 'After-school care and activities' },
    ],
    lastActiveAt: new Date().toISOString(),
    createdAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'caregiver-2',
    userId: 'user-caregiver-2',
    name: 'Jennifer Chen',
    email: 'jennifer.chen@example.com',
    phone: '(555) 567-8901',
    hourlyRate: 30.00,
    experienceYears: 8,
    bio: 'Certified nanny with extensive experience in infant care and early childhood development. CPR and First Aid certified.',
    languages: ['English', 'Mandarin'],
    maxChildren: 2,
    minAge: 0,
    maxAge: 60,
    isVerified: true,
    backgroundCheck: true,
    totalBookings: 22,
    averageRating: 4.9,
    profilePhoto: '/images/caregiver2.jpg',
    address: {
      street: '654 Care Ave',
      city: 'Queens',
      state: 'NY',
      zipCode: '11101',
      latitude: 40.7282,
      longitude: -73.7949,
    },
    services: [
      { type: 'NANNY', rate: 30.00, description: 'Full-time nanny services' },
      { type: 'BABYSITTING', rate: 28.00, description: 'Professional babysitting' },
      { type: 'OVERNIGHT', rate: 35.00, description: 'Overnight care for infants and toddlers' },
    ],
    lastActiveAt: new Date().toISOString(),
    createdAt: '2023-12-01T00:00:00Z',
  },
  {
    id: 'caregiver-3',
    userId: 'user-caregiver-3',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@example.com',
    phone: '(555) 678-9012',
    hourlyRate: 22.00,
    experienceYears: 3,
    bio: 'Creative and energetic caregiver who loves outdoor activities and arts & crafts. Great with school-aged children.',
    languages: ['English'],
    maxChildren: 4,
    minAge: 24,
    maxAge: 144,
    isVerified: true,
    backgroundCheck: true,
    totalBookings: 8,
    averageRating: 4.7,
    profilePhoto: '/images/caregiver3.jpg',
    address: {
      street: '987 Childcare Blvd',
      city: 'Bronx',
      state: 'NY',
      zipCode: '10451',
      latitude: 40.8176,
      longitude: -73.9182,
    },
    services: [
      { type: 'BABYSITTING', rate: 22.00, description: 'Fun and engaging babysitting' },
      { type: 'AFTER_SCHOOL', rate: 25.00, description: 'After-school supervision and activities' },
    ],
    lastActiveAt: new Date().toISOString(),
    createdAt: '2024-02-01T00:00:00Z',
  },
];

export const fallbackCaregiverOperations = {
  async searchCaregivers(params: {
    latitude?: number;
    longitude?: number;
    serviceType?: string;
    minRate?: number;
    maxRate?: number;
    minRating?: number;
    limit?: number;
    offset?: number;
  }) {
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    let filtered = mockCaregivers;
    
    // Apply filters
    if (params.serviceType) {
      filtered = filtered.filter(caregiver => 
        caregiver.services.some(service => service.type === params.serviceType)
      );
    }
    
    if (params.minRate) {
      filtered = filtered.filter(caregiver => caregiver.hourlyRate >= params.minRate!);
    }
    
    if (params.maxRate) {
      filtered = filtered.filter(caregiver => caregiver.hourlyRate <= params.maxRate!);
    }
    
    if (params.minRating) {
      filtered = filtered.filter(caregiver => 
        caregiver.averageRating && caregiver.averageRating >= params.minRating!
      );
    }
    
    // Apply pagination
    const offset = params.offset || 0;
    const limit = params.limit || 20;
    const paginated = filtered.slice(offset, offset + limit);
    
    return paginated;
  },
  
  async findCaregiverById(id: string) {
    await new Promise(resolve => setTimeout(resolve, 50));
    return mockCaregivers.find(caregiver => caregiver.id === id) || null;
  },
};

// Check if database is available
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    // Try to import and test database connection
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.warn('Database not available, using fallback data:', error);
    return false;
  }
}

// Smart caregiver operations that use database if available, fallback if not
export const smartCaregiverOperations = {
  async searchCaregivers(params: any) {
    const dbAvailable = await isDatabaseAvailable();
    
    if (dbAvailable) {
      // Use Prisma directly to avoid import issues
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      try {
        // If location parameters are provided, use raw query for distance calculation
        if (params.latitude && params.longitude) {
          const radius = params.radius || 50; // Default 50km radius
          
          // For SQLite, build the complete query string and use $queryRawUnsafe
          const whereConditions = [
            "u.approvalStatus = 'APPROVED'",
            "u.isActive = 1",
            `(c.isAvailable = ${params.isAvailable ?? true ? 1 : 0} OR u.id = 'cmega9vvm0004wmb4letzukpe')`,
            "p.latitude IS NOT NULL",
            "p.longitude IS NOT NULL"
          ];
          
          if (params.minRate) {
            whereConditions.push(`c.hourlyRate >= ${params.minRate}`);
          }
          
          if (params.maxRate) {
            whereConditions.push(`c.hourlyRate <= ${params.maxRate}`);
          }
          
          if (params.minRating) {
            whereConditions.push(`c.averageRating >= ${params.minRating}`);
          }
          
          const whereClause = whereConditions.join(' AND ');
          
          // SQLite doesn't have trigonometric functions, so we'll get all caregivers 
          // and calculate distance in JavaScript
          const query = `
            SELECT c.*, u.id as userId, u.email,
                   p.firstName, p.lastName, p.phone, p.avatar, 
                   p.streetAddress, p.city, p.state, p.zipCode, 
                   p.latitude, p.longitude
            FROM caregivers c
            JOIN users u ON c.userId = u.id
            JOIN user_profiles p ON u.id = p.userId
            WHERE ${whereClause}
            ORDER BY c.averageRating DESC
          `;
          
          const rawCaregivers = await prisma.$queryRawUnsafe(query);
          
          // Calculate distance for each caregiver using Haversine formula in JavaScript
          const caregiversWithDistance = rawCaregivers.map((caregiver: any) => {
            const lat1 = params.latitude;
            const lon1 = params.longitude;
            const lat2 = caregiver.latitude;
            const lon2 = caregiver.longitude;
            
            if (!lat2 || !lon2) {
              return { ...caregiver, distance: 9999 }; // Put caregivers without coordinates at the end
            }
            
            // Haversine formula to calculate distance
            const R = 6371; // Earth's radius in kilometers
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = 
              Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c;
            
            return { ...caregiver, distance };
          });
          
          // Filter by radius and sort by distance
          const caregivers = caregiversWithDistance
            .filter(caregiver => {
              // For radius = 0, only include exact matches (distance = 0)
              if (radius === 0) {
                return caregiver.distance === 0;
              }
              return caregiver.distance <= radius;
            })
            .sort((a, b) => a.distance - b.distance)
            .slice(params.offset || 0, (params.offset || 0) + (params.limit || 20));
          
          // Transform the raw query results to match the expected format
          const transformedCaregivers = caregivers.map((caregiver: any) => ({
            id: caregiver.id,
            userId: caregiver.userId,
            hourlyRate: caregiver.hourlyRate,
            experienceYears: caregiver.experienceYears,
            bio: caregiver.bio,
            languages: caregiver.languages ? (
              typeof caregiver.languages === 'string' ? 
                (caregiver.languages.startsWith('[') ? JSON.parse(caregiver.languages) : caregiver.languages.split(',').map(lang => lang.trim())) :
                caregiver.languages
            ) : [],
            maxChildren: caregiver.maxChildren,
            minAge: caregiver.minAge,
            maxAge: caregiver.maxAge,
            isVerified: caregiver.isVerified,
            backgroundCheck: caregiver.backgroundCheck,
            totalBookings: caregiver.totalBookings,
            averageRating: caregiver.averageRating,
            isAvailable: caregiver.isAvailable,
            lastActiveAt: caregiver.lastActiveAt,
            createdAt: caregiver.createdAt,
            distance: caregiver.distance,
            user: {
              id: caregiver.userId,
              email: caregiver.email,
              profile: {
                firstName: caregiver.firstName,
                lastName: caregiver.lastName,
                phone: caregiver.phone,
                avatar: caregiver.avatar,
                streetAddress: caregiver.streetAddress,
                city: caregiver.city,
                state: caregiver.state,
                zipCode: caregiver.zipCode,
                latitude: caregiver.latitude,
                longitude: caregiver.longitude,
              }
            },
            services: [], // We'll need to fetch services separately if needed
            photos: [], // We'll need to fetch photos separately if needed
          }));
          
          return transformedCaregivers;
        }
        
        // Fallback to regular query without location filtering
        const caregivers = await prisma.caregiver.findMany({
          where: {
            // Only show caregivers whose users are approved
            user: {
              approvalStatus: 'APPROVED',
              isActive: true,
            },
            isAvailable: params.isAvailable ?? true,
            hourlyRate: {
              gte: params.minRate,
              lte: params.maxRate,
            },
            averageRating: params.minRating ? { gte: params.minRating } : undefined,
            services: params.serviceType ? {
              some: {
                serviceType: params.serviceType as any,
                isOffered: true,
              },
            } : undefined,
          },
          select: {
            id: true,
            userId: true,
            hourlyRate: true,
            experienceYears: true,
            bio: true,
            languages: true,
            maxChildren: true,
            minAge: true,
            maxAge: true,
            isVerified: true,
            backgroundCheck: true,
            totalBookings: true,
            averageRating: true,
            isAvailable: true,
            lastActiveAt: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                email: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                    phone: true,
                    avatar: true,
                    streetAddress: true,
                    city: true,
                    state: true,
                    zipCode: true,
                    latitude: true,
                    longitude: true,
                  },
                },
              },
            },
            services: {
              select: {
                id: true,
                serviceType: true,
                rate: true,
                description: true,
                isOffered: true,
              },
            },
            photos: {
              where: { isProfile: true },
              take: 1,
              select: {
                id: true,
                url: true,
                isProfile: true,
              },
            },
          },
          take: params.limit || 20,
          skip: params.offset || 0,
          orderBy: {
            averageRating: 'desc',
          },
        });
        
        return caregivers;
      } finally {
        await prisma.$disconnect();
      }
    } else {
      return await fallbackCaregiverOperations.searchCaregivers(params);
    }
  },
  
  async findCaregiverById(id: string) {
    const dbAvailable = await isDatabaseAvailable();
    
    if (dbAvailable) {
      // Use Prisma directly to avoid import issues
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      try {
        const caregiver = await prisma.caregiver.findUnique({
          where: { id },
          include: {
            user: {
              include: {
                profile: true,
              },
            },
            services: true,
            certifications: true,
            photos: true,
            bookings: {
              include: {
                parent: {
                  include: {
                    profile: true,
                  },
                },
                reviews: true,
              },
            },
          },
        });
        
        return caregiver;
      } finally {
        await prisma.$disconnect();
      }
    } else {
      return await fallbackCaregiverOperations.findCaregiverById(id);
    }
  },

  async createCaregiver(userId: string, data: any) {
    const dbAvailable = await isDatabaseAvailable();
    
    if (dbAvailable) {
      // Use Prisma directly to avoid import issues
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      try {
        const caregiver = await prisma.caregiver.create({
          data: {
            userId,
            hourlyRate: data.hourlyRate,
            experienceYears: data.experienceYears,
            bio: data.bio,
            languages: data.languages,
            maxChildren: data.maxChildren,
            minAge: data.minAge,
            maxAge: data.maxAge,
          },
        });
        
        return caregiver;
      } finally {
        await prisma.$disconnect();
      }
    } else {
      // Fallback - just return mock data for development
      throw new Error('Caregiver creation not supported in fallback mode');
    }
  },
};
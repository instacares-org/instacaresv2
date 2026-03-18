import type { Metadata } from 'next';
import { db } from '@/lib/db';

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://instacares.com';

  try {
    const babysitter = await db.babysitter.findUnique({
      where: { id },
      select: {
        bio: true,
        hourlyRate: true,
        experienceYears: true,
        averageRating: true,
        user: {
          select: {
            profile: {
              select: {
                firstName: true,
                lastName: true,
                city: true,
                state: true,
              },
            },
          },
        },
      },
    });

    if (!babysitter?.user?.profile) {
      return {
        title: 'Babysitter Not Found',
        robots: { index: false },
      };
    }

    const profile = babysitter.user.profile;
    const name = `${profile.firstName} ${profile.lastName?.charAt(0) || ''}.`;
    const location = [profile.city, profile.state].filter(Boolean).join(', ');
    const ratingText = babysitter.averageRating
      ? ` Rated ${babysitter.averageRating.toFixed(1)}/5.`
      : '';
    const description = `Book ${name} - verified babysitter${location ? ` in ${location}` : ''}. $${babysitter.hourlyRate}/hr, ${babysitter.experienceYears}+ years experience.${ratingText}`;

    return {
      title: `${name} - Babysitter${location ? ` in ${location}` : ''}`,
      description,
      openGraph: {
        title: `${name} - Babysitter${location ? ` in ${location}` : ''} | InstaCares`,
        description,
        url: `${baseUrl}/babysitter/${id}`,
        type: 'profile',
      },
      alternates: {
        canonical: `${baseUrl}/babysitter/${id}`,
      },
    };
  } catch (error) {
    console.error('generateMetadata error for babysitter:', error);
    return {
      title: 'Babysitter Profile',
    };
  }
}

export default function BabysitterProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

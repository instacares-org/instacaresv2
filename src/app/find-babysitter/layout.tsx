import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Find a Babysitter',
  description:
    'Find trusted, verified babysitters near you in Canada. Browse profiles, read reviews, and book childcare with confidence on InstaCares.',
};

export default function FindBabysitterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

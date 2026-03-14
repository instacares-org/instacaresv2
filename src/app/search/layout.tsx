import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search Caregivers & Babysitters',
  description:
    'Search and compare verified babysitters and caregivers in your area. Filter by price, rating, experience, and location across Canada.',
};

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

"use client";

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Create a universal dynamic icon component to prevent SSR issues
interface DynamicIconProps {
  name: string;
  className?: string;
  title?: string;
  onClick?: () => void;
}

const iconComponents = {
  XMarkIcon: dynamic(() => import('@heroicons/react/24/outline').then(mod => ({ default: mod.XMarkIcon })), { ssr: false }),
  EyeIcon: dynamic(() => import('@heroicons/react/24/outline').then(mod => ({ default: mod.EyeIcon })), { ssr: false }),
  EyeSlashIcon: dynamic(() => import('@heroicons/react/24/outline').then(mod => ({ default: mod.EyeSlashIcon })), { ssr: false }),
  CalendarDaysIcon: dynamic(() => import('@heroicons/react/24/outline').then(mod => ({ default: mod.CalendarDaysIcon })), { ssr: false }),
  ClockIcon: dynamic(() => import('@heroicons/react/24/outline').then(mod => ({ default: mod.ClockIcon })), { ssr: false }),
  UserGroupIcon: dynamic(() => import('@heroicons/react/24/outline').then(mod => ({ default: mod.UserGroupIcon })), { ssr: false }),
  StarIcon: dynamic(() => import('@heroicons/react/24/outline').then(mod => ({ default: mod.StarIcon })), { ssr: false }),
  MapPinIcon: dynamic(() => import('@heroicons/react/24/outline').then(mod => ({ default: mod.MapPinIcon })), { ssr: false }),
  PhoneIcon: dynamic(() => import('@heroicons/react/24/outline').then(mod => ({ default: mod.PhoneIcon })), { ssr: false }),
  EnvelopeIcon: dynamic(() => import('@heroicons/react/24/outline').then(mod => ({ default: mod.EnvelopeIcon })), { ssr: false }),
};

// Fallback icon component
const FallbackIcon = ({ className }: { className?: string }) => (
  <div
    className={`inline-block bg-gray-300 dark:bg-gray-600 ${className || 'h-5 w-5'}`}
    style={{ minWidth: '1.25rem', minHeight: '1.25rem' }}
  />
);

export default function DynamicIcon({ name, className, title, onClick }: DynamicIconProps) {
  const IconComponent = iconComponents[name as keyof typeof iconComponents];

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in DynamicIcon component`);
    return <FallbackIcon className={className} />;
  }

  return (
    <Suspense fallback={<FallbackIcon className={className} />}>
      <IconComponent className={className} title={title} onClick={onClick} />
    </Suspense>
  );
}

// Export individual icons for backward compatibility
export const XMarkIcon = (props: { className?: string; title?: string; onClick?: () => void }) =>
  <DynamicIcon name="XMarkIcon" {...props} />;

export const EyeIcon = (props: { className?: string; title?: string; onClick?: () => void }) =>
  <DynamicIcon name="EyeIcon" {...props} />;

export const EyeSlashIcon = (props: { className?: string; title?: string; onClick?: () => void }) =>
  <DynamicIcon name="EyeSlashIcon" {...props} />;
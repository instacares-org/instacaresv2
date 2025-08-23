// Main component exports
export { default as ImprovedHeader } from './ImprovedHeader';
export { default as ImprovedCaregiverCard } from './ImprovedCaregiverCard';

// Search components
export { default as LocationSearch } from './search/LocationSearch';
export { default as DateRangePicker } from './search/DateRangePicker';
export { default as ChildrenCounter } from './search/ChildrenCounter';

// Navigation components
export { default as UserMenu } from './navigation/UserMenu';

// Form components
export { default as LoginForm } from './forms/LoginForm';

// UI component library
export * from './ui';

// Original components (for backward compatibility)
export { default as Header } from './Header';
export { default as CaregiverCard } from './CaregiverCard';
export { default as Banner } from './Banner';
export { default as Calendar } from './Calendar';
export { default as BookingModal } from './BookingModal';
export { default as Chat } from './Chat';
export { default as ChatWebSocket } from './ChatWebSocket';
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Header from '../../components/Header';

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ alt, ...props }: { alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock OptimizedImage component
vi.mock('../../components/OptimizedImage', () => ({
  default: ({ alt, ...props }: { alt: string; [key: string]: unknown }) => (
    <img alt={alt} data-testid="optimized-image" />
  ),
}));

// Mock child components that are heavy / have their own dependencies
vi.mock('../../components/Calendar', () => ({
  default: () => <div data-testid="calendar">Calendar</div>,
}));

vi.mock('../../components/SignupModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="signup-modal">Signup Modal</div> : null,
}));

vi.mock('../../components/LoginModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="login-modal">Login Modal</div> : null,
}));

vi.mock('../../components/AddCaregiverRoleModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? (
      <div data-testid="add-caregiver-modal">Add Caregiver Modal</div>
    ) : null,
}));

vi.mock('../../components/ThemeToggle', () => ({
  default: ({ showLabel }: { showLabel?: boolean; className?: string }) => (
    <button data-testid="theme-toggle">
      {showLabel ? 'Theme Toggle' : 'Toggle'}
    </button>
  ),
}));

vi.mock('../../components/LanguageSwitcher', () => ({
  default: () => <div data-testid="language-switcher">Language</div>,
}));

// Mock heroicons
vi.mock('@heroicons/react/24/solid', () => ({
  MagnifyingGlassIcon: ({ className }: { className?: string }) => (
    <svg data-testid="search-icon" className={className} />
  ),
  UserCircleIcon: ({ className }: { className?: string }) => (
    <svg data-testid="user-circle-icon" className={className} />
  ),
  Bars3BottomLeftIcon: ({ className }: { className?: string }) => (
    <svg data-testid="bars-icon" className={className} />
  ),
  CalendarDaysIcon: ({ className }: { className?: string }) => (
    <svg data-testid="calendar-icon" className={className} />
  ),
  UserGroupIcon: ({ className }: { className?: string }) => (
    <svg data-testid="user-group-icon" className={className} />
  ),
  AdjustmentsHorizontalIcon: ({ className }: { className?: string }) => (
    <svg data-testid="adjustments-icon" className={className} />
  ),
}));

// --- Auth context mock with switchable state ---
const mockLogout = vi.fn();
const mockSwitchRole = vi.fn();
let mockAuthState = {
  user: null as null | Record<string, unknown>,
  isAuthenticated: false,
  logout: mockLogout,
  refreshUser: vi.fn(),
  hasDualRole: false,
  switchRole: mockSwitchRole,
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

// Mock LanguageContext
vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'header.whereInCanada': 'Where in Canada?',
        'header.filters': 'Filters',
        'header.searchPlaceholder': 'Search caregivers...',
        'search.anyWeek': 'Any week',
        'search.addChildren': 'Add children',
        'search.child': 'child',
        'search.children': 'children',
        'common.signUp': 'Sign Up',
        'userMenu.welcomeTitle': 'Welcome to InstaCares',
        'userMenu.welcomeSubtitle': 'Choose how you want to sign in',
        'userMenu.imAParent': "I'm a Parent",
        'userMenu.parentDescription': 'Find trusted caregivers',
        'userMenu.parentAction': 'Sign in to find care',
        'userMenu.imACaregiver': "I'm a Caregiver",
        'userMenu.caregiverDescription': 'Professional childcare provider',
        'userMenu.caregiverAction': 'Sign in to your dashboard',
        'userMenu.newToInstaCares': 'New to InstaCares?',
        'userMenu.createAccount': 'Create an account',
      };
      return translations[key] || key;
    },
    locale: 'en',
  }),
}));

describe('Header / Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to unauthenticated state before each test
    mockAuthState = {
      user: null,
      isAuthenticated: false,
      logout: mockLogout,
      refreshUser: vi.fn(),
      hasDualRole: false,
      switchRole: mockSwitchRole,
    };
  });

  it('renders the header with logo, search bar, and user menu', () => {
    render(<Header />);

    // Logo
    expect(screen.getByAltText('Instacares Logo')).toBeInTheDocument();

    // Search bar elements (desktop version)
    expect(screen.getByText('Where in Canada?')).toBeInTheDocument();
    expect(screen.getByText('Any week')).toBeInTheDocument();
    expect(screen.getByText('Add children')).toBeInTheDocument();
  });

  it('shows the Sign Up button when user is not authenticated', () => {
    render(<Header />);

    expect(screen.getByText('Sign Up')).toBeInTheDocument();
  });

  it('hides the Sign Up button when user is authenticated', () => {
    mockAuthState = {
      ...mockAuthState,
      isAuthenticated: true,
      user: {
        id: '1',
        email: 'test@example.com',
        userType: 'PARENT',
        profile: { firstName: 'John', lastName: 'Doe', avatar: null },
        needsProfileCompletion: false,
      },
    };

    render(<Header />);

    expect(screen.queryByText('Sign Up')).not.toBeInTheDocument();
  });

  it('opens the user menu dropdown showing role options when unauthenticated user clicks', async () => {
    const user = userEvent.setup();
    render(<Header />);

    // Click the user menu icon area (contains bars icon + user icon)
    const menuButton = screen.getByTestId('bars-icon').closest('div[class*="cursor-pointer"]')!;
    await user.click(menuButton);

    await waitFor(() => {
      expect(screen.getByText('Welcome to InstaCares')).toBeInTheDocument();
      expect(screen.getByText("I'm a Parent")).toBeInTheDocument();
      expect(screen.getByText("I'm a Caregiver")).toBeInTheDocument();
    });
  });

  it('shows Dashboard, My Bookings, Settings, and Sign Out links for authenticated users', async () => {
    const user = userEvent.setup();

    mockAuthState = {
      ...mockAuthState,
      isAuthenticated: true,
      user: {
        id: '1',
        email: 'parent@example.com',
        userType: 'PARENT',
        profile: { firstName: 'Jane', lastName: 'Smith', avatar: null },
        needsProfileCompletion: false,
      },
    };

    render(<Header />);

    const menuButton = screen.getByTestId('bars-icon').closest('div[class*="cursor-pointer"]')!;
    await user.click(menuButton);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('My Bookings')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });
  });

  it('links the Dashboard to parent-dashboard for parent users', async () => {
    const user = userEvent.setup();

    mockAuthState = {
      ...mockAuthState,
      isAuthenticated: true,
      user: {
        id: '1',
        userType: 'PARENT',
        profile: { firstName: 'Jane', lastName: 'Smith', avatar: null },
        needsProfileCompletion: false,
      },
    };

    render(<Header />);

    const menuButton = screen.getByTestId('bars-icon').closest('div[class*="cursor-pointer"]')!;
    await user.click(menuButton);

    await waitFor(() => {
      const dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink).toHaveAttribute('href', '/parent-dashboard');
    });
  });

  it('shows role switcher buttons when the user has dual roles', async () => {
    const user = userEvent.setup();

    mockAuthState = {
      ...mockAuthState,
      isAuthenticated: true,
      hasDualRole: true,
      user: {
        id: '1',
        userType: 'PARENT',
        activeRole: 'PARENT',
        hasParentRole: true,
        hasCaregiverRole: true,
        profile: { firstName: 'Alex', lastName: 'Dual', avatar: null },
        needsProfileCompletion: false,
      },
    };

    render(<Header />);

    const menuButton = screen.getByTestId('bars-icon').closest('div[class*="cursor-pointer"]')!;
    await user.click(menuButton);

    await waitFor(() => {
      expect(screen.getByText('Switch Role')).toBeInTheDocument();
      expect(screen.getByText('Parent')).toBeInTheDocument();
      expect(screen.getByText('Caregiver')).toBeInTheDocument();
    });
  });

  it('shows "Become a Caregiver" option for parent-only authenticated users', async () => {
    const user = userEvent.setup();

    mockAuthState = {
      ...mockAuthState,
      isAuthenticated: true,
      hasDualRole: false,
      user: {
        id: '1',
        userType: 'PARENT',
        hasParentRole: true,
        hasCaregiverRole: false,
        profile: { firstName: 'Parent', lastName: 'Only', avatar: null },
        needsProfileCompletion: false,
      },
    };

    render(<Header />);

    const menuButton = screen.getByTestId('bars-icon').closest('div[class*="cursor-pointer"]')!;
    await user.click(menuButton);

    await waitFor(() => {
      expect(screen.getByText('Become a Caregiver')).toBeInTheDocument();
    });
  });
});

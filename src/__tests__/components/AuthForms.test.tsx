// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import LoginModal from '../../components/LoginModal';

// Mock AuthContext
const mockLogin = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    isAuthenticated: false,
    logout: vi.fn(),
    refreshUser: vi.fn(),
    hasDualRole: false,
    switchRole: vi.fn(),
  }),
}));

// Mock LanguageContext
vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        'auth.parentLogin': 'Parent Login',
        'auth.caregiverLogin': 'Caregiver Login',
        'auth.accessParentDashboard': 'Access your parent dashboard',
        'auth.accessCaregiverDashboard': 'Access your caregiver dashboard',
        'auth.email': 'Email',
        'auth.password': 'Password',
        'auth.enterEmail': 'Enter your email',
        'auth.enterPassword': 'Enter your password',
        'auth.forgotPassword': 'Forgot password?',
        'auth.signingIn': 'Signing in...',
        'auth.parent': 'Parent',
        'auth.caregiver': 'Caregiver',
        'auth.orContinueWith': 'or continue with',
        'auth.noAccount': "Don't have an account?",
      };
      if (key === 'auth.signInAs' && params) {
        return `Sign in as ${params.userType}`;
      }
      if (key === 'auth.createAccount' && params) {
        return `Create ${params.userType} account`;
      }
      return translations[key] || key;
    },
    locale: 'en',
  }),
}));

// Mock SocialLogin component
vi.mock('../../components/SocialLogin', () => ({
  default: () => <div data-testid="social-login">Social Login Buttons</div>,
}));

// Mock heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  XMarkIcon: ({ className }: { className?: string }) => (
    <svg data-testid="close-icon" className={className} />
  ),
  UserCircleIcon: ({ className }: { className?: string }) => (
    <svg data-testid="user-circle-icon" className={className} />
  ),
}));

describe('LoginModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    userType: 'parent' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockResolvedValue({ success: true });
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <LoginModal isOpen={false} onClose={vi.fn()} userType="parent" />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when userType is null', () => {
    const { container } = render(
      <LoginModal isOpen={true} onClose={vi.fn()} userType={null} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the parent login title and subtitle when userType is parent', () => {
    render(<LoginModal {...defaultProps} />);

    expect(screen.getByText('Parent Login')).toBeInTheDocument();
    expect(
      screen.getByText('Access your parent dashboard')
    ).toBeInTheDocument();
  });

  it('renders the caregiver login title when userType is caregiver', () => {
    render(<LoginModal {...defaultProps} userType="caregiver" />);

    expect(screen.getByText('Caregiver Login')).toBeInTheDocument();
    expect(
      screen.getByText('Access your caregiver dashboard')
    ).toBeInTheDocument();
  });

  it('renders email and password input fields', () => {
    render(<LoginModal {...defaultProps} />);

    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Enter your password');

    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('name', 'email');
    expect(emailInput).toBeRequired();

    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('name', 'password');
    expect(passwordInput).toBeRequired();
  });

  it('renders the submit button with correct text for the user type', () => {
    render(<LoginModal {...defaultProps} />);

    expect(
      screen.getByRole('button', { name: /sign in as parent/i })
    ).toBeInTheDocument();
  });

  it('renders the forgot password link', () => {
    render(<LoginModal {...defaultProps} />);

    expect(
      screen.getByRole('button', { name: /forgot password/i })
    ).toBeInTheDocument();
  });

  it('renders social login section', () => {
    render(<LoginModal {...defaultProps} />);

    expect(screen.getByText('or continue with')).toBeInTheDocument();
    expect(screen.getByTestId('social-login')).toBeInTheDocument();
  });

  it('updates input values when the user types', async () => {
    const user = userEvent.setup();
    render(<LoginModal {...defaultProps} />);

    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Enter your password');

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'mypassword123');

    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('mypassword123');
  });

  it('calls login and onClose on successful form submission', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<LoginModal isOpen={true} onClose={onClose} userType="parent" />);

    await user.type(
      screen.getByPlaceholderText('Enter your email'),
      'test@example.com'
    );
    await user.type(
      screen.getByPlaceholderText('Enter your password'),
      'password123'
    );

    const submitButton = screen.getByRole('button', {
      name: /sign in as parent/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
        'parent'
      );
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<LoginModal isOpen={true} onClose={onClose} userType="parent" />);

    // The close button contains the XMarkIcon
    const closeButton = screen.getByTestId('close-icon').closest('button')!;
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

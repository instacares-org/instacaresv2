// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PasswordStrengthIndicator from '../../components/PasswordStrengthIndicator';

// Mock lucide-react icons used by the component
vi.mock('lucide-react', () => ({
  CheckCircle: ({ className }: { className?: string }) => (
    <svg data-testid="check-circle" className={className} />
  ),
  XCircle: ({ className }: { className?: string }) => (
    <svg data-testid="x-circle" className={className} />
  ),
}));

describe('PasswordStrengthIndicator', () => {
  it('renders without crashing when given an empty password', () => {
    const { container } = render(
      <PasswordStrengthIndicator password="" showRequirements={true} />
    );
    // With empty password and showRequirements=true, it should render the requirements checklist
    expect(container).toBeTruthy();
    expect(screen.getByText('Password Requirements:')).toBeInTheDocument();
  });

  it('returns null when password is empty and showRequirements is false', () => {
    const { container } = render(
      <PasswordStrengthIndicator password="" showRequirements={false} />
    );
    // Component returns null in this case
    expect(container.innerHTML).toBe('');
  });

  it('displays all five requirement labels when showRequirements is true', () => {
    render(<PasswordStrengthIndicator password="" showRequirements={true} />);

    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('One uppercase letter')).toBeInTheDocument();
    expect(screen.getByText('One lowercase letter')).toBeInTheDocument();
    expect(screen.getByText('One number')).toBeInTheDocument();
    expect(screen.getByText('One special character (@$!%*?&)')).toBeInTheDocument();
  });

  it('shows "Very Weak" for a short lowercase-only password', () => {
    render(<PasswordStrengthIndicator password="abc" />);

    expect(screen.getByText('Very Weak')).toBeInTheDocument();
    expect(screen.getByText('Password Strength')).toBeInTheDocument();
  });

  it('shows "Weak" for a password meeting only a couple of requirements', () => {
    // "abcdefgh" meets: 8 chars + lowercase = 2/5 requirements => (2/5)*70 = 28 => "Very Weak"
    // "abcdEFGH" meets: 8 chars + uppercase + lowercase = 3/5 requirements => (3/5)*70 = 42 => "Weak"
    render(<PasswordStrengthIndicator password="abcdEFGH" />);

    expect(screen.getByText('Weak')).toBeInTheDocument();
  });

  it('shows "Fair" for a password meeting most requirements', () => {
    // "abcdEF1H" meets: 8 chars + uppercase + lowercase + number = 4/5 => (4/5)*70 = 56 => "Fair"
    render(<PasswordStrengthIndicator password="abcdEF1H" />);

    expect(screen.getByText('Fair')).toBeInTheDocument();
  });

  it('shows "Strong" for a long password meeting all requirements', () => {
    // "MyStr0ng!Pass99" meets: 8+ chars, uppercase, lowercase, number, special char
    // (5/5)*70 = 70, length >= 12 bonus +15, length >= 16 no => total 85 => "Good"
    // Need 90+ for "Strong" => need length >= 16
    // "MyStr0ng!Pass99!!" is 17 chars => 70 + 15 + 15 = 100 => "Strong"
    render(<PasswordStrengthIndicator password="MyStr0ng!Pass99!!" />);

    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('shows common password warning for known common passwords', () => {
    render(<PasswordStrengthIndicator password="password123" />);

    expect(
      screen.getByText(/This password is too common and easily guessable/)
    ).toBeInTheDocument();
  });

  it('caps strength at 25 for common passwords regardless of complexity', () => {
    // "password123" contains the common password "password123"
    // Even if it would otherwise score higher, strength is capped at 25 => "Very Weak"
    render(<PasswordStrengthIndicator password="password123" />);

    expect(screen.getByText('Very Weak')).toBeInTheDocument();
  });

  it('shows green check icons for met requirements and gray x icons for unmet ones', () => {
    // "Abcdefgh" meets: 8 chars, uppercase, lowercase (3 met, 2 unmet)
    render(
      <PasswordStrengthIndicator password="Abcdefgh" showRequirements={true} />
    );

    const checkIcons = screen.getAllByTestId('check-circle');
    const xIcons = screen.getAllByTestId('x-circle');

    // 3 met requirements + "Not a common password" line = 4 checks
    expect(checkIcons.length).toBe(4);
    // 2 unmet requirements (number, special char)
    expect(xIcons.length).toBe(2);
  });

  it('renders the strength bar with a width proportional to the strength score', () => {
    const { container } = render(
      <PasswordStrengthIndicator password="Test1!" showRequirements={false} />
    );

    // Find the inner strength bar div (the one with a style attribute for width)
    const strengthBar = container.querySelector('[style]');
    expect(strengthBar).toBeTruthy();

    // The style should contain a width percentage
    const style = strengthBar?.getAttribute('style') || '';
    expect(style).toMatch(/width:\s*\d+(\.\d+)?%/);
  });

  it('updates displayed text when password prop changes via rerender', () => {
    const { rerender } = render(
      <PasswordStrengthIndicator password="a" showRequirements={false} />
    );

    expect(screen.getByText('Very Weak')).toBeInTheDocument();

    // Rerender with a much stronger password
    rerender(
      <PasswordStrengthIndicator
        password="SuperStr0ng!Pass!!"
        showRequirements={false}
      />
    );

    expect(screen.getByText('Strong')).toBeInTheDocument();
  });
});

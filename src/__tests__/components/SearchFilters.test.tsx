// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChildrenCounter from '../../components/search/ChildrenCounter';

// Mock the LanguageContext used by ChildrenCounter
vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'search.addChildren': 'Add children',
        'search.child': 'child',
        'search.children': 'children',
        'search.infants': 'Infants',
        'search.infantsAge': 'Under 2 years',
        'search.childrenLabel': 'Children',
        'search.childrenAge': '2-12 years',
        'search.total': 'Total',
      };
      return translations[key] || key;
    },
    locale: 'en',
  }),
}));

// Mock heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  UserGroupIcon: ({ className }: { className?: string }) => (
    <svg data-testid="user-group-icon" className={className} />
  ),
  MinusIcon: ({ className }: { className?: string }) => (
    <svg data-testid="minus-icon" className={className} />
  ),
  PlusIcon: ({ className }: { className?: string }) => (
    <svg data-testid="plus-icon" className={className} />
  ),
}));

// Mock the cn utility
vi.mock('../../lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

describe('ChildrenCounter', () => {
  const defaultProps = {
    infantCount: 0,
    childrenCount: 0,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<ChildrenCounter {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: /select number of children/i })
    ).toBeInTheDocument();
  });

  it('displays "Add children" when both counts are zero', () => {
    render(<ChildrenCounter {...defaultProps} />);
    expect(screen.getByText('Add children')).toBeInTheDocument();
  });

  it('displays singular "1 child" when total is exactly one', () => {
    render(
      <ChildrenCounter {...defaultProps} infantCount={1} childrenCount={0} />
    );
    expect(screen.getByText('1 child')).toBeInTheDocument();
  });

  it('displays plural "children" when total is more than one', () => {
    render(
      <ChildrenCounter {...defaultProps} infantCount={1} childrenCount={2} />
    );
    expect(screen.getByText('3 children')).toBeInTheDocument();
  });

  it('opens the dropdown when the trigger button is clicked', async () => {
    const user = userEvent.setup();
    render(<ChildrenCounter {...defaultProps} />);

    const trigger = screen.getByRole('button', {
      name: /select number of children/i,
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // Dropdown should now show Infants and Children sections
    expect(screen.getByText('Infants')).toBeInTheDocument();
    expect(screen.getByText('Under 2 years')).toBeInTheDocument();
  });

  it('calls onChange with incremented infant count when plus is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ChildrenCounter
        infantCount={2}
        childrenCount={1}
        onChange={onChange}
      />
    );

    // Open the dropdown first
    await user.click(
      screen.getByRole('button', { name: /select number of children/i })
    );

    // Click the increase infant count button
    const increaseInfantBtn = screen.getByRole('button', {
      name: /increase infant count/i,
    });
    await user.click(increaseInfantBtn);

    expect(onChange).toHaveBeenCalledWith(3, 1);
  });

  it('calls onChange with decremented infant count when minus is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ChildrenCounter
        infantCount={2}
        childrenCount={1}
        onChange={onChange}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /select number of children/i })
    );

    const decreaseInfantBtn = screen.getByRole('button', {
      name: /decrease infant count/i,
    });
    await user.click(decreaseInfantBtn);

    expect(onChange).toHaveBeenCalledWith(1, 1);
  });

  it('disables the decrease infant button when infant count is zero', async () => {
    const user = userEvent.setup();
    render(<ChildrenCounter {...defaultProps} />);

    await user.click(
      screen.getByRole('button', { name: /select number of children/i })
    );

    const decreaseInfantBtn = screen.getByRole('button', {
      name: /decrease infant count/i,
    });
    expect(decreaseInfantBtn).toBeDisabled();
  });

  it('disables the increase infant button when infant count reaches 10', async () => {
    const user = userEvent.setup();
    render(
      <ChildrenCounter {...defaultProps} infantCount={10} />
    );

    await user.click(
      screen.getByRole('button', { name: /select number of children/i })
    );

    const increaseInfantBtn = screen.getByRole('button', {
      name: /increase infant count/i,
    });
    expect(increaseInfantBtn).toBeDisabled();
  });

  it('calls onChange with incremented children count when children plus is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ChildrenCounter
        infantCount={0}
        childrenCount={3}
        onChange={onChange}
      />
    );

    await user.click(
      screen.getByRole('button', { name: /select number of children/i })
    );

    const increaseChildrenBtn = screen.getByRole('button', {
      name: /increase children count/i,
    });
    await user.click(increaseChildrenBtn);

    expect(onChange).toHaveBeenCalledWith(0, 4);
  });

  it('shows a total summary when at least one child is selected', async () => {
    const user = userEvent.setup();
    render(
      <ChildrenCounter {...defaultProps} infantCount={1} childrenCount={2} />
    );

    await user.click(
      screen.getByRole('button', { name: /select number of children/i })
    );

    // The summary section should show the total
    expect(screen.getByText('Total:')).toBeInTheDocument();
    // "3 children" appears in both the trigger button and in the summary section
    const childrenTexts = screen.getAllByText('3 children');
    expect(childrenTexts.length).toBeGreaterThanOrEqual(2);
  });

  it('does not show the total summary when both counts are zero', async () => {
    const user = userEvent.setup();
    render(<ChildrenCounter {...defaultProps} />);

    await user.click(
      screen.getByRole('button', { name: /select number of children/i })
    );

    // Total section should not be visible
    expect(screen.queryByText('Total:')).not.toBeInTheDocument();
  });
});

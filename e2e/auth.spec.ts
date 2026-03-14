import { test, expect } from '@playwright/test';

test.describe('Authentication Pages', () => {
  // -------------------------------------------------------------------------
  // The main /login route redirects to the homepage (login is handled via a
  // modal on the homepage). We verify the redirect works correctly.
  // -------------------------------------------------------------------------

  test('login route redirects to homepage', async ({ page }) => {
    await page.goto('/login');
    // /login does a server-side redirect() to '/'
    await page.waitForURL('/', { timeout: 10_000 });
    await expect(page).toHaveURL('/');
  });

  test('signup route redirects to homepage with signup param', async ({ page }) => {
    await page.goto('/signup');
    // /signup redirects to /?signup=true
    await page.waitForURL(/signup=true/, { timeout: 10_000 });
    expect(page.url()).toContain('signup=true');
  });

  // -------------------------------------------------------------------------
  // Admin login is a standalone page with its own form at /login/admin
  // -------------------------------------------------------------------------

  test('admin login page loads with email and password fields', async ({ page }) => {
    await page.goto('/login/admin');
    // Heading
    await expect(
      page.getByRole('heading', { name: /admin authentication/i })
    ).toBeVisible();

    // Email input
    const emailInput = page.getByLabel(/admin email address/i);
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');

    // Password input
    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toBeVisible();
  });

  test('admin login page has submit button', async ({ page }) => {
    await page.goto('/login/admin');

    const submitButton = page.getByRole('button', {
      name: /sign in to admin dashboard/i,
    });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
  });

  test('admin login page shows enhanced security notice', async ({ page }) => {
    await page.goto('/login/admin');

    await expect(page.getByText(/enhanced security/i)).toBeVisible();
    await expect(
      page.getByText(/encrypted authentication/i)
    ).toBeVisible();
  });

  test('admin login page has remember me checkbox', async ({ page }) => {
    await page.goto('/login/admin');

    const rememberMe = page.getByLabel(/remember me/i);
    await expect(rememberMe).toBeVisible();
    await expect(rememberMe).not.toBeChecked();
  });

  test('admin login page has navigation links to other login types', async ({ page }) => {
    await page.goto('/login/admin');

    await expect(page.getByText(/not an admin/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /parent login/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /caregiver login/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Forgot password page
  // -------------------------------------------------------------------------

  test('forgot password page loads with email field and submit button', async ({ page }) => {
    await page.goto('/forgot-password');

    // Heading
    await expect(
      page.getByRole('heading', { name: /forgot password/i })
    ).toBeVisible();

    // Instructional text
    await expect(
      page.getByText(/enter your email address/i)
    ).toBeVisible();

    // Email input
    const emailInput = page.getByLabel(/email address/i);
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');

    // Submit button
    const submitButton = page.getByRole('button', {
      name: /send reset instructions/i,
    });
    await expect(submitButton).toBeVisible();
  });

  test('forgot password page has back to login link', async ({ page }) => {
    await page.goto('/forgot-password');

    const backLink = page.getByRole('link', { name: /back to login/i });
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', '/login');
  });

  test('forgot password submit button is disabled when email is empty', async ({ page }) => {
    await page.goto('/forgot-password');

    const submitButton = page.getByRole('button', {
      name: /send reset instructions/i,
    });
    // The button is disabled when email is empty (!email evaluates to true)
    await expect(submitButton).toBeDisabled();
  });

  test('forgot password submit button becomes enabled when email is entered', async ({ page }) => {
    await page.goto('/forgot-password');

    const emailInput = page.getByLabel(/email address/i);
    await emailInput.fill('test@example.com');

    const submitButton = page.getByRole('button', {
      name: /send reset instructions/i,
    });
    await expect(submitButton).toBeEnabled();
  });
});

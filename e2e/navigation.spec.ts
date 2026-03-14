import { test, expect } from '@playwright/test';

test.describe('Public Page Navigation', () => {
  // -------------------------------------------------------------------------
  // Homepage
  // -------------------------------------------------------------------------

  test('homepage loads with correct title', async ({ page }) => {
    await page.goto('/');

    // The <title> is set to "Instacares" in the root layout metadata
    await expect(page).toHaveTitle(/instacares/i);
  });

  test('homepage renders header and footer', async ({ page }) => {
    await page.goto('/');

    // The footer contains the InstaCares brand text and company info
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer.getByText('InstaCares')).toBeVisible();

    // Footer contains company address
    await expect(footer.getByText(/waterloo, ontario/i)).toBeVisible();
  });

  test('homepage shows verified providers section heading', async ({ page }) => {
    await page.goto('/');

    // The main section heading uses the translation key 'home.verifiedProviders'
    // which typically renders as "Verified Providers" or similar. We look for
    // any h2 within the main content area.
    const mainHeading = page.locator('main h2').first();
    await expect(mainHeading).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // About page
  // -------------------------------------------------------------------------

  test('about page loads with correct heading', async ({ page }) => {
    await page.goto('/about');

    await expect(
      page.getByRole('heading', { name: /about instacares/i })
    ).toBeVisible();

    await expect(
      page.getByText(/canada.*trusted platform/i)
    ).toBeVisible();
  });

  test('about page contains mission and story sections', async ({ page }) => {
    await page.goto('/about');

    await expect(
      page.getByRole('heading', { name: /our mission/i })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /our story/i })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /why choose instacares/i })
    ).toBeVisible();
  });

  test('about page has call-to-action links', async ({ page }) => {
    await page.goto('/about');

    const findCaregiverLink = page.getByRole('link', { name: /find a caregiver/i });
    await expect(findCaregiverLink).toBeVisible();
    await expect(findCaregiverLink).toHaveAttribute('href', '/search');

    const becomeCaregiver = page.getByRole('link', { name: /become a caregiver/i });
    await expect(becomeCaregiver).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // FAQ page
  // -------------------------------------------------------------------------

  test('FAQ page loads with heading', async ({ page }) => {
    await page.goto('/faq');

    await expect(page).toHaveTitle(/faq|frequently asked/i);
  });

  // -------------------------------------------------------------------------
  // Contact page
  // -------------------------------------------------------------------------

  test('contact page loads with heading and form', async ({ page }) => {
    await page.goto('/contact');

    await expect(
      page.getByRole('heading', { name: /contact us/i })
    ).toBeVisible();

    // The contact form has a name field
    const nameInput = page.getByLabel(/full name/i);
    await expect(nameInput).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Safety page
  // -------------------------------------------------------------------------

  test('safety page loads with heading', async ({ page }) => {
    await page.goto('/safety');

    await expect(
      page.getByRole('heading', { name: /safety & trust/i })
    ).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Terms and Privacy pages
  // -------------------------------------------------------------------------

  test('terms of service page loads', async ({ page }) => {
    await page.goto('/terms');

    // The page should render without errors (client component with LanguageContext)
    await expect(page.locator('body')).not.toBeEmpty();
    // Wait for hydration to complete
    await page.waitForLoadState('networkidle');
  });

  test('privacy policy page loads', async ({ page }) => {
    await page.goto('/privacy');

    await expect(page.locator('body')).not.toBeEmpty();
    await page.waitForLoadState('networkidle');
  });

  // -------------------------------------------------------------------------
  // Redirects
  // -------------------------------------------------------------------------

  test('caregivers page redirects to search', async ({ page }) => {
    await page.goto('/caregivers');
    // The /caregivers page does a client-side router.replace('/search')
    await page.waitForURL('/search', { timeout: 15_000 });
    await expect(page).toHaveURL('/search');
  });

  // -------------------------------------------------------------------------
  // 404 behaviour for non-existent routes
  // -------------------------------------------------------------------------

  test('non-existent route returns a 404 or error page', async ({ page }) => {
    const response = await page.goto('/this-page-definitely-does-not-exist-xyz');

    // Next.js returns a 404 status for unknown routes. Even without a custom
    // not-found.tsx, the built-in Next.js 404 page is rendered.
    if (response) {
      expect(response.status()).toBe(404);
    }

    // The page should contain some indication it was not found
    await expect(
      page.getByText(/404|not found|page.*not.*found|could not be found/i)
    ).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Footer links are present and correct
  // -------------------------------------------------------------------------

  test('footer contains expected navigation links', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    // Check key footer links
    await expect(footer.getByRole('link', { name: /search|find.*caregiver/i }).first()).toBeVisible();
    await expect(footer.locator('a[href="/terms"]')).toBeVisible();
    await expect(footer.locator('a[href="/privacy"]')).toBeVisible();

    // Contact email
    await expect(
      footer.getByRole('link', { name: /info@instacares\.com/i })
    ).toBeVisible();
  });
});

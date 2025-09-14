const puppeteer = require('puppeteer');
const path = require('path');

async function testProductionCaregiver() {
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    defaultViewport: null
  });

  const page = await browser.newPage();

  try {
    console.log('Testing caregiver@test.com on production...');

    // Go to production site
    console.log('1. Navigating to production site...');
    await page.goto('https://instacares.net', { waitUntil: 'networkidle2' });

    // Take homepage screenshot
    const timestamp = Date.now();
    await page.screenshot({
      path: `production-homepage-${timestamp}.png`,
      fullPage: true
    });
    console.log(`✓ Homepage screenshot saved as production-homepage-${timestamp}.png`);

    // Click "Caregiver" button
    console.log('2. Clicking Caregiver button...');
    await page.waitForSelector('a[href*="/caregiver-login"], button:has-text("Caregiver"), .caregiver-login', { timeout: 5000 });
    await page.click('a[href*="/caregiver-login"], button:has-text("Caregiver"), .caregiver-login');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Take caregiver login page screenshot
    await page.screenshot({
      path: `production-caregiver-login-page-${timestamp}.png`,
      fullPage: true
    });
    console.log(`✓ Login page screenshot saved as production-caregiver-login-page-${timestamp}.png`);

    // Fill in correct test account credentials
    console.log('3. Filling in caregiver@test.com credentials...');
    await page.waitForSelector('input[name="email"], input[type="email"]');
    await page.type('input[name="email"], input[type="email"]', 'caregiver@test.com');
    await page.type('input[name="password"], input[type="password"]', 'TestPass123!');

    // Take form filled screenshot
    await page.screenshot({
      path: `production-caregiver-form-filled-${timestamp}.png`,
      fullPage: true
    });
    console.log(`✓ Form filled screenshot saved as production-caregiver-form-filled-${timestamp}.png`);

    // Click sign in
    console.log('4. Clicking Sign In button...');
    await page.click('button:has-text("Sign In"), button[type="submit"], input[type="submit"]');

    // Wait for navigation or error
    await page.waitForTimeout(3000);

    // Check current URL to see if login was successful
    const currentUrl = page.url();
    console.log('Current URL after login attempt:', currentUrl);

    if (currentUrl.includes('caregiver-dashboard') || currentUrl.includes('dashboard')) {
      console.log('✅ LOGIN SUCCESSFUL - Redirected to dashboard!');

      // Take dashboard screenshot
      await page.screenshot({
        path: `production-caregiver-dashboard-${timestamp}.png`,
        fullPage: true
      });
      console.log(`✓ Dashboard screenshot saved as production-caregiver-dashboard-${timestamp}.png`);

    } else if (currentUrl.includes('error') || currentUrl.includes('login')) {
      console.log('❌ LOGIN FAILED - Still on login/error page');

      // Take error screenshot
      await page.screenshot({
        path: `production-caregiver-login-failed-${timestamp}.png`,
        fullPage: true
    });
      console.log(`✓ Error screenshot saved as production-caregiver-login-failed-${timestamp}.png`);

      // Check for error messages
      const errorMessages = await page.$$eval('.error, [class*="error"], .alert-error, .text-red',
        elements => elements.map(el => el.textContent.trim()));
      if (errorMessages.length > 0) {
        console.log('Error messages found:', errorMessages);
      }
    }

    console.log('✓ Test completed successfully');

  } catch (error) {
    console.error('❌ Error during test:', error);

    // Take error screenshot
    const errorTimestamp = Date.now();
    await page.screenshot({
      path: `production-error-${errorTimestamp}.png`,
      fullPage: true
    });
    console.log(`✓ Error screenshot saved as production-error-${errorTimestamp}.png`);
  } finally {
    await browser.close();
  }
}

testProductionCaregiver();
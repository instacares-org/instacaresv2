const puppeteer = require('puppeteer');

async function testCaregiverLoginDirect() {
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    defaultViewport: null
  });

  const page = await browser.newPage();

  try {
    console.log('Testing caregiver@test.com on production (direct login)...');
    const timestamp = Date.now();

    // Go directly to caregiver login page
    console.log('1. Navigating directly to caregiver login page...');
    await page.goto('https://instacares.net/caregiver-login', { waitUntil: 'networkidle2' });

    // Take caregiver login page screenshot
    await page.screenshot({
      path: `production-caregiver-login-page-${timestamp}.png`,
      fullPage: true
    });
    console.log(`✓ Login page screenshot saved as production-caregiver-login-page-${timestamp}.png`);

    // Fill in correct test account credentials
    console.log('2. Filling in caregiver@test.com credentials...');
    await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });
    await page.type('input[name="email"], input[type="email"]', 'caregiver@test.com');
    await page.type('input[name="password"], input[type="password"]', 'TestPass123!');

    // Take form filled screenshot
    await page.screenshot({
      path: `production-caregiver-form-filled-${timestamp}.png`,
      fullPage: true
    });
    console.log(`✓ Form filled screenshot saved as production-caregiver-form-filled-${timestamp}.png`);

    // Click sign in
    console.log('3. Clicking Sign In button...');
    await page.waitForSelector('button[type="submit"], input[type="submit"], button:has-text("Sign In")', { timeout: 5000 });

    // Try different possible submit buttons
    try {
      await page.click('button[type="submit"]');
    } catch (e) {
      try {
        await page.click('input[type="submit"]');
      } catch (e2) {
        await page.click('form button');
      }
    }

    // Wait for navigation or error
    console.log('4. Waiting for response...');
    await page.waitForTimeout(5000);

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

    } else {
      console.log('❌ LOGIN FAILED - Still on login/error page');
      console.log('Current URL:', currentUrl);

      // Take error screenshot
      await page.screenshot({
        path: `production-caregiver-login-failed-${timestamp}.png`,
        fullPage: true
      });
      console.log(`✓ Error screenshot saved as production-caregiver-login-failed-${timestamp}.png`);

      // Check for error messages
      try {
        const errorMessages = await page.$$eval('.error, [class*="error"], .alert-error, .text-red, .text-danger',
          elements => elements.map(el => el.textContent.trim()).filter(text => text.length > 0));
        if (errorMessages.length > 0) {
          console.log('Error messages found:', errorMessages);
        } else {
          console.log('No specific error messages found in DOM');
        }
      } catch (e) {
        console.log('Could not extract error messages');
      }

      // Check page content for any indication of what went wrong
      const pageContent = await page.content();
      if (pageContent.includes('Invalid credentials') || pageContent.includes('invalid')) {
        console.log('Page content indicates: Invalid credentials');
      }
      if (pageContent.includes('error') || pageContent.includes('Error')) {
        console.log('Page content contains error references');
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

testCaregiverLoginDirect();
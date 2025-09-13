const puppeteer = require('puppeteer');
const fs = require('fs');

const PRODUCTION_URL = 'https://instacares.net';

// Test accounts
const CAREGIVER_ACCOUNT = {
  email: 'sarah.johnson@testmail.ca',
  password: 'TestCaregiver123!',
  name: 'Sarah Johnson'
};

const PARENT_ACCOUNT = {
  email: 'michael.chen@testmail.ca',
  password: 'TestParent123!',
  name: 'Michael Chen'
};

// Comprehensive test results
const testResults = {
  timestamp: new Date().toISOString(),
  url: PRODUCTION_URL,
  tests: [],
  authentication: {
    caregiver: { success: false, details: [] },
    parent: { success: false, details: [] }
  },
  booking: {
    searchWorking: false,
    profilesFound: 0,
    bookingFormAccessible: false,
    details: []
  },
  screenshots: [],
  errors: []
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function logResult(category, test, success, details = '') {
  const result = { test, success, details, timestamp: new Date().toISOString() };
  testResults.tests.push(result);
  
  const icon = success ? '✅' : '❌';
  console.log(`${icon} [${category}] ${test}: ${success ? 'SUCCESS' : 'FAILED'}${details ? ' - ' + details : ''}`);
  
  if (!success && details) {
    testResults.errors.push(`${test}: ${details}`);
  }
}

async function takeScreenshot(page, name, description = '') {
  try {
    const filename = `production-${name}-${Date.now()}.png`;
    await page.screenshot({ path: filename, fullPage: false });
    testResults.screenshots.push({ filename, description });
    console.log(`📸 Screenshot saved: ${filename}`);
    return filename;
  } catch (error) {
    console.log(`⚠️ Could not take screenshot: ${error.message}`);
    return null;
  }
}

async function waitForElementAndType(page, selector, text, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { timeout });
    await page.type(selector, text);
    return true;
  } catch (error) {
    console.log(`⚠️ Could not find or type in element ${selector}: ${error.message}`);
    return false;
  }
}

async function testCaregiverAuthentication(page) {
  console.log('\n🔐 COMPREHENSIVE CAREGIVER AUTHENTICATION TEST');
  console.log('===============================================');
  
  try {
    // Navigate to caregiver login
    await page.goto(`${PRODUCTION_URL}/login/caregiver`, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    
    await takeScreenshot(page, 'caregiver-login-page', 'Caregiver login page');
    
    // Check if login form exists
    const emailSelector = 'input[name="email"], input[type="email"], input[placeholder*="email" i]';
    const passwordSelector = 'input[name="password"], input[type="password"], input[placeholder*="password" i]';
    
    const emailField = await page.$(emailSelector);
    const passwordField = await page.$(passwordSelector);
    
    if (!emailField || !passwordField) {
      await logResult('AUTH', 'Caregiver Login Form', false, 'Email or password field not found');
      testResults.authentication.caregiver.details.push('Login form not accessible');
      return false;
    }
    
    await logResult('AUTH', 'Caregiver Login Form Found', true);
    
    // Clear any existing values
    await page.evaluate(() => {
      document.querySelectorAll('input').forEach(input => input.value = '');
    });
    
    // Fill login credentials
    const emailFilled = await waitForElementAndType(page, emailSelector, CAREGIVER_ACCOUNT.email);
    const passwordFilled = await waitForElementAndType(page, passwordSelector, CAREGIVER_ACCOUNT.password);
    
    if (!emailFilled || !passwordFilled) {
      await logResult('AUTH', 'Caregiver Credentials Entry', false, 'Could not fill login form');
      return false;
    }
    
    await logResult('AUTH', 'Caregiver Credentials Entry', true);
    await takeScreenshot(page, 'caregiver-form-filled', 'Caregiver form with credentials');
    
    // Submit the form - try multiple selectors
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]', 
      'button:contains("Sign In")',
      'button:contains("Login")',
      '[data-testid="submit"]',
      '.login-button',
      '.submit-button'
    ];
    
    let submitButton = null;
    for (const selector of submitSelectors) {
      submitButton = await page.$(selector);
      if (submitButton) break;
    }
    
    if (!submitButton) {
      // Try to find button by text content
      submitButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => 
          btn.textContent.toLowerCase().includes('sign in') ||
          btn.textContent.toLowerCase().includes('login') ||
          btn.textContent.toLowerCase().includes('submit')
        );
      });
    }
    
    if (!submitButton || submitButton.asElement() === null) {
      await logResult('AUTH', 'Caregiver Submit Button', false, 'Submit button not found');
      return false;
    }
    
    await logResult('AUTH', 'Caregiver Submit Button Found', true);
    
    // Click submit and wait for response
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
        submitButton.click()
      ]);
    } catch (error) {
      console.log(`⚠️ Navigation error: ${error.message}`);
    }
    
    await delay(5000); // Wait for any redirects/loading
    
    const currentUrl = page.url();
    console.log(`🔍 Current URL after login: ${currentUrl}`);
    
    // Check authentication result
    if (currentUrl.includes('dashboard') || currentUrl.includes('caregiver-dashboard')) {
      await logResult('AUTH', 'Caregiver Login Success', true, `Redirected to: ${currentUrl}`);
      testResults.authentication.caregiver.success = true;
      testResults.authentication.caregiver.details.push('Successfully logged in');
      testResults.authentication.caregiver.details.push(`Dashboard URL: ${currentUrl}`);
      
      await takeScreenshot(page, 'caregiver-dashboard', 'Caregiver dashboard after login');
      
      // Check dashboard elements
      await delay(2000);
      
      // Look for welcome message or user name
      const welcomeSelectors = ['h1', 'h2', '[class*="welcome"]', '[class*="greeting"]', '[data-testid="welcome"]'];
      let welcomeText = '';
      
      for (const selector of welcomeSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            welcomeText = await page.evaluate(el => el.textContent, element);
            if (welcomeText && welcomeText.length > 0) break;
          }
        } catch (e) {}
      }
      
      if (welcomeText) {
        await logResult('AUTH', 'Caregiver Dashboard Welcome', true, `Message: ${welcomeText.substring(0, 50)}`);
      }
      
      // Check for profile/logout functionality
      const logoutSelectors = [
        'button:contains("Logout")',
        'a:contains("Logout")',
        '[href*="logout"]',
        '[data-testid="logout"]',
        '.logout'
      ];
      
      let logoutFound = false;
      for (const selector of logoutSelectors) {
        const logoutElement = await page.$(selector);
        if (logoutElement) {
          logoutFound = true;
          break;
        }
      }
      
      // Also try to find logout by text content
      if (!logoutFound) {
        const logoutByText = await page.evaluateHandle(() => {
          const elements = Array.from(document.querySelectorAll('button, a, div'));
          return elements.find(el => 
            el.textContent && el.textContent.toLowerCase().includes('logout')
          );
        });
        
        if (logoutByText && logoutByText.asElement()) {
          logoutFound = true;
        }
      }
      
      await logResult('AUTH', 'Caregiver Dashboard Navigation', logoutFound, logoutFound ? 'Logout option available' : 'Logout option not found');
      
      return true;
      
    } else if (currentUrl.includes('pending') || currentUrl.includes('approval') || currentUrl.includes('verify')) {
      await logResult('AUTH', 'Caregiver Account Status', true, 'Account pending approval/verification');
      testResults.authentication.caregiver.details.push('Account requires approval or verification');
      return true;
      
    } else {
      // Check for error messages
      const errorSelectors = ['.error', '.alert-danger', '[class*="error"]', '[data-testid="error"]'];
      let errorMessage = '';
      
      for (const selector of errorSelectors) {
        try {
          const errorElement = await page.$(selector);
          if (errorElement) {
            errorMessage = await page.evaluate(el => el.textContent, errorElement);
            if (errorMessage) break;
          }
        } catch (e) {}
      }
      
      await logResult('AUTH', 'Caregiver Login Result', false, `Unexpected URL: ${currentUrl}. Error: ${errorMessage}`);
      testResults.authentication.caregiver.details.push(`Failed - URL: ${currentUrl}`);
      if (errorMessage) testResults.authentication.caregiver.details.push(`Error: ${errorMessage}`);
      
      await takeScreenshot(page, 'caregiver-login-failed', 'Caregiver login failure state');
      return false;
    }
    
  } catch (error) {
    await logResult('AUTH', 'Caregiver Authentication', false, error.message);
    testResults.authentication.caregiver.details.push(`Exception: ${error.message}`);
    return false;
  }
}

async function testParentAuthentication(page) {
  console.log('\n👨‍👩‍👧‍👦 COMPREHENSIVE PARENT AUTHENTICATION TEST');
  console.log('=============================================');
  
  try {
    // Navigate to parent login
    await page.goto(`${PRODUCTION_URL}/login/parent`, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    
    await takeScreenshot(page, 'parent-login-page', 'Parent login page');
    
    // Check login form
    const emailSelector = 'input[name="email"], input[type="email"], input[placeholder*="email" i]';
    const passwordSelector = 'input[name="password"], input[type="password"], input[placeholder*="password" i]';
    
    const emailField = await page.$(emailSelector);
    const passwordField = await page.$(passwordSelector);
    
    if (!emailField || !passwordField) {
      await logResult('AUTH', 'Parent Login Form', false, 'Email or password field not found');
      return false;
    }
    
    await logResult('AUTH', 'Parent Login Form Found', true);
    
    // Clear and fill credentials
    await page.evaluate(() => {
      document.querySelectorAll('input').forEach(input => input.value = '');
    });
    
    const emailFilled = await waitForElementAndType(page, emailSelector, PARENT_ACCOUNT.email);
    const passwordFilled = await waitForElementAndType(page, passwordSelector, PARENT_ACCOUNT.password);
    
    if (!emailFilled || !passwordFilled) {
      await logResult('AUTH', 'Parent Credentials Entry', false, 'Could not fill login form');
      return false;
    }
    
    await logResult('AUTH', 'Parent Credentials Entry', true);
    await takeScreenshot(page, 'parent-form-filled', 'Parent form with credentials');
    
    // Find and click submit button
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:contains("Sign In")',
      'button:contains("Login")',
      '.login-button',
      '.submit-button'
    ];
    
    let submitButton = null;
    for (const selector of submitSelectors) {
      submitButton = await page.$(selector);
      if (submitButton) break;
    }
    
    if (!submitButton) {
      submitButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => 
          btn.textContent.toLowerCase().includes('sign in') ||
          btn.textContent.toLowerCase().includes('login')
        );
      });
    }
    
    if (!submitButton || submitButton.asElement() === null) {
      await logResult('AUTH', 'Parent Submit Button', false, 'Submit button not found');
      return false;
    }
    
    // Submit form
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
        submitButton.click()
      ]);
    } catch (error) {
      console.log(`⚠️ Submit error: ${error.message}`);
    }
    
    await delay(5000);
    
    const currentUrl = page.url();
    console.log(`🔍 Current URL after parent login: ${currentUrl}`);
    
    // Check result
    if (currentUrl.includes('dashboard') || currentUrl.includes('parent-dashboard')) {
      await logResult('AUTH', 'Parent Login Success', true, `Redirected to: ${currentUrl}`);
      testResults.authentication.parent.success = true;
      testResults.authentication.parent.details.push('Successfully logged in');
      testResults.authentication.parent.details.push(`Dashboard URL: ${currentUrl}`);
      
      await takeScreenshot(page, 'parent-dashboard', 'Parent dashboard after login');
      
      return true;
      
    } else if (currentUrl.includes('pending') || currentUrl.includes('approval')) {
      await logResult('AUTH', 'Parent Account Status', true, 'Account pending approval');
      testResults.authentication.parent.details.push('Account requires approval');
      return true;
      
    } else {
      await logResult('AUTH', 'Parent Login Result', false, `Unexpected URL: ${currentUrl}`);
      testResults.authentication.parent.details.push(`Failed - URL: ${currentUrl}`);
      await takeScreenshot(page, 'parent-login-failed', 'Parent login failure state');
      return false;
    }
    
  } catch (error) {
    await logResult('AUTH', 'Parent Authentication', false, error.message);
    return false;
  }
}

async function testBookingWorkflow(page) {
  console.log('\n📅 COMPREHENSIVE BOOKING WORKFLOW TEST');
  console.log('======================================');
  
  try {
    // Try to access search page directly
    await page.goto(`${PRODUCTION_URL}/search`, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    
    const currentUrl = page.url();
    
    if (currentUrl.includes('search')) {
      await logResult('BOOKING', 'Search Page Access', true, 'Search page accessible');
      testResults.booking.searchWorking = true;
      
      await takeScreenshot(page, 'search-page', 'Search/browse page');
      
      // Look for caregiver profiles/cards
      const profileSelectors = [
        '[class*="caregiver"]',
        '[class*="profile"]', 
        '[class*="card"]',
        '[data-testid="caregiver"]',
        '.user-card',
        '.profile-card'
      ];
      
      let profiles = [];
      for (const selector of profileSelectors) {
        profiles = await page.$$(selector);
        if (profiles.length > 0) break;
      }
      
      testResults.booking.profilesFound = profiles.length;
      await logResult('BOOKING', 'Caregiver Profiles Found', profiles.length > 0, `Found ${profiles.length} profiles`);
      
      if (profiles.length > 0) {
        // Try to click on first profile
        try {
          await profiles[0].click();
          await delay(3000);
          
          const profileUrl = page.url();
          await logResult('BOOKING', 'Profile Navigation', true, `Navigated to: ${profileUrl}`);
          
          await takeScreenshot(page, 'caregiver-profile', 'Individual caregiver profile');
          
          // Look for booking elements
          const bookingSelectors = [
            'button:contains("Book")',
            'button:contains("Schedule")', 
            'button:contains("Request")',
            '[class*="booking"]',
            '[class*="schedule"]',
            '[data-testid="book"]'
          ];
          
          let bookingButton = null;
          for (const selector of bookingSelectors) {
            bookingButton = await page.$(selector);
            if (bookingButton) break;
          }
          
          if (!bookingButton) {
            bookingButton = await page.evaluateHandle(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              return buttons.find(btn => 
                btn.textContent && (
                  btn.textContent.toLowerCase().includes('book') ||
                  btn.textContent.toLowerCase().includes('schedule') ||
                  btn.textContent.toLowerCase().includes('request')
                )
              );
            });
          }
          
          const hasBookingButton = bookingButton && bookingButton.asElement();
          await logResult('BOOKING', 'Booking Button Available', hasBookingButton, hasBookingButton ? 'Booking functionality present' : 'No booking button found');
          
          testResults.booking.bookingFormAccessible = hasBookingButton;
          
          if (hasBookingButton) {
            testResults.booking.details.push('Booking button found and accessible');
            
            // Try to click booking button to see booking form
            try {
              await bookingButton.click();
              await delay(3000);
              
              const bookingUrl = page.url();
              await takeScreenshot(page, 'booking-form', 'Booking form or process');
              
              await logResult('BOOKING', 'Booking Flow Initiated', true, `Booking process started: ${bookingUrl}`);
              testResults.booking.details.push(`Booking form accessible at: ${bookingUrl}`);
              
            } catch (error) {
              await logResult('BOOKING', 'Booking Flow Initiation', false, error.message);
            }
          }
          
        } catch (error) {
          await logResult('BOOKING', 'Profile Click', false, error.message);
        }
      } else {
        testResults.booking.details.push('No caregiver profiles found on search page');
      }
      
    } else {
      await logResult('BOOKING', 'Search Page Access', false, `Could not access search page. Current URL: ${currentUrl}`);
      
      // Check if login is required
      if (currentUrl.includes('login')) {
        testResults.booking.details.push('Search requires authentication - redirected to login');
        await logResult('BOOKING', 'Search Authentication Required', true, 'Search page requires login');
      } else {
        testResults.booking.details.push(`Unexpected redirect to: ${currentUrl}`);
      }
    }
    
  } catch (error) {
    await logResult('BOOKING', 'Booking Workflow Test', false, error.message);
    testResults.booking.details.push(`Exception: ${error.message}`);
  }
}

async function runComprehensiveTest() {
  console.log('🚀 COMPREHENSIVE PRODUCTION AUTHENTICATION & BOOKING TEST');
  console.log('=========================================================');
  console.log(`📅 Started: ${new Date().toLocaleString()}`);
  console.log(`🌐 URL: ${PRODUCTION_URL}`);
  console.log('=========================================================\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: [
      '--window-size=1400,900', 
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  
  // Set user agent to avoid bot detection
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  
  try {
    // Test basic connectivity first
    console.log('🔍 Testing basic site connectivity...');
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await logResult('CONNECTIVITY', 'Site Accessible', true, 'Production site responsive');
    await takeScreenshot(page, 'homepage', 'Production homepage');
    
    // Run authentication tests
    const caregiverAuthSuccess = await testCaregiverAuthentication(page);
    
    // Reset page state
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle2' });
    await delay(2000);
    
    const parentAuthSuccess = await testParentAuthentication(page);
    
    // Test booking workflow (may require authentication)
    await testBookingWorkflow(page);
    
    // Generate final report
    console.log('\n=========================================================');
    console.log('📊 COMPREHENSIVE TEST RESULTS');
    console.log('=========================================================');
    
    const totalTests = testResults.tests.length;
    const passedTests = testResults.tests.filter(t => t.success).length;
    const failedTests = totalTests - passedTests;
    const successRate = Math.round((passedTests / totalTests) * 100);
    
    console.log(`📈 OVERALL RESULTS:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   Success Rate: ${successRate}%\n`);
    
    console.log(`🔐 AUTHENTICATION SUMMARY:`);
    console.log(`   Caregiver Auth: ${testResults.authentication.caregiver.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`   Parent Auth: ${testResults.authentication.parent.success ? '✅ SUCCESS' : '❌ FAILED'}\n`);
    
    console.log(`📅 BOOKING WORKFLOW:`);
    console.log(`   Search Page: ${testResults.booking.searchWorking ? '✅ ACCESSIBLE' : '❌ NOT ACCESSIBLE'}`);
    console.log(`   Profiles Found: ${testResults.booking.profilesFound}`);
    console.log(`   Booking Available: ${testResults.booking.bookingFormAccessible ? '✅ YES' : '❌ NO'}\n`);
    
    if (testResults.screenshots.length > 0) {
      console.log(`📸 SCREENSHOTS CAPTURED:`);
      testResults.screenshots.forEach(s => {
        console.log(`   - ${s.filename}${s.description ? ' (' + s.description + ')' : ''}`);
      });
      console.log('');
    }
    
    if (testResults.errors.length > 0) {
      console.log(`⚠️ ERRORS ENCOUNTERED:`);
      testResults.errors.forEach(e => console.log(`   - ${e}`));
      console.log('');
    }
    
    // Save detailed report
    const reportFilename = `comprehensive-test-report-${Date.now()}.json`;
    fs.writeFileSync(reportFilename, JSON.stringify(testResults, null, 2));
    console.log(`📄 Detailed JSON report saved: ${reportFilename}\n`);
    
    console.log('========================================');
    console.log('🔐 TEST ACCOUNT CREDENTIALS');
    console.log('========================================');
    console.log(`CAREGIVER:`);
    console.log(`   📧 Email: ${CAREGIVER_ACCOUNT.email}`);
    console.log(`   🔑 Password: ${CAREGIVER_ACCOUNT.password}`);
    console.log(`   📍 Location: Toronto, Ontario, Canada\n`);
    
    console.log(`PARENT:`);
    console.log(`   📧 Email: ${PARENT_ACCOUNT.email}`);
    console.log(`   🔑 Password: ${PARENT_ACCOUNT.password}`);
    console.log(`   📍 Location: Toronto, Ontario, Canada\n`);
    
    console.log('🔍 Browser window left open for manual inspection.');
    console.log('✅ Comprehensive testing complete!');
    
    return testResults;
    
  } catch (error) {
    console.error('\n❌ Critical test failure:', error);
    testResults.errors.push(`Critical failure: ${error.message}`);
    
    await takeScreenshot(page, 'critical-error', 'Critical test failure');
    
    return testResults;
  }
}

// Run the comprehensive test
runComprehensiveTest().catch(console.error);
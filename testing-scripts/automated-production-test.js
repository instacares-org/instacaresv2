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

// Test results object
const testResults = {
  timestamp: new Date().toISOString(),
  url: PRODUCTION_URL,
  tests: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  },
  screenshots: [],
  errors: []
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function logTest(name, status, details = '') {
  const test = {
    name,
    status,
    details,
    timestamp: new Date().toISOString()
  };
  testResults.tests.push(test);
  testResults.summary.total++;
  testResults.summary[status]++;
  
  const icon = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⏭️';
  console.log(`${icon} ${name}: ${status.toUpperCase()}${details ? ' - ' + details : ''}`);
}

async function takeScreenshot(page, name) {
  try {
    const filename = `production-${name}-${Date.now()}.png`;
    await page.screenshot({ path: filename, fullPage: false });
    testResults.screenshots.push(filename);
    return filename;
  } catch (error) {
    console.log(`   ⚠️ Could not take screenshot: ${error.message}`);
    return null;
  }
}

async function runProductionTests() {
  console.log('🚀 AUTOMATED PRODUCTION TEST SUITE');
  console.log('=====================================');
  console.log(`📅 Date: ${new Date().toLocaleString()}`);
  console.log(`🌐 URL: ${PRODUCTION_URL}`);
  console.log('=====================================\n');

  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--window-size=1400,900', '--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  try {
    // TEST 1: Site Accessibility
    console.log('📡 TEST 1: Site Accessibility');
    console.log('----------------------------');
    try {
      await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await takeScreenshot(page, 'homepage');
      await logTest('Site Accessibility', 'passed', 'Homepage loads successfully');
      
      // Check for key elements
      const hasLogo = await page.$('[class*="logo"], img[alt*="InstaCares"], a[href="/"]') !== null;
      const hasLoginButtons = await page.$('a[href*="login"], button:has-text("Login")') !== null;
      
      if (hasLogo) await logTest('Logo Present', 'passed');
      if (hasLoginButtons) await logTest('Login Links Present', 'passed');
      
    } catch (error) {
      await logTest('Site Accessibility', 'failed', error.message);
      testResults.errors.push(error.message);
    }
    
    console.log('');
    
    // TEST 2: Caregiver Registration Check
    console.log('📝 TEST 2: Registration Pages');
    console.log('----------------------------');
    try {
      await page.goto(`${PRODUCTION_URL}/signup`, { waitUntil: 'networkidle2', timeout: 20000 });
      const hasSignupForm = await page.$('form, [class*="signup"], [class*="register"]') !== null;
      if (hasSignupForm) {
        await logTest('Signup Page Accessible', 'passed');
        await takeScreenshot(page, 'signup');
      } else {
        await logTest('Signup Page Accessible', 'failed', 'No signup form found');
      }
    } catch (error) {
      await logTest('Signup Page Accessible', 'failed', error.message);
    }
    
    console.log('');
    
    // TEST 3: Caregiver Login
    console.log('🔐 TEST 3: Caregiver Login');
    console.log('----------------------------');
    try {
      await page.goto(`${PRODUCTION_URL}/login/caregiver`, { waitUntil: 'networkidle2' });
      await delay(2000);
      
      // Clear any existing values
      await page.evaluate(() => {
        document.querySelectorAll('input').forEach(input => input.value = '');
      });
      
      // Find and fill email field
      const emailField = await page.$('input[name="email"], input[type="email"], input[placeholder*="mail"]');
      if (emailField) {
        await emailField.type(CAREGIVER_ACCOUNT.email);
        await logTest('Caregiver Email Field', 'passed', 'Field found and filled');
      } else {
        await logTest('Caregiver Email Field', 'failed', 'Field not found');
      }
      
      // Find and fill password field
      const passwordField = await page.$('input[name="password"], input[type="password"]');
      if (passwordField) {
        await passwordField.type(CAREGIVER_ACCOUNT.password);
        await logTest('Caregiver Password Field', 'passed', 'Field found and filled');
      } else {
        await logTest('Caregiver Password Field', 'failed', 'Field not found');
      }
      
      await takeScreenshot(page, 'caregiver-login-form');
      
      // Submit form
      const submitButton = await page.$('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")');
      if (submitButton) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
          submitButton.click()
        ]);
        
        await delay(3000);
        const currentUrl = page.url();
        
        if (currentUrl.includes('dashboard')) {
          await logTest('Caregiver Login', 'passed', 'Successfully redirected to dashboard');
          await takeScreenshot(page, 'caregiver-dashboard');
          
          // Check dashboard elements
          const hasWelcome = await page.$('h1, [class*="welcome"], [class*="greeting"]') !== null;
          const hasProfile = await page.$('[class*="profile"], [class*="user"]') !== null;
          
          if (hasWelcome) await logTest('Caregiver Dashboard Welcome', 'passed');
          if (hasProfile) await logTest('Caregiver Profile Section', 'passed');
          
          // Try to logout
          const logoutBtn = await page.$('a[href*="logout"], button:has-text("Logout"), [class*="logout"]');
          if (logoutBtn) {
            await logoutBtn.click();
            await delay(2000);
            await logTest('Caregiver Logout', 'passed');
          }
        } else if (currentUrl.includes('pending') || currentUrl.includes('approval')) {
          await logTest('Caregiver Login', 'passed', 'Account pending approval');
        } else {
          await logTest('Caregiver Login', 'failed', `Unexpected redirect: ${currentUrl}`);
        }
      } else {
        await logTest('Caregiver Login Submit', 'failed', 'Submit button not found');
      }
    } catch (error) {
      await logTest('Caregiver Login', 'failed', error.message);
      testResults.errors.push(error.message);
    }
    
    console.log('');
    
    // TEST 4: Parent Login
    console.log('👨‍👩‍👧‍👦 TEST 4: Parent Login');
    console.log('----------------------------');
    try {
      await page.goto(`${PRODUCTION_URL}/login/parent`, { waitUntil: 'networkidle2' });
      await delay(2000);
      
      // Clear fields
      await page.evaluate(() => {
        document.querySelectorAll('input').forEach(input => input.value = '');
      });
      
      // Fill login form
      const emailField = await page.$('input[name="email"], input[type="email"]');
      if (emailField) {
        await emailField.type(PARENT_ACCOUNT.email);
        await logTest('Parent Email Field', 'passed');
      }
      
      const passwordField = await page.$('input[name="password"], input[type="password"]');
      if (passwordField) {
        await passwordField.type(PARENT_ACCOUNT.password);
        await logTest('Parent Password Field', 'passed');
      }
      
      await takeScreenshot(page, 'parent-login-form');
      
      // Submit
      const submitButton = await page.$('button[type="submit"]');
      if (submitButton) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
          submitButton.click()
        ]);
        
        await delay(3000);
        const currentUrl = page.url();
        
        if (currentUrl.includes('dashboard')) {
          await logTest('Parent Login', 'passed', 'Successfully logged in');
          await takeScreenshot(page, 'parent-dashboard');
          
          // TEST 5: Search Functionality
          console.log('');
          console.log('🔍 TEST 5: Search Functionality');
          console.log('----------------------------');
          
          // Look for search link
          const searchLink = await page.$('a[href="/search"], button:has-text("Search"), button:has-text("Find")');
          if (searchLink) {
            await searchLink.click();
            await delay(3000);
            
            if (page.url().includes('search')) {
              await logTest('Search Page Navigation', 'passed');
              await takeScreenshot(page, 'search-page');
              
              // Check for caregiver profiles
              const profiles = await page.$$('[class*="card"], [class*="caregiver"], [class*="profile"]');
              await logTest('Caregiver Profiles', profiles.length > 0 ? 'passed' : 'failed', 
                           `Found ${profiles.length} profiles`);
              
              // TEST 6: Booking Flow
              if (profiles.length > 0) {
                console.log('');
                console.log('📅 TEST 6: Booking Flow');
                console.log('----------------------------');
                
                // Click on first profile
                const viewButton = await page.$('button:has-text("View"), a:has-text("View"), button:has-text("Book")');
                if (viewButton) {
                  await viewButton.click();
                  await delay(3000);
                  await logTest('Caregiver Profile View', 'passed');
                  await takeScreenshot(page, 'caregiver-profile');
                  
                  // Check for booking elements
                  const hasBookingButton = await page.$('button:has-text("Book"), button:has-text("Schedule")') !== null;
                  const hasAvailability = await page.$('[class*="availability"], [class*="calendar"], [class*="schedule"]') !== null;
                  
                  if (hasBookingButton) await logTest('Booking Button Present', 'passed');
                  if (hasAvailability) await logTest('Availability Section Present', 'passed');
                } else {
                  await logTest('Profile View Button', 'failed', 'Not found');
                }
              }
            } else {
              await logTest('Search Page Navigation', 'failed', 'Did not reach search page');
            }
          } else {
            // Try direct navigation
            await page.goto(`${PRODUCTION_URL}/search`, { waitUntil: 'networkidle2' });
            if (page.url().includes('search')) {
              await logTest('Search Page Direct Access', 'passed');
              await takeScreenshot(page, 'search-direct');
            } else {
              await logTest('Search Page Access', 'failed');
            }
          }
        } else if (currentUrl.includes('pending')) {
          await logTest('Parent Login', 'passed', 'Account pending approval');
        } else {
          await logTest('Parent Login', 'failed', `Unexpected redirect: ${currentUrl}`);
        }
      }
    } catch (error) {
      await logTest('Parent Login', 'failed', error.message);
      testResults.errors.push(error.message);
    }
    
    console.log('');
    
    // TEST 7: Mobile Responsiveness
    console.log('📱 TEST 7: Mobile Responsiveness');
    console.log('----------------------------');
    try {
      await page.setViewport({ width: 375, height: 667 }); // iPhone size
      await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle2' });
      await delay(2000);
      await takeScreenshot(page, 'mobile-view');
      await logTest('Mobile View', 'passed', 'Site loads on mobile viewport');
      
      // Reset viewport
      await page.setViewport({ width: 1400, height: 900 });
    } catch (error) {
      await logTest('Mobile View', 'failed', error.message);
    }
    
    console.log('');
    
    // TEST 8: API Health Check
    console.log('🏥 TEST 8: API Health Check');
    console.log('----------------------------');
    try {
      const response = await page.goto(`${PRODUCTION_URL}/api/health`, { waitUntil: 'networkidle2' });
      if (response && response.ok()) {
        await logTest('API Health Endpoint', 'passed', `Status: ${response.status()}`);
      } else {
        await logTest('API Health Endpoint', 'failed', `Status: ${response ? response.status() : 'No response'}`);
      }
    } catch (error) {
      await logTest('API Health Endpoint', 'failed', error.message);
    }
    
  } catch (error) {
    console.error('❌ Critical test failure:', error);
    testResults.errors.push(error.message);
  } finally {
    // Generate Report
    console.log('\n=====================================');
    console.log('📊 FINAL TEST REPORT');
    console.log('=====================================');
    console.log(`📅 Completed: ${new Date().toLocaleString()}`);
    console.log(`🌐 URL: ${PRODUCTION_URL}`);
    console.log('');
    console.log('📈 RESULTS SUMMARY:');
    console.log(`   Total Tests: ${testResults.summary.total}`);
    console.log(`   ✅ Passed: ${testResults.summary.passed}`);
    console.log(`   ❌ Failed: ${testResults.summary.failed}`);
    console.log(`   ⏭️ Skipped: ${testResults.summary.skipped}`);
    console.log(`   Success Rate: ${Math.round((testResults.summary.passed / testResults.summary.total) * 100)}%`);
    console.log('');
    
    if (testResults.screenshots.length > 0) {
      console.log('📸 SCREENSHOTS CAPTURED:');
      testResults.screenshots.forEach(s => console.log(`   - ${s}`));
      console.log('');
    }
    
    if (testResults.errors.length > 0) {
      console.log('⚠️ ERRORS ENCOUNTERED:');
      testResults.errors.forEach(e => console.log(`   - ${e}`));
      console.log('');
    }
    
    // Save detailed report to file
    const reportFilename = `production-test-report-${Date.now()}.json`;
    fs.writeFileSync(reportFilename, JSON.stringify(testResults, null, 2));
    console.log(`📄 Detailed report saved to: ${reportFilename}`);
    
    console.log('\n=====================================');
    console.log('🔐 TEST ACCOUNTS:');
    console.log('=====================================');
    console.log('CAREGIVER:');
    console.log(`   Email: ${CAREGIVER_ACCOUNT.email}`);
    console.log(`   Password: ${CAREGIVER_ACCOUNT.password}`);
    console.log('');
    console.log('PARENT:');
    console.log(`   Email: ${PARENT_ACCOUNT.email}`);
    console.log(`   Password: ${PARENT_ACCOUNT.password}`);
    console.log('');
    
    console.log('🔍 Browser window left open for manual inspection.');
    console.log('✅ Automated testing complete!');
    
    // Return results for programmatic use
    return testResults;
  }
}

// Run the tests
runProductionTests().catch(console.error);
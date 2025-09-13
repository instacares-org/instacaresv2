const puppeteer = require('puppeteer');

async function testBrowserLogin() {
  console.log('🌐 TESTING NEXTAUTH WITH BROWSER AUTOMATION');
  console.log('===========================================\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,  // Show browser for debugging
    slowMo: 1000      // Slow down actions
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable console logging from the page
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error') {
        console.log(`[Browser] ${msg.type()}: ${msg.text()}`);
      }
    });
    
    // Test 1: Navigate to production site
    console.log('1️⃣ Navigating to production caregiver login...');
    await page.goto('https://instacares.net/login/caregiver', { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    console.log('   ✅ Page loaded successfully');
    
    // Test 2: Fill in login form
    console.log('2️⃣ Filling in login credentials...');
    
    // Wait for form elements
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    
    // Fill in the form
    await page.type('input[name="email"]', 'sarah.johnson@testmail.ca');
    await page.type('input[name="password"]', 'TestCaregiver123!');
    
    console.log('   ✅ Credentials filled');
    
    // Test 3: Submit form and check response
    console.log('3️⃣ Submitting login form...');
    
    // Listen for network requests
    const responses = [];
    page.on('response', response => {
      if (response.url().includes('/api/auth/')) {
        responses.push({
          url: response.url(),
          status: response.status()
        });
      }
    });
    
    // Click submit button
    const submitButton = await page.$('button[type="submit"]');
    if (submitButton) {
      await submitButton.click();
    } else {
      console.log('   ❌ Submit button not found, trying form submit');
      await page.keyboard.press('Enter');
    }
    
    // Wait for navigation or response
    try {
      await page.waitForNavigation({ timeout: 15000 });
      console.log(`   ✅ Navigation occurred to: ${page.url()}`);
    } catch (navError) {
      console.log('   ⚠️ No navigation, checking current page...');
      console.log(`   Current URL: ${page.url()}`);
    }
    
    // Test 4: Check authentication result
    console.log('4️⃣ Checking authentication result...');
    
    const currentUrl = page.url();
    console.log(`   Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/caregiver-dashboard')) {
      console.log('   ✅ SUCCESS: Redirected to caregiver dashboard!');
    } else if (currentUrl.includes('/login')) {
      console.log('   ❌ FAILED: Still on login page');
      
      // Check for error messages
      const errorElements = await page.$$('.error, .text-red-500, [role="alert"]');
      if (errorElements.length > 0) {
        for (const element of errorElements) {
          const text = await page.evaluate(el => el.textContent, element);
          console.log(`   Error message: ${text}`);
        }
      }
    } else {
      console.log('   ⚠️ UNCLEAR: Unexpected URL');
    }
    
    // Check network responses
    console.log('5️⃣ Network responses:');
    responses.forEach(resp => {
      console.log(`   ${resp.status} ${resp.url}`);
    });
    
    // Test 5: Check session manually
    console.log('6️⃣ Checking session via API...');
    const sessionResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/auth/session');
        return await response.json();
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('   Session data:', JSON.stringify(sessionResponse, null, 2));
    
    console.log('\n✅ Browser testing complete!');
    
  } catch (error) {
    console.error('❌ Browser test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testBrowserLogin().catch(console.error);
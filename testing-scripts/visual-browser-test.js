const puppeteer = require('puppeteer');

async function visualBrowserTest() {
  console.log('👁️ VISUAL BROWSER TEST - AUTHENTICATION DEMO');
  console.log('=============================================\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,  // Show the browser window
    slowMo: 2000,     // Slow down actions so you can see them
    args: [
      '--start-maximized',
      '--no-sandbox', 
      '--disable-setuid-sandbox'
    ],
    defaultViewport: null
  });
  
  try {
    const page = await browser.newPage();
    
    console.log('🎬 Starting visual demo...');
    console.log('You should see a browser window opening now!\n');
    
    // Test 1: Caregiver Login
    console.log('1️⃣ Testing CAREGIVER login...');
    console.log('   Navigating to caregiver login page...');
    
    await page.goto('https://instacares.net/login/caregiver', { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    await page.waitForTimeout(2000); // Pause so you can see the page
    
    console.log('   Filling in caregiver credentials...');
    
    // Wait for and fill email
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.type('input[name="email"]', 'sarah.johnson@testmail.ca', { delay: 100 });
    
    await page.waitForTimeout(1000);
    
    // Fill password
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    await page.type('input[name="password"]', 'TestCaregiver123!', { delay: 100 });
    
    await page.waitForTimeout(1000);
    
    console.log('   Submitting login form...');
    
    // Submit form
    const submitButton = await page.$('button[type="submit"]');
    if (submitButton) {
      await submitButton.click();
      
      // Wait for navigation
      try {
        await page.waitForNavigation({ timeout: 10000, waitUntil: 'networkidle0' });
      } catch (e) {
        console.log('   Navigation timeout, checking current page...');
      }
    }
    
    const caregiverUrl = page.url();
    console.log(`   Result: ${caregiverUrl}`);
    
    if (caregiverUrl.includes('/caregiver-dashboard')) {
      console.log('   ✅ SUCCESS: Caregiver logged in and redirected to dashboard!');
    } else {
      console.log('   ❌ Issue with caregiver login');
    }
    
    await page.waitForTimeout(3000); // Pause so you can see the dashboard
    
    // Test 2: Parent Login (open new tab)
    console.log('\n2️⃣ Testing PARENT login in new tab...');
    
    const parentPage = await browser.newPage();
    
    console.log('   Navigating to parent login page...');
    
    await parentPage.goto('https://instacares.net/login/parent', { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    await parentPage.waitForTimeout(2000);
    
    console.log('   Filling in parent credentials...');
    
    // Fill parent login form
    await parentPage.waitForSelector('input[name="email"]', { timeout: 10000 });
    await parentPage.type('input[name="email"]', 'michael.chen@testmail.ca', { delay: 100 });
    
    await parentPage.waitForTimeout(1000);
    
    await parentPage.waitForSelector('input[name="password"]', { timeout: 10000 });
    await parentPage.type('input[name="password"]', 'TestParent123!', { delay: 100 });
    
    await parentPage.waitForTimeout(1000);
    
    console.log('   Submitting parent login form...');
    
    const parentSubmitButton = await parentPage.$('button[type="submit"]');
    if (parentSubmitButton) {
      await parentSubmitButton.click();
      
      try {
        await parentPage.waitForNavigation({ timeout: 10000, waitUntil: 'networkidle0' });
      } catch (e) {
        console.log('   Navigation timeout, checking current page...');
      }
    }
    
    const parentUrl = parentPage.url();
    console.log(`   Result: ${parentUrl}`);
    
    if (parentUrl.includes('/parent-dashboard')) {
      console.log('   ✅ SUCCESS: Parent logged in and redirected to dashboard!');
    } else {
      console.log('   ❌ Issue with parent login');
    }
    
    await parentPage.waitForTimeout(3000);
    
    console.log('\n🎉 Visual demo complete!');
    console.log('You should see both dashboards open in separate tabs.');
    console.log('Press Ctrl+C to close the browser when you\'re done viewing.');
    
    // Keep browser open for manual inspection
    await new Promise((resolve) => {
      process.on('SIGINT', () => {
        console.log('\n👋 Closing browser...');
        resolve();
      });
    });
    
  } catch (error) {
    console.error('❌ Visual test failed:', error.message);
  } finally {
    await browser.close();
  }
}

visualBrowserTest().catch(console.error);
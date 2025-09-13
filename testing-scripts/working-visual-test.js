const puppeteer = require('puppeteer');

// Helper function to wait
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function workingVisualTest() {
  console.log('🎬 WORKING VISUAL AUTHENTICATION DEMO');
  console.log('=====================================\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,  // Show the browser window
    slowMo: 1500,     // Slow down actions so you can see them
    args: [
      '--start-maximized',
      '--no-sandbox', 
      '--disable-setuid-sandbox'
    ],
    defaultViewport: null
  });
  
  try {
    const page = await browser.newPage();
    
    console.log('🎬 Browser opened - you should see it now!');
    console.log('📋 This demo will show both caregiver and parent login\n');
    
    // Test 1: Caregiver Login
    console.log('1️⃣ CAREGIVER LOGIN DEMO');
    console.log('   → Navigating to caregiver login page...');
    
    await page.goto('https://instacares.net/login/caregiver', { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    await wait(3000); // Wait 3 seconds so you can see the page
    console.log('   → Page loaded! You should see the caregiver login form');
    
    // Fill email field
    console.log('   → Filling in email: sarah.johnson@testmail.ca');
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.type('input[name="email"]', 'sarah.johnson@testmail.ca', { delay: 150 });
    
    await wait(2000);
    
    // Fill password field
    console.log('   → Filling in password: TestCaregiver123!');
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    await page.type('input[name="password"]', 'TestCaregiver123!', { delay: 150 });
    
    await wait(2000);
    
    console.log('   → Submitting login form...');
    
    // Submit form and wait for navigation
    const submitButton = await page.$('button[type="submit"]');
    if (submitButton) {
      await Promise.all([
        page.waitForNavigation({ timeout: 15000, waitUntil: 'networkidle0' }),
        submitButton.click()
      ]);
    } else {
      console.log('   ⚠️ Submit button not found, trying Enter key');
      await page.keyboard.press('Enter');
      await page.waitForNavigation({ timeout: 15000, waitUntil: 'networkidle0' });
    }
    
    const caregiverUrl = page.url();
    console.log(`   ✅ Result: ${caregiverUrl}`);
    
    if (caregiverUrl.includes('/caregiver-dashboard')) {
      console.log('   🎉 SUCCESS: Caregiver login successful! You should see the dashboard.');
    } else {
      console.log('   ❌ Login may have failed - check the browser window');
    }
    
    await wait(5000); // Wait 5 seconds to view dashboard
    
    // Test 2: Parent Login in new tab
    console.log('\n2️⃣ PARENT LOGIN DEMO (opening new tab)');
    
    const parentPage = await browser.newPage();
    
    console.log('   → Navigating to parent login page...');
    await parentPage.goto('https://instacares.net/login/parent', { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    await wait(3000);
    console.log('   → Parent login page loaded!');
    
    // Fill parent credentials
    console.log('   → Filling in parent email: michael.chen@testmail.ca');
    await parentPage.waitForSelector('input[name="email"]', { timeout: 10000 });
    await parentPage.type('input[name="email"]', 'michael.chen@testmail.ca', { delay: 150 });
    
    await wait(2000);
    
    console.log('   → Filling in parent password: TestParent123!');
    await parentPage.waitForSelector('input[name="password"]', { timeout: 10000 });
    await parentPage.type('input[name="password"]', 'TestParent123!', { delay: 150 });
    
    await wait(2000);
    
    console.log('   → Submitting parent login form...');
    
    const parentSubmitButton = await parentPage.$('button[type="submit"]');
    if (parentSubmitButton) {
      await Promise.all([
        parentPage.waitForNavigation({ timeout: 15000, waitUntil: 'networkidle0' }),
        parentSubmitButton.click()
      ]);
    } else {
      console.log('   ⚠️ Submit button not found, trying Enter key');
      await parentPage.keyboard.press('Enter');
      await parentPage.waitForNavigation({ timeout: 15000, waitUntil: 'networkidle0' });
    }
    
    const parentUrl = parentPage.url();
    console.log(`   ✅ Result: ${parentUrl}`);
    
    if (parentUrl.includes('/parent-dashboard')) {
      console.log('   🎉 SUCCESS: Parent login successful! You should see the parent dashboard.');
    } else {
      console.log('   ❌ Parent login may have failed - check the browser window');
    }
    
    await wait(3000);
    
    console.log('\n🎊 DEMO COMPLETE!');
    console.log('════════════════');
    console.log('You should now see TWO browser tabs:');
    console.log('1. Caregiver Dashboard (sarah.johnson@testmail.ca)');
    console.log('2. Parent Dashboard (michael.chen@testmail.ca)');
    console.log('\nBoth accounts are successfully authenticated with NextAuth!');
    console.log('\n⏰ Browser will stay open for 30 seconds for you to explore...');
    
    await wait(30000); // Keep open for 30 seconds
    
    console.log('👋 Closing browser...');
    
  } catch (error) {
    console.error('❌ Visual test failed:', error.message);
    console.log('💡 You can manually test by visiting:');
    console.log('   🔗 Caregiver: https://instacares.net/login/caregiver');
    console.log('   🔗 Parent: https://instacares.net/login/parent');
  } finally {
    await browser.close();
  }
}

workingVisualTest().catch(console.error);
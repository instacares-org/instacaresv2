const puppeteer = require('puppeteer');

// Production URL - Testing both possible domains
const PRODUCTION_URLS = [
  'https://instacares.net',
  'https://instacares.com',
  'http://72.60.71.43' // IP address if domain not configured
];

let PRODUCTION_URL = PRODUCTION_URLS[0]; // Start with instacares.net

async function testProductionAccounts() {
  console.log('🌐 Testing Production Environment...\n');
  console.log('URL:', PRODUCTION_URL);
  console.log('========================================\n');
  
  const browser = await puppeteer.launch({ 
    headless: false, 
    args: ['--window-size=1400,900'] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  try {
    // First, let's check if the production site is accessible
    console.log('📡 Checking production site availability...');
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✅ Production site is accessible\n');
    
    // Test Caregiver Registration/Login
    console.log('1️⃣ Testing Caregiver Account...');
    console.log('   Email: sarah.johnson@testmail.ca');
    console.log('   Password: TestCaregiver123!');
    
    // Try to navigate to caregiver login
    await page.goto(`${PRODUCTION_URL}/login/caregiver`, { waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000);
    
    // Check if login form exists
    const hasEmailField = await page.$('input[name="email"], input[type="email"]') !== null;
    const hasPasswordField = await page.$('input[name="password"], input[type="password"]') !== null;
    
    if (hasEmailField && hasPasswordField) {
      console.log('   ✅ Login form found');
      
      // Try to login
      await page.type('input[name="email"], input[type="email"]', 'sarah.johnson@testmail.ca');
      await page.type('input[name="password"], input[type="password"]', 'TestCaregiver123!');
      
      // Find and click submit button
      const submitButton = await page.$('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")');
      if (submitButton) {
        await submitButton.click();
        console.log('   ⏳ Attempting login...');
        
        // Wait for response
        await page.waitForTimeout(5000);
        
        const currentUrl = page.url();
        if (currentUrl.includes('dashboard')) {
          console.log('   ✅ Login successful! Redirected to dashboard');
        } else if (currentUrl.includes('pending') || currentUrl.includes('approval')) {
          console.log('   ⚠️ Account needs approval');
        } else {
          console.log('   ℹ️ Current URL:', currentUrl);
          
          // Check for error messages
          const errorMessage = await page.$eval('*[class*="error"], *[class*="alert"]', el => el.textContent).catch(() => null);
          if (errorMessage) {
            console.log('   ⚠️ Error message:', errorMessage);
          }
        }
      }
    } else {
      console.log('   ⚠️ Login form not found - may need to register first');
    }
    
    console.log('');
    
    // Test Parent Account
    console.log('2️⃣ Testing Parent Account...');
    console.log('   Email: michael.chen@testmail.ca');
    console.log('   Password: TestParent123!');
    
    await page.goto(`${PRODUCTION_URL}/login/parent`, { waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000);
    
    // Clear any existing input
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      inputs.forEach(input => input.value = '');
    });
    
    const hasParentEmailField = await page.$('input[name="email"], input[type="email"]') !== null;
    const hasParentPasswordField = await page.$('input[name="password"], input[type="password"]') !== null;
    
    if (hasParentEmailField && hasParentPasswordField) {
      console.log('   ✅ Login form found');
      
      // Try to login
      await page.type('input[name="email"], input[type="email"]', 'michael.chen@testmail.ca');
      await page.type('input[name="password"], input[type="password"]', 'TestParent123!');
      
      const submitButton = await page.$('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")');
      if (submitButton) {
        await submitButton.click();
        console.log('   ⏳ Attempting login...');
        
        await page.waitForTimeout(5000);
        
        const currentUrl = page.url();
        if (currentUrl.includes('dashboard')) {
          console.log('   ✅ Login successful! Redirected to dashboard');
        } else if (currentUrl.includes('pending') || currentUrl.includes('approval')) {
          console.log('   ⚠️ Account needs approval');
        } else {
          console.log('   ℹ️ Current URL:', currentUrl);
          
          const errorMessage = await page.$eval('*[class*="error"], *[class*="alert"]', el => el.textContent).catch(() => null);
          if (errorMessage) {
            console.log('   ⚠️ Error message:', errorMessage);
          }
        }
      }
    } else {
      console.log('   ⚠️ Login form not found - may need to register first');
    }
    
    console.log('\n========================================');
    console.log('📊 Production Test Summary:');
    console.log('========================================');
    console.log('🌐 Production URL:', PRODUCTION_URL);
    console.log('');
    console.log('Test Accounts:');
    console.log('Caregiver: sarah.johnson@testmail.ca / TestCaregiver123!');
    console.log('Parent: michael.chen@testmail.ca / TestParent123!');
    console.log('');
    console.log('Note: If accounts don\'t exist on production,');
    console.log('you may need to register them first.');
    console.log('');
    console.log('The browser window will remain open for manual testing.');
    
    // Take screenshots for documentation
    await page.screenshot({ 
      path: `production-test-${Date.now()}.png`,
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved for reference');
    
  } catch (error) {
    console.error('\n❌ Production test failed:', error.message);
    
    // Take error screenshot
    await page.screenshot({ 
      path: `production-error-${Date.now()}.png`,
      fullPage: true 
    });
    console.log('📸 Error screenshot saved');
  }
  
  console.log('\n🔍 Browser left open for manual testing.');
  console.log('You can now manually test the production environment.');
}

// Run the test
testProductionAccounts().catch(console.error);
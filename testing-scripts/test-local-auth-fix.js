const puppeteer = require('puppeteer');

async function testLocalAuthFix() {
  console.log('🧪 TESTING LOCAL AUTHENTICATION FIXES');
  console.log('====================================\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--window-size=1400,900']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  
  try {
    // Test caregiver login locally first
    console.log('1️⃣ Testing Caregiver Login on Local...');
    
    await page.goto('http://localhost:3005/login/caregiver', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000);
    
    // Fill login form
    await page.type('input[name="email"]', 'sarah.johnson@testmail.ca');
    await page.type('input[name="password"]', 'TestCaregiver123!');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForTimeout(5000);
    
    const currentUrl = page.url();
    console.log(`   Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('caregiver-dashboard')) {
      console.log('   ✅ Local caregiver authentication working!');
      
      // Test logout
      const logoutBtn = await page.$('button:contains("Logout"), a:contains("Logout")');
      if (logoutBtn) {
        await logoutBtn.click();
        await page.waitForTimeout(2000);
      }
    } else {
      console.log('   ❌ Local caregiver authentication failed');
      
      // Check for error messages
      const errorElement = await page.$('.error, [class*="error"], .alert-danger');
      if (errorElement) {
        const errorText = await page.evaluate(el => el.textContent, errorElement);
        console.log(`   Error: ${errorText}`);
      }
    }
    
    // Test parent login
    console.log('\n2️⃣ Testing Parent Login on Local...');
    
    await page.goto('http://localhost:3005/login/parent', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(2000);
    
    // Fill login form  
    await page.type('input[name="email"]', 'michael.chen@testmail.ca');
    await page.type('input[name="password"]', 'TestParent123!');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForTimeout(5000);
    
    const parentUrl = page.url();
    console.log(`   Current URL: ${parentUrl}`);
    
    if (parentUrl.includes('parent-dashboard')) {
      console.log('   ✅ Local parent authentication working!');
    } else {
      console.log('   ❌ Local parent authentication failed');
      
      // Check for error messages
      const errorElement = await page.$('.error, [class*="error"], .alert-danger');
      if (errorElement) {
        const errorText = await page.evaluate(el => el.textContent, errorElement);
        console.log(`   Error: ${errorText}`);
      }
    }
    
    console.log('\n✅ Local authentication test complete!');
    
  } catch (error) {
    console.error('❌ Local test error:', error.message);
  }
  
  // Keep browser open for inspection
  console.log('\n🔍 Browser left open for manual testing');
}

testLocalAuthFix().catch(console.error);
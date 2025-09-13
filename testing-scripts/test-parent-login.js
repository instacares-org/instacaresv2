const puppeteer = require('puppeteer');

async function testParentLogin() {
  console.log('👨‍👩‍👧‍👦 TESTING PARENT LOGIN');
  console.log('=======================\n');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    console.log('1️⃣ Navigating to parent login page...');
    
    await page.goto('https://instacares.net/login/parent', { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    console.log('2️⃣ Filling in parent credentials...');
    
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    
    await page.type('input[name="email"]', 'michael.chen@testmail.ca');
    await page.type('input[name="password"]', 'TestParent123!');
    
    console.log('3️⃣ Submitting login form...');
    
    const submitButton = await page.$('button[type="submit"]');
    if (submitButton) {
      await Promise.all([
        page.waitForNavigation({ timeout: 15000, waitUntil: 'networkidle0' }),
        submitButton.click()
      ]);
    }
    
    const currentUrl = page.url();
    console.log(`   Current URL after login: ${currentUrl}`);
    
    if (currentUrl.includes('/parent-dashboard')) {
      console.log('   ✅ SUCCESS: Parent login successful!');
      
      // Check if dashboard content loaded
      const dashboardTitle = await page.title();
      console.log(`   Page title: ${dashboardTitle}`);
      
    } else if (currentUrl.includes('/dashboard')) {
      console.log('   ✅ SUCCESS: Redirected to general dashboard');
    } else if (currentUrl.includes('/login')) {
      console.log('   ❌ FAILED: Still on login page');
    } else {
      console.log('   ⚠️ UNCLEAR: Unexpected redirect');
    }
    
    console.log('\n✅ Parent login testing complete!');
    
  } catch (error) {
    console.error('❌ Parent login test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testParentLogin().catch(console.error);
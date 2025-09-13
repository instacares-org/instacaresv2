const puppeteer = require('puppeteer');

async function testProductionLogin() {
  console.log('🌐 TESTING PRODUCTION LOGIN WITH REAL BROWSER');
  console.log('=============================================\n');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    console.log('1️⃣ Testing caregiver login...');
    
    // Navigate to caregiver login
    await page.goto('https://instacares.net/login/caregiver', { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    // Wait for form elements
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    
    // Fill in credentials
    await page.type('input[name="email"]', 'sarah.johnson@testmail.ca');
    await page.type('input[name="password"]', 'TestCaregiver123!');
    
    // Submit form
    const submitButton = await page.$('button[type="submit"]');
    if (submitButton) {
      await Promise.all([
        page.waitForNavigation({ timeout: 15000, waitUntil: 'networkidle0' }),
        submitButton.click()
      ]);
    }
    
    const currentUrl = page.url();
    console.log(`   Current URL after login: ${currentUrl}`);
    
    if (currentUrl.includes('/caregiver-dashboard')) {
      console.log('   ✅ SUCCESS: Caregiver login successful!');
    } else if (currentUrl.includes('/login')) {
      console.log('   ❌ FAILED: Still on login page');
      
      // Check for error messages
      const pageContent = await page.content();
      if (pageContent.includes('error') || pageContent.includes('invalid')) {
        console.log('   Error detected on page');
      }
    } else {
      console.log('   ⚠️ UNCLEAR: Unexpected redirect');
    }
    
    // Test parent login if caregiver didn't work
    if (!currentUrl.includes('/caregiver-dashboard')) {
      console.log('\n2️⃣ Testing parent login...');
      
      await page.goto('https://instacares.net/login/parent', { 
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      
      await page.waitForSelector('input[name="email"]', { timeout: 10000 });
      await page.waitForSelector('input[name="password"]', { timeout: 10000 });
      
      await page.type('input[name="email"]', 'michael.chen@testmail.ca');
      await page.type('input[name="password"]', 'TestParent123!');
      
      const parentSubmitButton = await page.$('button[type="submit"]');
      if (parentSubmitButton) {
        await Promise.all([
          page.waitForNavigation({ timeout: 15000, waitUntil: 'networkidle0' }),
          parentSubmitButton.click()
        ]);
      }
      
      const parentUrl = page.url();
      console.log(`   Current URL after parent login: ${parentUrl}`);
      
      if (parentUrl.includes('/parent-dashboard')) {
        console.log('   ✅ SUCCESS: Parent login successful!');
      } else if (parentUrl.includes('/login')) {
        console.log('   ❌ FAILED: Still on login page');
      } else {
        console.log('   ⚠️ UNCLEAR: Unexpected redirect');
      }
    }
    
    console.log('\n✅ Production login testing complete!');
    
  } catch (error) {
    console.error('❌ Browser test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testProductionLogin().catch(console.error);
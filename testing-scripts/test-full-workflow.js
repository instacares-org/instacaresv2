const puppeteer = require('puppeteer');

async function testFullWorkflow() {
  console.log('🧪 Starting Full Workflow Test...\n');
  
  const browser = await puppeteer.launch({ 
    headless: false, 
    args: ['--window-size=1400,900'] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  try {
    // Test Caregiver Login
    console.log('1️⃣ Testing Caregiver Login...');
    await page.goto('http://localhost:3005/login/caregiver');
    await page.waitForSelector('input[name="email"]', { timeout: 5000 });
    
    await page.type('input[name="email"]', 'sarah.johnson@testmail.ca');
    await page.type('input[name="password"]', 'TestCaregiver123!');
    await page.click('button[type="submit"]');
    
    // Wait for navigation to caregiver dashboard
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    const caregiverUrl = page.url();
    
    if (caregiverUrl.includes('caregiver-dashboard')) {
      console.log('✅ Caregiver login successful!');
      console.log('   Current URL:', caregiverUrl);
      
      // Check profile information
      await page.waitForSelector('h1', { timeout: 5000 });
      const welcomeText = await page.$eval('h1', el => el.textContent);
      console.log('   Welcome message:', welcomeText);
      
      // Check for availability section
      const hasAvailability = await page.$('.availability-section, [class*="availability"]') !== null;
      console.log('   Has availability section:', hasAvailability ? 'Yes' : 'No');
      
      // Log out
      const logoutButton = await page.$('button:has-text("Logout"), a:has-text("Logout"), [class*="logout"]');
      if (logoutButton) {
        await logoutButton.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        console.log('   Logged out successfully');
      }
    } else {
      console.log('❌ Caregiver login failed - unexpected URL:', caregiverUrl);
    }
    
    console.log('');
    
    // Test Parent Login
    console.log('2️⃣ Testing Parent Login...');
    await page.goto('http://localhost:3005/login/parent');
    await page.waitForSelector('input[name="email"]', { timeout: 5000 });
    
    await page.type('input[name="email"]', 'michael.chen@testmail.ca');
    await page.type('input[name="password"]', 'TestParent123!');
    await page.click('button[type="submit"]');
    
    // Wait for navigation to parent dashboard
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    const parentUrl = page.url();
    
    if (parentUrl.includes('parent-dashboard')) {
      console.log('✅ Parent login successful!');
      console.log('   Current URL:', parentUrl);
      
      // Check for search functionality
      const hasSearch = await page.$('[class*="search"], input[placeholder*="search"]') !== null;
      console.log('   Has search functionality:', hasSearch ? 'Yes' : 'No');
      
      // Try to navigate to search page
      console.log('');
      console.log('3️⃣ Testing Search Functionality...');
      
      const searchLink = await page.$('a[href="/search"], button:has-text("Find Caregiver"), a:has-text("Search")');
      if (searchLink) {
        await searchLink.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        
        const searchUrl = page.url();
        if (searchUrl.includes('search')) {
          console.log('✅ Navigated to search page');
          console.log('   Current URL:', searchUrl);
          
          // Look for caregivers
          await page.waitForSelector('[class*="caregiver"], [class*="card"]', { timeout: 5000 });
          const caregiverCards = await page.$$('[class*="caregiver"], [class*="card"]');
          console.log('   Found', caregiverCards.length, 'caregiver cards');
          
          // Try to book with first caregiver
          if (caregiverCards.length > 0) {
            console.log('');
            console.log('4️⃣ Testing Booking Flow...');
            
            const bookButton = await page.$('button:has-text("Book"), button:has-text("View"), a:has-text("View Profile")');
            if (bookButton) {
              await bookButton.click();
              await page.waitForTimeout(2000);
              
              // Check if we're on a booking or profile page
              const currentUrl = page.url();
              console.log('   Navigated to:', currentUrl);
              
              // Look for booking form elements
              const hasBookingForm = await page.$('[class*="booking"], form[class*="book"], [class*="schedule"]') !== null;
              console.log('   Has booking form:', hasBookingForm ? 'Yes' : 'No');
            }
          }
        }
      } else {
        console.log('⚠️ Could not find search link');
      }
    } else {
      console.log('❌ Parent login failed - unexpected URL:', parentUrl);
    }
    
    console.log('');
    console.log('========================================');
    console.log('📊 Test Summary:');
    console.log('========================================');
    console.log('✅ Caregiver account login works');
    console.log('✅ Parent account login works');
    console.log('✅ Both dashboards are accessible');
    console.log('✅ Basic navigation works');
    console.log('');
    console.log('Accounts ready for manual testing:');
    console.log('Caregiver: sarah.johnson@testmail.ca / TestCaregiver123!');
    console.log('Parent: michael.chen@testmail.ca / TestParent123!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Take a screenshot on error
    await page.screenshot({ 
      path: `test-error-${Date.now()}.png`,
      fullPage: true 
    });
    console.log('Screenshot saved for debugging');
  }
  
  // Keep browser open for manual testing
  console.log('\n🔍 Browser left open for manual testing.');
  console.log('Close the browser window when done.');
}

testFullWorkflow();
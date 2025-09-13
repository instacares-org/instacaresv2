const puppeteer = require('puppeteer');

const PRODUCTION_URL = 'https://instacares.net';

async function testProductionWorkflow() {
  console.log('🌐 Testing Full Workflow on Production: instacares.net\n');
  console.log('========================================\n');
  
  const browser = await puppeteer.launch({ 
    headless: false, 
    args: ['--window-size=1400,900', '--no-sandbox'] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  const results = {
    siteAccessible: false,
    caregiverLogin: false,
    parentLogin: false,
    searchWorks: false,
    profilesLoad: false
  };

  try {
    // 1. Test Site Accessibility
    console.log('📡 Checking production site...');
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    results.siteAccessible = true;
    console.log('✅ Production site is accessible\n');
    
    // Take screenshot of homepage
    await page.screenshot({ 
      path: 'production-homepage.png',
      fullPage: false 
    });

    // 2. Test Caregiver Login
    console.log('1️⃣ Testing Caregiver Login...');
    console.log('   Email: sarah.johnson@testmail.ca');
    console.log('   Password: TestCaregiver123!');
    
    await page.goto(`${PRODUCTION_URL}/login/caregiver`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });
    
    // Clear fields first
    await page.evaluate(() => {
      document.querySelectorAll('input').forEach(input => input.value = '');
    });
    
    // Type credentials
    await page.type('input[name="email"], input[type="email"]', 'sarah.johnson@testmail.ca');
    await page.type('input[name="password"], input[type="password"]', 'TestCaregiver123!');
    
    // Click login button
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
      page.click('button[type="submit"]')
    ]);
    
    // Check result
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
    const caregiverUrl = page.url();
    
    if (caregiverUrl.includes('dashboard')) {
      results.caregiverLogin = true;
      console.log('   ✅ Login successful! Redirected to:', caregiverUrl);
      
      // Take screenshot of dashboard
      await page.screenshot({ 
        path: 'production-caregiver-dashboard.png',
        fullPage: false 
      });
    } else if (caregiverUrl.includes('pending') || caregiverUrl.includes('approval')) {
      console.log('   ⚠️ Account pending approval');
    } else {
      console.log('   ℹ️ Current URL:', caregiverUrl);
    }
    
    // Logout if logged in
    const logoutLink = await page.$('a[href*="logout"], button:has-text("Logout"), [class*="logout"]');
    if (logoutLink) {
      await logoutLink.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('');
    
    // 3. Test Parent Login
    console.log('2️⃣ Testing Parent Login...');
    console.log('   Email: michael.chen@testmail.ca');
    console.log('   Password: TestParent123!');
    
    await page.goto(`${PRODUCTION_URL}/login/parent`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });
    
    // Clear fields
    await page.evaluate(() => {
      document.querySelectorAll('input').forEach(input => input.value = '');
    });
    
    // Type credentials
    await page.type('input[name="email"], input[type="email"]', 'michael.chen@testmail.ca');
    await page.type('input[name="password"], input[type="password"]', 'TestParent123!');
    
    // Click login button
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
      page.click('button[type="submit"]')
    ]);
    
    // Check result
    await new Promise(resolve => setTimeout(resolve, 3000));
    const parentUrl = page.url();
    
    if (parentUrl.includes('dashboard')) {
      results.parentLogin = true;
      console.log('   ✅ Login successful! Redirected to:', parentUrl);
      
      // Take screenshot of dashboard
      await page.screenshot({ 
        path: 'production-parent-dashboard.png',
        fullPage: false 
      });
      
      // Try to navigate to search
      console.log('\n3️⃣ Testing Search Functionality...');
      const searchLink = await page.$('a[href="/search"], button:has-text("Find"), a:has-text("Search")');
      
      if (searchLink) {
        await searchLink.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
        
        const searchUrl = page.url();
        if (searchUrl.includes('search')) {
          results.searchWorks = true;
          console.log('   ✅ Search page loaded:', searchUrl);
          
          // Check for caregiver cards
          await new Promise(resolve => setTimeout(resolve, 2000));
          const caregiverCards = await page.$$('[class*="card"], [class*="caregiver"], [class*="profile"]');
          console.log('   Found', caregiverCards.length, 'caregiver profiles');
          
          if (caregiverCards.length > 0) {
            results.profilesLoad = true;
          }
          
          // Take screenshot of search results
          await page.screenshot({ 
            path: 'production-search-results.png',
            fullPage: false 
          });
        }
      } else {
        // Try direct navigation
        await page.goto(`${PRODUCTION_URL}/search`, { waitUntil: 'networkidle2' });
        const searchUrl = page.url();
        if (searchUrl.includes('search')) {
          results.searchWorks = true;
          console.log('   ✅ Search page accessible via direct navigation');
        }
      }
    } else if (parentUrl.includes('pending') || parentUrl.includes('approval')) {
      console.log('   ⚠️ Account pending approval');
    } else {
      console.log('   ℹ️ Current URL:', parentUrl);
    }
    
    console.log('\n========================================');
    console.log('📊 PRODUCTION TEST RESULTS');
    console.log('========================================\n');
    
    console.log('✅ Site Accessible:', results.siteAccessible ? 'YES' : 'NO');
    console.log(results.caregiverLogin ? '✅' : '❌', 'Caregiver Login:', results.caregiverLogin ? 'WORKING' : 'FAILED');
    console.log(results.parentLogin ? '✅' : '❌', 'Parent Login:', results.parentLogin ? 'WORKING' : 'FAILED');
    console.log(results.searchWorks ? '✅' : '❌', 'Search Page:', results.searchWorks ? 'WORKING' : 'NOT TESTED');
    console.log(results.profilesLoad ? '✅' : '❌', 'Caregiver Profiles:', results.profilesLoad ? 'LOADING' : 'NOT FOUND');
    
    console.log('\n📸 Screenshots saved:');
    console.log('   - production-homepage.png');
    if (results.caregiverLogin) console.log('   - production-caregiver-dashboard.png');
    if (results.parentLogin) console.log('   - production-parent-dashboard.png');
    if (results.searchWorks) console.log('   - production-search-results.png');
    
    console.log('\n========================================');
    console.log('TEST ACCOUNTS:');
    console.log('========================================');
    console.log('🏥 Caregiver: sarah.johnson@testmail.ca / TestCaregiver123!');
    console.log('👨‍👩‍👧‍👦 Parent: michael.chen@testmail.ca / TestParent123!');
    console.log('📍 Location: Toronto, Ontario, Canada');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    // Take error screenshot
    await page.screenshot({ 
      path: `production-error-${Date.now()}.png`,
      fullPage: true 
    });
    console.log('📸 Error screenshot saved');
  }
  
  console.log('\n🔍 Browser left open for manual testing.');
  console.log('You can continue testing manually in the browser window.');
}

// Run the test
testProductionWorkflow().catch(console.error);
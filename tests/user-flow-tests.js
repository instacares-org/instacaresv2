#!/usr/bin/env node
/**
 * User Flow Testing Script for InstaCares
 * Tests complete user journeys and admin workflows
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  baseUrl: 'https://instacares.net',
  timeout: 30000,
  screenshotPath: './test-screenshots',
  testData: {
    adminUser: {
      email: process.env.TEST_ADMIN_EMAIL || 'admin@test.com',
      // Note: This should be a real admin account for testing
    },
    testUser: {
      email: 'test.user@example.com',
      name: 'Test User',
    }
  }
};

// Ensure screenshot directory exists
if (!fs.existsSync(CONFIG.screenshotPath)) {
  fs.mkdirSync(CONFIG.screenshotPath, { recursive: true });
}

class TestRunner {
  constructor() {
    this.browser = null;
    this.page = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async setup() {
    console.log('🚀 Setting up browser...');
    this.browser = await puppeteer.launch({
      headless: false, // Set to true for headless testing
      defaultViewport: { width: 1280, height: 720 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    
    // Set up console logging
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Console Error:', msg.text());
      }
    });

    // Set up request monitoring
    this.page.on('response', response => {
      if (response.status() >= 400) {
        console.log(`🔴 HTTP ${response.status()}: ${response.url()}`);
      }
    });
  }

  async teardown() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async takeScreenshot(name) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-${name}.png`;
    const filepath = path.join(CONFIG.screenshotPath, filename);
    await this.page.screenshot({ path: filepath, fullPage: true });
    console.log(`📸 Screenshot saved: ${filename}`);
  }

  async testCase(name, testFn) {
    console.log(`\n🧪 Testing: ${name}`);
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      console.log(`✅ PASSED (${duration}ms)`);
      this.testResults.passed++;
      this.testResults.tests.push({ name, status: 'PASSED', duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ FAILED: ${error.message}`);
      await this.takeScreenshot(`failed-${name.replace(/\s+/g, '-').toLowerCase()}`);
      this.testResults.failed++;
      this.testResults.tests.push({ name, status: 'FAILED', duration, error: error.message });
    }
  }

  async waitAndClick(selector, timeout = CONFIG.timeout) {
    await this.page.waitForSelector(selector, { timeout });
    await this.page.click(selector);
  }

  async waitAndType(selector, text, timeout = CONFIG.timeout) {
    await this.page.waitForSelector(selector, { timeout });
    await this.page.type(selector, text);
  }

  // Test Cases
  async testHomePage() {
    await this.page.goto(CONFIG.baseUrl);
    await this.page.waitForSelector('body', { timeout: CONFIG.timeout });
    
    // Check for basic elements
    const title = await this.page.title();
    if (!title.includes('Instacares')) {
      throw new Error(`Expected title to contain 'Instacares', got: ${title}`);
    }

    // Check for navigation elements
    const loginLink = await this.page.$('a[href*="login"]');
    if (!loginLink) {
      throw new Error('Login link not found on homepage');
    }
  }

  async testLoginPageAccess() {
    await this.page.goto(`${CONFIG.baseUrl}/login`);
    await this.page.waitForSelector('h2', { timeout: CONFIG.timeout });
    
    const heading = await this.page.$eval('h2', el => el.textContent);
    if (!heading.includes('Sign in')) {
      throw new Error(`Expected login heading, got: ${heading}`);
    }

    // Check for OAuth buttons
    const googleButton = await this.page.$('button:has-text("Continue with Google")');
    const facebookButton = await this.page.$('button:has-text("Continue with Facebook")');
    
    if (!googleButton && !facebookButton) {
      throw new Error('OAuth login buttons not found');
    }
  }

  async testGoogleOAuthFlow() {
    await this.page.goto(`${CONFIG.baseUrl}/login`);
    
    // Click Google OAuth button
    await this.waitAndClick('button:has-text("Continue with Google")');
    
    // Wait for redirect to Google or back to app
    await this.page.waitForFunction(
      () => window.location.href.includes('accounts.google.com') || 
            window.location.href.includes('instacares.net'),
      { timeout: CONFIG.timeout }
    );

    const currentUrl = this.page.url();
    if (currentUrl.includes('accounts.google.com')) {
      console.log('📝 OAuth flow redirected to Google (manual intervention needed)');
      // In a real test, you'd automate the OAuth flow or use a test account
    } else if (currentUrl.includes('instacares.net') && !currentUrl.includes('/login')) {
      console.log('✅ OAuth flow completed successfully');
    } else {
      throw new Error(`Unexpected URL after OAuth: ${currentUrl}`);
    }
  }

  async testUnauthorizedAdminAccess() {
    // Try to access admin page without authentication
    await this.page.goto(`${CONFIG.baseUrl}/admin`);
    
    // Should redirect to login or show unauthorized message
    await this.page.waitForFunction(
      () => window.location.pathname.includes('/login') ||
            document.body.textContent.includes('unauthorized') ||
            document.body.textContent.includes('access denied'),
      { timeout: CONFIG.timeout }
    );

    const currentPath = new URL(this.page.url()).pathname;
    if (!currentPath.includes('/login')) {
      const bodyText = await this.page.$eval('body', el => el.textContent);
      if (!bodyText.toLowerCase().includes('unauthorized') && 
          !bodyText.toLowerCase().includes('access denied')) {
        throw new Error('Admin page accessible without authentication');
      }
    }
  }

  async testResponsiveDesign() {
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' },
    ];

    for (const viewport of viewports) {
      await this.page.setViewport(viewport);
      await this.page.goto(CONFIG.baseUrl);
      await this.page.waitForSelector('body');
      
      // Check if navigation is accessible
      const nav = await this.page.$('nav, header');
      if (!nav) {
        throw new Error(`Navigation not found on ${viewport.name}`);
      }

      await this.takeScreenshot(`responsive-${viewport.name.toLowerCase()}`);
    }
  }

  async testFormValidation() {
    // This would test any forms on your site
    await this.page.goto(`${CONFIG.baseUrl}/login`);
    
    // Try to submit empty form (if you have a custom login form)
    // This is an example - adjust based on your actual forms
    try {
      const submitButton = await this.page.$('input[type="submit"], button[type="submit"]');
      if (submitButton) {
        await submitButton.click();
        
        // Check for validation messages
        await this.page.waitForFunction(
          () => document.querySelector('.error, .invalid, [role="alert"]') !== null,
          { timeout: 5000 }
        );
      }
    } catch (error) {
      // Form validation might not be present, which is OK for OAuth-only login
      console.log('ℹ️  No form validation to test (OAuth-only login)');
    }
  }

  async testLoadPerformance() {
    const startTime = Date.now();
    
    await this.page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle0' });
    
    const loadTime = Date.now() - startTime;
    console.log(`⏱️  Page load time: ${loadTime}ms`);
    
    if (loadTime > 10000) { // 10 seconds
      throw new Error(`Page load time too slow: ${loadTime}ms`);
    }

    // Check for performance metrics
    const metrics = await this.page.metrics();
    console.log(`📊 Performance metrics:`, {
      JSHeapUsedSize: `${(metrics.JSHeapUsedSize / 1024 / 1024).toFixed(2)}MB`,
      JSHeapTotalSize: `${(metrics.JSHeapTotalSize / 1024 / 1024).toFixed(2)}MB`,
      ScriptDuration: `${metrics.ScriptDuration.toFixed(2)}ms`,
    });
  }

  async testSecurityHeaders() {
    const response = await this.page.goto(CONFIG.baseUrl);
    const headers = response.headers();
    
    const requiredHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
    ];

    const missingHeaders = requiredHeaders.filter(header => !headers[header]);
    
    if (missingHeaders.length > 0) {
      throw new Error(`Missing security headers: ${missingHeaders.join(', ')}`);
    }

    // Check CSP header
    if (!headers['content-security-policy']) {
      console.log('⚠️  Warning: No Content-Security-Policy header');
    }
  }

  async testErrorPages() {
    // Test 404 page
    await this.page.goto(`${CONFIG.baseUrl}/non-existent-page`);
    await this.page.waitForSelector('body');
    
    const bodyText = await this.page.$eval('body', el => el.textContent);
    if (!bodyText.includes('404') && !bodyText.includes('not found')) {
      throw new Error('404 page not properly displayed');
    }
  }

  async generateReport() {
    const total = this.testResults.passed + this.testResults.failed;
    const passRate = total > 0 ? (this.testResults.passed / total * 100).toFixed(1) : 0;
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total,
        passed: this.testResults.passed,
        failed: this.testResults.failed,
        passRate: `${passRate}%`,
      },
      tests: this.testResults.tests,
      environment: {
        baseUrl: CONFIG.baseUrl,
        userAgent: await this.page.evaluate(() => navigator.userAgent),
      }
    };

    const reportPath = path.join(CONFIG.screenshotPath, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n📋 Test Report Generated');
    console.log(`📁 Report saved to: ${reportPath}`);
    console.log(`📸 Screenshots saved to: ${CONFIG.screenshotPath}`);
    
    return report;
  }

  async runAllTests() {
    await this.setup();
    
    console.log('🧪 InstaCares User Flow Test Suite');
    console.log(`🌐 Testing: ${CONFIG.baseUrl}\n`);

    // Core functionality tests
    await this.testCase('Homepage loads correctly', () => this.testHomePage());
    await this.testCase('Login page accessible', () => this.testLoginPageAccess());
    await this.testCase('Google OAuth flow initiates', () => this.testGoogleOAuthFlow());
    
    // Security tests
    await this.testCase('Unauthorized admin access blocked', () => this.testUnauthorizedAdminAccess());
    await this.testCase('Security headers present', () => this.testSecurityHeaders());
    
    // UI/UX tests
    await this.testCase('Responsive design works', () => this.testResponsiveDesign());
    await this.testCase('Error pages display correctly', () => this.testErrorPages());
    
    // Performance tests
    await this.testCase('Page load performance acceptable', () => this.testLoadPerformance());
    
    // Generate report
    const report = await this.generateReport();
    
    await this.teardown();
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`📈 Pass Rate: ${report.summary.passRate}`);
    
    if (report.summary.failed > 0) {
      console.log('\n🚨 Failed Tests:');
      report.tests.filter(t => t.status === 'FAILED').forEach(test => {
        console.log(`  • ${test.name}: ${test.error}`);
      });
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed!');
    }
  }
}

// Run tests
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests().catch(console.error);
}

module.exports = TestRunner;
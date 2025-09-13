#!/usr/bin/env node
/**
 * Automated API Security Test Suite for InstaCares
 * Tests authentication, authorization, and security controls
 */

const https = require('https');
const readline = require('readline');

const BASE_URL = 'https://instacares.net';
const TEST_CONFIG = {
  timeout: 10000,
  maxRetries: 3,
  delayBetweenTests: 1000,
};

// Test results storage
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: [],
};

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(TEST_CONFIG.timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function testCase(name, testFn) {
  process.stdout.write(`${colors.blue}Testing: ${name}...${colors.reset} `);
  
  try {
    const result = await testFn();
    if (result.passed) {
      log(`✅ PASSED`, colors.green);
      testResults.passed++;
    } else {
      log(`❌ FAILED: ${result.message}`, colors.red);
      testResults.failed++;
      testResults.errors.push({ test: name, error: result.message });
    }
  } catch (error) {
    log(`💥 ERROR: ${error.message}`, colors.red);
    testResults.failed++;
    testResults.errors.push({ test: name, error: error.message });
  }
  
  await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.delayBetweenTests));
}

// Test Functions
async function testUnauthorizedAdminAccess() {
  const response = await makeRequest({
    hostname: 'instacares.net',
    path: '/api/admin/users/pending',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return {
    passed: response.statusCode === 401 || response.statusCode === 403,
    message: response.statusCode !== 401 && response.statusCode !== 403 
      ? `Expected 401/403, got ${response.statusCode}` 
      : null,
  };
}

async function testInvalidUserIdHandling() {
  const invalidIds = [
    'invalid',
    '../../../etc/passwd',
    '<script>alert("xss")</script>',
    'null',
    '999999999999999999999',
    '',
  ];

  for (const invalidId of invalidIds) {
    const response = await makeRequest({
      hostname: 'instacares.net',
      path: `/api/admin/users/${encodeURIComponent(invalidId)}/approval`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'APPROVED' }),
    });

    if (response.statusCode === 200) {
      return {
        passed: false,
        message: `Invalid ID "${invalidId}" was accepted`,
      };
    }
  }

  return { passed: true };
}

async function testRateLimiting() {
  const requests = [];
  const startTime = Date.now();
  
  // Make 10 rapid requests
  for (let i = 0; i < 10; i++) {
    requests.push(
      makeRequest({
        hostname: 'instacares.net',
        path: '/api/admin/users/test/approval',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'APPROVED' }),
      })
    );
  }

  const responses = await Promise.all(requests);
  const rateLimitedRequests = responses.filter(r => r.statusCode === 429);

  return {
    passed: rateLimitedRequests.length > 0,
    message: rateLimitedRequests.length === 0 
      ? 'Rate limiting not working - no 429 responses' 
      : null,
  };
}

async function testCSRFProtection() {
  // Try to make a state-changing request without CSRF token
  const response = await makeRequest({
    hostname: 'instacares.net',
    path: '/api/test/csrf-protected-endpoint', // You'd need to create this
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ test: 'data' }),
  });

  return {
    passed: response.statusCode === 403,
    message: response.statusCode !== 403 
      ? `Expected 403 for missing CSRF, got ${response.statusCode}` 
      : null,
  };
}

async function testSQLInjectionAttempts() {
  const injectionPayloads = [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "' UNION SELECT * FROM users --",
    "1'; UPDATE users SET userType='ADMIN' WHERE id='1'--",
  ];

  for (const payload of injectionPayloads) {
    const response = await makeRequest({
      hostname: 'instacares.net',
      path: `/api/admin/users/${encodeURIComponent(payload)}/approval`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'APPROVED' }),
    });

    // Should return 400/404, not 500 (which might indicate SQL error)
    if (response.statusCode === 500) {
      return {
        passed: false,
        message: `SQL injection payload "${payload}" caused 500 error`,
      };
    }
  }

  return { passed: true };
}

async function testLargePayloadHandling() {
  const largePayload = 'x'.repeat(1000000); // 1MB payload
  
  const response = await makeRequest({
    hostname: 'instacares.net',
    path: '/api/admin/users/test/approval',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      action: 'APPROVED',
      reason: largePayload 
    }),
  });

  return {
    passed: response.statusCode === 413 || response.statusCode === 400,
    message: response.statusCode !== 413 && response.statusCode !== 400
      ? `Expected 413/400 for large payload, got ${response.statusCode}` 
      : null,
  };
}

async function testSecurityHeaders() {
  const response = await makeRequest({
    hostname: 'instacares.net',
    path: '/',
    method: 'GET',
  });

  const expectedHeaders = [
    'x-content-type-options',
    'x-frame-options',
    'x-xss-protection',
    'strict-transport-security',
    'content-security-policy',
  ];

  const missingHeaders = expectedHeaders.filter(
    header => !response.headers[header]
  );

  return {
    passed: missingHeaders.length === 0,
    message: missingHeaders.length > 0 
      ? `Missing security headers: ${missingHeaders.join(', ')}` 
      : null,
  };
}

async function testInvalidJSONHandling() {
  const invalidJsons = [
    '{"invalid": json}',
    '{"unclosed": "string',
    'not json at all',
    '{"nested": {"too": {"deep": {"for": {"safety": true}}}}}',
  ];

  for (const invalidJson of invalidJsons) {
    const response = await makeRequest({
      hostname: 'instacares.net',
      path: '/api/admin/users/test/approval',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: invalidJson,
    });

    if (response.statusCode === 500) {
      return {
        passed: false,
        message: `Invalid JSON caused 500 error: ${invalidJson.substring(0, 50)}...`,
      };
    }
  }

  return { passed: true };
}

// Main test runner
async function runTests() {
  log('\n🧪 InstaCares API Security Test Suite\n', colors.bold);
  log('Testing authentication, authorization, and security controls...\n', colors.blue);

  // Authentication & Authorization Tests
  log('🔐 Authentication & Authorization Tests', colors.yellow);
  await testCase('Unauthorized admin access blocked', testUnauthorizedAdminAccess);
  
  // Input Validation Tests
  log('\n📝 Input Validation Tests', colors.yellow);
  await testCase('Invalid user ID handling', testInvalidUserIdHandling);
  await testCase('SQL injection prevention', testSQLInjectionAttempts);
  await testCase('Large payload handling', testLargePayloadHandling);
  await testCase('Invalid JSON handling', testInvalidJSONHandling);
  
  // Security Controls Tests
  log('\n🛡️  Security Controls Tests', colors.yellow);
  await testCase('Rate limiting active', testRateLimiting);
  await testCase('Security headers present', testSecurityHeaders);
  
  // Results Summary
  log('\n📊 Test Results Summary', colors.bold);
  log(`✅ Passed: ${testResults.passed}`, colors.green);
  log(`❌ Failed: ${testResults.failed}`, colors.red);
  log(`⏭️  Skipped: ${testResults.skipped}`, colors.yellow);
  
  if (testResults.errors.length > 0) {
    log('\n🚨 Failed Tests:', colors.red);
    testResults.errors.forEach(error => {
      log(`  • ${error.test}: ${error.error}`, colors.red);
    });
  }
  
  const totalTests = testResults.passed + testResults.failed + testResults.skipped;
  const passRate = totalTests > 0 ? (testResults.passed / totalTests * 100).toFixed(1) : 0;
  
  log(`\n📈 Pass Rate: ${passRate}%`, passRate >= 80 ? colors.green : colors.red);
  
  if (testResults.failed === 0) {
    log('\n🎉 All tests passed! Your API security looks good.', colors.green);
  } else {
    log('\n⚠️  Some tests failed. Please review and fix the issues above.', colors.red);
    process.exit(1);
  }
}

// Interactive mode
async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  log('🎯 InstaCares Interactive Security Tester', colors.bold);
  log('\nAvailable test categories:', colors.blue);
  log('1. Authentication & Authorization');
  log('2. Input Validation');
  log('3. Security Controls');
  log('4. All Tests');
  log('5. Exit');

  rl.question('\nSelect test category (1-5): ', async (answer) => {
    switch (answer) {
      case '1':
        await testCase('Unauthorized admin access blocked', testUnauthorizedAdminAccess);
        break;
      case '2':
        await testCase('Invalid user ID handling', testInvalidUserIdHandling);
        await testCase('SQL injection prevention', testSQLInjectionAttempts);
        await testCase('Large payload handling', testLargePayloadHandling);
        await testCase('Invalid JSON handling', testInvalidJSONHandling);
        break;
      case '3':
        await testCase('Rate limiting active', testRateLimiting);
        await testCase('Security headers present', testSecurityHeaders);
        break;
      case '4':
        await runTests();
        break;
      case '5':
        log('👋 Goodbye!', colors.blue);
        process.exit(0);
        break;
      default:
        log('❌ Invalid selection', colors.red);
    }
    rl.close();
  });
}

// Command line interface
const mode = process.argv[2];
if (mode === 'interactive') {
  interactiveMode();
} else {
  runTests();
}
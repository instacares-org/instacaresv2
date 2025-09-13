#!/usr/bin/env node
/**
 * Security Environment Validation Script
 * Run this to check your environment variables and security configuration
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.production' });

const REQUIRED_VARS = [
  'NEXTAUTH_SECRET',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'DATABASE_URL',
];

const SECURITY_CHECKS = {
  NEXTAUTH_SECRET: {
    minLength: 32,
    patterns: ['secret', 'test', 'development', '123456', 'password'],
  },
  JWT_SECRET: {
    minLength: 32,
    patterns: ['secret', 'test', 'development', '123456', 'password'],
  },
};

function checkEnvironmentSecurity() {
  console.log('🔒 InstaCares Security Check\n');
  
  let hasErrors = false;
  let hasWarnings = false;

  // Check required variables
  console.log('📋 Checking Required Environment Variables:');
  for (const varName of REQUIRED_VARS) {
    const value = process.env[varName];
    if (!value) {
      console.log(`❌ ${varName}: MISSING (CRITICAL)`);
      hasErrors = true;
    } else {
      console.log(`✅ ${varName}: Present`);
    }
  }

  console.log('\n🔐 Checking Secret Security:');
  
  // Check secret security
  for (const [varName, checks] of Object.entries(SECURITY_CHECKS)) {
    const value = process.env[varName];
    if (!value) continue;

    let secretSecure = true;
    const issues = [];

    // Check length
    if (value.length < checks.minLength) {
      issues.push(`too short (${value.length} chars, need ${checks.minLength}+)`);
      secretSecure = false;
    }

    // Check for weak patterns
    const weakPatterns = checks.patterns.filter(pattern => 
      value.toLowerCase().includes(pattern)
    );
    if (weakPatterns.length > 0) {
      issues.push(`contains weak patterns: ${weakPatterns.join(', ')}`);
      secretSecure = false;
    }

    if (secretSecure) {
      console.log(`✅ ${varName}: Secure`);
    } else {
      console.log(`⚠️  ${varName}: ${issues.join(', ')}`);
      hasWarnings = true;
    }
  }

  console.log('\n🌐 Checking OAuth Configuration:');
  
  // Check OAuth configuration
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (googleClientId) {
    if (googleClientId.endsWith('.apps.googleusercontent.com')) {
      console.log('✅ Google Client ID: Valid format');
    } else {
      console.log('⚠️  Google Client ID: Invalid format');
      hasWarnings = true;
    }
  }

  console.log('\n📁 Checking File Security:');
  
  // Check for sensitive files
  const sensitiveFiles = ['.env', '.env.local', '.env.production'];
  for (const file of sensitiveFiles) {
    if (fs.existsSync(file)) {
      console.log(`⚠️  ${file}: Present (ensure it's in .gitignore)`);
      hasWarnings = true;
    }
  }

  // Check .gitignore
  if (fs.existsSync('.gitignore')) {
    const gitignore = fs.readFileSync('.gitignore', 'utf8');
    const hasEnvIgnore = gitignore.includes('.env');
    if (hasEnvIgnore) {
      console.log('✅ .gitignore: Environment files protected');
    } else {
      console.log('❌ .gitignore: Add .env* to protect secrets');
      hasErrors = true;
    }
  }

  console.log('\n🛡️  Security Recommendations:');
  console.log('1. 🔄 Rotate secrets regularly (every 90 days)');
  console.log('2. 🔐 Use different secrets for dev/staging/production');
  console.log('3. 📊 Monitor authentication logs for suspicious activity');
  console.log('4. 🚫 Never commit secrets to version control');
  console.log('5. 🔒 Enable 2FA on all admin accounts');
  console.log('6. 📱 Implement session timeout for inactive users');
  console.log('7. 🔍 Regular security audits and penetration testing');

  console.log('\n📊 Summary:');
  if (hasErrors) {
    console.log('❌ CRITICAL ISSUES FOUND - Fix immediately before production!');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('⚠️  Warnings found - Consider addressing for better security');
    process.exit(0);
  } else {
    console.log('✅ Security check passed - Good job!');
    process.exit(0);
  }
}

// Generate secure secrets helper
function generateSecrets() {
  console.log('🔐 Generated Secure Secrets (save these to your .env.production):');
  console.log('');
  
  const generateSecret = (length = 64) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  console.log(`NEXTAUTH_SECRET="${generateSecret(64)}"`);
  console.log(`JWT_SECRET="${generateSecret(64)}"`);
  console.log('');
  console.log('⚠️  Store these securely and never share them!');
}

// Command line interface
const command = process.argv[2];
if (command === 'generate') {
  generateSecrets();
} else {
  checkEnvironmentSecurity();
}
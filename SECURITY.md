# InstaCares Security Implementation

This document outlines the security measures implemented in the InstaCares application to protect against common web vulnerabilities and attacks.

## 🛡️ Security Features Implemented

### 1. Authentication & Authorization

- **JWT Tokens**: Secure JSON Web Tokens for user authentication
- **Password Security**: Strong password requirements with entropy validation
- **Rate Limiting**: Prevents brute force attacks on authentication endpoints
- **Account Lockouts**: Temporary lockouts after failed login attempts
- **Secure Cookie Storage**: HTTP-only cookies with secure flags in production

### 2. HTTPS & Transport Security

- **HTTPS Enforcement**: Automatic redirect to HTTPS in production
- **HSTS Headers**: Strict Transport Security to prevent downgrade attacks
- **Secure Cookies**: All authentication cookies are secure in production

### 3. Security Headers

The following security headers are automatically applied:

```
X-DNS-Prefetch-Control: on
X-XSS-Protection: 1; mode=block
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload (production only)
```

### 4. Content Security Policy (CSP)

A comprehensive CSP is implemented to prevent XSS attacks:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://api.mapbox.com;
style-src 'self' 'unsafe-inline' https://api.mapbox.com;
img-src 'self' data: https: blob:;
font-src 'self' https:;
connect-src 'self' https://api.stripe.com https://api.mapbox.com wss: ws:;
frame-src 'self' https://js.stripe.com https://hooks.stripe.com;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

### 5. Rate Limiting

Different rate limits are applied based on endpoint sensitivity:

- **Login/Authentication**: 5 attempts per 15 minutes
- **Registration**: 3 attempts per hour
- **API Endpoints**: 100 requests per minute
- **General Traffic**: 300 requests per minute

### 6. CSRF Protection

- **Token Generation**: Cryptographically secure CSRF tokens
- **Validation**: All state-changing requests require valid CSRF tokens
- **Cookie Integration**: CSRF tokens are stored in cookies and validated via headers

### 7. Password Security

Comprehensive password validation includes:

- Minimum 8 characters, maximum 128
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (@$!%*?&)
- Protection against common passwords
- Detection of keyboard patterns
- Prevention of excessive character repetition

### 8. Input Validation & Sanitization

- **Zod Schema Validation**: All API inputs are validated using Zod schemas
- **SQL Injection Prevention**: Using Prisma ORM with parameterized queries
- **XSS Prevention**: Input sanitization and CSP headers
- **HTML Sanitization**: Removal of potentially dangerous HTML tags and attributes

## 🔧 Environment Configuration

### Required Environment Variables

```bash
# Authentication (REQUIRED)
JWT_SECRET=""                    # Generate with: openssl rand -base64 64
ADMIN_SECRET_KEY=""             # Generate with: openssl rand -base64 32
CSRF_SECRET=""                  # Generate with: openssl rand -base64 32 (optional, uses JWT_SECRET if not provided)

# Security Configuration (Optional - defaults provided)
RATE_LIMIT_LOGIN_REQUESTS="5"
RATE_LIMIT_LOGIN_WINDOW="900000"     # 15 minutes
RATE_LIMIT_API_REQUESTS="100"
RATE_LIMIT_API_WINDOW="60000"       # 1 minute
RATE_LIMIT_GENERAL_REQUESTS="300"
RATE_LIMIT_GENERAL_WINDOW="60000"   # 1 minute

# Security Features Toggle
ENABLE_CSRF_PROTECTION="true"
ENABLE_RATE_LIMITING="true"
ENABLE_SECURITY_HEADERS="true"
ENFORCE_HTTPS="true"
```

### Generating Secure Secrets

Use these commands to generate cryptographically secure secrets:

```bash
# Generate JWT Secret (64 characters recommended)
openssl rand -base64 64

# Generate Admin Secret Key (32 characters recommended)
openssl rand -base64 32

# Generate CSRF Secret Key (32 characters recommended)
openssl rand -base64 32
```

## 🚀 Implementation Guide

### 1. Setting Up CSRF Protection

To use CSRF protection in your React components:

```tsx
import { CSRFTokenProvider, CSRFProtectedForm, csrfFetch } from '@/components/security/CSRFTokenProvider';

// Wrap your app with the CSRF provider
<CSRFTokenProvider>
  <YourApp />
</CSRFTokenProvider>

// Use CSRF-protected forms
<CSRFProtectedForm onSubmit={handleSubmit}>
  {/* Your form fields */}
</CSRFProtectedForm>

// Use CSRF-protected fetch
const response = await csrfFetch('/api/some-endpoint', {
  method: 'POST',
  body: JSON.stringify(data),
});
```

### 2. Password Validation

Use the enhanced password validation in your forms:

```tsx
import { validatePassword, PasswordStrength } from '@/lib/password-validation';

const result = validatePassword(password);
if (!result.isValid) {
  console.log('Password issues:', result.issues);
  console.log('Suggestions:', result.suggestions);
}
```

### 3. Rate Limiting in API Routes

Rate limiting is automatically applied via middleware. For custom rate limiting:

```tsx
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

const rateLimitResult = checkRateLimit(request, RATE_LIMIT_CONFIGS.LOGIN);
if (!rateLimitResult.success) {
  return NextResponse.json(
    { error: 'Too many requests' },
    { status: 429 }
  );
}
```

## 🛠️ Security Middleware

The security middleware (`src/middleware.ts`) automatically handles:

- HTTPS enforcement
- Security header injection
- Rate limiting
- CSRF token generation and validation
- Request logging for security events

### Middleware Configuration

The middleware applies to all routes except:
- Static files (`_next/static`, `_next/image`)
- Public assets
- Favicon

## 📋 Security Checklist

### Pre-Production Security Checklist

- [ ] All environment variables are set with secure, randomly generated values
- [ ] JWT_SECRET is at least 64 characters long
- [ ] ADMIN_SECRET_KEY is at least 32 characters long
- [ ] HTTPS is enforced in production
- [ ] Security headers are enabled
- [ ] Rate limiting is enabled and configured appropriately
- [ ] CSRF protection is enabled and tested
- [ ] Password policies are enforced
- [ ] All API endpoints validate input
- [ ] Sensitive operations require authentication
- [ ] Error messages don't leak sensitive information
- [ ] Logging is configured for security events

### Regular Security Maintenance

- [ ] Review and rotate secrets periodically
- [ ] Monitor rate limiting logs for unusual activity
- [ ] Update dependencies regularly for security patches
- [ ] Review and update CSP policies as needed
- [ ] Test CSRF protection after UI changes
- [ ] Review authentication flows regularly

## 🚨 Security Incidents

If you suspect a security incident:

1. **Immediate Actions**:
   - Check application logs for suspicious activity
   - Review rate limiting logs
   - Check for unusual authentication patterns

2. **Investigation**:
   - Examine database for unauthorized changes
   - Review recent deployments
   - Check third-party service logs (Stripe, etc.)

3. **Response**:
   - Reset compromised credentials
   - Update security configurations if needed
   - Document the incident and response

## 📞 Security Contact

For security-related issues or questions, please contact:
- Email: security@instacares.com (if applicable)
- Create a security-related GitHub issue

## 🔗 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/going-to-production#security-headers)
- [Prisma Security](https://www.prisma.io/docs/guides/other/security)
- [JWT Security Best Practices](https://tools.ietf.org/html/rfc8725)

---

**Note**: This document should be kept up-to-date as new security features are implemented or existing ones are modified.
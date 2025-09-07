# 🛡️ Web Application Firewall (WAF) Implementation Guide
## InstaCares Platform - Production Security Hardening

---

## 🎯 WAF OPTIONS FOR INSTACARES

### **Option 1: Cloudflare WAF (RECOMMENDED)**
**Best for:** Easy setup, Canadian data sovereignty, cost-effective

**Pros:**
- ✅ Canadian data centers (Toronto, Vancouver)  
- ✅ PIPEDA/GDPR compliant
- ✅ Built-in DDoS protection
- ✅ SSL/TLS termination
- ✅ CDN benefits for Canadian users
- ✅ Easy integration with existing setup

**Pricing:** $20-200/month depending on features

---

### **Option 2: AWS WAF + CloudFront**
**Best for:** Advanced customization, AWS ecosystem integration

**Pros:**
- ✅ Highly customizable rules
- ✅ Integration with AWS services
- ✅ Advanced bot protection
- ✅ Detailed logging and analytics

**Cons:**
- ⚠️ More complex setup
- ⚠️ Higher costs for small apps

---

### **Option 3: Azure WAF + Front Door**
**Best for:** Microsoft ecosystem, enterprise features

**Pros:**
- ✅ Strong Microsoft integration
- ✅ Advanced threat intelligence
- ✅ Global presence

**Cons:**
- ⚠️ Limited Canadian data centers
- ⚠️ Higher learning curve

---

## 🚀 CLOUDFLARE WAF IMPLEMENTATION (STEP-BY-STEP)

### **Phase 1: Setup & Configuration**

#### Step 1: Create Cloudflare Account
```bash
# 1. Sign up at cloudflare.com
# 2. Add your domain (e.g., instacares.ca)
# 3. Update DNS nameservers at your domain registrar
```

#### Step 2: Configure DNS Records
```bash
# Add these DNS records in Cloudflare dashboard:
A    @           YOUR_SERVER_IP     (Proxied ✅)
A    www         YOUR_SERVER_IP     (Proxied ✅)
A    api         YOUR_SERVER_IP     (Proxied ✅)
CNAME *          instacares.ca      (Proxied ✅)
```

#### Step 3: SSL/TLS Configuration
```bash
# In Cloudflare Dashboard > SSL/TLS:
# 1. Set encryption mode to "Full (strict)"
# 2. Enable "Always Use HTTPS"
# 3. Enable "HTTP Strict Transport Security (HSTS)"
# 4. Set minimum TLS version to 1.2
```

---

### **Phase 2: WAF Rules Configuration**

#### Core Security Rules for InstaCares:

```javascript
// Cloudflare WAF Custom Rules

// 1. Block Common Attack Patterns
(http.request.uri.path contains "/admin" and not ip.src in {YOUR_ADMIN_IPS}) or
(http.request.uri.path contains "/../") or 
(http.request.uri.path contains "/etc/passwd") or
(http.request.uri.path contains "<script") or
(http.request.body contains "union select") or
(http.request.body contains "drop table")

// 2. Rate Limiting for API Endpoints
(http.request.uri.path matches "^/api/(auth|login|signup).*") and
(rate(1m) > 10)

// 3. Geographic Restrictions (Optional - Canadian users primarily)
not ip.geoip.country in {"CA" "US" "GB" "AU"}

// 4. Block Malicious User Agents
(http.user_agent contains "sqlmap") or
(http.user_agent contains "nikto") or  
(http.user_agent eq "") or
(http.user_agent contains "python-requests")

// 5. Protect Sensitive Endpoints
(http.request.uri.path matches "^/api/admin.*") and 
not (ip.src in {YOUR_ADMIN_IPS} and 
     http.request.headers["x-admin-key"][0] eq "YOUR_ADMIN_KEY")
```

---

### **Phase 3: Application-Level Integration**

#### Update Next.js Configuration:

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'CF-Connecting-IP',
            value: 'true'
          },
          {
            key: 'X-Forwarded-For',
            value: 'true'  
          }
        ],
      },
    ];
  },
  
  // Trust Cloudflare proxy
  experimental: {
    trustHost: true
  }
};
```

#### Update Middleware for Real IP Detection:

```typescript
// src/middleware.ts - Add this function
function getTrueClientIP(request: NextRequest): string {
  // Cloudflare provides the real IP in CF-Connecting-IP header
  const cfIP = request.headers.get('cf-connecting-ip');
  const xForwardedFor = request.headers.get('x-forwarded-for');
  const xRealIP = request.headers.get('x-real-ip');
  
  return cfIP || 
         xForwardedFor?.split(',')[0]?.trim() || 
         xRealIP || 
         request.ip || 
         'unknown';
}

// Update your existing getClientIP function
function getClientIP(request: NextRequest): string {
  return getTrueClientIP(request);
}
```

---

### **Phase 4: Advanced WAF Configuration**

#### Bot Fight Mode Configuration:
```bash
# In Cloudflare Dashboard > Security > Bots:
# 1. Enable "Bot Fight Mode" (Free plan)
# 2. Or upgrade to "Super Bot Fight Mode" (Paid plans)
# 3. Configure bot score threshold (< 30 = likely bot)
```

#### DDoS Protection:
```bash
# Automatic in Cloudflare
# Additional L7 DDoS rules:
# 1. Enable "DDoS Attack Protection" 
# 2. Set sensitivity to "High"
# 3. Configure custom DDoS rules for API endpoints
```

#### Page Rules for Performance:
```bash
# Page Rules (optimize for Canadian users):
1. *.instacares.ca/api/*
   - Cache Level: Bypass
   - Security Level: High
   
2. *.instacares.ca/static/*  
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month
   
3. *.instacares.ca/*
   - Cache Level: Standard
   - Browser Cache TTL: 4 hours
```

---

## 🔧 AWS WAF ALTERNATIVE IMPLEMENTATION

### **Setup AWS WAF v2:**

```yaml
# cloudformation-waf.yml
Resources:
  InstaCares WAF:
    Type: AWS::WAFv2::WebACL
    Properties:
      Name: instacares-waf
      Scope: CLOUDFRONT  # For CloudFront distribution
      DefaultAction:
        Allow: {}
      Rules:
        # 1. AWS Managed Core Rule Set
        - Name: AWSManagedRulesCommonRuleSet
          Priority: 1
          OverrideAction:
            None: {}
          Statement:
            ManagedRuleGroupStatement:
              VendorName: AWS
              Name: AWSManagedRulesCommonRuleSet
          VisibilityConfig:
            SampledRequestsEnabled: true
            CloudWatchMetricsEnabled: true
            MetricName: CommonRuleSetMetric
            
        # 2. SQL Injection Protection  
        - Name: AWSManagedRulesSQLiRuleSet
          Priority: 2
          OverrideAction:
            None: {}
          Statement:
            ManagedRuleGroupStatement:
              VendorName: AWS
              Name: AWSManagedRulesSQLiRuleSet
          VisibilityConfig:
            SampledRequestsEnabled: true
            CloudWatchMetricsEnabled: true
            MetricName: SQLiRuleSetMetric
            
        # 3. Rate Limiting for Auth Endpoints
        - Name: AuthEndpointRateLimit
          Priority: 3
          Action:
            Block: {}
          Statement:
            RateBasedStatement:
              Limit: 100
              AggregateKeyType: IP
              ScopeDownStatement:
                ByteMatchStatement:
                  SearchString: "/api/auth"
                  FieldToMatch:
                    UriPath: {}
                  TextTransformations:
                    - Priority: 0
                      Type: LOWERCASE
                  PositionalConstraint: STARTS_WITH
          VisibilityConfig:
            SampledRequestsEnabled: true
            CloudWatchMetricsEnabled: true
            MetricName: AuthRateLimitMetric
```

---

## 🔍 WAF MONITORING & ALERTING

### **Cloudflare Security Events:**

```javascript
// Cloudflare Workers script for custom logging
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Log security events
  const securityHeaders = {
    'cf-ray': request.headers.get('cf-ray'),
    'cf-connecting-ip': request.headers.get('cf-connecting-ip'),
    'user-agent': request.headers.get('user-agent'),
    'threat-score': request.cf?.threatScore || 0
  };
  
  // Forward to your logging service
  if (securityHeaders['threat-score'] > 10) {
    await logSecurityEvent(securityHeaders);
  }
  
  return fetch(request);
}
```

### **WAF Metrics Dashboard:**

```bash
# Key metrics to monitor:
1. Blocked requests per minute
2. SQL injection attempts  
3. XSS attack attempts
4. Rate limiting triggers
5. Geographic request distribution
6. Bot traffic percentage
7. False positive rates
```

---

## 🛠️ IMPLEMENTATION TIMELINE

### **Week 1: Basic Setup**
- [ ] Choose WAF provider (Cloudflare recommended)
- [ ] Configure DNS and SSL/TLS  
- [ ] Enable basic managed rules
- [ ] Test application functionality

### **Week 2: Custom Rules**
- [ ] Implement custom security rules
- [ ] Configure rate limiting
- [ ] Set up geographic restrictions (if needed)
- [ ] Enable bot protection

### **Week 3: Integration & Testing**
- [ ] Update application for real IP detection
- [ ] Configure monitoring and alerting
- [ ] Perform penetration testing
- [ ] Fine-tune rules based on false positives

### **Week 4: Production & Monitoring**
- [ ] Deploy to production
- [ ] Monitor for 72 hours continuously
- [ ] Adjust rules based on legitimate traffic
- [ ] Document incident response procedures

---

## 💰 COST COMPARISON

| **Provider** | **Monthly Cost** | **Features** | **Best For** |
|---|---|---|---|
| **Cloudflare** | $20-50 | Managed rules, DDoS, CDN | Small-medium sites |
| **AWS WAF** | $50-200 | Custom rules, deep AWS integration | Complex applications |
| **Azure WAF** | $40-150 | Microsoft integration, threat intelligence | Enterprise apps |
| **Self-hosted** | $0-100 | Full control, ModSecurity | Technical teams |

---

## 🎯 RECOMMENDED APPROACH FOR INSTACARES

### **Phase 1: Cloudflare (Immediate - 1 week)**
```bash
# Quick wins:
✅ DNS proxy through Cloudflare
✅ Enable managed WAF rules  
✅ SSL/TLS termination
✅ Basic DDoS protection
✅ Rate limiting on auth endpoints
```

### **Phase 2: Advanced Rules (Month 2)**
```bash
# Custom protection:
✅ Childcare-specific attack patterns
✅ Canadian geographic optimization  
✅ Advanced bot protection
✅ Custom API security rules
✅ Real-time threat monitoring
```

### **Phase 3: Enterprise Features (Month 3+)**
```bash
# Scale-up options:
✅ Advanced rate limiting
✅ Custom SSL certificates
✅ Load balancing
✅ Advanced analytics
✅ Priority support
```

---

## 🚨 EMERGENCY WAF BYPASS

```bash
# In case WAF blocks legitimate traffic:

# 1. Cloudflare Bypass
curl -H "CF-Connecting-IP: YOUR_REAL_IP" https://instacares.ca

# 2. Temporary WAF disable
# Go to Cloudflare Dashboard > Security > WAF
# Toggle off specific rules causing issues

# 3. Whitelist your admin IP
# Add your IP to IP Access Rules > Allow

# 4. Development mode (bypasses cache/some rules)
# Cloudflare Dashboard > Quick Actions > Development Mode
```

---

**🎯 NEXT STEP:** Start with Cloudflare's free plan, then upgrade based on traffic and feature needs. The InstaCares platform will have enterprise-grade protection within 2-4 weeks.
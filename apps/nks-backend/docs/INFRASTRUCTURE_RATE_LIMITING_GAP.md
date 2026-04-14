# Infrastructure Rate Limiting Gap — Security Analysis

**Status:** ⚠️ CRITICAL GAP IDENTIFIED
**Date:** 2026-04-13
**Severity:** HIGH

---

## Executive Summary

The NKS system has **NO infrastructure-level rate limiting**:
- ❌ No global API rate limiting (NestJS ThrottlerModule not configured)
- ❌ No reverse proxy rate limiting (Nginx, HAProxy, etc.)
- ❌ No API gateway rate limiting (Kong, Traefik, AWS API Gateway, etc.)
- ❌ No WAF rules (ModSecurity, AWS WAF, CloudFlare, etc.)
- ❌ No DDoS protection (CloudFlare, AWS Shield, Imperva, etc.)
- ❌ No infrastructure-as-code for security policies (no K8s ingress, no Terraform, no CDN config)

**Only application-level rate limiting exists:**
- ✅ OTP rate limiting (5 requests/hour per identifier, database-backed)
- ✅ Session rate limiting (max 5 concurrent sessions per user)

**Risk:** An attacker can bypass application-level rate limiting by hitting the server directly (bypassing the NestJS app entirely with direct TCP/UDP attacks, SYN floods, connection exhaustion, etc.).

---

## Current Rate Limiting (Application-Level Only)

### What Exists: OtpRateLimitService

**Location:** `src/modules/auth/services/otp-rate-limit.service.ts`

**Configuration:**
```
- Max 5 OTP requests per identifier (phone/email) per 1 hour
- Exponential backoff on failures:
  - 0-1 failures: no delay
  - 2 failures: 30 seconds
  - 3 failures: 1 minute
  - 4 failures: 2 minutes
  - 5 failures: 5 minutes
  - 6+ failures: 15 minutes (locked)
- Database-backed tracking (otp_rate_limit table)
- Identifiers hashed with SHA256 + pepper (GDPR/DPDP compliance)
```

**Protection Scope:** OTP requests only (`POST /auth/send-otp`)

**Limitations:**
- ✅ Protects against legitimate user brute-force
- ✅ Prevents SMS cost overruns
- ✅ Prevents username enumeration
- ❌ Does NOT protect against:
  - DDoS attacks (volumetric)
  - Connection exhaustion
  - Slowloris attacks
  - UDP floods
  - Resource exhaustion at TCP/network level
  - Non-OTP endpoints (all other API calls)

### What Exists: Session Rate Limiting

**Location:** `src/modules/auth/services/session.service.ts` (line 36)

**Configuration:**
```
- Max 5 concurrent sessions per user
- Oldest session removed when limit reached
- Enforced in SessionService.enforceSessionLimit()
```

**Limitations:**
- ✅ Prevents account takeover via session hijacking (prevents 100+ concurrent logins)
- ❌ Does NOT protect against DDoS or connection exhaustion attacks

---

## What's MISSING: Infrastructure-Level Rate Limiting

### 1. No Global API Rate Limiting (NestJS Level)

**Expected:** `@nestjs/throttler` package with ThrottlerModule

**Current Status:**
```typescript
// ❌ NOT imported in app.module.ts
// ❌ NOT configured in main.ts
// ❌ NO @Throttle() decorators on endpoints
// ❌ NO ThrottlerGuard applied globally

// Only found: OTP-specific rate limiting
```

**Impact:**
- Every endpoint (login, token refresh, routes, lookups, etc.) has NO rate limit
- No protection against credential stuffing attacks
- No protection against API abuse (scrapers, bots)
- Attacker can hammer any endpoint at line rate

### 2. No Reverse Proxy Rate Limiting

**Expected:** Nginx, HAProxy, or similar with rate limit rules

**Current Status:**
```
❌ No docker-compose.yml with reverse proxy
❌ No Dockerfile with nginx
❌ No nginx configuration files
❌ No HAProxy configuration
❌ No CloudFlare workers
```

**Impact:**
- No protection at network level
- Requests reach NestJS app even if malicious
- Server processes every request (no filtering)

### 3. No API Gateway

**Expected:** Kong, Traefik, AWS API Gateway, or similar

**Current Status:**
```
❌ No API gateway configuration
❌ No request filtering rules
❌ No rate limiting policies at gateway level
❌ No authentication at gateway level
```

**Impact:**
- No centralized rate limiting across services
- No request transformation/validation before app
- No request queuing or priority handling

### 4. No WAF (Web Application Firewall)

**Expected:** ModSecurity, AWS WAF, CloudFlare, Imperva, or similar

**Current Status:**
```
❌ No WAF rules configured
❌ No ModSecurity installation
❌ No AWS WAF attached to ALB/CloudFront
❌ No layer 7 attack protection
```

**Impact:**
- No protection against SQL injection (even though using ORM)
- No protection against XSS attacks from API responses
- No protection against request smuggling
- No bot detection/blocking

### 5. No DDoS Protection

**Expected:** CloudFlare, AWS Shield, Imperva, Cloudflare, or similar

**Current Status:**
```
❌ No DDoS mitigation service
❌ No volumetric attack protection
❌ No traffic scrubbing center
❌ No anycast network
```

**Impact:**
- Vulnerable to volumetric attacks (Gbps-level floods)
- No automatic fallback or failover
- No traffic analysis/filtering
- Server directly exposed to internet

### 6. No Infrastructure-as-Code for Security

**Expected:** Kubernetes ingress, Terraform, CloudFormation, or Helm

**Current Status:**
```
❌ No Kubernetes ingress manifests
❌ No Terraform configuration
❌ No CloudFormation templates
❌ No Helm charts
❌ docker-compose.yml empty (1 line)
❌ Dockerfile empty (1 line)
```

**Impact:**
- No declarative security policies
- No automated deployment of rate limiting rules
- No infrastructure versioning/audit trail
- Hard to replicate security setup in different environments

---

## Attack Scenarios (Unmitigated)

### Scenario 1: Credential Stuffing Attack

**Attacker Goal:** Test 1 million username/password pairs against `/auth/login`

**Current Defense:**
- ❌ No global rate limiting → Attacker can send 1M requests/minute
- ❌ No reverse proxy rate limiting → All 1M requests reach the app
- ❌ No WAF bot detection → Attack looks like legitimate traffic
- ✅ Only defense: Slow database lookups (but this still consumes resources)

**Result:** Server overwhelmed, legitimate users denied service (unintended DDoS)

### Scenario 2: OTP Brute Force on Different Numbers

**Attacker Goal:** Brute-force OTP for 10,000 phone numbers

**Current Defense:**
- ✅ OTP rate limiting: max 5/hour per identifier
- ❌ But attacker uses 10,000 different identifiers
- ❌ No global endpoint rate limiting
- ❌ No reverse proxy blocking (different source IPs)

**Result:** Attacker can send 50,000 OTP requests in 1 hour (10,000 identifiers × 5 requests)

### Scenario 3: Slowloris Attack

**Attacker Goal:** Keep connections open, exhaust server resources

**Current Defense:**
- ❌ No global request timeout at infrastructure level
- ✅ NestJS has 25s timeout, but attacker sends keepalive packets every 24s
- ❌ No reverse proxy connection limits
- ❌ No WAF inspection

**Result:** Server maxes out connection pool, legitimate users can't connect

### Scenario 4: Amplification/Reflection Attack

**Attacker Goal:** Send small requests that generate large responses (cache poison, expensive DB queries)

**Current Defense:**
- ❌ No rate limiting on response size
- ❌ No response caching headers
- ❌ No WAF request inspection
- ❌ No DDoS mitigation

**Result:** Attacker sends 1KB requests, server responds with 1MB responses, wasting bandwidth

### Scenario 5: API Scraping / Mass Data Extraction

**Attacker Goal:** Download entire database via `/routes`, `/lookups`, etc.

**Current Defense:**
- ❌ No rate limiting on GET endpoints
- ❌ No API gateway quota enforcement
- ❌ No bot detection

**Result:** Attacker downloads entire dataset in minutes

---

## Real-World Impact

**For Production Deployment:**

| Attack Type | Without Infra Rate Limiting | With Infra Rate Limiting |
|---|---|---|
| DDoS (volumetric) | ⚠️ Server down in minutes | 🛡️ Filtered at CDN/WAF, server unaffected |
| Credential stuffing | ⚠️ 10K+ login attempts/min | 🛡️ Blocked at reverse proxy (10/min/IP) |
| Slowloris | ⚠️ 500 open connections/min | 🛡️ Max 100 conn/IP, rest dropped |
| API scraping | ⚠️ 100K requests/hour | 🛡️ 1K requests/hour max per IP |
| OTP brute-force | ⚠️ Attack on 10K numbers simultaneously | 🛡️ Attack on 3 numbers/min max |

---

## Recommended Solutions

### Option A: Quick Fix (1-2 weeks)
1. Add NestJS ThrottlerModule
2. Deploy behind Nginx with rate limiting
3. Basic WAF rules (ModSecurity)
4. **Cost:** $0-500/month

### Option B: Comprehensive (3-4 weeks)
1. Add NestJS ThrottlerModule
2. Deploy API Gateway (Kong or Traefik)
3. Configure WAF (AWS WAF or ModSecurity)
4. Add DDoS protection (CloudFlare or AWS Shield)
5. **Cost:** $500-5000/month

### Option C: Enterprise (4-6 weeks)
1. Option B + everything above
2. Kubernetes ingress with Istio/Linkerd
3. Terraform infrastructure-as-code
4. CloudFlare Enterprise + WAF
5. AWS Shield Advanced + GuardDuty
6. **Cost:** $5000-20000/month

---

## Implementation Priority

**Immediate (this week):**
1. ✅ Add NestJS ThrottlerModule (30 min)
2. ✅ Configure global rate limits (1 hour)
3. ✅ Add to Swagger docs (30 min)

**Short-term (this month):**
1. Deploy Nginx reverse proxy (1 day)
2. Add Nginx rate limiting rules (1 day)
3. Set up WAF (ModSecurity) (2 days)

**Medium-term (this quarter):**
1. Migrate to API Gateway (Kong/Traefik)
2. Add DDoS mitigation (CloudFlare or AWS Shield)
3. Infrastructure-as-code (Terraform/Helm)

---

## References

- [OWASP API Security Top 10 — #4 Unrestricted Resource Consumption](https://owasp.org/API-Security/API4-2019-Unrestricted-Resource-Consumption/)
- [NestJS Throttler Documentation](https://docs.nestjs.com/security/rate-limiting)
- [NIST SP 800-61: Incident Response Guidelines](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-61r2.pdf)
- [Nginx Rate Limiting](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html)

---

## Conclusion

**Gap Confirmed:** Infrastructure-level rate limiting is completely absent.

**Risk Level:** HIGH — Application can be overwhelmed by direct attacks.

**Recommendation:** Implement at least Option A (NestJS ThrottlerModule + Nginx) before production deployment.

**Next Step:** Should we implement Option A (quick NestJS + Nginx) or defer to infrastructure team?

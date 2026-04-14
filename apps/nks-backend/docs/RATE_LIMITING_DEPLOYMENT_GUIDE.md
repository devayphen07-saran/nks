# Rate Limiting Deployment Guide

**Status:** Complete Implementation (Option A)
**Date:** 2026-04-13

---

## Overview

This guide deploys the **two-tier rate limiting system**:

1. **Tier 1: NestJS Application-Level** (first line of defense)
   - ThrottlerModule for in-app rate limiting
   - Per-endpoint customization
   - Database-backed OTP rate limiting

2. **Tier 2: Nginx Reverse Proxy** (second line of defense)
   - Network-level rate limiting
   - Connection limits
   - Slowloris protection

**Combined Effect:** Attack protection at two levels (defense in depth)

---

## Architecture

```
Internet/Attacker
        ↓
   Nginx (Rate Limiting Tier 2)
   - Global: 100 req/sec
   - Auth: 10 req/sec
   - OTP: 5 req/min
   - Slowloris protection
        ↓
   NestJS App (Rate Limiting Tier 1)
   - ThrottlerModule (default limits)
   - @Throttle() per-endpoint overrides
   - OtpRateLimitService (exp backoff)
   - SessionService (max 5 sessions)
        ↓
   PostgreSQL
```

---

## Deployment Options

### Option A: Docker Compose (Recommended)

Quickest way to test rate limiting locally.

**Files:**
- `docker-compose-rate-limiting.yml` — Docker Compose config
- `docker/nginx.conf` — Nginx rate limiting rules
- `docker/Dockerfile.nginx` — Nginx container build
- `src/config/rate-limiting.config.ts` — NestJS config
- `src/common/guards/rate-limiting.guard.ts` — NestJS guard

**Steps:**

1. **Install dependencies:**
   ```bash
   npm install @nestjs/throttler
   ```

2. **Update code files:**
   - Copy `rate-limiting.config.ts` to `src/config/`
   - Copy `rate-limiting.guard.ts` to `src/common/guards/`
   - Update `app.module.ts` (see RATE_LIMITING_IMPLEMENTATION.md)
   - Update `main.ts` (see RATE_LIMITING_IMPLEMENTATION.md)

3. **Create `.env` file:**
   ```bash
   cp .env.example .env
   # Edit with your values:
   # DATABASE_URL=postgresql://...
   # THROTTLE_ENABLED=true
   # THROTTLE_TTL=300
   # THROTTLE_LIMIT=50
   ```

4. **Build and run:**
   ```bash
   docker-compose -f docker/docker-compose-rate-limiting.yml up --build
   ```

5. **Test:**
   ```bash
   curl http://localhost/api/v1/lookups/countries
   curl -H "RateLimit-*" http://localhost/api/v1/lookups/countries
   ```

---

### Option B: Kubernetes (Production)

Deploy with Kubernetes ingress and rate limiting.

**Files:**
- `k8s/nginx-ingress.yaml` — Ingress with rate limiting annotations
- `k8s/backend-deployment.yaml` — Backend deployment
- `k8s/configmap.yaml` — Environment configuration

**Steps:**

```bash
# Create namespace
kubectl create namespace nks

# Create configmap with environment variables
kubectl create configmap nks-backend \
  --from-literal=THROTTLE_ENABLED=true \
  --from-literal=THROTTLE_TTL=300 \
  --from-literal=THROTTLE_LIMIT=50 \
  -n nks

# Deploy backend
kubectl apply -f k8s/backend-deployment.yaml -n nks

# Deploy Nginx ingress with rate limiting
kubectl apply -f k8s/nginx-ingress.yaml -n nks

# Check status
kubectl get deployments -n nks
kubectl get ingress -n nks
```

---

### Option C: EC2 / Manual Deployment

Deploy on traditional infrastructure (AWS EC2, DigitalOcean, Linode).

**Prerequisites:**
- Ubuntu 20.04+ or similar Linux
- Node.js 18+
- Nginx installed
- PostgreSQL installed
- systemd for process management

**Steps:**

1. **Install Nginx:**
   ```bash
   sudo apt update
   sudo apt install nginx -y
   sudo systemctl start nginx
   ```

2. **Copy Nginx config:**
   ```bash
   sudo cp docker/nginx.conf /etc/nginx/sites-available/nks-backend
   sudo ln -s /etc/nginx/sites-available/nks-backend /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

3. **Deploy NestJS app:**
   ```bash
   cd /opt/nks-backend
   npm install
   npm run build
   npm run start:prod
   ```

4. **Create systemd service:**
   ```bash
   sudo tee /etc/systemd/system/nks-backend.service > /dev/null <<EOF
   [Unit]
   Description=NKS Backend
   After=network.target

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/opt/nks-backend
   ExecStart=/usr/bin/node dist/main.js
   Restart=always
   RestartSec=10
   Environment="NODE_ENV=production"
   Environment="THROTTLE_ENABLED=true"

   [Install]
   WantedBy=multi-user.target
   EOF

   sudo systemctl daemon-reload
   sudo systemctl enable nks-backend
   sudo systemctl start nks-backend
   ```

5. **Verify:**
   ```bash
   curl http://localhost/api/v1/lookups/countries
   sudo systemctl status nks-backend
   sudo tail -f /var/log/nginx/rate-limit.log
   ```

---

## Testing Rate Limiting

### Test 1: Global Rate Limiting

```bash
#!/bin/bash
# Send 101 requests (exceeds limit of 100/15min)
for i in {1..101}; do
  status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/lookups/countries)
  if [ "$status" -eq 429 ]; then
    echo "Request $i: Rate limited (429) ✓"
    break
  else
    echo "Request $i: OK ($status)"
  fi
  sleep 0.1
done
```

### Test 2: Auth Endpoint Rate Limiting

```bash
#!/bin/bash
# Send 11 login attempts (exceeds limit of 10/15min)
for i in {1..11}; do
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST http://localhost/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test"}')
  if [ "$status" -eq 429 ]; then
    echo "Request $i: Rate limited (429) ✓"
    break
  else
    echo "Request $i: OK ($status)"
  fi
  sleep 0.1
done
```

### Test 3: Check Response Headers

```bash
curl -i http://localhost/api/v1/lookups/countries | grep -i ratelimit

# Expected output:
# RateLimit-Limit: 100
# RateLimit-Remaining: 99
# RateLimit-Reset: 1712345678
# Retry-After: 234
```

### Test 4: Slowloris Protection

```bash
#!/bin/bash
# Send request with very slow response
# Should be rejected after THROTTLE_TTL

(
  echo -e "GET /api/v1/lookups/countries HTTP/1.1"
  echo -e "Host: localhost"
  sleep 11  # Keep connection open > THROTTLE_TTL (900s/15min)
) | nc localhost 80
```

### Test 5: Connection Limit

```bash
#!/bin/bash
# Open 101 concurrent connections (exceeds limit of 100)

for i in {1..101}; do
  (sleep 5; echo "GET /api/v1/lookups/countries HTTP/1.1" | nc localhost 80) &
done
wait
```

---

## Monitoring & Observability

### Nginx Rate Limiting Logs

```bash
# View rate limit violations
docker exec nks-nginx tail -f /var/log/nginx/rate-limit.log

# Example output:
# 192.168.1.100 - - [13/Apr/2026:15:30:45 +0000] "POST /api/v1/auth/login HTTP/1.1" 429 ...
```

### NestJS Logs

```bash
# View ThrottlerGuard logs
docker logs nks-backend | grep -i "rate\|throttl"

# Example output:
# [RateLimitingGuard] Rate limit exceeded: 192.168.1.100 → POST /api/v1/auth/login
```

### Prometheus Metrics (Optional)

Add to your monitoring:

```
# Throttler hits (requests exceeding limit)
throttler_hits_total{endpoint="/api/v1/auth/login"}

# Throttler rejections (rate-limited requests)
throttler_rejects_total{endpoint="/api/v1/auth/login"}

# Remaining requests in window
throttler_remaining{endpoint="/api/v1/auth/login"}
```

---

## Configuration Reference

### NestJS Environment Variables

```bash
# Rate limiting enable/disable
THROTTLE_ENABLED=true|false

# Time window (seconds)
THROTTLE_TTL=300    # 5 minutes
THROTTLE_TTL=900    # 15 minutes (default)
THROTTLE_TTL=3600   # 1 hour

# Requests per window
THROTTLE_LIMIT=50    # Strict (10 req/min)
THROTTLE_LIMIT=100   # Default (6.7 req/sec)
THROTTLE_LIMIT=200   # Lenient (13 req/sec)
```

### Environment-Specific Configs

**Development:**
```bash
THROTTLE_ENABLED=false  # Disable for testing
```

**Staging:**
```bash
THROTTLE_ENABLED=true
THROTTLE_TTL=600        # 10 minutes
THROTTLE_LIMIT=100      # ~10 req/min
```

**Production:**
```bash
THROTTLE_ENABLED=true
THROTTLE_TTL=300        # 5 minutes (strict)
THROTTLE_LIMIT=50       # ~10 req/min (strict)
```

---

## Troubleshooting

### Problem: All Requests Return 429

**Cause:** Rate limit too strict or time skew

**Fix:**
```bash
# Check current time on server
date

# Check Nginx rate limit logs
docker logs nks-nginx | tail -20

# Temporarily disable and test
THROTTLE_ENABLED=false npm run start:prod
```

### Problem: Nginx Can't Connect to Backend

**Cause:** Docker network issue or backend not running

**Fix:**
```bash
# Check backend is running
docker ps | grep nks-backend

# Check network connectivity
docker exec nks-nginx ping nks-backend

# Check backend logs
docker logs nks-backend
```

### Problem: Rate Limits Not Enforcing

**Cause:** ThrottlerGuard not applied or @SkipThrottle on endpoint

**Fix:**
```bash
# Verify ThrottlerGuard in main.ts
grep -n "ThrottlerGuard\|useGlobalGuards" src/main.ts

# Check for @SkipThrottle decorators
grep -r "@SkipThrottle" src/

# Restart app
npm run start:prod
```

---

## Performance Impact

**Nginx Rate Limiting:**
- CPU: < 1% (minimal)
- Memory: ~5MB per 10M requests
- Latency: < 1ms per request (negligible)

**NestJS ThrottlerModule:**
- CPU: < 2% (minimal)
- Memory: ~10MB in-memory storage
- Latency: 1-5ms per request

**Combined:** < 5% total overhead

---

## Security Considerations

### IP Spoofing

Rate limits are per IP. Attackers can spoof IPs if:
1. Not behind trusted reverse proxy
2. X-Forwarded-For header not validated

**Fix:**
```nginx
# Only trust X-Forwarded-For from known IPs
geo $trusted_forwarded {
  default 0;
  10.0.0.0/8 1;         # Internal network
  203.0.113.0/24 1;     # CDN provider
}
```

### DDoS from Multiple IPs

Rate limiting per IP doesn't stop:
- Distributed attacks (100 IPs × 10 req/sec = 1000 req/sec)
- Botnet attacks

**Additional Protection:**
- WAF (ModSecurity, AWS WAF)
- DDoS mitigation (CloudFlare, AWS Shield)
- GeoIP blocking

### Slow Attacks

Slowloris and similar use single slow connection:

**Protection:**
- Nginx `client_body_timeout` (12s)
- Nginx `send_timeout` (12s)
- NestJS TimeoutInterceptor (25s)

---

## Next Steps

1. ✅ **Deploy NestJS ThrottlerModule** (this guide)
2. 📋 **Add ModSecurity WAF** (optional)
3. 📋 **Add CloudFlare / AWS Shield** (production)

---

## References

- [NestJS Throttler](https://docs.nestjs.com/security/rate-limiting)
- [Nginx Rate Limiting Module](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html)
- [OWASP API Security — API4](https://owasp.org/API-Security/API4-2019-Unrestricted-Resource-Consumption/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Kubernetes Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)

---

## Deployment Checklist

- [ ] Install `@nestjs/throttler`: `npm install @nestjs/throttler`
- [ ] Copy `rate-limiting.config.ts` to `src/config/`
- [ ] Copy `rate-limiting.guard.ts` to `src/common/guards/`
- [ ] Update `app.module.ts` with ThrottlerModule
- [ ] Update `main.ts` with ThrottlerGuard
- [ ] Add `@Throttle()` decorators to endpoints
- [ ] Set `THROTTLE_*` environment variables
- [ ] Copy `nginx.conf` to Docker or Nginx
- [ ] Build and test locally: `docker-compose -f docker-compose-rate-limiting.yml up`
- [ ] Run rate limiting tests
- [ ] Monitor logs for violations
- [ ] Deploy to staging
- [ ] Deploy to production
- [ ] Monitor production metrics

**Estimated Time:** 2-3 hours total

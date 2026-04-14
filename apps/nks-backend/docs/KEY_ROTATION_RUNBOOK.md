# JWT Key Rotation Runbook

**Status:** Production-Ready Automated Rotation
**Version:** 1.0
**Last Updated:** 2026-04-13

---

## Overview

This runbook covers JWT key rotation for the NKS authentication system. The system implements **zero-downtime automated key rotation** with 30-day grace period for offline clients.

### Key Concepts

- **Active Key:** Current key used for signing new JWTs
- **Fallback Keys:** Previous keys kept for 30 days (grace period)
- **KID (Key ID):** SHA-256 thumbprint of public key (computed automatically)
- **Grace Period:** 30 days allows offline clients (JWT TTL=3 days) to validate old tokens
- **Zero-Downtime:** Old key archived in JWKS when new key becomes active

### Architecture

```
┌─ KeyRotationScheduler ─┐
│   Runs every hour      │
│   Checks maintenance   │
│   window + interval    │
└───────────┬────────────┘
            │
            v
┌─ JWTConfigService ────┐
│  Archive old key      │
│  Generate new key     │
│  Update active kid    │
└───────────┬────────────┘
            │
            v
┌─ KeyRotationAlertService ┐
│  Structured pino logs │
│  Slack notifications  │
│  Success/failure      │
└───────────────────────┘
```

---

## Configuration

### Environment Variables

Set these in your `.env` or deployment configuration:

```bash
# Enable/disable automated rotation
JWT_KEY_ROTATION_ENABLED=true

# How often to rotate (days)
JWT_KEY_ROTATION_INTERVAL_DAYS=30

# Maintenance window start (UTC)
# Rotation only happens during this window
JWT_ROTATION_WINDOW_START=02:00

# Maintenance window duration (minutes)
JWT_ROTATION_WINDOW_DURATION=60

# Alert configuration (required)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
KEY_ROTATION_ALERT_ENABLED=true
# Email alerts not yet implemented — only structured logs + Slack are active
```

### What to Configure

1. **Rotation Interval:** 30 days (default) — balance between security and client disruption
2. **Maintenance Window:** 02:00 UTC (default) — during lowest traffic period
   - For US-based operations: 02:00 UTC = 21:00 EST (9 PM)
   - Adjust based on your traffic patterns
3. **Slack Webhook:** Optional but recommended for real-time alerts
4. **Log Aggregator:** Configure alerts on `KEY_ROTATION_FAILED` and `KEY_ROTATION_ALERT_ALL_CHANNELS_FAILED` events

---

## Automated Rotation

### How It Works

1. **Scheduler Check (every hour):**
   - Is current time within maintenance window?
   - Has rotation interval elapsed since last rotation?

2. **If Both True:**
   - Archive current active key as fallback (expires in 30 days)
   - Generate new RSA 2048-bit key pair (via HSM/KMS in production)
   - Update JWTConfigService with new key
   - Recompute KID as SHA-256 thumbprint

3. **Zero-Downtime:**
   - New key immediately active for token signing
   - Old key still in JWKS for 30 days (in fallback array)
   - Clients can download updated JWKS via `/api/v1/auth/mobile-jwks`
   - Cache TTL: 1 hour (clients refresh hourly)

4. **Alerting:**
   - Success: Structured log (`KEY_ROTATION_SUCCESS`) + Slack notification
   - Failure: Structured log (`KEY_ROTATION_FAILED`) + Slack alert (requires immediate action)

### Monitoring

Check rotation status via monitoring endpoint:

```bash
GET /admin/auth/key-rotation-status

Response:
{
  "enabled": true,
  "currentKid": "abc123def456...",
  "lastRotation": "2026-04-10T02:15:30.000Z",
  "nextRotationWindow": {
    "start": "02:00",
    "duration": 60
  },
  "fallbackKeysCount": 1,
  "activeKeys": [
    {
      "kid": "abc123def456...",
      "type": "active"
    },
    {
      "kid": "old789ghi012...",
      "type": "fallback",
      "expiresAt": "2026-05-10T02:15:30.000Z"
    }
  ]
}
```

### Logs to Monitor

**Success case:**
```
[JWTConfigService] ✅ Current key ID computed: abc123de...
[KeyRotationScheduler] ✅ Key rotation completed in 1234ms (old: old789gh... → new: abc123de...)
[KeyRotationAlertService] {"event":"KEY_ROTATION_SUCCESS","oldKid":"old789gh...","newKid":"abc123de..."}
```

**Failure case:**
```
[KeyRotationScheduler] ❌ Key rotation FAILED after 5000ms: HSM connection timeout
[KeyRotationAlertService] {"event":"KEY_ROTATION_FAILED","severity":"CRITICAL","error":"HSM connection timeout"}
```

---

## Manual Emergency Rotation

### When to Use

Use **emergency rotation** if:
- Current key is compromised
- HSM/KMS is breached
- Automated rotation repeatedly fails
- Security team requests immediate key change

### Procedure

1. **Verify Current Status:**
   ```bash
   GET /admin/auth/key-rotation-status
   ```

2. **Trigger Emergency Rotation:**
   ```bash
   POST /admin/auth/rotate-keys-emergency
   Authorization: Bearer <admin-token>

   Response:
   {
     "success": true,
     "oldKid": "abc123def456...",
     "newKid": "xyz789abc123...",
     "message": "Emergency key rotation completed successfully"
   }
   ```

3. **Verify Rotation Success:**
   ```bash
   GET /admin/auth/key-rotation-status

   Confirm:
   - currentKid changed to newKid
   - oldKid now in fallbackKeysCount
   ```

4. **Monitor Client Updates:**
   - Check logs for `/api/v1/auth/mobile-jwks` downloads
   - Look for token verification errors (should be zero)
   - Monitor for 30 minutes

5. **Notify Team:**
   - Alerts automatically sent (structured log + Slack)
   - Share rotation summary in #security-incidents

---

## Failure Scenarios

### Scenario 1: Rotation Fails - HSM Connection Timeout

**Symptoms:**
- CRITICAL `KEY_ROTATION_FAILED` log event emitted
- Logs show: "HSM connection timeout"
- Status endpoint shows `lastRotation` unchanged

**Recovery:**

1. **Investigate HSM connectivity:**
   ```bash
   # SSH to backend server
   telnet hsm.company.com 5000

   # Check HSM service health
   systemctl status hsm-service
   ```

2. **Fix connectivity issues:**
   - Restart HSM service if needed
   - Check network policies, firewall rules
   - Verify credentials/certificates

3. **Retry rotation:**
   ```bash
   POST /admin/auth/rotate-keys-emergency
   ```

4. **If still failing:**
   - Escalate to HSM vendor support
   - Use manual rotation procedure (see below)

### Scenario 2: New Key Generation Fails

**Symptoms:**
- CRITICAL alert: "Failed to generate new RSA key pair"
- Status shows old key still active

**Recovery:**

1. **Check HSM capacity:**
   ```bash
   # Check available key slots on HSM
   pkcs11-tool --show-info
   ```

2. **If HSM full:**
   - Remove old/unused keys from HSM
   - Or provision new HSM slot
   - Retry rotation

3. **If HSM error:**
   - Restart HSM hardware
   - Contact vendor for support

### Scenario 3: Slack Alerts Not Sending

**Symptoms:**
- Rotation succeeds but no Slack notification received
- Logs show: `KEY_ROTATION_SLACK_FAILED`

> **Note**: Email alerts are not yet implemented. Only structured pino logs + Slack webhook are active channels.

**Recovery:**

1. **Check Slack webhook configuration:**
   ```bash
   # Verify webhook URL in .env
   echo $SLACK_WEBHOOK_URL
   echo $KEY_ROTATION_ALERT_ENABLED  # must be 'true' or unset
   ```

2. **Test alert service:**
   ```bash
   GET /admin/auth/test-key-rotation-alerts

   Response:
   {
     "slackConfigured": true,
     "slackSendSucceeded": true,
     "alertsEnabled": true
   }
   ```

3. **If Slack test fails:**
   - Verify `SLACK_WEBHOOK_URL` is a valid `https://hooks.slack.com/...` URL
   - Check network connectivity (5-second timeout)
   - Ensure `KEY_ROTATION_ALERT_ENABLED` is not `false`
   - Look for `KEY_ROTATION_SLACK_FAILED` in logs for details

### Scenario 4: Clients Can't Validate Tokens After Rotation

**Symptoms:**
- Logs show JWT verification failures after rotation
- Clients report "invalid token" errors

**Diagnosis:**

1. **Check JWKS endpoint:**
   ```bash
   GET /api/v1/auth/mobile-jwks

   Verify response includes:
   - Active key (current KID)
   - Fallback key(s) (old KIDs)
   ```

2. **Check key count:**
   ```bash
   GET /admin/auth/key-rotation-status

   Should show:
   - fallbackKeysCount: 1 (old key)
   - activeKeys array with 2 entries
   ```

3. **If JWKS missing old key:**
   - Check if fallback keys were archived correctly
   - Verify no fallback keys expired early
   - Logs should show: "Archived key {kid} as fallback until {date}"

4. **Force client JWKS refresh:**
   - Clients cache JWKS for 1 hour
   - Tell clients to clear cache manually
   - Or wait for 1-hour TTL to expire

---

## Testing

### Automated Rotation Test

1. **Enable test mode (optional):**
   ```bash
   # In development, set:
   JWT_KEY_ROTATION_INTERVAL_DAYS=0  # Rotate every cycle
   ```

2. **Wait for maintenance window** or manually adjust system time for testing

3. **Verify rotation occurred:**
   ```bash
   GET /admin/auth/key-rotation-status
   # Check lastRotation timestamp is recent
   ```

4. **Verify alerts sent:**
   - Check structured logs for `KEY_ROTATION_SUCCESS` event
   - Check Slack #security-alerts channel

### Alert Configuration Test

```bash
POST /admin/auth/test-key-rotation-alerts

Expected Response:
{
  "slackConfigured": true,
  "slackSendSucceeded": true,
  "alertsEnabled": true
}
```

**Verify:**
- Test Slack message posted (if `SLACK_WEBHOOK_URL` configured)
- `slackSendSucceeded: true` in response

### Client Token Validation Test

After rotation, verify clients can still validate tokens:

```bash
# Generate a token with old key (from before rotation)
# Mobile app tries to validate with JWKS
# Should succeed because old key is in fallback

# Logs should show no JWT verification errors
grep -i "jwt verification failed" app.log
# Output should be empty (or only show expected errors)
```

---

## Key Rotation History

### Querying Rotation History

View all past rotations (from application logs):

```bash
grep "Key rotation completed" /var/log/nks-backend/app.log

# Example output:
# 2026-04-10T02:15:30Z [KeyRotationScheduler] ✅ Key rotation completed in 1234ms
# 2026-03-10T02:10:45Z [KeyRotationScheduler] ✅ Key rotation completed in 1567ms
```

### Rotation Metrics

**Track these metrics:**
- Time since last rotation
- Rotation success rate
- Average rotation duration
- Fallback keys available

```bash
# In monitoring dashboard (Prometheus/Datadog):
nks_key_rotation_success_total
nks_key_rotation_failure_total
nks_key_rotation_duration_ms
nks_active_fallback_keys_count
```

---

## Security Considerations

### Key Storage

- **Private Key:** Protected by HSM (FIPS 140-2 Level 2+ recommended)
- **Public Key:** Distributed in JWKS endpoint (public, not sensitive)
- **Never:** Export private key to application code
- **Never:** Log private key material

### Access Control

- Only ops/security team can trigger emergency rotation
- Admin endpoint `/admin/auth/rotate-keys-emergency` requires:
  - Valid authentication token
  - Admin/SUPER_ADMIN role
  - HTTPS only

### Audit Trail

**Log all rotation events:**
- Who triggered (for emergency rotations)
- When rotation occurred
- Old and new KID values
- Success/failure status
- Alert recipients

**Audit Trail Examples:**
```json
{
  "event": "key_rotation_scheduled",
  "timestamp": "2026-04-10T02:15:30Z",
  "oldKid": "abc123...",
  "newKid": "xyz789...",
  "reason": "scheduled",
  "result": "success"
}

{
  "event": "key_rotation_emergency",
  "timestamp": "2026-04-12T15:30:00Z",
  "triggeredBy": "admin@company.com",
  "oldKid": "abc123...",
  "newKid": "new456...",
  "reason": "emergency",
  "result": "success"
}
```

### Grace Period Rationale

Why 30 days?
- Offline JWT TTL = 3 days
- Mobile clients may stay offline for 7-14 days
- Grace period = 30 days = 4+ offline windows
- Ensures offline clients can always validate tokens
- No client lockout after key rotation

---

## Troubleshooting Checklist

- [ ] Is rotation enabled? Check `JWT_KEY_ROTATION_ENABLED=true`
- [ ] Is scheduler running? Check logs for "Key rotation scheduler initialized"
- [ ] Are we in maintenance window? Verify `JWT_ROTATION_WINDOW_START` and current time
- [ ] Have we waited long enough? Check `JWT_KEY_ROTATION_INTERVAL_DAYS` since last rotation
- [ ] Are alerts configured? Check `SLACK_WEBHOOK_URL` and `KEY_ROTATION_ALERT_ENABLED`
- [ ] Can we reach HSM? Test `telnet hsm.company.com 5000`
- [ ] Are JWKS keys valid? Verify via `/api/v1/auth/mobile-jwks` endpoint
- [ ] Are clients updating JWKS? Check logs for endpoint hits
- [ ] Check full logs: `tail -f /var/log/nks-backend/app.log`

---

## Contacts & Escalation

**For Automated Rotation Issues:**
- ops@company.com (primary)
- security@company.com (secondary)

**For HSM/KMS Issues:**
- HSM Vendor Support (contact info in onboarding)
- Cloud Provider Support (AWS KMS, Azure Key Vault, etc.)

**For Slack Alert Issues:**
- Platform team (Slack webhook integration)
- DevOps team (log aggregator configuration)

---

## References

- [JWT Configuration Source Code](../src/config/jwt.config.ts)
- [Key Rotation Scheduler](../src/modules/auth/services/key-rotation-scheduler.ts)
- [Alert Service](../src/modules/auth/services/key-rotation-alert.service.ts)
- [RFC 7638 - JWK Thumbprint](https://tools.ietf.org/html/rfc7638)
- [NIST SP 800-57: Key Management](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-57pt1r5.pdf)

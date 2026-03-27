# Future Implementation

## Step 4 — Email Linking Flow

Allow a logged-in phone-only user to link an email address to their account.

### API Endpoints

#### `POST /api/v1/auth/email/link`
- **Auth:** Required (Bearer token)
- **Body:** `{ email: string }`
- **Flow:**
  1. Validate email is not already taken by another user
  2. Generate a short-lived verification token (`crypto.randomBytes(32).toString('hex')`)
  3. Store in `otp_verification` table:
     - `identifier` = email
     - `value` = token (hashed)
     - `purpose` = `EMAIL_VERIFY`
     - `expiresAt` = now + 24 hours
  4. Send verification email with link: `https://<app>/auth/email/verify?token=<token>`
  5. Return `{ message: "Verification email sent" }`

#### `POST /api/v1/auth/email/verify`
- **Auth:** Required (Bearer token)
- **Body:** `{ token: string }`
- **Flow:**
  1. Look up token in `otp_verification` where `purpose = EMAIL_VERIFY` and `isUsed = false` and `expiresAt > now`
  2. If not found or expired → `400 "Invalid or expired token"`
  3. Check email (`identifier`) is still not taken by another user
  4. `UPDATE users SET email = identifier, emailVerified = true WHERE id = userId`
  5. Mark token `isUsed = true`
  6. Return updated `AuthResponseDto`

### Dependencies
- Email sending service (e.g. nodemailer, Resend, SendGrid) — not yet configured
- `otpPurposeEnum` must include `EMAIL_VERIFY` value

### Note
Once implemented, uncomment the `emailVerified` check in `AuthService.setPassword()`:
```typescript
// TODO: Require emailVerified = true once email-linking flow (Step 4) is implemented.
if (!user.emailVerified) {
  throw new BadRequestException('Please verify your email before setting a password.');
}
```

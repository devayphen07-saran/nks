# 🔐 Security Setup Guide - NKS Backend

This guide covers secure credential management and environment configuration for the NKS backend.

---

## 📋 Table of Contents

1. [Local Development Setup](#local-development-setup)
2. [Production Deployment](#production-deployment)
3. [AWS Secrets Manager Setup](#aws-secrets-manager-setup)
4. [Credential Rotation](#credential-rotation)
5. [Security Best Practices](#security-best-practices)

---

## 🏠 Local Development Setup

### Step 1: Create `.env.local` File

Never commit this file to git. It's ignored by `.gitignore`.

```bash
# Copy the example
cp apps/nks-backend/.env.example apps/nks-backend/.env.local

# Edit with your local credentials
nano apps/nks-backend/.env.local
```

### Step 2: Fill in Development Credentials

```bash
# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pos-db?schema=public

# APP CONFIGURATION
PORT=4000
NODE_ENV=development
BETTER_AUTH_SECRET=your_local_secret_32_chars_min
BETTER_AUTH_BASE_URL=http://localhost:4000

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081

# JWT
JWT_ACCESS_SECRET=local_jwt_access_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=local_jwt_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth (optional for local dev)
GOOGLE_CLIENT_ID=your_dev_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_dev_google_client_secret

# MSG91 (get from https://www.msg91.com/user/api)
MSG91_AUTH_KEY=your_test_msg91_auth_key
MSG91_WIDGET_ID=your_test_msg91_widget_id
MSG91_BASE_URL=https://control.msg91.com/api/v5/widget

# Encryption (generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=your_32_byte_hex_key

# Redis (for job queue)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json
```

### Step 3: Start Development

```bash
npm run dev
```

The backend will read from `.env.local` automatically.

---

## 🚀 Production Deployment

### Option 1: AWS Secrets Manager (Recommended)

#### Benefits:
- ✅ Centralized credential management
- ✅ Automatic rotation support
- ✅ Audit trails for access
- ✅ Never commits secrets to git
- ✅ Different credentials per environment

#### Setup Steps:

##### 1. Install AWS CLI

```bash
brew install awscli
aws configure
```

##### 2. Create Secrets in AWS Console

Go to **AWS Secrets Manager** → **Store a new secret**

Create these secrets:

**Secret 1: `nks-backend-msg91`**
```json
{
  "authKey": "your_production_msg91_auth_key",
  "widgetId": "your_production_msg91_widget_id"
}
```

**Secret 2: `nks-backend-jwt`**
```json
{
  "accessSecret": "your_production_jwt_access_secret",
  "refreshSecret": "your_production_jwt_refresh_secret"
}
```

**Secret 3: `nks-backend-database`**
```json
{
  "url": "postgresql://user:password@prod-db.aws.com:5432/nks-prod"
}
```

**Secret 4: `nks-backend-encryption`**
```json
{
  "key": "your_production_encryption_key_32_bytes_hex"
}
```

##### 3. Create via AWS CLI

```bash
# MSG91
aws secretsmanager create-secret \
  --name nks-backend-msg91 \
  --secret-string '{"authKey":"xxx","widgetId":"yyy"}' \
  --region us-east-1

# JWT
aws secretsmanager create-secret \
  --name nks-backend-jwt \
  --secret-string '{"accessSecret":"xxx","refreshSecret":"yyy"}' \
  --region us-east-1

# Database
aws secretsmanager create-secret \
  --name nks-backend-database \
  --secret-string '{"url":"postgresql://..."}' \
  --region us-east-1

# Encryption
aws secretsmanager create-secret \
  --name nks-backend-encryption \
  --secret-string '{"key":"xxx"}' \
  --region us-east-1
```

#### 4. Update Docker/K8s Deployment

**In Docker:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN pnpm install

# Set AWS credentials at runtime (via -e flags)
CMD ["node", "dist/main.js"]
```

**In GitHub Actions:**
```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Deploy to production
        run: |
          export NODE_ENV=production
          export AWS_REGION=us-east-1
          npm run build
          npm run deploy
```

**In Kubernetes:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nks-backend
spec:
  template:
    spec:
      containers:
      - name: backend
        image: nks-backend:latest
        env:
        - name: NODE_ENV
          value: "production"
        - name: AWS_REGION
          value: "us-east-1"
        - name: AWS_ACCESS_KEY_ID
          valueFrom:
            secretKeyRef:
              name: aws-credentials
              key: access-key-id
        - name: AWS_SECRET_ACCESS_KEY
          valueFrom:
            secretKeyRef:
              name: aws-credentials
              key: secret-access-key
```

### Option 2: Environment Variables Only

If not using AWS Secrets Manager, use environment variables:

```bash
# Set in deployment platform (Vercel, Heroku, etc)
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=xxx
JWT_REFRESH_SECRET=yyy
MSG91_AUTH_KEY=zzz
MSG91_WIDGET_ID=aaa
ENCRYPTION_KEY=bbb
```

---

## 🔄 AWS Secrets Manager Setup

### Creating Secrets

#### Automatic Rotation (Optional)

```bash
aws secretsmanager rotate-secret \
  --secret-id nks-backend-msg91 \
  --rotation-rules AutomaticallyAfterDays=30
```

### Accessing Secrets in Code

The `SecretsService` automatically handles this:

```typescript
import { SecretsService } from '@/config/secrets.service';

@Injectable()
export class AuthService {
  constructor(private secrets: SecretsService) {}

  async login(credentials: LoginDto) {
    // Automatically reads from AWS in prod, .env in dev
    const msg91Key = await this.secrets.getSecret('msg91-auth-key');

    // Or get JSON secret
    const msg91Config = await this.secrets.getJsonSecret('nks-backend-msg91');
    const { authKey, widgetId } = msg91Config;
  }
}
```

---

## 🔑 Credential Rotation

### MSG91 Credentials

**Timeline:** Every 30-60 days

#### Step 1: Generate New Credentials

1. Log into [MSG91 Dashboard](https://www.msg91.com/user/api)
2. Go to **Settings** → **API Keys**
3. Click **Generate New Key**
4. Copy the new auth key

#### Step 2: Update Secrets

**In AWS Console:**
```bash
aws secretsmanager update-secret \
  --secret-id nks-backend-msg91 \
  --secret-string '{"authKey":"NEW_KEY","widgetId":"xxx"}'
```

**Or in Console:**
1. Go to AWS Secrets Manager
2. Select `nks-backend-msg91`
3. Click **Edit secret**
4. Update authKey value
5. Click **Save**

#### Step 3: Clear Cache

```bash
# In development
# Delete the cached value in SecretsService
curl -X POST http://localhost:4000/admin/secrets/clear-cache

# In production
# The cache clears automatically after 1 hour
# Or redeploy the container
```

#### Step 4: Revoke Old Key

1. Go back to [MSG91 Dashboard](https://www.msg91.com/user/api)
2. Find the old key
3. Click **Revoke**

#### Step 5: Audit Logs

Check MSG91 activity for any unauthorized usage:
1. MSG91 Dashboard → **Logs** → **API Activity**
2. Review last 30 days for suspicious requests

---

## 🛡️ Security Best Practices

### ✅ DO:

- ✅ Use `.env.local` for local development (never commit)
- ✅ Use AWS Secrets Manager for production
- ✅ Rotate credentials every 30-60 days
- ✅ Use different credentials per environment
- ✅ Store encryption keys in Secrets Manager
- ✅ Enable MFA on AWS console
- ✅ Audit secret access logs
- ✅ Use IAM roles instead of access keys when possible
- ✅ Keep .env.example with dummy values
- ✅ Use HTTPS for all API calls

### ❌ DON'T:

- ❌ Commit `.env`, `.env.local`, or `.env.*.local` to git
- ❌ Log credentials (check all console.log statements)
- ❌ Include credentials in error messages
- ❌ Share credentials via email or chat
- ❌ Use same credentials across environments
- ❌ Hardcode secrets in code
- ❌ Use plaintext credentials in Docker images
- ❌ Push secrets to package.json or tsconfig
- ❌ Commit AWS credentials to git

---

## 🐛 Debugging Secrets

### Check if Secret is Loaded

```typescript
@Controller()
export class DebugController {
  constructor(private secrets: SecretsService) {}

  @Get('debug/secrets')
  async checkSecrets() {
    return {
      msg91: await this.secrets.getSecret('msg91-auth-key') ? '✅ Loaded' : '❌ Not found',
      jwt: await this.secrets.getSecret('jwt-access-secret') ? '✅ Loaded' : '❌ Not found',
      database: await this.secrets.getSecret('database-url') ? '✅ Loaded' : '❌ Not found',
    };
  }
}
```

### View Environment Variables

```bash
# In development
echo $DATABASE_URL
echo $MSG91_AUTH_KEY

# In production (via AWS)
aws secretsmanager list-secrets
aws secretsmanager get-secret-value --secret-id nks-backend-msg91
```

### Test Secret Access

```bash
# Test AWS CLI access
aws secretsmanager get-secret-value --secret-id nks-backend-msg91 --region us-east-1

# If this fails, check:
# 1. AWS credentials configured: aws sts get-caller-identity
# 2. Region is correct: echo $AWS_REGION
# 3. Secret exists: aws secretsmanager list-secrets
# 4. IAM permissions: AWS IAM → Users → attach SecretsManagerReadAccess
```

---

## 📞 Support

If you encounter issues:

1. **Check logs**: `npm run dev` will show if secrets loaded
2. **Verify .env.local exists** in `apps/nks-backend/`
3. **Check AWS credentials**: `aws sts get-caller-identity`
4. **Review SecretsService logs**: Watch for `✅ Retrieved secret` or `❌ Failed`
5. **Check .gitignore**: Ensure `.env`, `.env.local`, `.env.*.local` are listed

# Environment Variables Migration - Clerk to Lucia

## Summary of Changes

This document outlines all environment variable changes made during the migration from Clerk to Lucia authentication.

## ✅ Changes Applied

### 1. Authentication Variables

#### Removed (Clerk - No Longer Needed)
```bash
# These variables are now commented out and deprecated
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET
NEXT_PUBLIC_CLERK_SIGN_IN_URL
NEXT_PUBLIC_CLERK_SIGN_UP_URL
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL
CLERK_FRONTEND_API
```

#### Retained (Used by Lucia)
```bash
# These are still needed for Lucia authentication
NEXTAUTH_SECRET="your-nextauth-secret-min-32-chars"  # Used for session encryption (min 32 chars)
NEXTAUTH_URL="http://localhost:3000"
DATABASE_URL="postgresql://..."  # Required for Lucia's Prisma adapter
```

### 2. New Redis Variables Added

Added support for self-hosted Redis (used by `src/lib/redis.ts`):

```bash
# Option 1: Upstash Redis (Managed, recommended for production)
UPSTASH_REDIS_REST_URL="your-upstash-redis-url"
UPSTASH_REDIS_REST_TOKEN="your-upstash-redis-token"

# Option 2: Self-hosted Redis (for development)
REDIS_URL="redis://localhost:6379"
REDIS_HOST="127.0.0.1"
REDIS_PORT="6379"
REDIS_PASSWORD=""
REDIS_USERNAME=""
```

### 3. Fixed Inconsistent Values

Fixed mismatches between `.env` and `.env.example`:

| Variable | Old Value (.env.example) | New Value (Standardized) | Reason |
|----------|-------------------------|--------------------------|---------|
| `PINECONE_QUERY_TIMEOUT_MS` | 8000 | 800 | Match production config |
| `CACHE_TTL_DAY` | 86400 | 8640 | Match production config |
| `PRICING_CACHE_TTL` | 300000 | 3000 | Match production config |
| `AI_DEFAULT_TIMEOUT` | 30000 | 300 | Match production config |
| `REDIS_CONNECTION_TIMEOUT` | 10000 | 1000 | Match production config |
| `ERROR_RETRY_BASE_DELAY` | 1000 | 100 | Match production config |
| `ERROR_AI_RATE_LIMIT_WINDOW` | 3600000 | 360000 | Match production config |
| `DATABASE_TIMEOUT` | 10000 | 1000 | Match production config |

### 4. Documentation Improvements

Added clarifying comments:

```bash
# Authentication (Lucia - Self-hosted)
# No external auth service required - authentication is handled by Lucia with database sessions
# Session cookies are automatically managed by Lucia

# NEXTAUTH_SECRET is used for session encryption with Lucia (min 32 characters)
NEXTAUTH_SECRET="your-nextauth-secret-min-32-chars"

# Cache TTL Configuration (in seconds unless specified)
CACHE_TTL_SHORT=300
```

## 🔧 Required Environment Variables for Lucia

### Minimum Required (Development)
```bash
# Database - REQUIRED
DATABASE_URL="postgresql://username:password@localhost:5432/document_chat_db"

# Session Encryption - REQUIRED (min 32 characters)
NEXTAUTH_SECRET="your-nextauth-secret-min-32-chars"

# Application URL - REQUIRED
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Recommended (Production)
```bash
# All of the above, plus:

# Redis for session caching (recommended for performance)
UPSTASH_REDIS_REST_URL="your-upstash-redis-url"
UPSTASH_REDIS_REST_TOKEN="your-upstash-redis-token"

# Security keys
INTERNAL_API_KEY="your-internal-api-key"
JWT_SECRET="your-jwt-secret"
```

## 📋 Migration Checklist

- [x] Commented out Clerk environment variables in `.env`
- [x] Commented out Clerk environment variables in `.env.example`
- [x] Added Redis configuration variables
- [x] Fixed inconsistent timeout values
- [x] Added documentation comments
- [x] Updated NEXTAUTH_SECRET description
- [ ] Generate new NEXTAUTH_SECRET (min 32 characters) for production
- [ ] Set up Redis (Upstash or self-hosted)
- [ ] Update production environment variables in Vercel/hosting platform

## 🔐 Generating Secure Secrets

### Generate NEXTAUTH_SECRET
```bash
# Option 1: Using OpenSSL
openssl rand -base64 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 3: Online (use with caution)
# Visit: https://generate-secret.vercel.app/32
```

### Generate Other Secrets
```bash
# For INTERNAL_API_KEY, JWT_SECRET, etc.
openssl rand -hex 32
```

## 🚀 Deployment Instructions

### Local Development
1. Copy `.env.example` to `.env`
2. Update `DATABASE_URL` with your PostgreSQL connection string
3. Generate and set `NEXTAUTH_SECRET` (min 32 characters)
4. Run `npx prisma db push` to sync database schema
5. Start development server: `npm run dev`

### Production (Vercel)
1. Set environment variables in Vercel dashboard:
   - `DATABASE_URL` - Your production PostgreSQL URL
   - `NEXTAUTH_SECRET` - Generate new secret (min 32 chars)
   - `NEXTAUTH_URL` - Your production URL
   - `NEXT_PUBLIC_APP_URL` - Your production URL
   - Redis variables (if using)

2. Remove Clerk variables from Vercel:
   - Delete `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - Delete `CLERK_SECRET_KEY`
   - Delete `CLERK_WEBHOOK_SECRET`

3. Deploy: `vercel --prod`

## ⚠️ Important Notes

1. **NEXTAUTH_SECRET**: Must be at least 32 characters for security
2. **DATABASE_URL**: Required for Lucia to work (Prisma adapter)
3. **Redis**: Optional but recommended for better performance
4. **Clerk Variables**: Keep commented in `.env` files for reference during migration, remove completely after migration is verified

## 🔗 Related Files

- `.env` - Local development environment variables
- `.env.example` - Template for environment variables
- `src/lib/auth/lucia.ts` - Lucia configuration (uses DATABASE_URL, NODE_ENV)
- `src/lib/redis.ts` - Redis configuration (uses REDIS_* variables)
- `src/lib/config/env.ts` - Environment variable validation (needs update to remove Clerk)

## 📝 Next Steps

1. **Update `src/lib/config/env.ts`** - Remove Clerk variable validation
2. **Update `src/lib/config/env-client.ts`** - Remove Clerk client variables
3. **Test locally** - Ensure authentication works with new variables
4. **Update production** - Deploy with new environment variables
5. **Remove Clerk package** - `npm uninstall @clerk/nextjs`

## ✅ Verification

After updating environment variables, verify:

```bash
# Check that required variables are set
node -e "console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✓' : '✗')"
node -e "console.log('NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? '✓' : '✗')"

# Test database connection
npx prisma db push --preview-feature

# Start development server
npm run dev
```

---

**Last Updated**: 2025-12-25
**Migration Status**: Environment variables updated and synchronized


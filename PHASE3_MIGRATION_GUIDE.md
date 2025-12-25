# Phase 3: Clerk to Self-Hosted Authentication Migration Guide

## Overview
This document outlines the migration from Clerk to a self-hosted authentication solution using Lucia Auth v3.

## ✅ Completed Steps

### 1. Core Authentication Setup
- ✅ Created `src/lib/auth/lucia.ts` with Lucia v3 configuration
- ✅ Updated `src/lib/auth.ts` to export Lucia functions
- ✅ Updated `src/lib/auth-utils.ts` to use Lucia
- ✅ Updated `src/middleware.ts` to use Lucia session validation

### 2. Authentication Routes
- ✅ Updated `/api/auth/login` - Now uses Lucia for session creation
- ✅ Updated `/api/auth/logout` - Now uses Lucia for session invalidation
- ✅ Updated `/api/auth/signup` - Creates organization and user with Lucia session

### 3. Database Schema
- ✅ Added `clerkId` field to User model (for migration compatibility)
- ✅ Marked Lucia-specific fields as legacy (sessions, keys, hashed_password)
- ✅ Generated Prisma client with new schema

### 4. Bug Fixes
- ✅ Fixed missing closing braces in `vector-index-manager.ts`
- ✅ Fixed missing closing braces in `vector-search.ts`
- ✅ Fixed duplicate exports in vector services
- ✅ Restored corrupted `account-deletion.ts` from git

## ⚠️ Remaining Work

### Critical (Must Do Before Running)

#### 1. Database Migration
```bash
# Set your DATABASE_URL in .env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# Run migration
npm run db:push
# OR create a proper migration
npm run db:migrate
```

#### 2. Remove Clerk Dependencies
The codebase still has **575 files** with Clerk imports. Key files to update:

**High Priority API Routes:**
- `src/app/api/v1/user/route.ts`
- `src/app/api/v1/profile/route.ts`
- `src/app/api/v1/organizations/route.ts`
- `src/app/api/v1/documents/**/*.ts`
- `src/app/api/v1/billing/**/*.ts`

**Pattern to Replace:**
```typescript
// OLD (Clerk)
import { auth, currentUser } from '@clerk/nextjs/server';
const { userId } = await auth();
const user = await currentUser();

// NEW (Lucia)
import { validateRequest } from '@/lib/auth';
const { user, session } = await validateRequest();
```

#### 3. Update User Lookup Pattern
```typescript
// OLD (Clerk)
const user = await db.user.findUnique({
  where: { clerkId: userId }
});

// NEW (Lucia)
const { user } = await validateRequest();
// user is already from database
```

### Medium Priority

#### 4. Frontend Components
Update components that use Clerk hooks:
- Replace `useUser()` with custom hook using `/api/auth/session`
- Replace `useAuth()` with session-based auth
- Update sign-in/sign-up pages

#### 5. Webhooks
- Remove Clerk webhook handler (`/api/v1/webhooks/clerk`)
- Implement email verification (if needed)
- Implement password reset flow

### Low Priority

#### 6. Environment Variables
Remove Clerk-specific variables:
```bash
# Remove these from .env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET

# Keep these
DATABASE_URL
NEXTAUTH_SECRET (or similar for session encryption)
```

#### 7. Package Cleanup
```bash
# Remove Clerk packages
npm uninstall @clerk/nextjs

# Ensure Lucia packages are installed
npm install lucia @lucia-auth/adapter-prisma oslo
```

## 🔧 Migration Script

Create a migration script to update existing users:

```typescript
// scripts/migrate-clerk-to-lucia.ts
import { db } from '@/lib/db';
import { Argon2id } from 'oslo/password';

async function migrateUsers() {
  const users = await db.user.findMany({
    where: { clerkId: { not: null } }
  });

  for (const user of users) {
    // Generate temporary password or send reset email
    const tempPassword = generateSecurePassword();
    const hashedPassword = await new Argon2id().hash(tempPassword);

    await db.user.update({
      where: { id: user.id },
      data: { hashed_password: hashedPassword }
    });

    // Send email with temporary password
    await sendPasswordResetEmail(user.email, tempPassword);
  }
}
```

## 📝 Testing Checklist

- [ ] User can sign up with email/password
- [ ] User can log in with email/password
- [ ] User can log out
- [ ] Session persists across page refreshes
- [ ] Protected routes redirect to login
- [ ] API routes validate sessions correctly
- [ ] Organization creation works on signup
- [ ] User data is properly associated with organization

## 🚨 Breaking Changes

1. **Authentication Flow**: Users will need to create new passwords
2. **Session Management**: Sessions are now server-side only
3. **User IDs**: Internal user IDs remain the same, but authentication method changes
4. **No OAuth**: Current implementation only supports email/password (can be extended)

## 📚 Next Steps

1. Set DATABASE_URL and run migration
2. Systematically update API routes (start with user/profile routes)
3. Update frontend components
4. Test authentication flow
5. Deploy and notify users of password reset requirement

## 🔗 Resources

- [Lucia Auth Documentation](https://lucia-auth.com/)
- [Prisma Adapter for Lucia](https://lucia-auth.com/database-adapters/prisma)
- [Oslo (Password Hashing)](https://oslo.js.org/)


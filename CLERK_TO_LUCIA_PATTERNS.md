# Clerk to Lucia Migration Patterns

## Quick Reference for Common Replacements

### 1. Import Statements

```typescript
// ❌ OLD (Clerk)
import { auth, currentUser } from '@clerk/nextjs/server';
import { useUser, useAuth } from '@clerk/nextjs';

// ✅ NEW (Lucia)
import { validateRequest } from '@/lib/auth';
// For frontend, create custom hooks
```

### 2. Getting Current User in API Routes

```typescript
// ❌ OLD (Clerk)
export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const user = await db.user.findUnique({
    where: { clerkId: userId }
  });
}

// ✅ NEW (Lucia)
export async function GET(request: NextRequest) {
  const { user, session } = await validateRequest();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // user is already the full database user object
  // user.organizationId is available directly
}
```

### 3. Creating Sessions (Login)

```typescript
// ❌ OLD (Clerk)
// Clerk handles this automatically

// ✅ NEW (Lucia)
import { lucia } from '@/lib/auth';
import { cookies } from 'next/headers';

const session = await lucia.createSession(user.id, {});
const sessionCookie = lucia.createSessionCookie(session.id);

(await cookies()).set(
  sessionCookie.name,
  sessionCookie.value,
  sessionCookie.attributes
);
```

### 4. Destroying Sessions (Logout)

```typescript
// ❌ OLD (Clerk)
// Clerk handles this automatically

// ✅ NEW (Lucia)
import { lucia, validateRequest } from '@/lib/auth';
import { cookies } from 'next/headers';

const { session } = await validateRequest();
if (session) {
  await lucia.invalidateSession(session.id);
  const sessionCookie = lucia.createBlankSessionCookie();
  (await cookies()).set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes
  );
}
```

### 5. Middleware Protection

```typescript
// ❌ OLD (Clerk)
import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

// ✅ NEW (Lucia)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateRequest } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { user } = await validateRequest();
  
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') ||
                     request.nextUrl.pathname.startsWith('/signup');
  
  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  return NextResponse.next();
}
```

### 6. Frontend User Access

```typescript
// ❌ OLD (Clerk)
import { useUser } from '@clerk/nextjs';

function MyComponent() {
  const { user, isLoaded } = useUser();
  
  if (!isLoaded) return <div>Loading...</div>;
  if (!user) return <div>Not logged in</div>;
  
  return <div>Hello {user.firstName}</div>;
}

// ✅ NEW (Lucia) - Create custom hook
// src/hooks/use-current-user.ts
import { useEffect, useState } from 'react';

export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        setUser(data.user);
        setIsLoading(false);
      });
  }, []);
  
  return { user, isLoading };
}

// Usage
import { useCurrentUser } from '@/hooks/use-current-user';

function MyComponent() {
  const { user, isLoading } = useCurrentUser();
  
  if (isLoading) return <div>Loading...</div>;
  if (!user) return <div>Not logged in</div>;
  
  return <div>Hello {user.firstName}</div>;
}
```

### 7. Organization Access

```typescript
// ❌ OLD (Clerk)
const { orgId } = await auth();

// ✅ NEW (Lucia)
const { user } = await validateRequest();
const organizationId = user.organizationId;
```

### 8. User Metadata

```typescript
// ❌ OLD (Clerk)
const user = await currentUser();
const metadata = user.publicMetadata;

// ✅ NEW (Lucia)
const { user } = await validateRequest();
// Store metadata directly in User model
const metadata = user.metadata; // Add metadata field to Prisma schema if needed
```

### 9. Password Hashing

```typescript
// ✅ NEW (Lucia uses Oslo)
import { Argon2id } from 'oslo/password';

// Hash password
const hashedPassword = await new Argon2id().hash(password);

// Verify password
const validPassword = await new Argon2id().verify(
  user.hashed_password,
  password
);
```

### 10. Session Validation in Server Components

```typescript
// ❌ OLD (Clerk)
import { auth } from '@clerk/nextjs/server';

export default async function Page() {
  const { userId } = await auth();
  // ...
}

// ✅ NEW (Lucia)
import { validateRequest } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Page() {
  const { user } = await validateRequest();
  
  if (!user) {
    redirect('/login');
  }
  
  // ...
}
```

## Common Gotchas

1. **Session Cookie**: Lucia requires manual cookie management, Clerk did this automatically
2. **User Object**: Lucia's `user` is your database user, Clerk's was a separate object
3. **Organization**: Lucia doesn't have built-in org support, use `user.organizationId`
4. **Email Verification**: Lucia doesn't include this, implement separately if needed
5. **OAuth**: Lucia supports OAuth but requires additional setup

## Migration Priority

1. **Start with**: API routes that validate auth
2. **Then**: Login/logout/signup flows
3. **Then**: Middleware
4. **Then**: Frontend components
5. **Finally**: Remove Clerk dependencies


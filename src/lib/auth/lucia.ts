/**
 * Lucia Auth Configuration
 * 
 * Self-hosted authentication solution using Lucia v3
 */

import { Lucia } from "lucia";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Session, User } from "lucia";

// Initialize Lucia with Prisma adapter
const adapter = new PrismaAdapter(db.session, db.user);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    expires: false,
    attributes: {
      secure: process.env.NODE_ENV === "production",
    },
  },
  getUserAttributes: (attributes) => {
    return {
      id: attributes.id,
      email: attributes.email,
      firstName: attributes.firstName,
      lastName: attributes.lastName,
      imageUrl: attributes.imageUrl,
      organizationId: attributes.organizationId,
      role: attributes.role,
    };
  },
});

// Type declarations for Lucia
declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: DatabaseUserAttributes;
  }
}

interface DatabaseUserAttributes {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  organizationId: string;
  role: string;
}

/**
 * Validate the current session
 * Cached to avoid multiple database calls
 */
export const validateRequest = cache(
  async (): Promise<
    { user: User; session: Session } | { user: null; session: null }
  > => {
    const sessionId = (await cookies()).get(lucia.sessionCookieName)?.value ?? null;
    
    if (!sessionId) {
      return {
        user: null,
        session: null,
      };
    }

    const result = await lucia.validateSession(sessionId);
    
    // Refresh session if needed
    try {
      if (result.session && result.session.fresh) {
        const sessionCookie = lucia.createSessionCookie(result.session.id);
        (await cookies()).set(
          sessionCookie.name,
          sessionCookie.value,
          sessionCookie.attributes
        );
      }
      if (!result.session) {
        const sessionCookie = lucia.createBlankSessionCookie();
        (await cookies()).set(
          sessionCookie.name,
          sessionCookie.value,
          sessionCookie.attributes
        );
      }
    } catch {
      // Next.js throws error when attempting to set cookies in Server Components
    }

    return result;
  }
);

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
  const { user } = await validateRequest();
  return user;
}

/**
 * Get the current user's organization ID
 */
export async function getCurrentOrganizationId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.organizationId || null;
}

/**
 * Check if the current user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const { user } = await validateRequest();
  return !!user;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const { session } = await validateRequest();
  
  if (!session) {
    return {
      error: "Unauthorized",
    };
  }

  await lucia.invalidateSession(session.id);

  const sessionCookie = lucia.createBlankSessionCookie();
  (await cookies()).set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes
  );
}


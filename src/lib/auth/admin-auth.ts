/**
 * Admin Authentication and Authorization
 *
 * Provides utilities for verifying admin access to organization resources.
 */

import { validateRequest } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';

// ... (rest of the file)

export async function verifyAdminAccess(
  organizationId: string,
  requiredRoles: UserRole[] = ['ADMIN', 'OWNER']
): Promise<AdminAuthResult> {
  try {
    const session = await validateRequest();
    
    if (!session) {
      return {
        authorized: false,
        error: 'Unauthorized - Authentication required',
        statusCode: 401
      };
    }

    const { user } = session;

    if (!user) {
      return {
        authorized: false,
        error: 'User not found or has been deleted',
        statusCode: 403
      };
    }

    // Verify user belongs to the requested organization
    if (user.organizationId !== organizationId) {
      return {
        authorized: false,
        error: 'Forbidden - User does not belong to this organization',
        statusCode: 403
      };
    }

    // Verify user has required role
    if (!requiredRoles.includes(user.role)) {
      return {
        authorized: false,
        error: `Forbidden - Required role: ${requiredRoles.join(' or ')}. Current role: ${user.role}`,
        statusCode: 403
      };
    }

    // Authorization successful
    return {
      authorized: true,
      userId: user.id,
      userRole: user.role,
      organizationId: user.organizationId
    };

  } catch (error) {
    console.error('Admin auth verification error:', error);
    return {
      authorized: false,
      error: 'Internal server error during authorization',
      statusCode: 500
    };
  }
}

/**
 * Quick check if current user is an admin or owner
 *
 * @returns true if user is ADMIN or OWNER, false otherwise
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const session = await validateRequest();
    if (!session?.user) return false;

    return session.user.role === 'ADMIN' || session.user.role === 'OWNER';
  } catch (error) {
    console.error('Admin check error:', error);
    return false;
  }
}

/**
 * Get current user's role and organization
 *
 * @returns User role and organization info, or null if not authenticated
 */
export async function getCurrentUserRole(): Promise<{
  userId: string;
  role: UserRole;
  organizationId: string;
} | null> {
  try {
    const session = await validateRequest();
    if (!session?.user) return null;

    const { user } = session;

    return {
      userId: user.id,
      role: user.role,
      organizationId: user.organizationId
    };
  } catch (error) {
    console.error('Get user role error:', error);
    return null;
  }
}

/**
 * Verify user has at least MEMBER access to organization
 *
 * @param organizationId - The organization ID to check
 * @returns true if user has any access, false otherwise
 */
export async function verifyOrganizationAccess(organizationId: string): Promise<boolean> {
  try {
    const session = await validateRequest();
    if (!session?.user) return false;

    return session.user.organizationId === organizationId;
  } catch (error) {
    console.error('Organization access check error:', error);
    return false;
  }
}

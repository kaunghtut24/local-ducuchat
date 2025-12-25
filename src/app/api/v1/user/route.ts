/**
 * @swagger
 * /api/user:
 *   get:
 *     tags: [Users]
 *     summary: Get current user information
 *     description: |
 *       Retrieve the authenticated user's account information including profile details,
 *       organization membership, and role information.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   
 *   patch:
 *     tags: [Users]
 *     summary: Update user account information
 *     description: |
 *       Update the authenticated user's account information such as name,
 *       timezone preferences, and email notification settings.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 1
 *                 description: User's first name
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 minLength: 1
 *                 description: User's last name
 *                 example: "Doe"
 *               timezone:
 *                 type: string
 *                 description: User's preferred timezone
 *                 example: "America/New_York"
 *               emailOptIn:
 *                 type: boolean
 *                 description: Whether user wants to receive email notifications
 *                 example: true
 *           examples:
 *             name_update:
 *               summary: Update name
 *               value:
 *                 firstName: "John"
 *                 lastName: "Doe"
 *             preferences_update:
 *               summary: Update preferences
 *               value:
 *                 timezone: "America/Los_Angeles"
 *                 emailOptIn: false
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateRequest } from '@/lib/auth'
import { z } from 'zod'
import { db } from '@/lib/db'
import { UserUpdateSchema } from '@/lib/validations'
import { handleApiError, asyncHandler, commonErrors } from '@/lib/api-errors'
import { withRateLimit, rateLimitConfigs } from '@/lib/rate-limit'
import { cacheManager } from '@/lib/cache'
import { UsageTrackingService, UsageType } from '@/lib/usage-tracking'

// Extract user data fetching logic for caching
async function fetchUserData(userId: string) {
  // Get user from local database using Lucia user ID
  const dbUser = await db.user.findUnique({
    where: { id: userId },
    include: { 
      organization: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  })

  if (!dbUser) {
    throw commonErrors.notFound('User')
  }

  // Return database user data
  const userData = {
    id: dbUser.id,
    email: dbUser.email,
    firstName: dbUser.firstName,
    lastName: dbUser.lastName,
    imageUrl: dbUser.imageUrl,
    createdAt: dbUser.createdAt,
    lastActiveAt: dbUser.lastActiveAt,
    
    // Database user data
    role: dbUser.role,
    organization: dbUser.organization,
    timezone: dbUser.timezone,
    emailOptIn: dbUser.emailOptIn,
  }

  return {
    success: true,
    data: userData,
    organizationId: dbUser.organizationId
  }
}

// GET /api/user - Get current user information
export const GET = asyncHandler(async () => {
  // Check authentication using Lucia
  const { user } = await validateRequest()
  
  if (!user) {
    throw commonErrors.unauthorized()
  }

  // Use cache with 1-hour TTL and smart invalidation
  const result = await cacheManager.withCache(
    `user:${user.id}:preferences`,
    () => fetchUserData(user.id),
    {
      ttl: 3600, // 1 hour
      userId: user.id,
      prefix: 'user:'
    }
  )

  // Track this API call (only for cache misses to avoid double-counting)
  if (!result.cached && result.data.organizationId) {
    try {
      await UsageTrackingService.trackUsage({
        organizationId: result.data.organizationId,
        usageType: UsageType.API_CALL,
        quantity: 1,
        resourceType: 'user',
        metadata: {
          endpoint: '/api/user',
          cached: result.cached
        }
      });
    } catch (trackingError) {
      console.warn('Failed to track user API usage:', trackingError);
      // Don't fail the request if tracking fails
    }
  }

  return NextResponse.json({
    success: result.data.success,
    data: result.data.data
  })
})

// PATCH /api/user - Update user information
export const PATCH = asyncHandler(async (request: NextRequest) => {
  // Check authentication using Lucia
  const { user } = await validateRequest()
  
  if (!user) {
    throw commonErrors.unauthorized()
  }

  // Parse and validate request body
  const body = await request.json()
  const validatedData = UserUpdateSchema.parse(body)

    // Check if user exists in database using Lucia user ID
    let dbUser = await db.user.findUnique({
      where: { id: user.id }
    })

    if (!dbUser) {
      throw commonErrors.notFound('User')
    }

    // Update existing user
    dbUser = await db.user.update({
      where: { id: user.id },
      data: {
        ...validatedData,
        lastActiveAt: new Date()
      }
    })

    // Clear user preferences cache since user data changed
    try {
      await cacheManager.invalidate(`user:${user.id}:preferences`)
      console.log('Cleared user preferences cache due to user update')
    } catch (cacheError) {
      console.warn('Failed to clear user preferences cache after user update:', cacheError)
      // Don't fail the request if cache clearing fails
    }

    return NextResponse.json({
      success: true,
      data: {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        timezone: dbUser.timezone,
        emailOptIn: dbUser.emailOptIn,
        role: dbUser.role,
        lastActiveAt: dbUser.lastActiveAt,
        updatedAt: dbUser.updatedAt
      }
    })
})

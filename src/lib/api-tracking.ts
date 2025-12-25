/**
 * API Request Tracking Middleware
 * Tracks all API requests to the UsageEvent table
 */

import { NextRequest } from 'next/server';
import { validateRequest } from '@/lib/auth-utils';

// ... (rest of the file)

export function withApiTracking<T extends any[]>(
  handler: (...args: T) => Promise<Response>
) {
  return async (...args: T): Promise<Response> => {
    const startTime = Date.now();
    const request = args[0] as NextRequest;
    
    let response: Response;
    let userContext: { userId: string; organizationId: string } | undefined;

    try {
      // Get user context for tracking
      try {
        const session = await validateRequest();
        if (session?.user) {
          userContext = {
            userId: session.user.id,
            organizationId: session.user.organizationId,
          };
        }
      } catch (authError) {
        // Auth might fail for public routes, that's OK
      }

      // Execute the original handler
      response = await handler(...args);
      
      // Track the request
      const responseTime = Date.now() - startTime;
      const trackingData = extractTrackingData(
        request,
        response.status,
        responseTime,
        userContext
      );
      
      // Track asynchronously to not block response
      setImmediate(() => trackApiRequest(trackingData));
      
      return response;
    } catch (error) {
      // Track failed requests too
      const responseTime = Date.now() - startTime;
      const trackingData = extractTrackingData(
        request,
        500,
        responseTime,
        userContext
      );
      
      setImmediate(() => trackApiRequest(trackingData));
      
      throw error;
    }
  };
}

/**
 * Simple tracking function for manual use in route handlers
 */
export async function logApiCall(
  request: NextRequest,
  response: Response,
  startTime: number
) {
  const responseTime = Date.now() - startTime;
  
  try {
    const session = await validateRequest();
    let userContext: { userId: string; organizationId: string } | undefined;
    
    if (session?.user) {
      userContext = {
        userId: session.user.id,
        organizationId: session.user.organizationId,
      };
    }
    
    const trackingData = extractTrackingData(
      request,
      response.status,
      responseTime,
      userContext
    );
    
    await trackApiRequest(trackingData);
  } catch (error) {
    console.error('Failed to log API call:', error);
  }
}
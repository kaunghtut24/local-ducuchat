import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { user } = await validateRequest();
    
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    
    // Return user data (excluding sensitive information)
    return NextResponse.json({ 
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        imageUrl: user.imageUrl,
        organizationId: user.organizationId,
        role: user.role,
      }
    });
  } catch (error) {
    console.error('Error validating session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

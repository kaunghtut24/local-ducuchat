import { NextResponse } from 'next/server';
import { validateRequest } from '@/lib/auth-utils';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await validateRequest();

    if (!session?.user) {
      return NextResponse.json(
        {
          error: 'No session or user from validateRequest',
          auth: { userId: null },
        },
        { status: 401 }
      );
    }
    
    const { user } = session;
    const organization = await db.organization.findUnique({
      where: { id: user.organizationId }
    });

    return NextResponse.json({
      debug: {
        userId: user.id,
        userFound: !!user,
        userData: {
          id: user.id,
          email: user.email,
          organizationId: user.organizationId,
          organization: organization
            ? {
                id: organization.id,
                name: organization.name,
                slug: organization.slug,
              }
            : null,
        },
      },
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json(
      {
        error: 'Debug endpoint failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { validateRequest, signOut } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Validate the current session
    const { session } = await validateRequest();
    
    if (!session) {
      return NextResponse.json({ error: 'No active session' }, { status: 401 });
    }
    
    // Perform logout
    await signOut();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error during logout:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

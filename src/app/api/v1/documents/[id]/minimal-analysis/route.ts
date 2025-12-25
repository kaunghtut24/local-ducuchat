import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '@/lib/auth-utils';
import { prisma } from '@/lib/db';
import { simpleAIClient } from '@/lib/ai/services/simple-ai-client';

// ... (rest of the file)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await validateRequest();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = session;

    const resolvedParams = await params;
    const documentId = resolvedParams.id;

    console.log(`🚀 [MINIMAL] Starting minimal analysis for: ${documentId}`);

    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        organizationId: true,
        name: true,
        status: true,
        extractedText: true,
        aiData: true
      }
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (document.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    // ... (rest of the POST function logic)
  } catch (error) {
    console.error('❌ [MINIMAL] Error:', error);
    
    // Update document status to failed
    try {
      const resolvedParams = await params;
      await prisma.document.update({
        where: { id: resolvedParams.id },
        data: { 
          status: 'FAILED',
          processingError: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    } catch (updateError) {
      console.error('Failed to update document status:', updateError);
    }

    return NextResponse.json(
      { 
        success: false,
        error: 'Minimal analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
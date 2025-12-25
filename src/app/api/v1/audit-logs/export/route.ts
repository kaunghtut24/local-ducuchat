import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '@/lib/auth-utils';
import { z } from 'zod';
import { AuditQueryService } from '@/lib/audit/query-service';
import { AuditEventType, AuditCategory, AuditSeverity } from '@prisma/client';

// ... (rest of the file)

export async function POST(request: NextRequest) {
  try {
    const session = await validateRequest();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedParams = exportParamsSchema.parse(body);

    const queryService = new AuditQueryService();
    const exportResult = await queryService.exportLogs(
      {
        startDate: validatedParams.startDate,
        endDate: validatedParams.endDate,
        eventTypes: validatedParams.eventTypes,
        categories: validatedParams.categories,
        severities: validatedParams.severities,
        userId: validatedParams.userId,
        resourceId: validatedParams.resourceId,
        resourceType: validatedParams.resourceType,
        searchTerm: validatedParams.searchTerm,
      },
      validatedParams.format
    );

    // For direct download
    const response = new Response(exportResult.data, {
      headers: {
        'Content-Type': exportResult.mimeType,
        'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
        'Cache-Control': 'no-cache',
      },
    });

    return response;
  } catch (error) {
    console.error('Failed to export audit logs:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
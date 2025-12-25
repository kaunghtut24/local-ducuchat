/**
 * Prometheus Metrics Endpoint
 * 
 * Exposes metrics in Prometheus format for scraping.
 * Endpoint: GET /api/metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { register } from '@/lib/observability/prometheus-metrics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Get metrics in Prometheus format
    const metrics = await register.metrics();

    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': register.contentType,
      },
    });
  } catch (error) {
    console.error('Error generating metrics:', error);
    return NextResponse.json(
      { error: 'Failed to generate metrics' },
      { status: 500 }
    );
  }
}


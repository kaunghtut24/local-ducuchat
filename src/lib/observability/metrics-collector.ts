/**
 * Metrics Collector
 * 
 * Bridges existing monitoring systems with Prometheus metrics.
 * Automatically collects metrics from AI operations, document processing, etc.
 */

import {
  aiRequestsTotal,
  aiRequestDuration,
  aiTokensUsed,
  aiCostTotal,
  aiCircuitBreakerState,
  documentProcessingTotal,
  documentProcessingDuration,
  documentVectorizationTotal,
  vectorSearchTotal,
  vectorSearchDuration,
  vectorIndexSize,
  cacheOperationsTotal,
  cacheHitRatio,
  cacheDuration,
  backgroundJobsTotal,
  backgroundJobDuration,
  httpRequestsTotal,
  httpRequestDuration,
} from './prometheus-metrics';

export class MetricsCollector {
  private static instance: MetricsCollector;
  private cacheStats = new Map<string, { hits: number; misses: number }>();

  private constructor() {
    // Initialize cache stats tracking
    this.startCacheStatsCollection();
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  // ============================================================================
  // AI Metrics
  // ============================================================================

  recordAIRequest(params: {
    provider: string;
    model: string;
    operation: string;
    status: 'success' | 'error';
    durationMs: number;
    tokensUsed?: { prompt: number; completion: number; total: number };
    cost?: number;
    organizationId?: string;
  }): void {
    const { provider, model, operation, status, durationMs, tokensUsed, cost, organizationId } = params;

    // Record request count
    aiRequestsTotal.inc({
      provider,
      model,
      operation,
      status,
      organization_id: organizationId || 'unknown',
    });

    // Record duration
    aiRequestDuration.observe(
      {
        provider,
        model,
        operation,
        organization_id: organizationId || 'unknown',
      },
      durationMs / 1000
    );

    // Record tokens
    if (tokensUsed) {
      aiTokensUsed.inc(
        {
          provider,
          model,
          token_type: 'prompt',
          organization_id: organizationId || 'unknown',
        },
        tokensUsed.prompt
      );
      aiTokensUsed.inc(
        {
          provider,
          model,
          token_type: 'completion',
          organization_id: organizationId || 'unknown',
        },
        tokensUsed.completion
      );
    }

    // Record cost
    if (cost) {
      aiCostTotal.inc(
        {
          provider,
          model,
          organization_id: organizationId || 'unknown',
        },
        cost
      );
    }
  }

  recordCircuitBreakerState(provider: string, state: 'closed' | 'open' | 'half-open'): void {
    const stateValue = state === 'closed' ? 0 : state === 'open' ? 1 : 2;
    aiCircuitBreakerState.set({ provider }, stateValue);
  }

  // ============================================================================
  // Document Processing Metrics
  // ============================================================================

  recordDocumentProcessing(params: {
    status: 'success' | 'error' | 'pending';
    documentType: string;
    durationMs?: number;
    organizationId?: string;
  }): void {
    const { status, documentType, durationMs, organizationId } = params;

    documentProcessingTotal.inc({
      status,
      document_type: documentType,
      organization_id: organizationId || 'unknown',
    });

    if (durationMs) {
      documentProcessingDuration.observe(
        {
          document_type: documentType,
          organization_id: organizationId || 'unknown',
        },
        durationMs / 1000
      );
    }
  }

  recordVectorization(params: { status: 'success' | 'error'; organizationId?: string }): void {
    documentVectorizationTotal.inc({
      status: params.status,
      organization_id: params.organizationId || 'unknown',
    });
  }

  // ============================================================================
  // Vector Search Metrics
  // ============================================================================

  recordVectorSearch(params: {
    backend: 'pinecone' | 'pgvector';
    status: 'success' | 'error';
    durationMs: number;
    organizationId?: string;
  }): void {
    const { backend, status, durationMs, organizationId } = params;

    vectorSearchTotal.inc({
      backend,
      status,
      organization_id: organizationId || 'unknown',
    });

    vectorSearchDuration.observe(
      {
        backend,
        organization_id: organizationId || 'unknown',
      },
      durationMs / 1000
    );
  }

  updateVectorIndexSize(backend: 'pinecone' | 'pgvector', size: number, organizationId?: string): void {
    vectorIndexSize.set(
      {
        backend,
        organization_id: organizationId || 'unknown',
      },
      size
    );
  }

  // ============================================================================
  // Cache Metrics
  // ============================================================================

  recordCacheOperation(params: {
    operation: 'get' | 'set' | 'delete';
    status: 'hit' | 'miss' | 'success' | 'error';
    cacheType: 'redis' | 'memory';
    durationMs: number;
  }): void {
    const { operation, status, cacheType, durationMs } = params;

    cacheOperationsTotal.inc({
      operation,
      status,
      cache_type: cacheType,
    });

    cacheDuration.observe(
      {
        operation,
        cache_type: cacheType,
      },
      durationMs / 1000
    );

    // Track hits/misses for ratio calculation
    if (operation === 'get') {
      const key = cacheType;
      const stats = this.cacheStats.get(key) || { hits: 0, misses: 0 };
      if (status === 'hit') {
        stats.hits++;
      } else if (status === 'miss') {
        stats.misses++;
      }
      this.cacheStats.set(key, stats);
    }
  }

  // ============================================================================
  // Background Job Metrics
  // ============================================================================

  recordBackgroundJob(params: {
    jobType: string;
    status: 'success' | 'error' | 'pending';
    durationMs?: number;
    organizationId?: string;
  }): void {
    const { jobType, status, durationMs, organizationId } = params;

    backgroundJobsTotal.inc({
      job_type: jobType,
      status,
      organization_id: organizationId || 'unknown',
    });

    if (durationMs) {
      backgroundJobDuration.observe(
        {
          job_type: jobType,
          organization_id: organizationId || 'unknown',
        },
        durationMs / 1000
      );
    }
  }

  // ============================================================================
  // HTTP Metrics
  // ============================================================================

  recordHttpRequest(params: {
    method: string;
    route: string;
    statusCode: number;
    durationMs: number;
  }): void {
    const { method, route, statusCode, durationMs } = params;

    httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode.toString(),
    });

    httpRequestDuration.observe(
      {
        method,
        route,
      },
      durationMs / 1000
    );
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private startCacheStatsCollection(): void {
    // Update cache hit ratios every 10 seconds
    setInterval(() => {
      this.cacheStats.forEach((stats, cacheType) => {
        const total = stats.hits + stats.misses;
        if (total > 0) {
          const ratio = stats.hits / total;
          cacheHitRatio.set({ cache_type: cacheType }, ratio);
        }
      });
    }, 10000);
  }
}

export const metricsCollector = MetricsCollector.getInstance();


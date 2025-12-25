/**
 * Prometheus Metrics Exporter
 * 
 * Exposes application metrics in Prometheus format for scraping.
 * Integrates with existing monitoring infrastructure.
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a Registry to register the metrics
export const register = new Registry();

// Add default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register, prefix: 'document_chat_' });

// ============================================================================
// AI Provider Metrics
// ============================================================================

export const aiRequestsTotal = new Counter({
  name: 'document_chat_ai_requests_total',
  help: 'Total number of AI requests',
  labelNames: ['provider', 'model', 'operation', 'status', 'organization_id'],
  registers: [register],
});

export const aiRequestDuration = new Histogram({
  name: 'document_chat_ai_request_duration_seconds',
  help: 'Duration of AI requests in seconds',
  labelNames: ['provider', 'model', 'operation', 'organization_id'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

export const aiTokensUsed = new Counter({
  name: 'document_chat_ai_tokens_total',
  help: 'Total number of AI tokens used',
  labelNames: ['provider', 'model', 'token_type', 'organization_id'],
  registers: [register],
});

export const aiCostTotal = new Counter({
  name: 'document_chat_ai_cost_total',
  help: 'Total AI cost in USD',
  labelNames: ['provider', 'model', 'organization_id'],
  registers: [register],
});

export const aiCircuitBreakerState = new Gauge({
  name: 'document_chat_ai_circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
  labelNames: ['provider'],
  registers: [register],
});

// ============================================================================
// Document Processing Metrics
// ============================================================================

export const documentProcessingTotal = new Counter({
  name: 'document_chat_document_processing_total',
  help: 'Total number of documents processed',
  labelNames: ['status', 'document_type', 'organization_id'],
  registers: [register],
});

export const documentProcessingDuration = new Histogram({
  name: 'document_chat_document_processing_duration_seconds',
  help: 'Duration of document processing in seconds',
  labelNames: ['document_type', 'organization_id'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  registers: [register],
});

export const documentVectorizationTotal = new Counter({
  name: 'document_chat_vectorization_total',
  help: 'Total number of document vectorizations',
  labelNames: ['status', 'organization_id'],
  registers: [register],
});

// ============================================================================
// Vector Search Metrics
// ============================================================================

export const vectorSearchTotal = new Counter({
  name: 'document_chat_vector_search_total',
  help: 'Total number of vector searches',
  labelNames: ['backend', 'status', 'organization_id'],
  registers: [register],
});

export const vectorSearchDuration = new Histogram({
  name: 'document_chat_vector_search_duration_seconds',
  help: 'Duration of vector searches in seconds',
  labelNames: ['backend', 'organization_id'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const vectorIndexSize = new Gauge({
  name: 'document_chat_vector_index_size',
  help: 'Number of vectors in the index',
  labelNames: ['backend', 'organization_id'],
  registers: [register],
});

// ============================================================================
// Cache Metrics
// ============================================================================

export const cacheOperationsTotal = new Counter({
  name: 'document_chat_cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'status', 'cache_type'],
  registers: [register],
});

export const cacheHitRatio = new Gauge({
  name: 'document_chat_cache_hit_ratio',
  help: 'Cache hit ratio (0-1)',
  labelNames: ['cache_type'],
  registers: [register],
});

export const cacheDuration = new Histogram({
  name: 'document_chat_cache_operation_duration_seconds',
  help: 'Duration of cache operations in seconds',
  labelNames: ['operation', 'cache_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

// ============================================================================
// Background Job Metrics (Inngest)
// ============================================================================

export const backgroundJobsTotal = new Counter({
  name: 'document_chat_background_jobs_total',
  help: 'Total number of background jobs',
  labelNames: ['job_type', 'status', 'organization_id'],
  registers: [register],
});

export const backgroundJobDuration = new Histogram({
  name: 'document_chat_background_job_duration_seconds',
  help: 'Duration of background jobs in seconds',
  labelNames: ['job_type', 'organization_id'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1800],
  registers: [register],
});

// ============================================================================
// HTTP Metrics
// ============================================================================

export const httpRequestsTotal = new Counter({
  name: 'document_chat_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'document_chat_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});


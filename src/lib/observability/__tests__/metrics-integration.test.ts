/**
 * Metrics Integration Tests
 *
 * Tests the integration between existing monitoring systems and Prometheus metrics.
 *
 * @jest-environment node
 */

import { metricsCollector } from '../metrics-collector';

describe('Metrics Integration', () => {
  describe('AI Metrics', () => {
    it('should record AI request metrics without errors', () => {
      expect(() => {
        metricsCollector.recordAIRequest({
          provider: 'openrouter',
          model: 'anthropic/claude-3.5-sonnet',
          operation: 'completion',
          status: 'success',
          durationMs: 1500,
          tokensUsed: {
            prompt: 100,
            completion: 200,
            total: 300,
          },
          cost: 0.05,
          organizationId: 'test-org',
        });
      }).not.toThrow();
    });

    it('should record circuit breaker state without errors', () => {
      expect(() => {
        metricsCollector.recordCircuitBreakerState('openrouter', 'open');
      }).not.toThrow();
    });
  });

  describe('Document Processing Metrics', () => {
    it('should record document processing without errors', () => {
      expect(() => {
        metricsCollector.recordDocumentProcessing({
          status: 'success',
          documentType: 'pdf',
          durationMs: 5000,
          organizationId: 'test-org',
        });
      }).not.toThrow();
    });

    it('should record vectorization without errors', () => {
      expect(() => {
        metricsCollector.recordVectorization({
          status: 'success',
          organizationId: 'test-org',
        });
      }).not.toThrow();
    });
  });

  describe('Vector Search Metrics', () => {
    it('should record vector search operations without errors', () => {
      expect(() => {
        metricsCollector.recordVectorSearch({
          backend: 'pgvector',
          status: 'success',
          durationMs: 150,
          organizationId: 'test-org',
        });
      }).not.toThrow();
    });

    it('should update vector index size without errors', () => {
      expect(() => {
        metricsCollector.updateVectorIndexSize('pgvector', 10000, 'test-org');
      }).not.toThrow();
    });
  });

  describe('Cache Metrics', () => {
    it('should record cache operations without errors', () => {
      expect(() => {
        metricsCollector.recordCacheOperation({
          operation: 'get',
          status: 'hit',
          cacheType: 'redis',
          durationMs: 5,
        });
      }).not.toThrow();
    });
  });

  describe('Background Job Metrics', () => {
    it('should record background jobs without errors', () => {
      expect(() => {
        metricsCollector.recordBackgroundJob({
          jobType: 'process-document-basic',
          status: 'success',
          durationMs: 30000,
          organizationId: 'test-org',
        });
      }).not.toThrow();
    });
  });

  describe('HTTP Metrics', () => {
    it('should record HTTP requests without errors', () => {
      expect(() => {
        metricsCollector.recordHttpRequest({
          method: 'POST',
          route: '/api/v1/ai/chat',
          statusCode: 200,
          durationMs: 500,
        });
      }).not.toThrow();
    });
  });
});


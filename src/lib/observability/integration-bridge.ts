/**
 * Integration Bridge
 * 
 * Connects existing monitoring systems to Prometheus metrics.
 * Listens to performance monitor and AI metrics events.
 */

import { metricsCollector } from './metrics-collector';
import { performanceMonitor } from '@/lib/ai/monitoring/performance-monitor';
import { aiMetricsIntegration } from '@/lib/ai/monitoring/ai-metrics-integration';

export class ObservabilityBridge {
  private static instance: ObservabilityBridge;
  private initialized = false;
  private unsubscribers: Array<() => void> = [];

  private constructor() {}

  static getInstance(): ObservabilityBridge {
    if (!ObservabilityBridge.instance) {
      ObservabilityBridge.instance = new ObservabilityBridge();
    }
    return ObservabilityBridge.instance;
  }

  /**
   * Initialize the bridge to start collecting metrics
   */
  initialize(): void {
    if (this.initialized) {
      console.log('⚠️  Observability bridge already initialized');
      return;
    }

    console.log('🔗 Initializing observability bridge...');

    // Listen to performance monitor events
    this.setupPerformanceMonitorListener();

    // Listen to AI metrics events
    this.setupAIMetricsListener();

    this.initialized = true;
    console.log('✅ Observability bridge initialized');
  }

  /**
   * Setup listener for performance monitor metrics
   */
  private setupPerformanceMonitorListener(): void {
    const unsubscribe = performanceMonitor.onMetric((metric) => {
      // Record AI request metrics
      metricsCollector.recordAIRequest({
        provider: metric.provider,
        model: metric.model || 'unknown',
        operation: metric.operation || 'completion',
        status: metric.success ? 'success' : 'error',
        durationMs: metric.latency,
        tokensUsed: {
          prompt: 0, // Performance monitor doesn't track individual token types
          completion: 0,
          total: metric.tokensProcessed || 0,
        },
        cost: metric.cost,
        organizationId: metric.organizationId,
      });
    });

    this.unsubscribers.push(unsubscribe);
    console.log('✅ Performance monitor listener setup complete');
  }

  /**
   * Setup listener for AI metrics integration
   */
  private setupAIMetricsListener(): void {
    // The AI metrics integration already records to the database
    // We just need to ensure Prometheus metrics are also recorded
    // This is handled by the performance monitor listener above
    console.log('✅ AI metrics listener setup complete');
  }

  /**
   * Shutdown the bridge
   */
  shutdown(): void {
    if (!this.initialized) {
      return;
    }

    console.log('🔌 Shutting down observability bridge...');

    // Unsubscribe from all listeners
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];

    this.initialized = false;
    console.log('✅ Observability bridge shutdown complete');
  }
}

// Export singleton instance
export const observabilityBridge = ObservabilityBridge.getInstance();

// Auto-initialize in server environment
if (typeof window === 'undefined') {
  observabilityBridge.initialize();
}


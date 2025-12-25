import { openai } from '@ai-sdk/openai';
import { generateText, streamText, embed } from 'ai';
import { ai } from '@/lib/config/env';
import {
  AIProviderAdapter,
  UnifiedCompletionRequest,
  UnifiedCompletionResponse,
  UnifiedEmbeddingRequest,
  UnifiedEmbeddingResponse,
  UnifiedStreamRequest,
  UnifiedStreamChunk,
  ProviderCapabilities,
  ModelInfo,
  CostEstimate,
  TokenEstimate
} from '../interfaces';

import {
  RateLimitError,
  AuthenticationError,
  ValidationError,
  QuotaExceededError,
  NetworkError,
  ProviderUnavailableError,
  ProviderConfigurationError
} from '../interfaces/errors';

import { cacheManager } from '@/lib/cache';
import { UsageTrackingService, UsageType } from '@/lib/usage-tracking';
import { validateCSRFInAPIRoute } from '@/lib/csrf';
import { AIMetricsIntegration } from '../monitoring/ai-metrics-integration';

export interface LiteLLMConfig {
  apiKey?: string;
  baseURL: string;
  maxRetries?: number;
  timeout?: number;
}

export class LiteLLMAdapter extends AIProviderAdapter {
  private config: LiteLLMConfig;
  private aiMetricsIntegration: AIMetricsIntegration;

  private modelMapping: Record<string, string> = {
    'fast': ai.modelFast,
    'balanced': ai.modelBalanced,
    'powerful': ai.modelPowerful,
    'embedding-small': 'text-embedding-3-small',
    'embedding-large': 'text-embedding-3-large'
  };

  constructor(config: LiteLLMConfig) {
    super('litellm');
    this.config = config;
    this.aiMetricsIntegration = new AIMetricsIntegration();
  }

  async initialize(): Promise<void> {
    try {
      await this.checkHealth();
      this.updateHealth(true);
    } catch (error) {
      this.updateHealth(false);
      throw this.handleError(error, 'Failed to initialize LiteLLM adapter');
    }
  }

  getCapabilities(): ProviderCapabilities {
    return {
      maxTokens: 8000,
      supportsFunctionCalling: true,
      supportsJsonMode: true,
      supportsStreaming: true,
      supportsVision: false,
      embeddingDimensions: [1536],
      models: {
        completion: ['ollama/llama2', 'ollama/mistral'],
        embedding: ['ollama/llama2']
      }
    };
  }

  getAvailableModels(): ModelInfo[] {
    return [
      {
        name: 'ollama/llama2',
        provider: 'litellm',
        displayName: 'Llama 2 (Ollama)',
        description: 'A general-purpose model running on a local Ollama instance.',
        maxTokens: 4096,
        costPer1KTokens: { prompt: 0, completion: 0 },
        averageLatency: 500,
        qualityScore: 0.7,
        tier: 'balanced',
        features: ['chat']
      },
      {
        name: 'ollama/mistral',
        provider: 'litellm',
        displayName: 'Mistral (Ollama)',
        description: 'A fast and efficient model running on a local Ollama instance.',
        maxTokens: 8192,
        costPer1KTokens: { prompt: 0, completion: 0 },
        averageLatency: 300,
        qualityScore: 0.75,
        tier: 'fast',
        features: ['chat']
      }
    ];
  }

  async loadAvailableModels(): Promise<ModelInfo[]> {
    // For local LiteLLM, we'll use a static list for now.
    // This could be extended to query the /v1/models endpoint of LiteLLM.
    return this.getAvailableModels();
  }

  async refreshModels(): Promise<void> {
    // No-op for now as we use a static list.
    return Promise.resolve();
  }

  async estimateCost(
    request: UnifiedCompletionRequest | UnifiedEmbeddingRequest
  ): Promise<CostEstimate> {
    const tokenEstimate = 'messages' in request
      ? await this.estimateTokensForCompletion(request)
      : await this.estimateTokensForEmbedding(request);

    return {
      estimatedCost: 0, // Assuming local models have no direct cost
      breakdown: {
        promptTokens: tokenEstimate.prompt,
        completionTokens: tokenEstimate.completion,
        totalTokens: tokenEstimate.total,
        promptCost: 0,
        completionCost: 0,
        pricePerToken: 0
      },
      metadata: {
        provider: 'litellm',
        model: request.model,
      }
    };
  }

  async estimateTokens(text: string, model?: string): Promise<TokenEstimate> {
    const tokenCount = Math.ceil(text.length / 4);
    return {
      prompt: tokenCount,
      completion: model?.includes('embedding') ? 0 : Math.ceil(tokenCount * 0.3),
      total: tokenCount
    };
  }

  async generateCompletion(
    request: UnifiedCompletionRequest
  ): Promise<UnifiedCompletionResponse> {
    const startTime = Date.now();
    try {
      const model = this.resolveModel(request.model);
      const liteLLMClient = openai({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
      })(model);

      const messages = this.formatMessages(request.messages);

      const result = await generateText({
        model: liteLLMClient,
        messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        stopSequences: request.stopSequences,
      });

      return {
        content: result.text,
        model: model,
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens
        },
        metadata: {
          provider: this.name,
          requestId: result.response?.id,
          finishReason: result.finishReason,
          cost: 0
        }
      };
    } catch (error) {
      throw this.handleError(error, 'generateCompletion');
    }
  }

  async generateEmbedding(
    request: UnifiedEmbeddingRequest
  ): Promise<UnifiedEmbeddingResponse> {
    const startTime = Date.now();
    try {
      const model = this.resolveModel(request.model);
      const liteLLMClient = openai.embedding(model, {
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
      });

      const result = await embed({
        model: liteLLMClient,
        value: request.text,
        ...(request.dimensions && { dimensions: request.dimensions })
      });

      return {
        embedding: result.embedding,
        model: model,
        usage: {
          totalTokens: result.usage.tokens
        },
        metadata: {
          provider: this.name,
          dimensions: result.embedding.length,
          cost: 0
        }
      };
    } catch (error) {
      throw this.handleError(error, 'generateEmbedding');
    }
  }

  async streamCompletion(
    request: UnifiedStreamRequest
  ): Promise<AsyncIterable<UnifiedStreamChunk>> {
    const startTime = Date.now();
    try {
      const model = this.resolveModel(request.model);
       const liteLLMClient = openai({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
      })(model);

      const messages = this.formatMessages(request.messages);

      const result = await streamText({
        model: liteLLMClient,
        messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        stopSequences: request.stopSequences,
      });

      return this.transformStream(result.textStream, model);
    } catch (error) {
      throw this.handleError(error, 'streamCompletion');
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
        const liteLLMClient = openai({
            apiKey: this.config.apiKey,
            baseURL: this.config.baseURL,
        })('ollama/llama2');

      await generateText({
        model: liteLLMClient,
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 5
      });

      this.updateHealth(true);
      return true;
    } catch (error) {
      this.updateHealth(false);
      return false;
    }
  }

  private resolveModel(unifiedModel: string): string {
    if (this.modelMapping[unifiedModel]) {
      return this.modelMapping[unifiedModel];
    }
    return unifiedModel;
  }

  private formatMessages(messages: any[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  private async estimateTokensForCompletion(
    request: UnifiedCompletionRequest
  ): Promise<TokenEstimate> {
    const allText = request.messages.map(m => m.content).join(' ');
    const promptTokens = Math.ceil(allText.length / 4);
    const completionTokens = Math.ceil((request.maxTokens || 1000) * 0.7);
    
    return {
      prompt: promptTokens,
      completion: completionTokens,
      total: promptTokens + completionTokens
    };
  }

  private async estimateTokensForEmbedding(
    request: UnifiedEmbeddingRequest
  ): Promise<TokenEstimate> {
    const text = Array.isArray(request.text) ? request.text.join(' ') : request.text;
    const tokens = Math.ceil(text.length / 4);
    
    return {
      prompt: tokens,
      completion: 0,
      total: tokens
    };
  }

  private async *transformStream(
    stream: AsyncIterable<string>,
    model: string
  ): AsyncIterator<UnifiedStreamChunk> {
    for await (const chunk of stream) {
      yield {
        content: chunk,
        metadata: {
          provider: this.name,
          model: model
        }
      };
    }
  }

  protected handleError(error: any, context: string): Error {
    if (error?.status === 401) {
      return new AuthenticationError('Invalid LiteLLM API key', 'litellm');
    }
    if (error?.status === 429) {
      return new RateLimitError('litellm', error.headers?.['retry-after']);
    }
    if (error?.status === 400) {
      return new ValidationError(`LiteLLM API validation error: ${error.message || error.body?.message}`);
    }
    if (error?.status >= 500) {
      return new ProviderUnavailableError('litellm', `Service error: ${error.status}`);
    }
    if (error?.name === 'APIConnectionError' || 
        error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ENOTFOUND') {
      return new NetworkError(`LiteLLM API connection error: ${error.message}`, 'litellm');
    }
    return new NetworkError(`LiteLLM API error: ${error.message || 'Unknown error'}`);
  }
}

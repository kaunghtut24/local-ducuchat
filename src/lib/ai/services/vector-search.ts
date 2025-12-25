/**
 * Vector Search Service
 *
 * Provides semantic search capabilities for government contracting documents
 * using Pinecone vector database with hybrid search support.
 */

import { AIServiceManager } from '@/lib/ai/ai-service-manager'
import { PineconeMetadata } from './embedding-service'
import { prisma } from '@/lib/prisma'
import { PgVectorSearchService } from './pgvector-search'
import { VectorSearchCache, defaultVectorSearchCache } from './vector-search-cache'
import { HybridSearchService, defaultHybridSearchService, HybridSearchOptions, HybridSearchResult } from './hybrid-search'

export interface SearchFilters {
  organizationId: string
  documentId?: string // Filter to specific document
  documentIds?: string[] // Filter to multiple documents
  documentTypes?: string[]
  naicsCodes?: string[]
  tags?: string[]
  dateRange?: {
    start: Date
    end: Date
  }
}

export interface SearchResult {
  documentId: string
  documentTitle: string
  chunkId: string
  chunkIndex: number
  chunkText: string
  score: number // Similarity score (0-1)
  metadata: PineconeMetadata
  highlights?: string[] // Key matching phrases
}

export interface SearchOptions {
  topK?: number // Number of results (default: 10)
  minScore?: number // Minimum similarity score (default: 0.7)
  includeMetadata?: boolean
  rerank?: boolean // Use reranking for better results
  hybridSearch?: boolean // Enable true hybrid search (default: false)
  vectorWeight?: number // Weight for vector similarity in hybrid search (0-1, default: 0.7)
  keywordWeight?: number // Weight for keyword relevance in hybrid search (0-1, default: 0.3)
}

export class VectorSearchService {
  private aiManager: AIServiceManager
  private pgVectorService: PgVectorSearchService
  private cache: VectorSearchCache
  private hybridSearchService: HybridSearchService

  constructor() {
    this.aiManager = AIServiceManager.getInstance()
    this.pgVectorService = new PgVectorSearchService()
    this.cache = defaultVectorSearchCache
    this.hybridSearchService = defaultHybridSearchService
  }

  /**
   * Search for similar document chunks with automatic fallback and caching
   */
  async searchSimilar(
    query: string,
    filters: SearchFilters,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const startTime = Date.now()
    console.log('🔍 Starting optimized similarity search:', { query: query.substring(0, 50), filters, options })

    const timeoutMs = parseInt(process.env.VECTOR_SEARCH_TIMEOUT_MS || '5000', 10)
    
    try {
      return await Promise.race([
        this.pgVectorService.searchSimilar(query, filters, options),
        new Promise<SearchResult[]>((_, reject) => 
          setTimeout(() => reject(new Error('Search timeout')), timeoutMs)
        )
      ])
    } catch (error) {
      const elapsed = Date.now() - startTime
      if (error instanceof Error && error.message === 'Search timeout') {
        console.warn(`⏰ Search timed out after ${elapsed}ms (limit: ${timeoutMs}ms)`)
        const cachedResults = this.cache.get(query, filters, options)
        if (cachedResults) {
          console.log(`✅ Returning cached results due to timeout (${cachedResults.length} results)`)
          return cachedResults
        }
        throw new Error(`Search timed out after ${timeoutMs}ms. Please try again in a moment.`)
      }
      console.error(`❌ Search failed after ${elapsed}ms:`, error)
      throw error
    }
  }

  /**
   * Perform the actual search with caching
   */
  private async performSearch(
    query: string,
    filters: SearchFilters,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    // Check cache first for performance
    if (this.cache.shouldCache(query, filters, options)) {
      const cachedResults = this.cache.get(query, filters, options)
      if (cachedResults) {
        console.log(`🎯 Returning ${cachedResults.length} cached results`)
        return cachedResults
      }
    }

    // Perform actual search with pgvector
    let results: SearchResult[]
    
    try {
      results = await this.pgVectorService.searchSimilar(query, filters, options)
    } catch (error) {
      console.error('❌ pgvector search failed:', error)
      throw new Error('Vector search unavailable: pgvector failed')
    }

    // Apply hybrid search if requested
    if (options.hybridSearch && results.length > 0) {
      console.log('🔀 Applying hybrid search scoring...')
      
      // Extract keywords from query for hybrid search
      const queryKeywords = query.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2)
        .map(word => word.replace(/[^\w]/g, ''))
        .filter(word => word.length > 0)
      
      const hybridOptions: HybridSearchOptions = {
        ...options,
        vectorWeight: options.vectorWeight || 0.7,
        keywordWeight: options.keywordWeight || 0.3,
      }

      const hybridResults = await this.hybridSearchService.performHybridSearch(
        results,
        query,
        queryKeywords,
        hybridOptions
      )

      // Cache hybrid results
      if (this.cache.shouldCache(query, filters, options)) {
        this.cache.set(query, filters, options, hybridResults as SearchResult[])
      }

      // Return hybrid results (which extend SearchResult)
      return hybridResults as SearchResult[]
    }

    // Cache results if appropriate
    if (this.cache.shouldCache(query, filters, options)) {
      this.cache.set(query, filters, options, results)
    }

    return results
  }

  /**
   * Find similar contract requirements
   */
  async findSimilarRequirements(
    requirement: string,
    organizationId: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    return this.searchSimilar(
      requirement,
      {
        organizationId,
        documentTypes: ['SOLICITATION', 'CONTRACT', 'AMENDMENT'],
      },
      options
    )
  }

  /**
   * Find similar past performance examples
   */
  async findSimilarExperience(
    experience: string,
    organizationId: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    return this.searchSimilar(
      experience,
      {
        organizationId,
        documentTypes: ['PAST_PERFORMANCE', 'CAPABILITY_STATEMENT'],
      },
      options
    )
  }

  /**
   * True hybrid search combining vector similarity with keyword relevance scoring
   */
  async hybridSearch(
    query: string,
    keywords: string[],
    filters: SearchFilters,
    options: SearchOptions = {}
  ): Promise<HybridSearchResult[]> {
    console.log('🔀 Starting true hybrid search...')
    console.log(`📝 Query: "${query}"`)
    console.log(`🏷️ Keywords: [${keywords.join(', ')}]`)
    
    // First get vector search results
    const vectorResults = await this.searchSimilar(query, filters, {
      ...options,
      hybridSearch: false // Prevent recursion
    })

    if (vectorResults.length === 0) {
      console.log('📭 No vector results found, returning empty hybrid results')
      return []
    }

    console.log(`🔍 Got ${vectorResults.length} vector results, applying hybrid scoring...`)

    // Apply hybrid search with score fusion
    const hybridOptions: HybridSearchOptions = {
      ...options,
      vectorWeight: options.vectorWeight || 0.7,
      keywordWeight: options.keywordWeight || 0.3,
    }

    const hybridResults = await this.hybridSearchService.performHybridSearch(
      vectorResults,
      query,
      keywords,
      hybridOptions
    )

    // Get search statistics
    const stats = this.hybridSearchService.getSearchStats(hybridResults)
    console.log(`📊 Hybrid search completed:`, {
      results: stats.totalResults,
      keywordCoverage: `${stats.keywordCoverage.toFixed(1)}%`,
      avgScores: {
        vector: stats.avgVectorScore.toFixed(3),
        keyword: stats.avgKeywordScore.toFixed(3),
        hybrid: stats.avgHybridScore.toFixed(3)
      }
    })

    return hybridResults
  }

  /**
   * Generate dense embedding for search query using OpenAI
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      console.log('🤖 Generating embedding for query using AI Manager:', query.substring(0, 100))

      const embedResponse = await this.aiManager.embed({
        model: 'embedding-small', // Or appropriate embedding model
        text: query,
      });

      if (!embedResponse?.embedding) {
        throw new Error('Failed to generate embedding from AI Manager');
      }

      console.log('📊 Embedding generated successfully, length:', embedResponse.embedding.length);
      return embedResponse.embedding;
    } catch (error) {
      console.error('❌ Embedding generation failed via AI Manager:', error);
      throw error;
    }
  }

  /**
   * Extract highlight phrases from text
   */
  private extractHighlights(query: string, text: string): string[] {
    const highlights: string[] = []
    const queryWords = query.toLowerCase().split(/\s+/)
    const sentences = text.split(/[.!?]+/)

    // Find sentences containing query words
    sentences.forEach((sentence) => {
      const sentenceLower = sentence.toLowerCase()
      if (queryWords.some((word) => sentenceLower.includes(word))) {
        highlights.push(sentence.trim())
      }
    })

    return highlights.slice(0, 3) // Return top 3 highlights
  }

  /**
   * Retrieve document with embeddings from database
   */
  private async getDocumentWithEmbeddings(documentId: string) {
    try {
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          embeddings: true,
        },
      })
      return document
    } catch (error) {
      console.error(`❌ Error fetching document ${documentId}:`, error)
      return null
    }
  }

  /**
   * Rerank results using a more sophisticated model
   */
  private async rerankResults(
    query: string,
    results: SearchResult[],
    topK: number
  ): Promise<SearchResult[]> {
    // Simple reranking based on keyword density
    // You could enhance this with a reranking model

    const queryWords = query.toLowerCase().split(/\s+/)

    const rerankedResults = results.map((result) => {
      const textLower = result.chunkText.toLowerCase()
      let keywordScore = 0

      queryWords.forEach((word) => {
        // Escape special regex characters to prevent regex errors
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const count = (textLower.match(new RegExp(escapedWord, 'g')) || []).length
        keywordScore += count
      })

      // Combine vector score with keyword score
      const combinedScore =
        result.score * 0.7 + (keywordScore / queryWords.length) * 0.3

      return {
        ...result,
        score: Math.min(combinedScore, 1),
      }
    })

    // Sort by combined score and return top K
    return rerankedResults.sort((a, b) => b.score - a.score).slice(0, topK)
  }

  /**
   * Check health of vector search services
   */
  async checkServiceHealth(): Promise<{
    pgvector: { available: boolean; error?: string; stats?: any }
  }> {
    const result = {
      pgvector: { available: false, error: undefined as string | undefined, stats: undefined as any },
    }

    try {
      const stats = await this.pgVectorService.getIndexStats()
      result.pgvector = { available: true, error: undefined, stats }
      console.log('✅ pgvector service healthy')
    } catch (error) {
      result.pgvector = {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats: undefined
      }
      console.log('❌ pgvector service unhealthy:', error)
    }

    return result
  }
}

// Default search service instance
export const defaultVectorSearch = new VectorSearchService();

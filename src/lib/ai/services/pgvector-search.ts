/**
 * PostgreSQL pgvector Search Service
 * 
 * Provides fallback vector search capabilities using PostgreSQL's pgvector extension
 * when Pinecone is unavailable. Implements the same interface as VectorSearchService.
 */

import { prisma } from '@/lib/prisma'
import { AIServiceManager } from '@/lib/ai/ai-service-manager'
import { SearchFilters, SearchResult, SearchOptions } from './vector-search'
import { DocumentChunk } from './document-chunker'
import { Document, DocumentEmbeddings } from '@/types/documents'

export interface PgVectorMetadata {
  documentId: string
  organizationId: string
  organizationNamespace: string
  chunkIndex: number
  chunkText: string // Preview text
  documentTitle: string
  documentType: string
  tags: string[]
  naicsCodes: string[]
  keywords: string[]
  createdAt: string
}

export class PgVectorSearchService {
  private aiManager: AIServiceManager

  constructor() {
    this.aiManager = AIServiceManager.getInstance()
  }

  /**
   * Search for similar document chunks using pgvector
   */
  async searchSimilar(
    query: string,
    filters: SearchFilters,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    console.log('🔍 [pgvector] Starting similarity search:', { query, filters, options })

    const {
      topK = 10,
      minScore = 0.1,
      rerank = false,
    } = options

    try {
      // Generate query embedding using existing OpenAI adapter
      console.log('📊 [pgvector] Generating query embedding...')
      const queryEmbedding = await this.generateQueryEmbedding(query)
      console.log('✅ [pgvector] Query embedding generated, length:', queryEmbedding.length)

      // Build WHERE clause for filtering
      const whereConditions = [`organization_id = $1`]
      const queryParams: any[] = [filters.organizationId]
      let paramIndex = 2

      if (filters.documentId) {
        whereConditions.push(`document_id = $${paramIndex}`)
        queryParams.push(filters.documentId)
        paramIndex++
      }

      if (filters.documentTypes?.length) {
        whereConditions.push(`metadata->>'documentType' = ANY($${paramIndex})`)
        queryParams.push(filters.documentTypes)
        paramIndex++
      }

      if (filters.naicsCodes?.length) {
        whereConditions.push(`metadata->'naicsCodes' ?| $${paramIndex}`)
        queryParams.push(filters.naicsCodes)
        paramIndex++
      }

      if (filters.tags?.length) {
        whereConditions.push(`metadata->'tags' ?| $${paramIndex}`)
        queryParams.push(filters.tags)
        paramIndex++
      }

      // Build the similarity search query
      const searchQuery = `
        SELECT 
          id,
          document_id,
          chunk_index,
          metadata,
          1 - (embedding <=> $${paramIndex}::vector) as similarity_score
        FROM document_vectors
        WHERE ${whereConditions.join(' AND ')}
          AND (1 - (embedding <=> $${paramIndex}::vector)) >= $${paramIndex + 1}
        ORDER BY embedding <=> $${paramIndex}::vector
        LIMIT $${paramIndex + 2}
      `

      queryParams.push(
        `[${queryEmbedding.join(',')}]`, // embedding vector
        minScore, // minimum similarity score
        rerank ? topK * 3 : topK // limit
      )

      console.log('🔍 [pgvector] Executing similarity search query')
      
      // Execute the query using raw SQL for vector operations
      const rawResults = await prisma.$queryRawUnsafe(
        searchQuery,
        ...queryParams
      ) as any[]

      console.log(`📊 [pgvector] Found ${rawResults.length} vector matches`)

      // Process results and get full chunk content from database
      const results: SearchResult[] = []

      for (const row of rawResults) {
        const metadata = row.metadata as PgVectorMetadata
        let fullChunkText = metadata.chunkText || ''

        // Get full chunk content from document embeddings
        try {
          const document = await this.getDocumentWithEmbeddings(row.document_id)
          const chunkData = document?.embeddings?.chunks?.find(
            (c: any) => c.chunkIndex === row.chunk_index
          )
          if (chunkData?.content) {
            fullChunkText = chunkData.content
            console.log(
              `✅ [pgvector] Retrieved full chunk content (${fullChunkText.length} chars) for chunk ${row.chunk_index}`
            )
          }
        } catch (error) {
          console.warn(
            `⚠️ [pgvector] Could not retrieve full chunk content for ${row.document_id}:${row.chunk_index}:`,
            error
          )
        }

        results.push({
          documentId: row.document_id,
          documentTitle: metadata.documentTitle || 'Unknown Document',
          chunkId: row.id,
          chunkIndex: row.chunk_index,
          chunkText: fullChunkText,
          score: row.similarity_score,
          metadata: metadata,
          highlights: this.extractHighlights(query, fullChunkText),
        })
      }

      console.log('✅ [pgvector] Processed results:', results.length, 'matches above threshold')

      // Rerank if requested
      if (rerank && results.length > 0) {
        console.log('🔄 [pgvector] Reranking results...')
        return await this.rerankResults(query, results, topK)
      }

      return results
    } catch (error) {
      console.error('❌ [pgvector] Vector search error:', error)
      throw error
    }
  }

  /**
   * Store embeddings in pgvector
   */
  async storeEmbeddings(
    document: Document,
    chunks: DocumentChunk[],
    embeddings_vectors: number[][]
  ): Promise<void> {
    console.log(`🚀 [pgvector] Storing ${chunks.length} embeddings for document ${document.id}`)

    try {
      // Prepare batch insert data
      const vectorData = chunks.map((chunk, index) => {
        return {
          documentId: document.id,
          chunkIndex: chunk.chunkIndex,
          organizationId: document.organizationId,
          embedding: `[${embeddings_vectors[index].join(',')}]`, // Already generated and passed
          metadata: {
            documentId: document.id,
            organizationId: document.organizationId,
            chunkIndex: chunk.chunkIndex,
            chunkText: chunk.content.substring(0, 200),
            documentTitle: document.name,
            documentType: document.documentType,
            tags: document.tags || [],
            naicsCodes: document.naicsCodes || [],
            keywords: chunk.keywords,
            createdAt: new Date().toISOString(),
          } as PgVectorMetadata
        }
      })

      // Batch insert into pgvector table
      console.log(`📡 [pgvector] Inserting ${vectorData.length} vectors into database`)
      
      // Use raw SQL for efficient batch insert with vector type
      const insertQuery = `
        INSERT INTO document_vectors (document_id, chunk_index, organization_id, embedding, metadata)
        VALUES ${vectorData.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}::vector, $${i * 5 + 5})`).join(', ')}
        ON CONFLICT (document_id, chunk_index) 
        DO UPDATE SET 
          embedding = EXCLUDED.embedding,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `

      const insertParams = vectorData.flatMap(data => [
        data.documentId,
        data.chunkIndex,
        data.organizationId,
        data.embedding,
        JSON.stringify(data.metadata)
      ])

      await prisma.$executeRawUnsafe(insertQuery, ...insertParams)

      console.log(`✅ [pgvector] Successfully stored ${vectorData.length} embeddings`)
    } catch (error) {
      console.error('❌ [pgvector] Error storing embeddings:', error)
      throw error
    }
  }

  /**
   * Delete embeddings for a document from pgvector
   */
  async deleteDocumentEmbeddings(
    documentId: string,
    organizationId: string
  ): Promise<void> {
    console.log(`🗑️ [pgvector] Deleting embeddings for document ${documentId}`)

    try {
      const result = await prisma.$executeRaw`
        DELETE FROM document_vectors 
        WHERE document_id = ${documentId} 
        AND organization_id = ${organizationId}
      `

      console.log(`✅ [pgvector] Deleted ${result} vector embeddings`)
    } catch (error) {
      console.error('❌ [pgvector] Error deleting embeddings:', error)
      throw error
    }
  }

  /**
   * Delete all embeddings for an organization from pgvector
   */
  async deleteAllOrganizationEmbeddings(
    organizationId: string
  ): Promise<void> {
    console.log(`🗑️ [pgvector] Deleting all embeddings for organization ${organizationId}`)

    try {
      const result = await prisma.$executeRaw`
        DELETE FROM document_vectors 
        WHERE organization_id = ${organizationId}
      `

      console.log(`✅ [pgvector] Deleted ${result} vector embeddings for organization ${organizationId}`)
    } catch (error) {
      console.error('❌ [pgvector] Error deleting all organization embeddings:', error)
      throw error
    }
  }

  /**
   * Generate query embedding using existing OpenAI adapter
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      console.log('🤖 [pgvector] Generating embedding for query using AI Manager:', query.substring(0, 100))

      const embedResponse = await this.aiManager.embed({
        model: 'embedding-small', // Use appropriate embedding model
        text: query,
      });

      if (!embedResponse?.embedding) {
        throw new Error('Failed to generate embedding from AI Manager');
      }

      console.log('✅ [pgvector] Embedding generated successfully, length:', embedResponse.embedding.length);
      return embedResponse.embedding;
    } catch (error) {
      console.error('❌ [pgvector] Embedding generation failed via AI Manager:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for batch of texts
   */
  private async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      console.log(`🚀 [pgvector] Generating batch embeddings for ${texts.length} texts using AI Manager`)

      const embedResponse = await this.aiManager.embed({
        model: 'embedding-small', // Use appropriate embedding model
        text: texts,
      });

      if (!embedResponse?.embedding || !Array.isArray(embedResponse.embedding) || embedResponse.embedding.length === 0) {
        throw new Error('Failed to generate embeddings from AI Manager: Empty or invalid response');
      }

      console.log(`✅ [pgvector] Generated ${embedResponse.embedding.length} embeddings`)

      return embedResponse.embedding as number[][];
    } catch (error) {
      console.error('❌ [pgvector] Batch embedding generation failed via AI Manager:', error)
      throw error
    }
  }

  /**
   * Extract highlight phrases from text
   */
  private extractHighlights(query: string, text: string): string[] {
    const highlights: string[] = []
    const queryWords = query.toLowerCase().split(/\s+/)
    const sentences = text.split(/[.!?]+/)

    sentences.forEach((sentence) => {
      const sentenceLower = sentence.toLowerCase()
      if (queryWords.some((word) => sentenceLower.includes(word))) {
        highlights.push(sentence.trim())
      }
    })

    return highlights.slice(0, 3)
  }

  /**
   * Get document with embeddings from database
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
      console.error(`❌ [pgvector] Error fetching document ${documentId}:`, error)
      return null
    }
  }

  /**
   * Rerank results using keyword-based scoring
   */
  private async rerankResults(
    query: string,
    results: SearchResult[],
    topK: number
  ): Promise<SearchResult[]> {
    const queryWords = query.toLowerCase().split(/\s+/)

    const rerankedResults = results.map((result) => {
      const textLower = result.chunkText.toLowerCase()
      let keywordScore = 0

      queryWords.forEach((word) => {
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

    return rerankedResults.sort((a, b) => b.score - a.score).slice(0, topK)
  }

  /**
   * Get index statistics for pgvector
   */
  async getIndexStats(): Promise<any> {
    try {
      const stats = await prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_vectors,
          COUNT(DISTINCT organization_id) as organizations,
          COUNT(DISTINCT document_id) as documents,
          pg_size_pretty(pg_total_relation_size('document_vectors')) as table_size
        FROM document_vectors
      `

      return stats
    } catch (error) {
      console.error('❌ [pgvector] Error getting index stats:', error)
      return null
    }
  }
}

// Default pgvector search service instance
export const defaultPgVectorSearch = new PgVectorSearchService()
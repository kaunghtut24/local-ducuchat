/**
 * Embedding Service
 *
 * Generates and manages vector embeddings for document chunks
 * using OpenAI and stores them in Pinecone for semantic search.
 */

import { Document, DocumentEmbeddings } from '@/types/documents'
import { AIServiceManager } from '@/lib/ai/ai-service-manager'
import { DocumentChunk } from './document-chunker'
import { CostOptimizationService } from './cost-optimization'
import { prisma } from '@/lib/prisma'
import { PgVectorSearchService } from './pgvector-search'

export interface EmbeddingConfig {
  model: 'text-embedding-3-small' | 'text-embedding-3-large' // OpenAI embedding models
  dimensions: number // 1536 for small, 3072 for large
  batchSize: number
}

// PineconeMetadata is no longer needed

export class EmbeddingService {
  private aiManager: AIServiceManager
  private pgVectorService: PgVectorSearchService
  private config: EmbeddingConfig

  constructor(config: Partial<EmbeddingConfig> = {}) {
    this.config = {
      model: 'text-embedding-3-small',
      dimensions: 1536, // OpenAI text-embedding-3-small dimension
      batchSize: 100,
      ...config,
    }

    // Get AI service manager instance
    this.aiManager = AIServiceManager.getInstance()
    this.pgVectorService = new PgVectorSearchService()
  }

  /**
   * Generate embeddings for document chunks and store in Pinecone
   */
  async generateAndStoreEmbeddings(
    chunks: DocumentChunk[],
    document: Document,
    progressCallback?: (step: string, progress: number, chunksProcessed?: number, totalChunks?: number) => Promise<void>
  ): Promise<DocumentEmbeddings> {
    console.log(
      `🚀 Starting embedding generation for ${chunks.length} chunks...`
    )
    const startTime = Date.now()

    try {
      // For pgvector, the organizationId is handled in the metadata
      const organizationNamespace = document.organizationId // Using organizationId as namespace equivalent

      // Process chunks in batches
      const embeddingChunks: DocumentEmbeddings['chunks'] = []
      let failedBatches = 0
      const failedChunkIds: string[] = []

      console.log(
        `📦 Processing ${chunks.length} chunks in batches of ${this.config.batchSize}...`
      )

      for (let i = 0; i < chunks.length; i += this.config.batchSize) {
        try {
          const batch = chunks.slice(i, i + this.config.batchSize)
          const batchNumber = Math.floor(i / this.config.batchSize) + 1
          const totalBatches = Math.ceil(chunks.length / this.config.batchSize)
          
          console.log(
            `🔄 Processing batch ${batchNumber}/${totalBatches} (chunks ${i + 1}-${Math.min(i + this.config.batchSize, chunks.length)})`
          )

          // Progress callback for current batch
          if (progressCallback) {
            const progress = Math.round((i / chunks.length) * 70) + 30 // 30-100% progress range
            await progressCallback(
              `Processing batch ${batchNumber}/${totalBatches}...`,
              progress,
              i,
              chunks.length
            )
          }

          // Generate embeddings for batch with timeout
          console.log(`🧮 Generating embeddings for batch...`)
          const embeddings = await Promise.race([
            this.generateBatchEmbeddings(batch.map((chunk) => chunk.content)),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Embedding generation timeout after 60s')), 60000)
            )
          ]) as number[][]
          console.log(`✅ Generated ${embeddings.length} embeddings for batch`)

          // Store embeddings in pgvector
          console.log(
            `📡 Storing ${batch.length} vectors to pgvector for document ${document.id}...`
          )
          await this.pgVectorService.storeEmbeddings(document, batch, embeddings)
          console.log(`✅ Successfully stored vectors to pgvector`)

          // Store references in our format with validation
          batch.forEach((chunk, idx) => {
            embeddingChunks.push({
              id: chunk.id,
              chunkIndex: chunk.chunkIndex,
              vectorId: `${document.organizationId}_${chunk.id}`, // A logical ID for the vector in pgvector
              content: chunk.content, // Store full chunk content in database
              startChar: chunk.startChar,
              endChar: chunk.endChar,
              keywords: chunk.keywords,
            })

            console.log(
              `📋 Stored embedding reference for chunk ${chunk.chunkIndex}: ${chunk.id}`
            )
          })
        } catch (batchError) {
          const batchNumber = Math.floor(i / this.config.batchSize) + 1
          const errorMessage = batchError instanceof Error ? batchError.message : 'Unknown error'

          console.error(`❌ Batch ${batchNumber} processing failed:`, batchError)

          // Track failed batch for reporting
          failedBatches++
          failedChunkIds.push(...batch.map(c => c.id))

          // Send progress callback with error
          if (progressCallback) {
            await progressCallback(
              `Batch ${batchNumber} failed (${failedBatches} total failures): ${errorMessage}`,
              Math.round((i / chunks.length) * 70) + 30,
              i,
              chunks.length
            )
          }

          // Log the failure but continue processing remaining batches
          console.warn(`⚠️ Continuing with remaining batches. Failed batch ${batchNumber} will be retried later.`)
          continue; // Continue to next batch instead of throwing
        }
      }

      // Return embedding references for database storage
      const successfulChunks = embeddingChunks.length
      const totalBatches = Math.ceil(chunks.length / this.config.batchSize)
      const processingTime = Date.now() - startTime

      if (failedBatches > 0) {
        console.warn(
          `⚠️ Embedding generation completed with ${failedBatches} failed batches. ` +
          `Successfully processed ${successfulChunks}/${chunks.length} chunks in ${processingTime}ms`
        )
        console.warn(`Failed chunk IDs:`, failedChunkIds)

        // If more than 50% of batches failed, throw error
        if (failedBatches > totalBatches / 2) {
          throw new Error(
            `Embedding generation critically failed: ${failedBatches}/${totalBatches} batches failed. ` +
            `Only ${successfulChunks}/${chunks.length} chunks processed successfully.`
          )
        }
      } else {
        console.log(
          `✅ Embedding generation complete! Generated ${embeddingChunks.length} embeddings in ${processingTime}ms`
        )
      }

      return {
        documentId: document.id,
        documentTitle: document.name,
        organizationNamespace: organizationNamespace,
        chunks: embeddingChunks,
        model: this.config.model,
        dimensions: this.config.dimensions,
        totalChunks: chunks.length,
        lastProcessed: new Date().toISOString(),
        partialFailure: failedBatches > 0,
        failedBatches: failedBatches,
        failedChunkIds: failedChunkIds,
      }
    } catch (error) {
      console.error('❌ Embedding generation failed:', error)
      throw error
    }
  }

  /**
   * Estimate token count for text (rough approximation: 1 token ≈ 4 characters)
   */
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4)
  }

  /**
   * Split text that exceeds token limit into smaller chunks
   */
  private splitLargeText(text: string, maxTokens: number = 7000): string[] {
    const estimatedTokens = this.estimateTokenCount(text)
    
    if (estimatedTokens <= maxTokens) {
      return [text]
    }

    console.log(`📏 Text too large (${estimatedTokens} tokens), splitting into smaller chunks...`)
    
    const chunks: string[] = []
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    let currentChunk = ''
    
    for (const sentence of sentences) {
      const sentenceWithPunctuation = sentence.trim() + '. '
      const wouldBeTokens = this.estimateTokenCount(currentChunk + sentenceWithPunctuation)
      
      if (wouldBeTokens > maxTokens && currentChunk.length > 0) {
        // Current chunk is full, save it and start new one
        chunks.push(currentChunk.trim())
        currentChunk = sentenceWithPunctuation
      } else {
        // Add sentence to current chunk
        currentChunk += sentenceWithPunctuation
      }
    }
    
    // Add final chunk if it has content
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim())
    }
    
    console.log(`✂️ Split text into ${chunks.length} smaller chunks`)
    return chunks
  }

  /**
   * Generate dense embeddings for a batch of texts using OpenAI (proper batching)
   */
  private async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    console.log(
      `🚀 Starting embedding generation with AI Manager for ${texts.length} texts`
    )
    console.log(`🔧 Config:`, {
      model: this.config.model,
      batchSize: this.config.batchSize,
      dimensions: this.config.dimensions,
    })

    // Validate and split texts that exceed token limits
    console.log(`🔍 Validating text sizes before sending to AI Manager...`)
    const processedTexts: string[] = []
    
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i]
      const estimatedTokens = this.estimateTokenCount(text)
      
      if (estimatedTokens > 7500) { // Leave buffer under 8192 limit
        console.log(`⚠️ Text ${i + 1} is too large (${estimatedTokens} tokens), splitting...`)
        const splitTexts = this.splitLargeText(text, 7000)
        processedTexts.push(...splitTexts)
      } else {
        processedTexts.push(text)
      }
    }

    // Final safety check - validate all processed texts are under limit
    console.log(`🛡️ Final safety check on ${processedTexts.length} processed texts...`)
    for (let i = 0; i < processedTexts.length; i++) {
      const estimatedTokens = this.estimateTokenCount(processedTexts[i])
      if (estimatedTokens > 8000) {
        console.error(`❌ SAFETY CHECK FAILED: Processed text ${i} still has ${estimatedTokens} tokens (over 8000 limit)`)
        console.error(`Text preview: ${processedTexts[i].substring(0, 200)}...`)
        throw new Error(`Text chunk ${i} exceeds token limit after processing: ${estimatedTokens} tokens`)
      }
    }
    console.log(`✅ All ${processedTexts.length} texts passed safety validation`)

    if (processedTexts.length !== texts.length) {
      console.log(`📝 Text processing: ${texts.length} original texts became ${processedTexts.length} processed texts`)
    }

    console.log(`🎯 Calling AI Manager for embeddings with model: ${this.config.model}`)
    console.log(`📤 Sending ${processedTexts.length} texts in batch request`)

    try {
      const embedResponse = await this.aiManager.embed({
        model: this.config.model,
        text: processedTexts,
        dimensions: this.config.dimensions,
      });

      if (!embedResponse?.embedding || !Array.isArray(embedResponse.embedding) || embedResponse.embedding.length === 0) {
        throw new Error('Failed to generate embeddings from AI Manager: Empty or invalid response');
      }

      const embeddings = embedResponse.embedding as number[][];

      // If texts were split, we need to handle merging embeddings back to match original text count
      if (processedTexts.length > texts.length) {
        console.log(`🔀 Merging split embeddings: ${processedTexts.length} embeddings -> ${texts.length} results`)
        
        const mergedEmbeddings: number[][] = [];
        let embeddingIndex = 0;
        
        for (let i = 0; i < texts.length; i++) {
          const originalText = texts[i];
          const estimatedTokens = this.estimateTokenCount(originalText);
          
          if (estimatedTokens > 7500) {
            mergedEmbeddings.push(embeddings[embeddingIndex]);
            const splitCount = this.splitLargeText(originalText, 7000).length;
            embeddingIndex += splitCount;
          } else {
            mergedEmbeddings.push(embeddings[embeddingIndex]);
            embeddingIndex++;
          }
        }
        
        console.log(`🎯 Merged ${embeddings.length} embeddings into ${mergedEmbeddings.length} results`)
        return mergedEmbeddings;
      }

      console.log(`✅ Successfully generated ${embeddings.length} embeddings in batch via AI Manager`)
      return embeddings;
    } catch (error) {
      console.error(`❌ Embedding generation failed via AI Manager:`, error)
      throw error
    }
  }

  /**
   * Delete embeddings for a document
   */
  async deleteDocumentEmbeddings(
    documentId: string,
    organizationId: string
  ): Promise<void> {
    console.log(
      `🗑️ Deleting embeddings for document ${documentId} in organization ${organizationId} from pgvector`
    )

    await this.pgVectorService.deleteDocumentEmbeddings(documentId)
    console.log(`✅ Deleted embeddings for document ${documentId} from pgvector`)
  }
}

// Default embedding service instance
export const defaultEmbeddingService = new EmbeddingService()

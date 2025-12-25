/**
 * @swagger
 * /api/v1/vectors/delete:
 *   delete:
 *     summary: Delete vectors from organization namespace
 *     description: Delete all vectors or specific document vectors from an organization's namespace in Pinecone
 *     tags: [Vectors]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               documentId:
 *                 type: string
 *                 description: Specific document ID to delete (optional - if not provided, deletes all organization vectors)
 *               deleteAll:
 *                 type: boolean
 *                 description: Confirm deletion of all organization vectors
 *             examples:
 *               deleteDocument:
 *                 summary: Delete specific document vectors
 *                 value:
 *                   documentId: "doc123"
 *               deleteAll:
 *                 summary: Delete all organization vectors
 *                 value:
 *                   deleteAll: true
 *     responses:
 *       200:
 *         description: Vectors deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 deletedCount:
 *                   type: number
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { defaultPgVectorSearch } from '@/lib/ai/services/pgvector-search'

const DeleteVectorsSchema = z.object({
  documentId: z.string().optional().describe('Specific document ID to delete vectors for'),
  deleteAll: z.boolean().optional().describe('Confirm deletion of all organization vectors')
}).refine(data => data.documentId || data.deleteAll, {
  message: "Either documentId or deleteAll must be provided"
})

export async function DELETE(request: NextRequest) {
  let body: any
  let validatedData: any
  
  try {
    const startTime = Date.now()
    
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request
    body = await request.json()
    validatedData = DeleteVectorsSchema.parse(body)

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { organizationId: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    console.log('🗑️  Starting vector deletion for organization:', user.organizationId)

    let deletedCount = 0

    if (validatedData.documentId) {
      // Delete vectors for specific document
      console.log('🎯 Deleting vectors for document:', validatedData.documentId)
      
      // Add start event to processing history
      const targetDocument = await prisma.document.findFirst({
        where: {
          id: validatedData.documentId,
          organizationId: user.organizationId
        },
        select: { processing: true, name: true }
      })

      if (targetDocument) {
        const currentProcessing = (targetDocument.processing as any) || {}
        
        await prisma.document.update({
          where: {
            id: validatedData.documentId,
            organizationId: user.organizationId
          },
          data: {
            processing: {
              ...currentProcessing,
              events: [
                ...(currentProcessing.events || []),
                {
                  id: `evt_${Date.now()}_vectors_delete_start`,
                  eventType: 'VECTORS_DELETE_STARTED',
                  status: 'PROCESSING',
                  message: `Starting vector embeddings deletion...`,
                  timestamp: new Date().toISOString(),
                  success: true,
                  metadata: { 
                    operation: 'delete_vectors_start'
                  }
                }
              ]
            },
            updatedAt: new Date()
          }
        })
      }
      
      // Delete vectors using PgVectorSearchService
      await defaultPgVectorSearch.deleteDocumentEmbeddings(validatedData.documentId, user.organizationId)
      deletedCount = 1 // Assuming 1 document's embeddings are deleted

      // Update database to clear embeddings metadata and add processing event
      const completionDocument = await prisma.document.findFirst({
        where: {
          id: validatedData.documentId,
          organizationId: user.organizationId
        },
        select: { processing: true, name: true }
      })

      if (completionDocument) {
        const currentProcessing = (completionDocument.processing as any) || {}
        
        await prisma.document.update({
          where: {
            id: validatedData.documentId,
            organizationId: user.organizationId
          },
          data: {
            embeddings: {},
            processing: {
              ...currentProcessing,
              events: [
                ...(currentProcessing.events || []),
                {
                  id: `evt_${Date.now()}_vectors_deleted`,
                  eventType: 'VECTORS_DELETED',
                  status: 'COMPLETED',
                  message: `Vector embeddings deleted for document: ${validatedData.documentId}`,
                  timestamp: new Date().toISOString(),
                  success: true,
                  metadata: { 
                    deletedCount,
                    processingTimeMs: Date.now() - startTime,
                    operation: 'delete_vectors'
                  }
                }
              ]
            },
            updatedAt: new Date()
          }
        })
      }

    } else if (validatedData.deleteAll) {
      // Delete all vectors for organization
      console.log('🗑️  Deleting ALL vectors for organization:', user.organizationId)
      
      // Fetch all documents for the organization to update their processing history
      const documents = await prisma.document.findMany({
        where: {
          organizationId: user.organizationId,
          embeddings: { not: {} } // Only documents that had embeddings
        },
        select: { id: true, processing: true, name: true }
      })

      // Delete all vectors for the organization using PgVectorSearchService
      await defaultPgVectorSearch.deleteAllOrganizationEmbeddings(user.organizationId)
      deletedCount = documents.length // Assuming all documents had embeddings

      for (const doc of documents) {
        const currentProcessing = (doc.processing as any) || {}
        
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            embeddings: {},
            processing: {
              ...currentProcessing,
              events: [
                ...(currentProcessing.events || []),
                {
                  id: `evt_${Date.now()}_vectors_deleted_all`,
                  eventType: 'VECTORS_DELETED',
                  status: 'COMPLETED',
                  message: `All organization vector embeddings deleted for document: ${doc.id}`,
                  timestamp: new Date().toISOString(),
                  success: true,
                  metadata: { 
                    deletedCount: 1, // Only 1 document is updated at a time
                    processingTimeMs: Date.now() - startTime,
                    operation: 'delete_all_vectors'
                  }
                }
              ]
            },
            updatedAt: new Date()
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: validatedData.documentId 
        ? `Deleted ${deletedCount} vectors for document ${validatedData.documentId}`
        : `Deleted ${deletedCount} vectors for organization`,
      deletedCount,
      processingTimeMs: Date.now() - startTime
    })

  } catch (error) {
    console.error('Vector deletion error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    // More detailed error logging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Detailed error:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      requestBody: validatedData || 'Failed to parse body'
    })

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}
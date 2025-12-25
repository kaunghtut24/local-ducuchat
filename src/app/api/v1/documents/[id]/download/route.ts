import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { storageServiceManager } from '@/lib/storage/storage-service-manager'

/**
 * @swagger
 * /api/v1/documents/{id}/download:
 *   get:
 *     summary: Download a document file
 *     description: Downloads the actual file content for a document. Returns demo content if Supabase is not configured.
 *     tags: [Documents]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID to download
 *     responses:
 *       200:
 *         description: File content successfully downloaded
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *           text/plain:
 *             schema:
 *               type: string
 *         headers:
 *           Content-Type:
 *             description: MIME type of the file
 *             schema:
 *               type: string
 *           Content-Length:
 *             description: Size of the file in bytes
 *             schema:
 *               type: integer
 *           Content-Disposition:
 *             description: File disposition header
 *             schema:
 *               type: string
 *               example: 'inline; filename="document.pdf"'
 *       401:
 *         description: Unauthorized - user not authenticated
 *       403:
 *         description: Forbidden - user doesn't have access to this document
 *       404:
 *         description: Document not found or file path missing
 *       500:
 *         description: Internal server error or file download failed
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let currentStep = 'initialization'
  try {
    console.log('🔍 Document download request started')

    currentStep = 'parameter_resolution'
    const resolvedParams = await params
    const documentId = resolvedParams.id

    currentStep = 'authentication'
    const { userId } = await auth()

    if (!userId) {
      console.log('❌ Download request unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!documentId) {
      console.log('❌ Document ID missing from params')
      return NextResponse.json(
        { error: 'Document ID required' },
        { status: 400 }
      )
    }

    console.log('📄 Download request for document:', documentId)

    currentStep = 'user_lookup'
    // Get user info
    let user = null

    if (userId !== 'test-user-id') {
      user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true, organizationId: true },
      })
    } else {
      // TEMPORARY: Mock user for testing - REMOVE IN PRODUCTION
      console.log('⚠️ USING MOCK USER FOR TESTING - REMOVE IN PRODUCTION')
      user = {
        id: 'test-user-db-id',
        organizationId: 'cmdm7dvvy0002s820wq4kz532',
      }
    }

    if (!user) {
      console.log('❌ User not found for clerkId:', userId)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    console.log('✅ User found:', {
      userId: user.id,
      organizationId: user.organizationId,
    })

    currentStep = 'document_lookup'
    // Get document and verify access
    let document = null
    try {
      document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          organizationId: true,
          filePath: true,
          name: true,
          mimeType: true,
          size: true,
          extractedText: true, // For created documents, this contains the content
          content: true, // Document content field (JSON)
        },
      })
    } catch (dbError) {
      console.error('❌ Database query failed:', dbError)
      return NextResponse.json(
        {
          error: 'Database connection error',
          details: dbError instanceof Error ? dbError.message : 'Unknown database error',
          timestamp: new Date().toISOString(),
          failedStep: currentStep,
        },
        { status: 500 }
      )
    }

    console.log('📋 Document query result:', {
      found: !!document,
      documentId,
      hasFilePath: !!document?.filePath,
      hasExtractedText: !!document?.extractedText,
      organizationId: document?.organizationId,
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Verify user has access to the document's organization
    if (document.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    console.log('📁 Document details:', {
      filePath: document.filePath,
      name: document.name,
      mimeType: document.mimeType,
      hasExtractedText: !!document.extractedText,
      isVirtualPath: document.filePath?.startsWith('/documents/'),
      fileExtension: document.name?.split('.').pop(),
      hasValidExtension: document.name?.includes('.'),
      filePathParts: document.filePath?.split('/'),
    })

    currentStep = 'content_determination'
    // Check if this is a created document (virtual path) vs uploaded document (real file)
    const isCreatedDocument =
      document.filePath?.startsWith('/documents/') ||
      !document.filePath?.includes('.')

    console.log('🔍 Document type analysis:', {
      filePath: document.filePath,
      isCreatedDocument,
      hasExtractedText: !!document.extractedText,
      hasContent: !!document.content,
      contentType: typeof document.content,
      extractedTextLength: document.extractedText?.length || 0,
      mimeType: document.mimeType,
    })

    if (isCreatedDocument) {
      console.log('📝 This is a created document, returning content directly')

      currentStep = 'content_extraction'
      // For created documents, return the content directly
      let content = ''

      if (document.extractedText) {
        content = document.extractedText
        console.log('✅ Using extractedText field')
      } else if (document.content && typeof document.content === 'object') {
        // Try to extract content from content field
        const contentData = document.content as any
        content =
          contentData?.extractedText ||
          contentData?.text ||
          contentData?.summary ||
          'No content available'
        console.log('✅ Using content field')
      } else {
        content = 'No content available for this document'
        console.log('⚠️ No content found in document')
      }

      // Return as text content
      const textContent = new TextEncoder().encode(content)
      return new Response(textContent, {
        headers: {
          'Content-Type': document.mimeType || 'text/plain',
          'Content-Length': textContent.byteLength.toString(),
          'Content-Disposition': `inline; filename="${document.name}"`,
          'Cache-Control': 'private, max-age=300',
          'X-Document-Type': 'created',
        },
      })
    }

    currentStep = 'storage_download'
    // Handle uploaded documents from StorageServiceManager
    console.log('📄 This is an uploaded document, fetching from storage')
    
    if (!document.filePath) {
      console.error('Document filePath is missing for document:', documentId)
      return NextResponse.json(
        { error: 'File path not found for document' },
        { status: 404 }
      )
    }

    let fileDataStream: ReadableStream | null = null
    try {
      fileDataStream = await storageServiceManager.downloadFile(document.filePath)
    } catch (storageError) {
      console.error('❌ Storage service download threw exception:', storageError)
      return NextResponse.json(
        {
          error: 'Storage system error',
          details: storageError instanceof Error ? storageError.message : 'Unknown storage error',
          timestamp: new Date().toISOString(),
          failedStep: currentStep,
        },
        { status: 500 }
      )
    }

    if (!fileDataStream) {
      console.error('❌ File not found in storage:', document.filePath)
      return NextResponse.json(
        {
          error: 'File not found',
          details: `File not found at path: ${document.filePath}`,
          originalPath: document.filePath,
        },
        { status: 404 }
      )
    }

    console.log('✅ File downloaded successfully from storage')

    currentStep = 'file_processing'
    
    // Convert ReadableStream to ArrayBuffer
    let arrayBuffer: ArrayBuffer
    try {
      const reader = fileDataStream.getReader();
      const chunks: Uint8Array[] = [];
      let totalLength = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalLength += value.length;
      }
      const combinedChunks = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combinedChunks.set(chunk, offset);
        offset += chunk.length;
      }
      arrayBuffer = combinedChunks.buffer;

      // Validate array buffer
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Array buffer is empty or null')
      }
      
      console.log('✅ File processing successful:', {
        bufferSize: arrayBuffer.byteLength,
        documentId,
        fileName: document.name
      })
      
    } catch (bufferError) {
      console.error('❌ Failed to convert file to array buffer:', bufferError)
      return NextResponse.json(
        {
          error: 'File processing error',
          details: bufferError instanceof Error ? bufferError.message : 'Unknown buffer conversion error',
          timestamp: new Date().toISOString(),
          failedStep: currentStep,
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('🚨 Document download error:', error)
    console.error(
      '📋 Error stack:',
      error instanceof Error ? error.stack : 'No stack trace'
    )
    console.error('🎯 Failed at step:', currentStep)

    // Provide more detailed error information for debugging
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown error type',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      failedStep: currentStep,
    }

    console.error(
      '🔍 Detailed error info:',
      JSON.stringify(errorDetails, null, 2)
    )

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: errorDetails.message,
        timestamp: errorDetails.timestamp,
        failedStep: currentStep,
      },
      { status: 500 }
    )
  }
}

import { createClient } from '@supabase/supabase-js';
import { supabase as supabaseConfig } from '@/lib/config/env';
import { IStorageService } from './storage-service-manager';

export class SupabaseStorageService implements IStorageService {
  private supabaseClient: any; // SupabaseClient
  private supabaseAdminClient: any; // SupabaseClient
  private bucketName: string = 'documents'; // Default bucket name for Supabase

  constructor() {
    const supabaseUrl = supabaseConfig.url;
    const supabaseAnonKey = supabaseConfig.anonKey;
    const supabaseServiceRoleKey = supabaseConfig.serviceRoleKey;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.warn('Supabase credentials not fully configured. Supabase storage will be disabled.');
      throw new Error('Supabase credentials not fully configured.');
    }

    this.supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    this.supabaseAdminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    this.ensureBucketExists().catch(console.error);
  }

  private async ensureBucketExists(): Promise<void> {
    const { data, error } = await this.supabaseAdminClient.storage.getBucket(this.bucketName);
    if (error && error.message === 'Bucket not found') {
      const { error: createError } = await this.supabaseAdminClient.storage.createBucket(this.bucketName, {
        public: false, // Ensure private access
        // Add any other specific bucket configuration here
      });
      if (createError) {
        throw new Error(`Failed to create Supabase bucket: ${createError.message}`);
      }
      console.log(`Supabase bucket '${this.bucketName}' created successfully.`);
    } else if (error) {
      throw new Error(`Error checking Supabase bucket existence: ${error.message}`);
    } else {
      console.log(`Supabase bucket '${this.bucketName}' already exists.`);
    }
  }

  async uploadFile(
    objectName: string,
    file: Buffer | ReadableStream,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    const { data, error } = await this.supabaseAdminClient.storage
      .from(this.bucketName)
      .upload(objectName, file, {
        contentType,
        upsert: true,
        cacheControl: '3600',
        duplex: 'half', // Required for ReadableStream in some environments
        metadata,
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    // Get public URL (even if bucket is private, admin client can generate signed URLs)
    const { data: publicUrlData } = this.supabaseAdminClient.storage
      .from(this.bucketName)
      .getPublicUrl(objectName);
    
    // In a real scenario, for private buckets, you'd generate a signed URL
    // For now, returning the public URL (which will be accessible if RLS allows or if bucket is public)
    return publicUrlData.publicUrl;
  }

  async downloadFile(objectName: string): Promise<ReadableStream | null> {
    const { data, error } = await this.supabaseAdminClient.storage
      .from(this.bucketName)
      .download(objectName);

    if (error) {
      if (error.message === 'The resource was not found') {
        return null;
      }
      throw new Error(`Supabase download failed: ${error.message}`);
    }

    // Supabase download returns a Blob, convert to ReadableStream if necessary
    if (data instanceof Blob) {
      return data.stream() as ReadableStream;
    }
    return null;
  }

  async deleteFile(objectName: string): Promise<void> {
    const { error } = await this.supabaseAdminClient.storage
      .from(this.bucketName)
      .remove([objectName]);

    if (error) {
      throw new Error(`Supabase deletion failed: ${error.message}`);
    }
    console.log(`File '${objectName}' deleted from Supabase.`);
  }

  getFileUrl(objectName: string): string {
    // For private buckets, getPublicUrl will still return a URL but access is restricted
    // You'd typically use a signed URL for secure access
    const { data } = this.supabaseAdminClient.storage
      .from(this.bucketName)
      .getPublicUrl(objectName);
    return data.publicUrl;
  }

  async checkHealth(): Promise<boolean> {
    try {
      // Try to list a limited number of files to check connectivity and auth
      const { error } = await this.supabaseAdminClient.storage.from(this.bucketName).list('', { limit: 1 });
      if (error) {
        console.error('Supabase health check failed:', error.message);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Supabase health check failed:', error);
      return false;
    }
  }
}

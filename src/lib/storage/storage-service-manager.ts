import { fileUpload } from '@/lib/config/env';
import { MinIOStorageService } from './minio-storage-service';
import { SupabaseStorageService } from './supabase-storage-service'; // Assuming a similar interface for Supabase
import { UploadThingStorageService } from './uploadthing-storage-service'; // Assuming a similar interface for UploadThing

export interface IStorageService {
  uploadFile(
    objectName: string,
    file: Buffer | ReadableStream,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string>;
  downloadFile(objectName: string): Promise<ReadableStream | null>;
  deleteFile(objectName: string): Promise<void>;
  getFileUrl(objectName: string): string;
  checkHealth(): Promise<boolean>;
}

export class StorageServiceManager implements IStorageService {
  private activeService: IStorageService;

  constructor() {
    this.initializeService();
  }

  private initializeService(): void {
    switch (fileUpload.storageProvider) {
      case 'minio':
        this.activeService = new MinIOStorageService();
        console.log('📦 Using MinIO Storage Service');
        break;
      case 'supabase':
        // Assuming SupabaseStorageService exists and implements IStorageService
        this.activeService = new SupabaseStorageService();
        console.log('📦 Using Supabase Storage Service');
        break;
      case 'uploadthing':
        // Assuming UploadThingStorageService exists and implements IStorageService
        this.activeService = new UploadThingStorageService();
        console.log('📦 Using UploadThing Storage Service');
        break;
      default:
        throw new Error(`Unsupported storage provider: ${fileUpload.storageProvider}`);
    }
  }

  async uploadFile(
    objectName: string,
    file: Buffer | ReadableStream,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    return this.activeService.uploadFile(objectName, file, contentType, metadata);
  }

  async downloadFile(objectName: string): Promise<ReadableStream | null> {
    return this.activeService.downloadFile(objectName);
  }

  async deleteFile(objectName: string): Promise<void> {
    return this.activeService.deleteFile(objectName);
  }

  getFileUrl(objectName: string): string {
    return this.activeService.getFileUrl(objectName);
  }

  async checkHealth(): Promise<boolean> {
    return this.activeService.checkHealth();
  }
}

export const storageServiceManager = new StorageServiceManager();
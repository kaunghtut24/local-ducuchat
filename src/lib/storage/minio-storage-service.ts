import * as Minio from 'minio';
import { fileUpload } from '@/lib/config/env';

export interface FileStorageService {
  uploadFile(
    bucketName: string,
    objectName: string,
    filePath: string | Buffer | ReadableStream,
    metaData?: Minio.ItemBucketMetadata
  ): Promise<string>;
  downloadFile(bucketName: string, objectName: string): Promise<ReadableStream>;
  deleteFile(bucketName: string, objectName: string): Promise<void>;
  getFileUrl(bucketName: string, objectName: string): string;
  checkHealth(): Promise<boolean>;
}

export class MinIOStorageService implements FileStorageService {
  private minioClient: Minio.Client;
  private bucketName: string;

  constructor() {
    if (!fileUpload.minioEndpoint || !fileUpload.minioAccessKey || !fileUpload.minioSecretKey || !fileUpload.minioBucketName) {
      throw new Error('MinIO environment variables are not fully configured.');
    }

    this.minioClient = new Minio.Client({
      endPoint: fileUpload.minioEndpoint,
      accessKey: fileUpload.minioAccessKey,
      secretKey: fileUpload.minioSecretKey,
      useSSL: fileUpload.minioEndpoint.startsWith('https://'),
    });
    this.bucketName = fileUpload.minioBucketName;

    // Ensure bucket exists on initialization
    this.ensureBucketExists().catch(console.error);
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1'); // Default region
        console.log(`MinIO bucket '${this.bucketName}' created successfully.`);
      } else {
        console.log(`MinIO bucket '${this.bucketName}' already exists.`);
      }
    } catch (error) {
      console.error(`Error ensuring MinIO bucket '${this.bucketName}' exists:`, error);
      throw error;
    }
  }

  async uploadFile(
    objectName: string,
    filePath: string | Buffer | ReadableStream,
    metaData?: Minio.ItemBucketMetadata
  ): Promise<string> {
    try {
      const etag = await this.minioClient.putObject(this.bucketName, objectName, filePath, metaData);
      console.log(`File '${objectName}' uploaded successfully. ETag: ${etag}`);
      return this.getFileUrl(this.bucketName, objectName);
    } catch (error) {
      console.error(`Error uploading file '${objectName}':`, error);
      throw error;
    }
  }

  async downloadFile(objectName: string): Promise<ReadableStream> {
    try {
      const stream = await this.minioClient.getObject(this.bucketName, objectName);
      return stream as unknown as ReadableStream; // Cast to ReadableStream
    } catch (error) {
      console.error(`Error downloading file '${objectName}':`, error);
      throw error;
    }
  }

  async deleteFile(objectName: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.bucketName, objectName);
      console.log(`File '${objectName}' deleted successfully.`);
    } catch (error) {
      console.error(`Error deleting file '${objectName}':`, error);
      throw error;
    }
  }

  getFileUrl(bucketName: string, objectName: string): string {
    // MinIO does not provide a direct public URL like S3 without custom setup
    // For local development, this might be the MinIO endpoint + bucket + object
    // In production, you'd typically proxy this or use signed URLs.
    return `${fileUpload.minioEndpoint}/${bucketName}/${objectName}`;
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.minioClient.bucketExists(this.bucketName);
      console.log(`MinIO service is healthy. Bucket '${this.bucketName}' exists.`);
      return true;
    } catch (error) {
      console.error('MinIO health check failed:', error);
      return false;
    }
  }
}

export const defaultMinIOStorageService = new MinIOStorageService();
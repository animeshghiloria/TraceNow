import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly useS3: boolean;

  constructor(private readonly cfg: ConfigService) {
    this.bucket = cfg.get('AWS_S3_BUCKET', '');
    this.region = cfg.get('AWS_REGION', 'ap-south-1');
    this.useS3 = !!(this.bucket && cfg.get('AWS_ACCESS_KEY_ID'));

    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: cfg.get('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: cfg.get('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  async uploadBuffer(
    buffer: Buffer,
    mimeType: string,
    prefix = 'uploads',
  ): Promise<string> {
    const ext = mimeType.split('/')[1] || 'jpg';
    const key = `${prefix}/${uuidv4()}.${ext}`;

    if (!this.useS3) {
      // Dev mode: return a placeholder URL
      this.logger.warn('S3 not configured — returning mock URL');
      return `https://placeholder.s3.amazonaws.com/${key}`;
    }

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async getSignedUrl(s3Url: string, expiresIn = 3600): Promise<string> {
    if (!this.useS3) return s3Url;
    const key = s3Url.split('.amazonaws.com/')[1];
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, cmd, { expiresIn });
  }
}

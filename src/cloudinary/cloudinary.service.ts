import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  UploadApiResponse,
  UploadApiErrorResponse,
  v2 as cloudinary,
} from 'cloudinary';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  private configured = false;
  private configChecked = false;

  constructor(private readonly configService: ConfigService) {}

  private ensureConfigured(): boolean {
    if (this.configChecked) return this.configured;

    const cloudinaryUrl =
      this.configService.get<string>('CLOUDINARY_URL') ||
      process.env.CLOUDINARY_URL;

    const cloudName =
      this.configService.get<string>('CLOUDINARY_CLOUD_NAME') ||
      process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey =
      this.configService.get<string>('CLOUDINARY_API_KEY') ||
      process.env.CLOUDINARY_API_KEY;
    const apiSecret =
      this.configService.get<string>('CLOUDINARY_API_SECRET') ||
      process.env.CLOUDINARY_API_SECRET;

    let resolvedCloudName = cloudName;
    let resolvedApiKey = apiKey;
    let resolvedApiSecret = apiSecret;

    if (
      (!resolvedCloudName || !resolvedApiKey || !resolvedApiSecret) &&
      cloudinaryUrl
    ) {
      try {
        const parsed = new URL(cloudinaryUrl);
        resolvedCloudName = resolvedCloudName || parsed.hostname;
        resolvedApiKey = resolvedApiKey || decodeURIComponent(parsed.username);
        resolvedApiSecret =
          resolvedApiSecret || decodeURIComponent(parsed.password);
      } catch {
        // URL parse edilemezse aşağıdaki validasyon net hata döndürecek.
      }
    }

    if (!resolvedCloudName || !resolvedApiKey || !resolvedApiSecret) {
      this.configChecked = true;
      this.configured = false;
      console.warn(
        'Cloudinary yapılandırması eksik. Yerel uploads fallback kullanılacak.',
      );
      return false;
    }

    cloudinary.config({
      cloud_name: resolvedCloudName,
      api_key: resolvedApiKey,
      api_secret: resolvedApiSecret,
    });

    this.configured = true;
    this.configChecked = true;
    return true;
  }

  private getExtFromMime(mimeType?: string): string {
    if (!mimeType) return '.bin';
    if (mimeType.includes('jpeg')) return '.jpg';
    if (mimeType.includes('png')) return '.png';
    if (mimeType.includes('webp')) return '.webp';
    if (mimeType.includes('gif')) return '.gif';
    if (mimeType.includes('mp4')) return '.mp4';
    if (mimeType.includes('quicktime')) return '.mov';
    return '.bin';
  }

  private async saveLocalFile(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse> {
    const uploadsDir = join(process.cwd(), 'uploads', 'trade-offers');
    await mkdir(uploadsDir, { recursive: true });

    const ext =
      extname(file.originalname || '') || this.getExtFromMime(file.mimetype);
    const fileName = `${Date.now()}-${randomUUID()}${ext}`;
    const fullPath = join(uploadsDir, fileName);

    await writeFile(fullPath, file.buffer);

    const port = this.configService.get<string>('PORT') || '3005';
    const baseUrl =
      this.configService.get<string>('BACKEND_PUBLIC_URL') ||
      `http://localhost:${port}`;
    const secureUrl = `${baseUrl}/uploads/trade-offers/${fileName}`;

    return {
      secure_url: secureUrl,
      public_id: `local/trade-offers/${fileName}`,
      resource_type: 'auto',
    } as UploadApiResponse;
  }

  async uploadImage(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    const hasCloudinary = this.ensureConfigured();

    if (!hasCloudinary) {
      return this.saveLocalFile(file);
    }

    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        { folder: 'loopp-items', resource_type: 'auto' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result!);
        },
      );

      const stream = new Readable();
      stream.push(file.buffer);
      stream.push(null);
      stream.pipe(upload);
    });
  }

  async deleteImage(publicId: string): Promise<any> {
    // Local fallback dosyasıysa diskten sil
    if (publicId?.startsWith('local/trade-offers/')) {
      const fileName = publicId.replace('local/trade-offers/', '');
      const localPath = join(
        process.cwd(),
        'uploads',
        'trade-offers',
        fileName,
      );
      try {
        await unlink(localPath);
      } catch {
        // Dosya zaten silinmiş olabilir.
      }
      return { result: 'ok' };
    }

    const hasCloudinary = this.ensureConfigured();
    if (!hasCloudinary) {
      return { result: 'skipped' };
    }

    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }
}

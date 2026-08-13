import { v2 as cloudinary } from "cloudinary";

export type CloudinaryUploadResult = {
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};

export type CloudinaryPort = {
  isConfigured(): boolean;
  deliveryUrl(publicId: string): string;
  uploadBuffer(buffer: Buffer, folder: string): Promise<CloudinaryUploadResult>;
  destroy(publicId: string): Promise<void>;
};

export const CLOUDINARY_ADAPTER = "CLOUDINARY_ADAPTER";

/** Sole Cloudinary SDK import in the API (AD-12). */
export class CloudinaryAdapter implements CloudinaryPort {
  constructor() {
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    const api_key = process.env.CLOUDINARY_API_KEY;
    const api_secret = process.env.CLOUDINARY_API_SECRET;
    if (cloud_name && api_key && api_secret) {
      cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
    }
  }

  isConfigured(): boolean {
    return Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET,
    );
  }

  deliveryUrl(publicId: string): string {
    return cloudinary.url(publicId, {
      quality: "auto",
      fetch_format: "auto",
      secure: true,
    });
  }

  uploadBuffer(
    buffer: Buffer,
    folder: string,
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder, resource_type: "image" },
          (error, result) => {
            if (error || !result?.public_id || !result.secure_url) {
              reject(error ?? new Error("empty upload result"));
              return;
            }
            resolve({
              public_id: result.public_id,
              secure_url: result.secure_url,
              width: result.width,
              height: result.height,
              format: result.format,
              bytes: result.bytes,
            });
          },
        )
        .end(buffer);
    });
  }

  async destroy(publicId: string): Promise<void> {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true,
    });
    if (result.result !== "ok" && result.result !== "not found") {
      throw new Error(`Cloudinary destroy: ${String(result.result)}`);
    }
  }
}

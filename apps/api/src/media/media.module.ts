import { Module } from "@nestjs/common";
import {
  CLOUDINARY_ADAPTER,
  CloudinaryAdapter,
} from "./cloudinary.adapter";
import { MediaService } from "./media.service";

@Module({
  providers: [
    CloudinaryAdapter,
    { provide: CLOUDINARY_ADAPTER, useExisting: CloudinaryAdapter },
    MediaService,
  ],
  exports: [MediaService],
})
export class MediaModule {}

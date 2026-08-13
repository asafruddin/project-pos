import { Transform } from "class-transformer";
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID } from "class-validator";

export class UploadProductImageDto {
  @IsOptional()
  @IsString()
  alt_text?: string;
}

export class ReorderProductImagesDto {
  @IsArray()
  @IsUUID("4", { each: true })
  image_ids!: string[];
}

export class UpdateProductImageDto {
  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  alt_text?: string | null;
}

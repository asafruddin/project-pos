import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class UpdateProductDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  price_minor?: number;

  @IsOptional()
  @IsString()
  sku?: string | null;

  @IsOptional()
  @IsString()
  barcode?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  cost_minor?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  compare_at_minor?: number | null;

  @IsOptional()
  @IsInt()
  @Min(-2_147_483_648)
  @Max(2_147_483_647)
  min_qty?: number | null;

  @IsOptional()
  @IsInt()
  @Min(-2_147_483_648)
  @Max(2_147_483_647)
  max_qty?: number | null;

  @IsOptional()
  @IsBoolean()
  track_stock?: boolean;

  @IsOptional()
  @IsUUID()
  parent_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  variant_label?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  variant_groups?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  variant_values?: string[];

  @IsOptional()
  @IsString()
  category_name?: string | null;

  @IsOptional()
  @IsString()
  brand_name?: string | null;

  @IsOptional()
  @IsString()
  unit_name?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

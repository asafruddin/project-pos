import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from "class-validator";

export class UpsertPromotionDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsIn(["percent", "fixed"])
  kind!: "percent" | "fixed";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  percent_bps?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  fixed_minor?: number | null;

  @IsOptional()
  @IsString()
  coupon_code?: string | null;

  @IsOptional()
  @IsBoolean()
  exclusive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_subtotal_minor?: number | null;

  @IsOptional()
  @IsString()
  customer_group?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  product_ids?: string[];

  @IsOptional()
  @IsString()
  starts_at?: string | null;

  @IsOptional()
  @IsString()
  ends_at?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  hour_start?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  hour_end?: number | null;
}

export class UpsertVoucherDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  remaining_minor!: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

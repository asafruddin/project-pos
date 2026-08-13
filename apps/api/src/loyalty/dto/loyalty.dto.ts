import { Type, Transform } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";

export class LoyaltyTierDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_lifetime_points!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  earn_multiplier_bps!: number;
}

export class UpdateLoyaltyProgramDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  earn_per_minor?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  point_value_minor?: number;

  @IsOptional()
  @Transform(({ value }) => (value === null ? null : value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expire_days?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LoyaltyTierDto)
  tiers?: LoyaltyTierDto[];
}

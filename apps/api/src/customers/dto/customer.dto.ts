import { Transform } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

function trim(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

function trimOrNull(value: unknown) {
  if (value == null) return null;
  return typeof value === "string" ? value.trim() : value;
}

export class CreateCustomerDto {
  @IsOptional()
  @IsUUID("4")
  customer_id?: string;

  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  @MinLength(1, { message: "Nama pelanggan wajib diisi." })
  name!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimOrNull(value))
  @IsString()
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimOrNull(value))
  @IsString()
  email?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimOrNull(value))
  @IsString()
  notes?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimOrNull(value))
  @IsString()
  group_name?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  store_credit_minor?: number;
}

export class UpdateCustomerDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  @MinLength(1, { message: "Nama pelanggan wajib diisi." })
  name?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimOrNull(value))
  @IsString()
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimOrNull(value))
  @IsString()
  email?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimOrNull(value))
  @IsString()
  notes?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimOrNull(value))
  @IsString()
  group_name?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  store_credit_minor?: number;
}

export class SetCustomerPriceDto {
  @IsUUID("4")
  product_id!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  price_minor?: number | null;
}

export class SetGroupPriceDto {
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  @MinLength(1, { message: "Nama grup wajib diisi." })
  group_name!: string;

  @IsUUID("4")
  product_id!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  price_minor?: number | null;
}

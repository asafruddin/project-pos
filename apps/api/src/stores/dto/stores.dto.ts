import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";

function trim(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

export class CreateStoreDto {
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  @MinLength(1, { message: "Nama toko wajib diisi." })
  name!: string;
}

export class UpdateStoreDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  @MinLength(1, { message: "Nama toko wajib diisi." })
  name?: string;

  @IsOptional()
  @IsIn(["daily", "shift", "manual"])
  queue_reset_mode?: "daily" | "shift" | "manual";

  @IsOptional()
  @IsBoolean()
  queue_reset_now?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: "PIN manajer harus 6 digit angka." })
  manager_pin?: string;

  @IsOptional()
  @IsBoolean()
  manager_pin_reset?: boolean;
}

export class CreateRegisterDto {
  @IsUUID("4")
  store_id!: string;

  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  @MinLength(1, { message: "Nama register wajib diisi." })
  name!: string;
}

export class SetStorePriceDto {
  @IsUUID("4")
  store_id!: string;

  @IsUUID("4")
  product_id!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  price_minor?: number | null;
}

class TransferLineDto {
  @IsUUID("4")
  product_id!: string;

  @IsInt()
  @Min(1)
  qty!: number;
}

export class CreateStockTransferDto {
  @IsUUID("4")
  from_store_id!: string;

  @IsUUID("4")
  to_store_id!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransferLineDto)
  lines!: TransferLineDto[];
}

export class TransitionStockTransferDto {
  @IsIn([
    "requested",
    "approved",
    "preparing",
    "shipped",
    "received",
    "completed",
    "cancelled",
  ])
  status!:
    | "requested"
    | "approved"
    | "preparing"
    | "shipped"
    | "received"
    | "completed"
    | "cancelled";
}

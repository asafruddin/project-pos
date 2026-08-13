import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

function trim(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

export class SupplierProductInputDto {
  @IsUUID("4")
  product_id!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  cost_minor?: number | null;
}

export class CreateSupplierDto {
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  @IsNotEmpty({ message: "Nama pemasok wajib diisi." })
  name!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  contact_name?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  email?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  payment_terms?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierProductInputDto)
  products?: SupplierProductInputDto[];
}

export class UpdateSupplierDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  @IsNotEmpty({ message: "Nama pemasok wajib diisi." })
  name?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  contact_name?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  email?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  payment_terms?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierProductInputDto)
  products?: SupplierProductInputDto[];
}

export class PoLineDto {
  @IsUUID("4")
  product_id!: string;

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  qty!: number;

  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  cost_minor!: number;
}

export class CreatePurchaseOrderDto {
  @IsUUID("4")
  supplier_id!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PoLineDto)
  lines?: PoLineDto[];
}

export class SavePurchaseOrderLinesDto {
  @IsArray()
  @ArrayMinSize(1, { message: "Pesanan harus punya minimal satu item." })
  @ValidateNested({ each: true })
  @Type(() => PoLineDto)
  lines!: PoLineDto[];
}

export class ReceiveLineDto {
  @IsUUID("4")
  product_id!: string;

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  qty!: number;
}

export class ReceiveGoodsDto {
  @IsArray()
  @ArrayMinSize(1, { message: "Isi minimal satu jumlah terima." })
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines!: ReceiveLineDto[];
}

export class UpdatePoInvoiceDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trim(value))
  @IsString()
  invoice_ref?: string | null;

  @IsOptional()
  @IsIn(["unpaid", "partial", "paid"])
  payment_status?: "unpaid" | "partial" | "paid";
}

import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class OpnameCountLineDto {
  @IsUUID("4")
  product_id!: string;

  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  counted_qty!: number;
}

export class SaveOpnameCountsDto {
  @IsArray()
  @ArrayMinSize(1, { message: "Isi minimal satu jumlah hitung." })
  @ValidateNested({ each: true })
  @Type(() => OpnameCountLineDto)
  lines!: OpnameCountLineDto[];
}

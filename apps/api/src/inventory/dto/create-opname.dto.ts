import { ArrayMinSize, IsArray, IsInt, IsUUID, Max, Min } from "class-validator";

export class CreateOpnameDto {
  @IsArray()
  @ArrayMinSize(1, { message: "Pilih minimal satu produk." })
  @IsUUID("4", { each: true })
  product_ids!: string[];
}

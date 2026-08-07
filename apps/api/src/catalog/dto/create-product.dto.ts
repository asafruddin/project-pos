import { Transform } from "class-transformer";
import { IsInt, IsNotEmpty, IsString, Max, Min } from "class-validator";

export class CreateProductDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  price_minor!: number;

  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  stock_qty!: number;
}

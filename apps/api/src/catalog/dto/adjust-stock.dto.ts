import { IsInt, Max, Min } from "class-validator";

export class AdjustStockDto {
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  stock_qty!: number;
}

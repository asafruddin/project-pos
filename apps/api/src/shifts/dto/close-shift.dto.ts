import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsString } from "class-validator";

export class CloseShiftDto {
  @IsString()
  @IsNotEmpty()
  closed_at!: string;

  @Type(() => Number)
  @IsInt()
  counted_cash_minor!: number;

  @Type(() => Number)
  @IsInt()
  expected_cash_minor!: number;
}

import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsString, IsUUID, Min } from "class-validator";

export class OpenShiftDto {
  @IsUUID("4")
  shift_id!: string;

  @IsString()
  @IsNotEmpty()
  opened_at!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  opening_cash_minor!: number;
}

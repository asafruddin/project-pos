import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class RecordCashMovementDto {
  @IsUUID("4")
  movement_id!: string;

  @IsIn(["in", "out"])
  kind!: "in" | "out";

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount_minor!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString()
  @IsNotEmpty()
  occurred_at!: string;
}

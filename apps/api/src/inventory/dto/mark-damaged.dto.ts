import { Transform } from "class-transformer";
import { IsInt, IsNotEmpty, IsString, Max, Min } from "class-validator";

export class MarkDamagedDto {
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  qty!: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: "Alasan stok wajib diisi." })
  reason!: string;
}

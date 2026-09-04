import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";
import {
  ACCOUNT_ROLES,
  PLATFORM_ROLES,
  type PlatformRole,
  type Role,
} from "@pos-apps/types";

export class CreatePlatformOperatorDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsIn([...PLATFORM_ROLES])
  role?: PlatformRole;
}

export class UpdatePlatformOperatorDto {
  @IsOptional()
  @IsIn([...PLATFORM_ROLES])
  role?: PlatformRole;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  password?: string;
}

export class CreatePlatformAccountDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn([...ACCOUNT_ROLES])
  role!: Role;

  @IsUUID()
  store_id!: string;
}

export class UpdatePlatformAccountDto {
  @IsOptional()
  @IsIn([...ACCOUNT_ROLES])
  role?: Role;

  @IsOptional()
  @IsUUID()
  store_id?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  password?: string;
}

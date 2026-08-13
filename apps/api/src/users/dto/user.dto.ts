import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ACCOUNT_ROLES, type Role } from "@pos-apps/types";

export class CreateUserDto {
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

export class UpdateUserDto {
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

class PermissionItemDto {
  @IsString()
  resource!: string;

  @IsString()
  action!: string;
}

export class ReplaceRolePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionItemDto)
  permissions!: PermissionItemDto[];
}

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { grantsFor, hasPermission } from "@pos-apps/domain";
import type { AuthUser } from "./jwt.strategy";
import { PERMISSION_KEY } from "./permission.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<{
      resource: string;
      action: string;
    }>(PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!required) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (
      !user ||
      !hasPermission(grantsFor(user), required.resource, required.action)
    ) {
      throw new ForbiddenException({
        code: "AUTH_FORBIDDEN",
        message: "Anda tidak memiliki izin untuk tindakan ini.",
      });
    }
    return true;
  }
}

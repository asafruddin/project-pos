import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/api-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const raw =
    process.env.CORS_ORIGIN ??
    "http://localhost:3002,http://localhost:3000,http://localhost:3003";
  const origins = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || isAllowedCorsOrigin(origin, origins)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
}

function isAllowedCorsOrigin(origin: string, configured: string[]): boolean {
  if (configured.includes(origin)) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "http:" && protocol !== "https:") return false;
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    const parts = hostname.split(".");
    if (parts.length !== 4) return false;
    const octets = parts.map((part) => Number(part));
    if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return false;
    }
    const [a, b] = octets;
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  } catch {
    return false;
  }
}

void bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

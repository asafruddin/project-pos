import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { DbShutdownService } from "./db/db-shutdown.service";
import { HealthController } from "./health.controller";
import { SalesModule } from "./sales/sales.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    AuthModule,
    CatalogModule,
    SalesModule,
  ],
  controllers: [HealthController],
  providers: [DbShutdownService],
})
export class AppModule {}

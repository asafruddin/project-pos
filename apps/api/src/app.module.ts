import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { DbShutdownService } from "./db/db-shutdown.service";
import { HealthController } from "./health.controller";
import { CustomersModule } from "./customers/customers.module";
import { InventoryModule } from "./inventory/inventory.module";
import { LoyaltyModule } from "./loyalty/loyalty.module";
import { MediaModule } from "./media/media.module";
import { PlatformModule } from "./platform/platform.module";
import { PromotionsModule } from "./promotions/promotions.module";
import { PurchasingModule } from "./purchasing/purchasing.module";
import { ReportsModule } from "./reports/reports.module";
import { SalesModule } from "./sales/sales.module";
import { ShiftsModule } from "./shifts/shifts.module";
import { UsersModule } from "./users/users.module";
import { StoresModule } from "./stores/stores.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    AuthModule,
    CatalogModule,
    CustomersModule,
    InventoryModule,
    LoyaltyModule,
    MediaModule,
    PlatformModule,
    PromotionsModule,
    PurchasingModule,
    ReportsModule,
    SalesModule,
    ShiftsModule,
    UsersModule,
    StoresModule,
  ],
  controllers: [HealthController],
  providers: [DbShutdownService],
})
export class AppModule {}

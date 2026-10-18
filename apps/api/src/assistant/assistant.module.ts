import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CustomersModule } from "../customers/customers.module";
import { InventoryModule } from "../inventory/inventory.module";
import { ReportsModule } from "../reports/reports.module";
import { AssistantController } from "./assistant.controller";
import { AssistantService } from "./assistant.service";
import { ProductLookup } from "./product-lookup";

@Module({
  imports: [AuthModule, ReportsModule, InventoryModule, CustomersModule],
  controllers: [AssistantController],
  providers: [AssistantService, ProductLookup],
})
export class AssistantModule {}

import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";
import { OpnameService } from "./opname.service";

@Module({
  imports: [AuthModule],
  controllers: [InventoryController],
  providers: [InventoryService, OpnameService],
})
export class InventoryModule {}

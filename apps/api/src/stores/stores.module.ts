import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StoresController } from "./stores.controller";
import { StoresService } from "./stores.service";
import { TransferService } from "./transfer.service";

@Module({
  imports: [AuthModule],
  controllers: [StoresController],
  providers: [StoresService, TransferService],
  exports: [StoresService],
})
export class StoresModule {}

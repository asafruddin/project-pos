import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MediaModule } from "../media/media.module";
import { StoresController } from "./stores.controller";
import { StoresService } from "./stores.service";
import { TransferService } from "./transfer.service";

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [StoresController],
  providers: [StoresService, TransferService],
  exports: [StoresService],
})
export class StoresModule {}

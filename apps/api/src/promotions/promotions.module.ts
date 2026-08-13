import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PromotionsController, VouchersController } from "./promotions.controller";
import { PromotionsService } from "./promotions.service";

@Module({
  imports: [AuthModule],
  controllers: [PromotionsController, VouchersController],
  providers: [PromotionsService],
})
export class PromotionsModule {}

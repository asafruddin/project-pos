import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ReturnsService } from "./returns.service";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";

@Module({
  imports: [AuthModule],
  controllers: [SalesController],
  providers: [SalesService, ReturnsService],
})
export class SalesModule {}

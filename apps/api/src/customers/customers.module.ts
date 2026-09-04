import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CustomersController } from "./customers.controller";
import { CustomerImportController } from "./customer-import.controller";
import { CustomersService } from "./customers.service";

@Module({
  imports: [AuthModule],
  controllers: [CustomerImportController, CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}

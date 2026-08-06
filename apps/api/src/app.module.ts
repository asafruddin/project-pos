import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { isPlaceholderId } from "@pos-apps/domain";

@Module({
  controllers: [HealthController],
})
export class AppModule {
  constructor() {
    // Smoke-import domain package to enforce workspace wiring (AD-5).
    void isPlaceholderId("api");
  }
}

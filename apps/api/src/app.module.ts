import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { isPlaceholderId } from "@pos-apps/domain";
import type { PlaceholderId } from "@pos-apps/types";

@Module({
  controllers: [HealthController],
})
export class AppModule {
  constructor() {
    // Smoke-import domain + types to enforce workspace wiring (AD-5 / Task 7).
    const id: PlaceholderId = "api";
    void isPlaceholderId(id);
  }
}

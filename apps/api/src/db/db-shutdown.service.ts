import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { closePool } from "./client";

@Injectable()
export class DbShutdownService implements OnModuleDestroy {
  async onModuleDestroy() {
    await closePool();
  }
}

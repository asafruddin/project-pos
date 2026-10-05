import * as Crypto from "expo-crypto";
import type { IdGenerator } from "@/core/ports/id";

export const cryptoIdGenerator: IdGenerator = {
  uuid: () => Crypto.randomUUID(),
};

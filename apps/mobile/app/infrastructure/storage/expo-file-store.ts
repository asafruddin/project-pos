import { Directory, File, Paths } from "expo-file-system";
import type { FileStore } from "@/core/ports/files";

/** Downloads authenticated binaries into `<cache>/pos-files` (survives app restarts, evictable by the OS). */
export class ExpoFileStore implements FileStore {
  private readonly dir = new Directory(Paths.cache, "pos-files");

  constructor(private readonly opts: { baseUrl: string; getToken: () => string | null }) {
    try {
      this.dir.create({ idempotent: true, intermediates: true });
    } catch {
      /* directory already exists */
    }
  }

  async download(input: { path: string; name: string; auth?: boolean; timeoutMs?: number }): Promise<string | null> {
    const url = /^https?:\/\//.test(input.path) ? input.path : `${this.opts.baseUrl.replace(/\/$/, "")}${input.path}`;
    const token = this.opts.getToken();
    if (input.auth !== false && !token) return null;
    const dest = new File(this.dir, input.name);
    try {
      if (dest.exists) dest.delete();
      const work = File.downloadFileAsync(url, dest, {
        headers: input.auth !== false && token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), input.timeoutMs ?? 10_000));
      const file = await Promise.race([work, timeout]);
      return file.uri;
    } catch {
      try {
        if (dest.exists) dest.delete();
      } catch {
        /* ignore */
      }
      return null;
    }
  }

  exists(uri: string): boolean {
    try {
      return new File(uri).exists;
    } catch {
      return false;
    }
  }

  remove(uri: string): void {
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      /* already gone */
    }
  }
}

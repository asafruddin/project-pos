/** Binary downloads kept on disk (product photos, store logo) so they work offline. */
export interface FileStore {
  /**
   * Download `url` (path relative to the API when it starts with `/`) into the cache under `name`.
   * Resolves with a `file://` URI, or null on any failure (callers fall back to placeholders).
   */
  download(input: { path: string; name: string; auth?: boolean; timeoutMs?: number }): Promise<string | null>;
  exists(uri: string): boolean;
  remove(uri: string): void;
}

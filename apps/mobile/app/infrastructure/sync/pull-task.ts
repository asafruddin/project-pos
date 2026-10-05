/** Server → device refresh (catalog, stock, ...). Runs after the outbox is drained. */
export interface PullTask {
  name: string;
  /** Skip a periodic run if the last success was more recent than this. */
  minIntervalMs: number;
  run(): Promise<void>;
}

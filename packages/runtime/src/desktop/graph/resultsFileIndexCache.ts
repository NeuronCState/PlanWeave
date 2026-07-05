import { resolve } from "node:path";

export const maxCachedResultsDirectories = 32;

export type ResultsFileIndexCacheScope = {
  resultsDir?: string;
};

export class ResultsFileIndexCache<T> {
  private readonly entries = new Map<string, T>();

  constructor(private readonly maxEntries: number) {}

  get(resultsDir: string): T | undefined {
    const key = resolve(resultsDir);
    const value = this.entries.get(key);
    if (value === undefined) {
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(resultsDir: string, value: T): void {
    const key = resolve(resultsDir);
    this.entries.delete(key);
    this.entries.set(key, value);
    this.trim();
  }

  clear(scope: ResultsFileIndexCacheScope = {}): void {
    if (scope.resultsDir) {
      this.entries.delete(resolve(scope.resultsDir));
      return;
    }
    this.entries.clear();
  }

  private trim(): void {
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (typeof oldestKey !== "string") {
        return;
      }
      this.entries.delete(oldestKey);
    }
  }
}

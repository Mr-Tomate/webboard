import crypto from 'node:crypto';

export interface CachedCompilation {
  hex: string;
  stdout: string;
  compilationTimeMs: number;
  timestamp: number;
}

export class CompilationCache {
  private cache: Map<string, CachedCompilation> = new Map();
  private maxEntries: number;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }

  public getCacheKey(sourceCode: string, fqbn = 'arduino:avr:uno'): string {
    return crypto
      .createHash('sha256')
      .update(`${fqbn}:${sourceCode.trim()}`)
      .digest('hex');
  }

  public get(key: string): CachedCompilation | undefined {
    return this.cache.get(key);
  }

  public set(key: string, result: CachedCompilation): void {
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, result);
  }

  public clear(): void {
    this.cache.clear();
  }
}

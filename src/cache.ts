import MemoryCache from "fast-memory-cache";

export abstract class AbstractCache {
  public abstract get<T>(key: string): T | undefined;
  public abstract set<T>(key: string, value: T, expireInSeconds?: number): void;
  public abstract delete(key: string): void;
  public abstract clear(): void;
  public async ensure<T>(
    key: string,
    provider: () => Promise<T>,
    expireInSeconds?: number
  ): Promise<T> {
    const valueInCache = this.get<T>(key);
    if (valueInCache) {
      return valueInCache;
    }
    const calculatedValue = await provider();
    this.set(key, calculatedValue, expireInSeconds);
    return calculatedValue;
  }
}

export class DefaultCache extends AbstractCache {
  protected cache: MemoryCache;

  constructor() {
    super();
    this.cache = new MemoryCache();
  }

  clear(): void {
    return this.cache.clear();
  }

  delete(key: string): void {
    return this.cache.delete(key);
  }

  get<T>(key: string): T | undefined {
    return this.cache.get(key);
  }

  set<T>(key: string, value: T, expireInSeconds?: number): void {
    return this.cache.set(key, value, expireInSeconds);
  }
}

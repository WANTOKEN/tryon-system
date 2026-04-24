/**
 * 图片缓存服务
 * 
 * 使用 Cache API 存储图片，支持离线访问
 */

const CACHE_NAME = 'image-cache-v1';
const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 天


class ImageCacheService {
  private cache: Cache | null = null;
  private initPromise: Promise<void> | null = null;

  async init() {
    if (this.cache) return;
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      if ('caches' in window) {
        this.cache = await caches.open(CACHE_NAME);
      }
    })();

    await this.initPromise;
  }

  /**
   * 获取缓存的图片
   */
  async get(url: string): Promise<Blob | null> {
    await this.init();
    if (!this.cache) return null;

    try {
      const response = await this.cache.match(url);
      if (!response) return null;

      const blob = await response.blob();
      return blob;
    } catch {
      return null;
    }
  }

  /**
   * 缓存图片
   */
  async set(url: string, blob: Blob): Promise<void> {
    await this.init();
    if (!this.cache) return;

    try {
      const response = new Response(blob, {
        headers: {
          'Content-Type': blob.type,
          'Cache-Control': 'public, max-age=31536000',
        },
      });
      await this.cache.put(url, response);
    } catch (error) {
      console.warn('[ImageCache] 缓存失败:', error);
    }
  }

  /**
   * 预加载图片列表
   */
  async preload(urls: string[]): Promise<void> {
    await this.init();
    if (!this.cache) return;

    const promises = urls.map(async (url) => {
      // 检查是否已缓存
      const cached = await this.cache!.match(url);
      if (cached) return;

      // 未缓存，发起请求
      try {
        const response = await fetch(url, { mode: 'cors' });
        if (response.ok) {
          await this.cache!.put(url, response);
        }
      } catch {
        // 忽略错误
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * 清理过期缓存
   */
  async cleanup(): Promise<void> {
    await this.init();
    if (!this.cache) return;

    try {
      const keys = await this.cache.keys();
      const now = Date.now();

      for (const request of keys) {
        const response = await this.cache.match(request);
        if (!response) continue;

        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const timestamp = new Date(dateHeader).getTime();
          if (now - timestamp > CACHE_MAX_AGE) {
            await this.cache.delete(request);
          }
        }
      }
    } catch (error) {
      console.warn('[ImageCache] 清理失败:', error);
    }
  }

  /**
   * 获取缓存统计
   */
  async getStats(): Promise<{ count: number; size: number }> {
    await this.init();
    if (!this.cache) return { count: 0, size: 0 };

    try {
      const keys = await this.cache.keys();
      let totalSize = 0;

      for (const request of keys) {
        const response = await this.cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }

      return { count: keys.length, size: totalSize };
    } catch {
      return { count: 0, size: 0 };
    }
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    if ('caches' in window) {
      await caches.delete(CACHE_NAME);
      this.cache = null;
    }
  }
}

export const imageCacheService = new ImageCacheService();

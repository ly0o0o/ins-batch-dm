/**
 * Chrome Storage 服务封装
 */
export class StorageService {
  /**
   * 获取存储数据
   */
  async get(keys: string | string[] | Record<string, any>): Promise<any> {
    return new Promise(resolve => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  /**
   * 设置存储数据
   */
  async set(items: Record<string, any>): Promise<void> {
    return new Promise(resolve => {
      chrome.storage.local.set(items, resolve);
    });
  }

  /**
   * 删除存储数据
   */
  async remove(keys: string | string[]): Promise<void> {
    return new Promise(resolve => {
      chrome.storage.local.remove(keys, resolve);
    });
  }

  /**
   * 清空所有存储数据
   */
  async clear(): Promise<void> {
    return new Promise(resolve => {
      chrome.storage.local.clear(resolve);
    });
  }
}

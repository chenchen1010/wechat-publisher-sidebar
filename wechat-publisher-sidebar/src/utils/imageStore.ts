/**
 * 图片存储管理 - 使用 IndexedDB 存储图片
 */

export interface ImageMetadata {
    name?: string;
    originalSize?: number;
    type?: string;
    [key: string]: unknown;
}

export interface ImageData {
    id: string;
    blob: Blob;
    name: string;
    originalSize: number;
    compressedSize: number;
    createdAt: number;
    type?: string;
}

class ImageStore {
    private dbName = 'WechatEditorImages';
    private storeName = 'images';
    private version = 1;
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('IndexedDB 打开失败:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB 初始化成功');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    objectStore.createIndex('createdAt', 'createdAt', { unique: false });
                    objectStore.createIndex('name', 'name', { unique: false });
                    console.log('ImageStore 对象存储已创建');
                }
            };
        });
    }

    async saveImage(id: string, blob: Blob, metadata: ImageMetadata = {}): Promise<string> {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);

            const imageData: ImageData = {
                id,
                blob,
                name: metadata.name || 'image',
                originalSize: metadata.originalSize || 0,
                compressedSize: blob.size,
                createdAt: Date.now(),
                type: metadata.type,
            };

            const request = objectStore.put(imageData);

            request.onsuccess = () => {
                console.log(`图片已保存: ${id}`);
                resolve(id);
            };

            request.onerror = () => {
                console.error('保存图片失败:', request.error);
                reject(request.error);
            };
        });
    }

    async getImage(id: string): Promise<string | null> {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get(id);

            request.onsuccess = () => {
                const result = request.result as ImageData | undefined;
                if (result && result.blob) {
                    const objectURL = URL.createObjectURL(result.blob);
                    resolve(objectURL);
                } else {
                    console.warn(`图片不存在: ${id}`);
                    resolve(null);
                }
            };

            request.onerror = () => {
                console.error('读取图片失败:', request.error);
                reject(request.error);
            };
        });
    }

    async getImageBlob(id: string): Promise<Blob | null> {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get(id);

            request.onsuccess = () => {
                const result = request.result as ImageData | undefined;
                if (result && result.blob) {
                    resolve(result.blob);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => {
                console.error('读取图片 Blob 失败:', request.error);
                reject(request.error);
            };
        });
    }

    async deleteImage(id: string): Promise<void> {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.delete(id);

            request.onsuccess = () => {
                console.log(`图片已删除: ${id}`);
                resolve();
            };

            request.onerror = () => {
                console.error('删除图片失败:', request.error);
                reject(request.error);
            };
        });
    }

    async getAllImages(): Promise<ImageData[]> {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.getAll();

            request.onsuccess = () => {
                resolve((request.result as ImageData[]) || []);
            };

            request.onerror = () => {
                console.error('获取图片列表失败:', request.error);
                reject(request.error);
            };
        });
    }

    async clearAll(): Promise<void> {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.clear();

            request.onsuccess = () => {
                console.log('所有图片已清空');
                resolve();
            };

            request.onerror = () => {
                console.error('清空图片失败:', request.error);
                reject(request.error);
            };
        });
    }

    async getTotalSize(): Promise<number> {
        const images = await this.getAllImages();
        return images.reduce((total, img) => total + (img.compressedSize || 0), 0);
    }
}

// 创建单例实例
const imageStore = new ImageStore();

export { imageStore, ImageStore };
export default imageStore;

// 配置接口
import {isSupported} from "./common";

interface IndexedDBConfig {
    version?: number; // 版本号默认为1
    storeName: string; // 表名
    keyPath?: string; // 主键
    autoIncrement?: boolean; // 是否自增
    indexes?: {
        name: string; // 索引名
        keyPath: string | string[]; // 索引字段
        unique?: boolean; // 是否唯一
    }[];
}

const DB_NAME = "WebEyeLogger";

/**
 * IndexedDB管理类
 * */
export class IndexedDBManager {
    private db: IDBDatabase | null = null;
    private config: IndexedDBConfig;

    constructor(config: IndexedDBConfig) {
        this.config = {
            version: 1,
            ...config
        }

        if (!isSupported("indexedDB")) {
            throw new Error("浏览器不支持indexedDB");
        }
    }

    // 初始化
    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, this.config.version!);

            request.onerror = () => {
                reject(new Error(`Failed to open IndexedDB: ${request.error}`));
            }

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            }

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // 创建或更新 stores
                // 删除已存在的 store
                if (db.objectStoreNames.contains(this.config.storeName)) {
                    db.deleteObjectStore(this.config.storeName);
                }

                // 创建 store
                const store = db.createObjectStore(this.config.storeName, {
                    keyPath: this.config.keyPath || "id",
                    autoIncrement: this.config.autoIncrement ?? true,
                })

                // 创建索引
                if (this.config.indexes?.length) {
                    this.config.indexes.forEach(item => {
                        store.createIndex(
                            item.name,
                            item.keyPath,
                            { unique: item.unique ?? false }
                        )
                    })
                }
            }
        })
    }

    /**
     * 检查数据库是否已初始化
     */
    private ensureDB(): void {
        if (!this.db) {
            throw new Error('Database not initialized. Call init() first.');
        }
    }

    // 添加数据
    async add<T = any>(data: T): Promise<IDBValidKey> {
        this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.config.storeName], "readwrite");
            const store = transaction.objectStore(this.config.storeName);
            const request = store.add(data);

            request.onsuccess  = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        })
    }

    // 删除数据
    async delete(key: IDBValidKey): Promise<void> {
        this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.config.storeName], "readwrite");
            const store = transaction.objectStore(this.config.storeName);
            const request = store.delete(key);

            request.onsuccess  = () => resolve();
            request.onerror = () => reject(request.error);
        })
    }

    // 更新数据
    async put<T = any>(data: T): Promise<IDBValidKey> {
        this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.config.storeName], "readwrite");
            const store = transaction.objectStore(this.config.storeName);
            const request = store.put(data);

            request.onsuccess  = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        })
    }

    // 查询单条数据
    async get<T = any>(key: IDBValidKey): Promise<T | undefined> {
        this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.config.storeName], "readonly");
            const store = transaction.objectStore(this.config.storeName);
            const request = store.get(key);

            request.onsuccess  = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        })
    }

    // 查询所有数据
    async getAll<T = any>(): Promise<T[]> {
        this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.config.storeName], "readonly");
            const store = transaction.objectStore(this.config.storeName);
            const request = store.getAll();

            request.onsuccess  = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        })
    }

    // 清空 store 中的所有数据
    async clear(): Promise<void> {
        this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.config.storeName], "readwrite");
            const store = transaction.objectStore(this.config.storeName);
            const request = store.clear();

            request.onsuccess  = () => resolve();
            request.onerror = () => reject(request.error);
        })
    }

    // 获取 store 中数据的数量
    async count(): Promise<number> {
        this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.config.storeName], "readonly");
            const store = transaction.objectStore(this.config.storeName);
            const request = store.count();

            request.onsuccess  = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        })
    }

    // 删除数据库
    async deleteDatabase(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(DB_NAME);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject('Database is in use.');
        })
    }

    // 关闭数据库
    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}
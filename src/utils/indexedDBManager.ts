// 配置接口
import {isSupported} from "./common";

interface IndexedDBConfig {
    version: number; // 版本号默认为1
    storeNames: {
        name: string; // store名
        keyPath?: string; // 主键
        autoIncrement?: boolean; // 是否自增
        indexes?: {
            name: string; // 索引名
            keyPath: string | string[]; // 索引字段
            unique?: boolean; // 是否唯一
        }[];
    }[]
}

const DB_NAME = "WebEyeLogger";

export const defaultStoreNames = [
    {
        name: 'logs',
        keyPath: 'id',
        autoIncrement: true,
        indexes: [
            { name: 'timestamp', keyPath: 'timestamp', unique: false },
            { name: 'level', keyPath: 'level', unique: false }
        ]
    },
    {
        name: 'records',
        keyPath: 'id',
        indexes: [
            { name: 'sessionId', keyPath: 'id', unique: true },
            { name: 'timestamp', keyPath: 'timestamp', unique: false },
        ]
    },
    {
        name: 'workers',
        keyPath: 'id',
        indexes: [
            { name: 'createAt', keyPath: 'createAt', unique: false },
            { name: 'retryCount', keyPath: 'retryCount', unique: false },
            { name: 'status', keyPath: 'status', unique: false },
        ]
    },
];

/**
 * IndexedDB管理类
 * */
export class IndexedDBManager {
    private static instance: IndexedDBManager | null = null;
    private db: IDBDatabase | null = null;
    private config?: IndexedDBConfig;
    loaded = false; // 数据库是否已加载

    constructor(config?: Omit<IndexedDBConfig, "version">) {
        if (IndexedDBManager.instance) {
            return IndexedDBManager.instance;
        }

        this.config = {
            storeNames: [],
            ...config,
            version: 10, // worker 公用数据库，所以不能将 version 设置为动态参数
        }

        if (!isSupported("indexedDB")) {
            throw new Error("浏览器不支持indexedDB");
        } else {
            this.init();
        }

        IndexedDBManager.instance = this;
    }

    static getInstance(): IndexedDBManager {
        return IndexedDBManager.instance!;
    }

    // 初始化
    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, this.config!.version!);

            request.onerror = () => {
                reject(new Error(`Failed to open IndexedDB: ${request.error}`));
            }

            request.onsuccess = () => {
                this.db = request.result;
                this.loaded = true;
                resolve();
            }

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (this.config?.storeNames?.length) {
                    // 创建或更新 stores
                    // 删除已存在的 store
                    this.config!.storeNames.forEach(item => {
                        if (db.objectStoreNames.contains(item.name)) {
                            db.deleteObjectStore(item.name);
                        }

                        // 创建 store
                        const store = db.createObjectStore(item.name, {
                            keyPath: item.keyPath || "id",
                            autoIncrement: item.autoIncrement ?? true,
                        })

                        // 创建索引
                        if (item.indexes?.length) {
                            item.indexes.forEach(index => {
                                store.createIndex(
                                    index.name,
                                    index.keyPath,
                                    { unique: index.unique ?? false }
                                )
                            })
                        }
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
    async add<T = any>(storeName: string, data: T): Promise<IDBValidKey> {
        this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.add(data);

            request.onsuccess  = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        })
    }

    // 删除数据
    async delete(storeName: string, key: IDBValidKey): Promise<void> {
        this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess  = () => resolve();
            request.onerror = () => reject(request.error);
        })
    }

    // 更新数据
    async put<T = any>(storeName: string, logId: IDBValidKey, data: T): Promise<IDBValidKey> {
        this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.get(logId);

            request.onsuccess  = () => {
                const log = request.result;
                if (log) {
                    store.put({ ...log, ...data });
                }
                resolve(request.result)
            };
            request.onerror = () => reject(request.error);
        })
    }

    // 查询单条数据
    async get<T = any>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
        this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess  = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        })
    }

    // 查询所有数据
    async getAll<T = any>(storeName: string, dbIndex?: string, filter?: string): Promise<T[]> {
        this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
            let index: IDBIndex | undefined;
            if (dbIndex) {
                index = store.index(dbIndex);
            }
            let request: IDBRequest<T[]>;
            if (filter) {
                request = index ? index.getAll(filter) : store.getAll(filter);
            } else {
                request = index ? index.getAll() : store.getAll();
            }

            request.onsuccess  = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        })
    }

    // 清空 store 中的所有数据
    async clear(storeName: string): Promise<void> {
        this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess  = () => resolve();
            request.onerror = () => reject(request.error);
        })
    }

    // 获取 store 中数据的数量
    async count(storeName: string): Promise<number> {
        this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
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
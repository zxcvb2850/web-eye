import logger from "../logger";

/**
 * 储存日志
 * */
export class WebIndexedDB {
    private dbName: string;
    private storeName: string;
    private dbVersion: number;
    private maxCount: number;
    public db: IDBDatabase | null;

    constructor(dbName: string, storeName: string, maxCount = 0) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.dbVersion = 1;
        this.maxCount = maxCount;
        this.db = null;

        this.init();
    }

    private init() {
        if (this.db) {
            logger.warn(`Already initialized`);
            return;
        }
        const request = indexedDB.open(this.dbName, this.dbVersion);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
                db.createObjectStore(this.storeName, {keyPath: 'id', autoIncrement: true});
            }
        };

        request.onsuccess = () => {
            this.db = request.result;
        };

        request.onerror = () => {
            logger.error('IndexedDB error:', request.error);
        };
    }

    // 添加数据
    public addData(data: any): Promise<number> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database is not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const addRequest = store.add(data);

            addRequest.onsuccess = async () => {
                // Check the count and delete the first entry if necessary
                const countRequest = store.count();
                countRequest.onsuccess = () => {
                    const count = countRequest.result;
                    resolve(count);
                    if (this.maxCount > 0 && count >= this.maxCount) {
                        const getFirstKeyRequest = store.openCursor();
                        getFirstKeyRequest.onsuccess = (event) => {
                            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                            if (cursor) {
                                store.delete(cursor.primaryKey);
                            }
                        };
                    }
                };

                countRequest.onerror = () => {
                    reject(new Error('Failed to count the entries'));
                };
            };

            addRequest.onerror = () => {
                reject(new Error('Failed to add data'));
            };
        });
    }

    // 获取数据
    public getAllData(): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database is not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const getAllRequest = store.getAll();

            getAllRequest.onsuccess = (data) => {
                resolve(getAllRequest.result);
            }

            getAllRequest.onerror = () => {
                reject(new Error('Failed to getAll data'));
            }
        })
    }

    // 删除数据
    public clearData(): Promise<number> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database is not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const clearRequest = store.clear();

            clearRequest.onsuccess = () => {
                resolve(1);
            };

            clearRequest.onerror = () => {
                reject(new Error('Failed to clear data'));
            };
        });
    }
}
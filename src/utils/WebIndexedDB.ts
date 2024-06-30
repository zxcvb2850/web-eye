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
        const request = indexedDB.open(this.dbName, this.dbVersion);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(this.storeName)) {
                db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (event: Event) => {
            this.db = (event.target as IDBOpenDBRequest).result;
        };

        request.onerror = (event: Event) => {
            console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
        };
    }

    public addData(data: any): Promise<void> {
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
                    console.info("----count----", count);
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

                resolve();
            };

            addRequest.onerror = () => {
                reject(new Error('Failed to add data'));
            };
        });
    }

    public clearData(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database is not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const clearRequest = store.clear();

            clearRequest.onsuccess = () => {
                resolve();
            };

            clearRequest.onerror = () => {
                reject(new Error('Failed to clear data'));
            };
        });
    }
}
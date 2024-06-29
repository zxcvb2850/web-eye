import {Callback} from "../types";

export class WebIndexedDB {
    public db: IDBDatabase | null;
    public dbName: string;
    public storeName: string;

    constructor(dbName: string, storeName: string) {
        this.db = null;
        this.dbName = dbName;
        this.storeName = storeName;
    }

    openDatabase(callback?: Callback) {
        const request = indexedDB.open(this.dbName, 1);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(this.storeName)) {
                db.createObjectStore(this.storeName, { autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            this.db = (event.target as IDBOpenDBRequest).result;
            callback && callback(true);
        };

        request.onerror = (event) => {
            console.error((event.target as IDBOpenDBRequest).error)
            callback && callback(false);
        };
    }

    addItem(item: any) {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.add(item);

        request.onsuccess = (event) => {
            console.info("---insert success---", (event.target as IDBRequest).result);
        };

        request.onerror = (event) => {
            console.error("---insert error---", (event.target as IDBRequest).error);
        };
    }
}
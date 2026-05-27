// The file store.ts handles the Pinia in-memory store definitions.
// This file deals with saving and loading the store content from IndexedDB.
// We use IndexedDB rather than localStorage because localStorage has a limit
// of around 5-10MB, and since we will be storing a state per-tab, it is possible
// that with some image literals involved and several tabs, the total storage could
// be larger than that.

import { AutoSaveKeyNames } from "@/helpers/editor";

// How long a session is dead before we automatically clean it up; 8 days (weekly class + one day):
const MAX_SESSION_AGE_MILLIS = 8 * 24 * 60 * 60 * 1000;

const DB_NAME = AutoSaveKeyNames.strypeIndexDatabaseName;
const DB_VERSION = 1;
let STORE : string;
// #v-ifdef STRYPE_PLATFORM == VITE_STANDARD_PYTHON_MODE
STORE = AutoSaveKeyNames.strypePythonDBStore;
// #v-else    
STORE = AutoSaveKeyNames.strypeMicrobitDBStore;
// #v-endif

// We don't actually need to specify the database schema in a type, but here are the fields and types:
enum DatabaseFieldNames {
    tabId = "tabId", // string; Sessions are saved per-tab based on a unique ID we generate for each 
    data = "data", // string; The actual data (a compressed JSON string of the state)
    
    lastModifiedAt = "lastModifiedAt", // timestamp; The last time a change was made to the data field
    lastAliveAt = "lastAliveAt", // timestamp; The last time the tab was confirmed as alive.  Used to clear out old tab sessions.
}

export function openIndexedDBConnection(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, {
                    keyPath: DatabaseFieldNames.tabId,
                });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// This saves the session state.  If the state has changed (as decided by string comparison),
// the lastModifiedAt is updated.  Regardless of that, lastAliveAt is always modified
export async function saveSessionState(tabId: string, data: string, db?: IDBDatabase) : Promise<void> {
    db = db ?? await openIndexedDBConnection();

    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);

        // Must read existing in order to be able to decide if it was modified:
        const request = store.openCursor(IDBKeyRange.only(tabId));
        
        request.onsuccess = () => {
            const cursor = request.result;

            const now = Date.now();
            
            if (!cursor) {
                // No existing record, so write a new record:
                store.put({
                    [DatabaseFieldNames.tabId]: tabId,
                    [DatabaseFieldNames.data]: data,
                    [DatabaseFieldNames.lastModifiedAt]: now,
                    // May as well update lastAliveAt too, since we're alive if we're saving:
                    [DatabaseFieldNames.lastAliveAt]: now,
                });
            }
            else {
                const record = cursor.value;
                record[DatabaseFieldNames.lastAliveAt] = now;
                if (data != record[DatabaseFieldNames.data] as string) {
                    record[DatabaseFieldNames.data] = data;
                    record[DatabaseFieldNames.lastModifiedAt] = now;
                }
                cursor.update(record);
            }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// Load session state, if it exists, or return undefined if not found:
export async function loadSessionState(tabId: string, db?: IDBDatabase) : Promise<string | null> {
    db = db ?? await openIndexedDBConnection();

    return new Promise<string | null>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const store = tx.objectStore(STORE);

        const request = store.get(tabId);

        request.onsuccess = () => {
            if (request.result) {
                resolve(request.result[DatabaseFieldNames.data] as string);
            }
            else {
                resolve(null);
            }
        };

        request.onerror = () => reject(request.error);
    });
}

// This cleans up old sessions.  Old here means sessions that were not seen alive recently.
// We have a timer task running that marks us as alive, but it's important to note that browsers
// can suspend tabs that have not been used for a while.  So if you have an old Strype tab
// lurking for days or weeks it will stop marking itself as alive, and will get cleaned out of storage.
// There's three options for what happens then once it's gone:
// - User returns to the tab, timers wake up, auto-save saves again, no data lost
// - User closes tab, the code wakes up and handles the tab closing, which means auto-save, no data lost
// - Browser or machine die unexpectedly, data is lost even though the tab was open.  But it hadn't been used in
//   a long time, so that's tough luck.
async function cleanupOldSessions(db: IDBDatabase) : Promise<void> {
    const cutoff = Date.now() - MAX_SESSION_AGE_MILLIS;

    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);

        const request = store.openCursor();

        request.onsuccess = () => {
            const cursor = request.result;

            if (!cursor) {
                resolve();
                return;
            }

            const record = cursor.value;

            // use lastAliveAt as the liveness signal
            const lastAlive = record[DatabaseFieldNames.lastAliveAt];
            if (!lastAlive || lastAlive < cutoff) {
                cursor.delete();
            }

            cursor.continue();
        };

        request.onerror = () => reject(request.error);
    });
}

// This should be run before looking at the DB.  It removes old sessions, and also
// moves any old local storage (which can exist from a version before we added indexed DB)
// into indexed DB, plus any emergency-sync-written state from a page unload into the DB too.
// That way, all code after this function only has to look at the DB.
export async function tidyUpDatabaseState(ourTabId : string, db: IDBDatabase) : Promise<void> {
    // We need to find any "emergency" localStorage items which were saved during page unload or refresh,
    // and move them into the database where they belong:
    const toAddToDatabase: Record<string, string> = {};
    const keysToDelete: string[] = [];
    let storeKey = AutoSaveKeyNames.pythonEditorState;
    // #v-ifdef STRYPE_PLATFORM == VITE_MICROBIT_MODE
    storeKey = AutoSaveKeyNames.mbEditor;
    // #v-endif
    const prefix = storeKey + ":";

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
            toAddToDatabase[key.slice(prefix.length)] = localStorage.getItem(key) as string;
            keysToDelete.push(key);
        }
    }

    for (const key of keysToDelete) {
        localStorage.removeItem(key);
    }
    
    for (const tabId of Object.keys(toAddToDatabase)) {
        await saveSessionState(tabId, toAddToDatabase[tabId], db);
    }
    
    // We also claim any old storage item and associate it with the current tab:
    const oldSingleItem = localStorage.getItem(storeKey);
    if (oldSingleItem) {
        localStorage.removeItem(storeKey);
        await saveSessionState(ourTabId, oldSingleItem, db);
    }
    
    await cleanupOldSessions(db);
}

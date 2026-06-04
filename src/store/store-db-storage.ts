// The file store.ts handles the Pinia in-memory store definitions.
// This file deals with saving and loading the store content from IndexedDB.
// We use IndexedDB rather than localStorage because localStorage has a limit
// of around 5-10MB, and since we will be storing a state per-tab, it is possible
// that with some image literals involved and several tabs, the total storage could
// be larger than that.
//
// Here's how the storage model works:
// - Saving:
//   - We make a tabId and save it to sessionStorage (this is the only real way to identify tabs)
//   - We save the browser state (periodically) to IndexedDB, using tabId as an identifier, and
//     also store times for last modified/last alive.
//   - When the browser tab is closed, we can't save to IndexedDB because that's async and we have
//     no time to do that.  So we "emergency save" to localStorage.  In this case, we know the tab was closed.
// - Loading:
//   - When the page loads it first calls tidyUpDatabaseState which does two things:
//     - It moves any emergency saves into IndexedDB proper so everything is in one place (on load, we have time).
//     - It cleans out any old saves which are >= 8 days old, based on lastAliveAt
//   - Then when loading up, we first check if we have a tabId.  If we do, we check if we have
//     an associated saved state.  If so, we automatically load it.  This usually means we've been
//     reloaded using the refresh button.
//   - If there is a recent state which was modified after save (this may happen if the user closed the tab then did Ctrl-Shift-T),
//     we show a banner message suggesting they may want to reload that state.


import { AutoSaveKeyNames } from "@/helpers/editor";
import { z } from "zod";
import { ceil } from "lodash";

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
    stillAlive = "stillAlive", // This is a string with either "maybe" or "false".  We never know for sure if the tab is still alive,
                               // but we do know if some cases whether it is not.
    
    modifiedSinceExternalSave = "modifiedSinceExternalSave", // This is a string with "true" or "false"; was this state modified after last
                                                             // saving externally (e.g. to disk, google drive), 
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
// If the modified and alive times are omitted from the params, Date.now() is used
export async function saveSessionState(tabId: string, data: string, stillAlive: "maybe" | "false", modifiedSinceExternalSave: boolean, lastModifiedAt?: number, lastAliveAt?: number, db?: IDBDatabase) : Promise<void> {
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
                    [DatabaseFieldNames.lastModifiedAt]: lastModifiedAt ?? now,
                    // May as well update lastAliveAt too, since we're alive if we're saving:
                    [DatabaseFieldNames.lastAliveAt]: lastAliveAt ?? now,
                    [DatabaseFieldNames.stillAlive]: stillAlive,
                    [DatabaseFieldNames.modifiedSinceExternalSave]: modifiedSinceExternalSave ? "true" : "false",
                });
            }
            else {
                const record = cursor.value;
                record[DatabaseFieldNames.lastAliveAt] = lastAliveAt ?? now;
                if (data != record[DatabaseFieldNames.data] as string) {
                    record[DatabaseFieldNames.data] = data;
                    record[DatabaseFieldNames.lastModifiedAt] = lastModifiedAt ?? now;
                }
                record[DatabaseFieldNames.stillAlive] = stillAlive;
                record[DatabaseFieldNames.modifiedSinceExternalSave] = modifiedSinceExternalSave ? "true" : "false";
                cursor.update(record);
            }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// Don't need the tabId as that's in the key of the item
// Don't need stillAlive as we know emergency saves are closed
const EmergencySaveSchema = z.object({ 
    [DatabaseFieldNames.data]: z.string(),
    [DatabaseFieldNames.lastModifiedAt]: z.number(),
    [DatabaseFieldNames.lastAliveAt]: z.number(),
    [DatabaseFieldNames.modifiedSinceExternalSave]: z.boolean(),
});
type EmergencySave = z.infer<typeof EmergencySaveSchema>;

export function emergencySaveSessionState(tabId: string, data: string, lastModifiedAt: number, modifiedSinceExternalSave: boolean) : void {
    let storageString = AutoSaveKeyNames.pythonEditorState;
    // #v-ifdef STRYPE_PLATFORM == VITE_MICROBIT_MODE
    storageString = AutoSaveKeyNames.mbEditor;
    // #v-endif
    const value : EmergencySave = {
        [DatabaseFieldNames.data]: data,
        [DatabaseFieldNames.lastModifiedAt]: lastModifiedAt,
        [DatabaseFieldNames.lastAliveAt]: Date.now(),
        [DatabaseFieldNames.modifiedSinceExternalSave]: modifiedSinceExternalSave,
    };
    localStorage.setItem(storageString + ":" + tabId, JSON.stringify(value));
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

// This function checks if there is a recent state the user might want to load via an auto-displayed banner message.
// The criteria for this is:
// - stillAlive == false; we know the tab is closed
// - modifiedSinceExternalSave == true; it was modified after its last external save
// - lastAliveAt sooner than 2 minutes ago; the user re-navigated to the website (or used Ctrl-Shift-T) soon after it was closed
export async function checkForRecentSaveStates(locale: string) : Promise<null | {data: string, when: string}> {
    const db = await openIndexedDBConnection();
    return new Promise<null | {data: string, when: string}>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const store = tx.objectStore(STORE);
        
        const request = store.getAll();

        request.onsuccess = () => {
            if (request.result) {
                // Makes it into e.g. "5 seconds ago", translated to the given locale.
                const rtf = new Intl.RelativeTimeFormat(locale, { style: "long" });
                const now = Date.now();
                let candidate : null | { lastAlive: number; item: any} = null;
                for (let item of request.result) {
                    const lastAlive = Number(item[DatabaseFieldNames.lastAliveAt]);
                    if (item[DatabaseFieldNames.stillAlive] == "false"
                        && item[DatabaseFieldNames.modifiedSinceExternalSave] ==  "true"
                        && lastAlive >= now - 2 * 60 * 1000) {
                        // Suitable for loading.  There might be multiple though:
                        if (candidate == null || lastAlive > candidate.lastAlive) {
                            candidate = {lastAlive, item};
                        }
                    }
                }
                
                resolve(candidate != null && DatabaseFieldNames.data in candidate.item ? {data: candidate.item[DatabaseFieldNames.data], when: rtf.format(ceil((candidate.lastAlive - now) / 1000), "second")} : null);
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
            if (record[DatabaseFieldNames.stillAlive] == "false" && record[DatabaseFieldNames.modifiedSinceExternalSave] == "false") {
                // We can clean up states which are closed and which were never modified after save:
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
export async function tidyUpDatabaseState(ourTabId : string, db: IDBDatabase, onError: (err: string) => void) : Promise<void> {
    // We need to find any "emergency" localStorage items which were saved during page unload or refresh,
    // and move them into the database where they belong:
    const toAddToDatabase: Record<string, {content: EmergencySave, keyToDelete: string}> = {};
    let storeKey = AutoSaveKeyNames.pythonEditorState;
    // #v-ifdef STRYPE_PLATFORM == VITE_MICROBIT_MODE
    storeKey = AutoSaveKeyNames.mbEditor;
    // #v-endif
    const prefix = storeKey + ":";

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
            const parsed = EmergencySaveSchema.safeParse(JSON.parse(localStorage.getItem(key) as string));
            if (parsed.success) {
                toAddToDatabase[key.slice(prefix.length)] = {content: parsed.data, keyToDelete: key};
            }
        }
    }
    
    for (const tabId of Object.keys(toAddToDatabase)) {
        const item = toAddToDatabase[tabId];
        // We know it's not still alive because it's an emergency save:
        await saveSessionState(tabId, item.content.data, "false", item.content.modifiedSinceExternalSave, item.content.lastModifiedAt, item.content.lastAliveAt, db)
            .catch(onError)
            .then((() => {
                // Only delete key if save was successful:
                localStorage.removeItem(item.keyToDelete);
            }));
    }
    
    // We also claim any old storage item (from old versions of Strype) and associate it with the current tab:
    const oldSingleItem = localStorage.getItem(storeKey);
    if (oldSingleItem) {
        // We assume it was changed since last modification:
        await saveSessionState(ourTabId, oldSingleItem, "false", true, undefined, undefined, db)
            .catch(onError)
            .then(() => {
                // Only delete key if save was successful:
                localStorage.removeItem(storeKey);
            });
    }
    
    await cleanupOldSessions(db);
}

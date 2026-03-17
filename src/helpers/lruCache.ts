// A least-recently-used cache that evicts old keys when we reach the specified number of items in the cache.
// Adapted from https://stackoverflow.com/questions/996505/lru-cache-implementation-in-javascript
export class LRU<K extends string | number, V> {
    max : number; // The maximum number of items to keep in cache
    cache : Map<K, V>; // The actual cache
    onEvict : (key: K, value: V) => void; // Run this when we evict an item from the cache
    constructor(max = 10, onEvict : (key: K, value: V) => void = () => {}) {
        this.max = max;
        this.cache = new Map();
        this.onEvict = onEvict;
    }

    get(key : K) : V | undefined {
        let item = this.cache.get(key);
        if (item !== undefined) {
            // refresh key
            this.cache.delete(key);
            this.cache.set(key, item);
        }
        return item;
    }

    // If this set evicts an item, it is passed to onEvict
    set(key : K, val : V) : void {
        // refresh key
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        // evict oldest
        else if (this.cache.size === this.max) {
            // Oldest key is first one added, which is first in Map:
            // We know key exists because cache is full:
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const evictKey = this.cache.keys().next().value!;
            const evictVal = this.cache.get(evictKey);
            this.cache.delete(evictKey);
            if (evictVal !== undefined) {
                this.onEvict(evictKey, evictVal);
            }
        }
        this.cache.set(key, val);
    }

    // Evicts the given item, and passes it to onEvict if it existed
    evict(key: K) : void {
        const evictVal = this.cache.get(key);
        if (evictVal !== undefined) {
            this.onEvict(key, evictVal);
        }
        this.cache.delete(key);
    }

    
}

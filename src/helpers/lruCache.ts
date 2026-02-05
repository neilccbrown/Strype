// Adapted from https://stackoverflow.com/questions/996505/lru-cache-implementation-in-javascript
export class LRU<K extends string | number, V> {
    max : number;
    cache : Map<K, V>;
    onEvict : (key: K, value: V) => void;
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
            const evictKey = this.firstKey();
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

    firstKey() : K {
        return this.cache.keys().next().value;
    }
}

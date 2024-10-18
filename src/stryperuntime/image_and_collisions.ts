
interface PersistentImage {
    img: HTMLImageElement,
    x: number,
    y: number,
    rotation: number, // degrees
    scale: number, // 1.0 means same size as original image
    dirty: boolean,
}

export class PersistentImageManager {
    private persistentImages = new Map<number, PersistentImage>();
    private persistentImagesDirty = false; // This relates to whether the map has had addition/removal, need to check each entry to see whether they are dirty
    private nextPersistentImageId = 0;
    
    public clear() : void {
        this.persistentImages.clear();
        this.persistentImagesDirty = false;
    }

    public addPersistentImage(filename : string): number {
        this.persistentImagesDirty = true;
        const img = new Image;
        img.src = "./graphics_images/" + filename;
        this.persistentImages.set(this.nextPersistentImageId, {img: img, x: 0, y: 0, rotation: 0, scale: 1, dirty: false});
        return this.nextPersistentImageId++;
    }
    
    public removePersistentImage(id: number): void {
        this.persistentImagesDirty = true;
        this.persistentImages.delete(id);
    }

    public setPersistentImageLocation(id: number, x: number, y: number): void {
        const obj = this.persistentImages.get(id);
        if (obj != undefined && (obj.x != x || obj.y != y)) {
            obj.x = x;
            obj.y = y;
            obj.dirty = true;
        }
    }
    
    public setPersistentImageRotation(id: number, rotation: number): void {
        const obj = this.persistentImages.get(id);
        if (obj != undefined && obj.rotation != rotation) {
            obj.rotation = rotation;
            obj.dirty = true;
        }
    }
    
    public setPersistentImageScale(id: number, scale: number): void {
        const obj = this.persistentImages.get(id);
        if (obj != undefined && obj.scale != scale) {
            obj.scale = scale;
            obj.dirty = true;
        }
    }

    public getPersistentImageLocation(id: number) : {x: number, y : number} | undefined {
        const obj = this.persistentImages.get(id);
        if (obj != undefined) {
            return {x : obj.x, y : obj.y};
        }
        else {
            return undefined;
        }
    }
    
    public getPersistentImageRotation(id: number) : number | undefined {
        const obj = this.persistentImages.get(id);
        return obj?.rotation;
    }
    
    public getPersistentImageScale(id: number) : number | undefined {
        const obj = this.persistentImages.get(id);
        return obj?.scale;
    }
    
    public isDirty() : boolean {
        return this.persistentImagesDirty || Array.from(this.persistentImages.values()).some((p) => p.dirty);
    }

    // Note: doesn't reset the individual images' dirty state
    public resetDirty() : void {
        this.persistentImagesDirty = true;
    }
    
    public getPersistentImages() : IterableIterator<PersistentImage> {
        return this.persistentImages.values();
    }
}

import {System, Box, Point} from "detect-collisions";

export interface PersistentImage {
    id: number,
    img: HTMLImageElement,
    x: number,
    y: number,
    rotation: number, // degrees
    scale: number, // 1.0 means same size as original image
    collisionBox: Box, // The item in the collision detection system
    dirty: boolean,
    associatedObject: any, // The object to remember for this PersistentImage (so far, this is the Actor from the strype.graphics Python module)
}

export class PersistentImageManager {
    private persistentImages = new Map<number, PersistentImage>();
    private persistentImagesDirty = false; // This relates to whether the map has had addition/removal, need to check each entry to see whether they are dirty
    private nextPersistentImageId = 0;
    private collisionSystem = new System();
    // A map to be able to look up the PersistentImage when we find an intersecting Box during collision detection:
    private boxToImageMap = new Map<Box, PersistentImage>();
    
    public clear() : void {
        this.persistentImages.clear();
        this.persistentImagesDirty = false;
        this.collisionSystem.clear();
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public addPersistentImage(image : HTMLImageElement, associatedObject?: any): number {
        this.persistentImagesDirty = true;
        const box = this.collisionSystem.createBox({x:0, y:0}, image.width, image.height, {isCentered: true});
        const newImage = {id: this.nextPersistentImageId, img: image, x: 0, y: 0, rotation: 0, scale: 1, collisionBox : box, dirty: false, associatedObject: associatedObject};
        this.persistentImages.set(this.nextPersistentImageId, newImage);
        this.boxToImageMap.set(box, newImage);
        return this.nextPersistentImageId++;
    }
    
    public removePersistentImage(id: number): void {
        this.persistentImagesDirty = true;
        const box = this.persistentImages.get(id)?.collisionBox;
        if (box != undefined) {
            this.collisionSystem.remove(box);
            this.boxToImageMap.delete(box);
        }
        this.persistentImages.delete(id);
    }

    public setPersistentImageLocation(id: number, x: number, y: number): void {
        const obj = this.persistentImages.get(id);
        if (obj != undefined && (obj.x != x || obj.y != y)) {
            obj.x = x;
            obj.y = y;
            obj.dirty = true;
            obj.collisionBox.setPosition(x, y);
            obj.collisionBox.updateBody();
        }
    }
    
    public setPersistentImageRotation(id: number, rotation: number): void {
        const obj = this.persistentImages.get(id);
        if (obj != undefined && obj.rotation != rotation) {
            obj.rotation = rotation;
            obj.dirty = true;
            obj.collisionBox.setAngle(rotation * Math.PI / 180);
            obj.collisionBox.updateBody();
        }
    }
    
    public setPersistentImageScale(id: number, scale: number): void {
        const obj = this.persistentImages.get(id);
        if (obj != undefined && obj.scale != scale) {
            obj.scale = scale;
            obj.dirty = true;
            obj.collisionBox.setScale(scale);
            obj.collisionBox.updateBody();
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
    
    public calculateAllOverlappingAtPos(x: number, y: number) : PersistentImage[] {
        const collisionPoint = new Point({x:x, y:y});
        this.collisionSystem.insert(collisionPoint);
        const all : PersistentImage[] = [];
        this.collisionSystem.checkOne(collisionPoint, (found) => {
            const pimg = this.boxToImageMap.get(found.b as Box);
            if (pimg) {
                all.push(pimg);
            }
        });
        this.collisionSystem.remove(collisionPoint);
        return all;
    }
}

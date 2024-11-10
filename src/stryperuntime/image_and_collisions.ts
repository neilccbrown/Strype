import {System, Box, Point} from "detect-collisions";

export interface PersistentImage {
    id: number,
    img: HTMLImageElement | OffscreenCanvas,
    x: number,
    y: number,
    rotation: number, // degrees
    scale: number, // 1.0 means same size as original image
    collisionBox: Box | null, // The item in the collision detection system.  Null if the object is not collidable
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
    public addPersistentImage(imageOrCanvas : HTMLImageElement | OffscreenCanvas, associatedObject?: any): number {
        this.persistentImagesDirty = true;
        const box = associatedObject ? this.collisionSystem.createBox({x:0, y:0}, imageOrCanvas.width, imageOrCanvas.height, {isCentered: true}) : null;
        const newImage = {id: this.nextPersistentImageId, img: imageOrCanvas, x: 0, y: 0, rotation: 0, scale: 1, collisionBox : box, dirty: false, associatedObject: associatedObject};
        this.persistentImages.set(this.nextPersistentImageId, newImage);
        if (box != null) {
            this.boxToImageMap.set(box, newImage);
        }
        return this.nextPersistentImageId++;
    }

    public hasPersistentImage(id: number) : boolean {
        return this.persistentImages.has(id);
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

    public removePersistentImageAfter(id: number, secs: number): void {
        setTimeout(() => this.removePersistentImage(id), secs * 1000);
    }
    

    public setPersistentImageLocation(id: number, x: number, y: number): void {
        const obj = this.persistentImages.get(id);
        if (obj != undefined && (obj.x != x || obj.y != y)) {
            obj.x = x;
            obj.y = y;
            obj.dirty = true;
            obj.collisionBox?.setPosition(x, y);
            obj.collisionBox?.updateBody();
        }
    }
    
    public setPersistentImageRotation(id: number, rotation: number): void {
        const obj = this.persistentImages.get(id);
        if (obj != undefined && obj.rotation != rotation) {
            obj.rotation = rotation;
            obj.dirty = true;
            // Note that rotation in the world goes the opposite way to collision because of the inverted
            // axis so we must negate it:
            obj.collisionBox?.setAngle(-rotation * Math.PI / 180);
            obj.collisionBox?.updateBody();
        }
    }
    
    public setPersistentImageScale(id: number, scale: number): void {
        const obj = this.persistentImages.get(id);
        if (obj != undefined && obj.scale != scale) {
            obj.scale = scale;
            obj.dirty = true;
            obj.collisionBox?.setScale(scale);
            obj.collisionBox?.updateBody();
        }
    }
    
    public setPersistentImageCollidable(id: number, collidable: boolean): void {
        const obj = this.persistentImages.get(id);
        if (obj) {
            if (collidable && !obj.collisionBox) {
                // Need to add a collision box:
                const box = this.collisionSystem.createBox({x:obj.x, y:obj.y}, obj.img.width, obj.img.height, {isCentered: true});
                this.boxToImageMap.set(box, obj);
            }
            else if (!collidable && obj.collisionBox) {
                // Need to remove a collision box:
                this.collisionSystem.remove(obj.collisionBox);
                this.boxToImageMap.delete(obj.collisionBox);
                obj.collisionBox = null;
            }
        }
    }
    
    // Gets the image size, ignoring rotation and scale
    public getPersistentImageSize(id: number) : {width: number, height: number} | undefined {
        const obj = this.persistentImages.get(id);
        if (obj != undefined) {
            return {width : obj.img.width, height : obj.img.height};
        }
        else {
            return undefined;
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
    
    public checkCollision(idA: number, idB: number) : boolean {
        const boxA = this.persistentImages.get(idA)?.collisionBox;
        const boxB = this.persistentImages.get(idB)?.collisionBox;
        if (boxA && boxB) {
            return this.collisionSystem.checkCollision(boxA, boxB);
        }
        else {
            return false;
        }
    }
    
    // Gets the associatedObject of all items which overlap the given persistent image id.
    public getAllOverlapping(id: number) : any[] {
        const r : any[] = [];
        const box = this.persistentImages.get(id)?.collisionBox;
        if (box) {
            this.collisionSystem.checkOne(box, (response) => {
                const pimg = this.boxToImageMap.get(box);
                if (pimg) {
                    r.push(pimg.associatedObject);
                }
            });
        }
        return r;
    }
    
    // If this PersistentImage is not already editable, makes an OffScreenCanvas for editing, draws on the existing
    // image, and returns this new OffScreenCanvas.  Returns null if it can't find the PersistentImage with the given id
    public editImage(id : number) : OffscreenCanvas | null {
        const pimg = this.persistentImages.get(id);
        if (pimg != null) {
            if (pimg.img instanceof HTMLImageElement) {
                const c = new OffscreenCanvas(pimg.img.width, pimg.img.height);
                (c.getContext("2d") as OffscreenCanvasRenderingContext2D).drawImage(pimg.img, 0, 0);
                pimg.img = c;
                return c;
            }
            else if (pimg.img instanceof OffscreenCanvas) {
                return pimg.img;
            }
        }
        return null;
    }
}


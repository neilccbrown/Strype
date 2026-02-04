import {System, Box, Point} from "detect-collisions";
import {makeImageHandle, makeSpriteHandle, RemoteCanvas, RemoteImage, StrypeSpriteStateUpdate} from "@/stryperuntime/worker_bridge_type";

// A Sprite is an item with an image, X Y position and rotation that is drawn on screen.
// Note that there is not a 1-to-1 correspondence between Actors and Sprites because:
//   - The .say() method of an Actor uses a Sprite for the speech bubble so an Actor may have multiple Sprites
//   - The background of the world is a Sprite but has no corresponding Actor.
export interface Sprite {
    id: number,
    img: RemoteImage | RemoteCanvas,
    x: number,
    y: number,
    rotation: number, // degrees
    scale: number, // 1.0 means same size as original image
    collisionBox: Box | null, // The item in the collision detection system.  Null if the object is not collidable
    dirty: boolean,
}

export const WORLD_WIDTH = 800;
export const WORLD_HEIGHT = 600;

export class SpriteManager {
    // Special case: ID 0 is always the background persistent image, and inserted first in the map to make it
    // first in the iteration order.  By default it is an 800x600 white image.
    private sprites = new Map<number, Sprite>();
    private spritesDirty = false; // This relates to whether the map has had addition/removal, need to check each entry to see whether they are dirty
    private nextSpriteId = 1;
    private collisionSystem = new System();
    // A map to be able to look up the Sprite when we find an intersecting Box during collision detection:
    private boxToImageMap = new Map<Box, Sprite>();
    private notify: (update: StrypeSpriteStateUpdate) => void;
    
    constructor(notify: (update: StrypeSpriteStateUpdate) => void) {
        this.notify = notify;
        this.clear();
    }
    
    public clear() : void {
        this.notify({request: "clear"});
        this.sprites.clear();
        const bk = {
            id: 0,
            img: {width: 808, height: 606, handle: makeImageHandle(0)}, // Special identifier indicating a black image
            // Since we go from -399 to 400, -299 to 300, the actual centre is 0.5, 0.5:
            x: 0.5,
            y: 0.5,
            rotation: 0,
            scale: 1.0,
            collisionBox: null,
            dirty: true,
        };
        this.sprites.set(0, bk);
        this.notify({request: "add", id: makeSpriteHandle(0), x: bk.x, y: bk.y, rotation: bk.rotation, scale: bk.scale, image: bk.img.handle});
        this.spritesDirty = true;
        this.collisionSystem.clear();
    }
    
    public setBackground(imageOrCanvas : RemoteImage) : void {
        const bk = this.sprites.get(0);
        // Should always be present but keep Typescript happy:
        if (bk) {
            bk.img = imageOrCanvas;
            this.sendUpdateFor(bk);
        }
    }

    private sendUpdateFor(p: Sprite) {
        this.notify({request: "update", id: makeSpriteHandle(p.id), image: p.img.handle, x: p.x, y: p.y, scale: p.scale, rotation: p.rotation});
    }

    public addSprite(imageOrCanvas : RemoteImage | RemoteCanvas, collidable: boolean): number {
        this.spritesDirty = true;
        const id = this.nextSpriteId++;
        const box = collidable ? this.collisionSystem.createBox({x:0, y:0}, imageOrCanvas.width, imageOrCanvas.height, {isCentered: true}) : null;
        const newImage = {id, img: imageOrCanvas, x: 0, y: 0, rotation: 0, scale: 1, collisionBox : box, dirty: false};
        this.sprites.set(id, newImage);
        if (box != null) {
            this.boxToImageMap.set(box, newImage);
        }
        
        this.notify({request: "add", id: makeSpriteHandle(id), x: newImage.x, y: newImage.y, rotation: newImage.rotation, scale: newImage.scale, image: imageOrCanvas.handle});
        return id;
    }

    public hasSprite(id: number) : boolean {
        return this.sprites.has(id);
    }
    
    public removeSprite(id: number): void {
        if (id <= 0) {
            // Don't remove the background image:
            return;
        }
        
        this.spritesDirty = true;
        const box = this.sprites.get(id)?.collisionBox;
        if (box != undefined) {
            this.collisionSystem.remove(box);
            this.boxToImageMap.delete(box);
        }
        this.sprites.delete(id);
        this.notify({request: "remove", id: makeSpriteHandle(id)});
    }

    public removeSpriteAfter(id: number, secs: number): void {
        setTimeout(() => this.removeSprite(id), secs * 1000);
    }

    public setSpriteImage(id: number, imageOrCanvas : RemoteImage | RemoteCanvas): void {
        const obj = this.sprites.get(id);
        if (obj != undefined) {
            obj.img = imageOrCanvas;
            obj.dirty = true;
            if (obj.collisionBox != null) {
                // To update box size, easiest to re-add:
                this.setSpriteCollidable(id, false);
                this.setSpriteCollidable(id, true);
                
            }
            this.sendUpdateFor(obj);
        }
    }

    public setSpriteLocation(id: number, x: number, y: number): void {
        const obj = this.sprites.get(id);
        if (obj != undefined && (obj.x != x || obj.y != y)) {
            obj.x = Math.max(-WORLD_WIDTH/2 + 1, Math.min(x, WORLD_WIDTH/2));
            obj.y = Math.max(-WORLD_HEIGHT/2 + 1, Math.min(y, WORLD_HEIGHT/2));
            obj.dirty = true;
            obj.collisionBox?.setPosition(x, y);
            obj.collisionBox?.updateBody();
            this.sendUpdateFor(obj);
        }
    }
    
    public setSpriteRotation(id: number, rotation: number): void {
        const obj = this.sprites.get(id);
        if (obj != undefined && obj.rotation != rotation) {
            obj.rotation = rotation;
            obj.dirty = true;
            obj.collisionBox?.setAngle(rotation * Math.PI / 180);
            obj.collisionBox?.updateBody();
            this.sendUpdateFor(obj);
        }
    }
    
    public setSpriteScale(id: number, scale: number): void {
        const obj = this.sprites.get(id);
        if (obj != undefined && obj.scale != scale) {
            obj.scale = scale;
            obj.dirty = true;
            obj.collisionBox?.setScale(scale);
            obj.collisionBox?.updateBody();
            this.sendUpdateFor(obj);
        }
    }
    
    public setSpriteCollidable(id: number, collidable: boolean): void {
        const obj = this.sprites.get(id);
        if (obj) {
            if (collidable && !obj.collisionBox) {
                // Need to add a collision box:
                const box = this.collisionSystem.createBox({x:obj.x, y:obj.y}, obj.img.width, obj.img.height, {isCentered: true});
                box.setAngle(obj.rotation * Math.PI / 180);
                box.setScale(obj.scale);
                box.updateBody();
                obj.collisionBox = box;
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
    public getSpriteSize(id: number) : {width: number, height: number} | undefined {
        const obj = this.sprites.get(id);
        if (obj != undefined) {
            return {width : obj.img.width, height : obj.img.height};
        }
        else {
            return undefined;
        }
    }

    public getSpriteLocation(id: number) : {x: number, y : number} | undefined {
        const obj = this.sprites.get(id);
        if (obj != undefined) {
            return {x : obj.x, y : obj.y};
        }
        else {
            return undefined;
        }
    }
    
    public getSpriteRotation(id: number) : number | undefined {
        const obj = this.sprites.get(id);
        return obj?.rotation;
    }
    
    public getSpriteScale(id: number) : number | undefined {
        const obj = this.sprites.get(id);
        return obj?.scale;
    }
    
    public isDirty() : boolean {
        return this.spritesDirty || Array.from(this.sprites.values()).some((p) => p.dirty);
    }

    // Note: doesn't reset the individual images' dirty state
    public resetDirty() : void {
        this.spritesDirty = true;
    }
    
    public getSprites() : IterableIterator<Sprite> {
        return this.sprites.values();
    }
    
    public calculateAllOverlappingAtPos(x: number, y: number) : Sprite[] {
        const collisionPoint = new Point({x:x, y:y});
        this.collisionSystem.insert(collisionPoint);
        const all : Sprite[] = [];
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
        const boxA = this.sprites.get(idA)?.collisionBox;
        const boxB = this.sprites.get(idB)?.collisionBox;
        if (boxA && boxB) {
            return this.collisionSystem.checkCollision(boxA, boxB);
        }
        else {
            return false;
        }
    }
    
    // Gets the idof all items which overlap the given persistent image id.
    public getAllOverlapping(id: number) : number[] {
        const r : number[] = [];
        const box = this.sprites.get(id)?.collisionBox;
        if (box) {
            this.collisionSystem.checkOne(box, (response) => {
                const pimg = this.boxToImageMap.get(response.b as Box);
                if (pimg != null) {
                    r.push(pimg.id);
                }
            });
        }
        return r;
    }
    
    // Gets ids of all actors in the world:
    public getAllActors() : number[] {
        return Array.from(this.sprites.values()).map((p) => p.id);
    }

    // Gets the associatedObject of all items which have centres within the specific radius of the given persistent image id.
    public getAllNearby(id: number, radius: number) : number[] {
        const us = this.sprites.get(id);
        const all: number[] = [];
        if (us) {
            const candidates = this.collisionSystem.search({
                minX: us.x - radius,
                minY: us.y - radius,
                maxX: us.x + radius,
                maxY: us.y + radius,
            }) as Box[];
            
            const radius_squared = radius * radius;

            // Filter down to only those whose center is truly inside the circle
            candidates.forEach((body) => {
                const dx = body.pos.x - us.x;
                const dy = body.pos.y - us.y;
                if (dx * dx + dy * dy <= radius_squared) {
                    const pimg = this.boxToImageMap.get(body);
                    // Don't include ourselves in the results:
                    if (pimg && pimg.id != id) {
                        all.push(pimg.id);
                    }
                }
            });
        }
        return all;
    }
    
    // If this Sprite's image is not already editable, makes an OffScreenCanvas for editing, draws on the existing
    // image, and returns this new OffScreenCanvas.  Returns null if it can't find the Sprite with the given id
    public editImage(id : number, ensureCanvas : (r : RemoteImage | RemoteCanvas) => RemoteCanvas) : RemoteCanvas | null {
        const sprite = this.sprites.get(id);
        if (sprite != null) {
            sprite.img = ensureCanvas(sprite.img);
            
        }
        return null;
    }
}


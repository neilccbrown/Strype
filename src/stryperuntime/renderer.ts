import { CanvasHandle, ImageHandle, isRemoteImage, makeCanvasHandle, makeImageHandle, makeSpriteHandle, RemoteCanvas, RemoteImage, SpriteHandle, StrypeSpriteStateUpdate } from "@/stryperuntime/worker_bridge_type";
import { SpriteManager } from "@/stryperuntime/image_and_collisions";

// A main thread class which keeps a SpriteManager that mirrors the state from the Pyodide web worker thread, and
// also has the actual ImageBitmap/OffscreenCanvas object references.  When asked, can render its mirror of the 
// Pyodide web worker state by combining all this together.
export class Renderer  {
    // Always has a single black 808x606 image first for the default background:
    private loadedImages : ImageBitmap[]  = [];
    private canvases : OffscreenCanvas[] = [];
    // Mirrored (as in echoed, not as in horizontally flipped) from the Pyodide thread:
    // The image/canvas handles here are not "remote", they are an index into the loadedImages/canvases arrays above
    // We need to use SpriteManager rather than just a simple map because we need the collision detection to also
    // run on the main thread to ask about which sprites were under mouse clicks.  The dirty state is also held
    // by the SpriteManager, and set to dirty when we get an update, but cleared when we render:
    private sprites : SpriteManager; 
    
    constructor() {
        // The notify parameter is to send updates to the main thread, but we are the main thread!
        // So no need to do anything when this sprite manager changes:
        this.sprites = new SpriteManager(() => {});
        
        // We have one special image to begin with for the default background; a black 808x606 image:
        const width = 808;
        const height = 606;

        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);

        const bitmap = canvas.transferToImageBitmap();

        this.loadedImages.push(bitmap);
    }
    
    // Sets the receiver for the MessagePort to update this renderer.  Will only
    // receive on the port, not send.
    setMessageChannel(recvUpdates : MessagePort) : void {
        recvUpdates.onmessage = (e) => {
            const update = e.data as StrypeSpriteStateUpdate;
            switch (update.request) {
            case "clear": {
                // Delete everything except the first black background:
                this.loadedImages.splice(1);
                this.sprites.clear();
                break;
            }
            case "add": {
                this.sprites.addSprite(update.image, update.collidable, update.id.handle);
                // Note: deliberate fall-through here into the update.
            }
            case "update": {
                // Note that in theory each call here updates the collision box, so it looks inefficient to do it in many calls.
                // But really, when it's an update only one field is updated, and all of the SpriteManager methods don't do anything
                // if a field is set unchanged:
                const id = update.id.handle;
                this.sprites.setSpriteLocation(id, update.x, update.y);
                this.sprites.setSpriteRotation(id, update.rotation);
                this.sprites.setSpriteScale(id, update.scale);
                this.sprites.setSpriteImage(id, update.image);
                this.sprites.setSpriteCollidable(id, update.collidable);
                break;
            }
            case "remove": {
                this.sprites.removeSprite(update.id.handle);
                break;
            }
            }
        };
    }

    async loadImage(url: string) : Promise<RemoteImage> {
        const response = await fetch(url);
        const blob = await response.blob();
        const imageBitmap = await createImageBitmap(blob);
        this.loadedImages.push(imageBitmap);
        return {handle: makeImageHandle(this.loadedImages.length - 1), width: imageBitmap.width, height: imageBitmap.height};
    }

    makeCanvas(width: number, height: number) : RemoteCanvas {
        const canvas = new OffscreenCanvas(width, height);
        this.canvases.push(canvas);
        return {handle: makeCanvasHandle(this.canvases.length - 1), width, height};
    }

    getImage(i : ImageHandle) : ImageBitmap {
        return this.loadedImages[i.handle];
    }

    getCanvas(c : CanvasHandle) : OffscreenCanvas {
        return this.canvases[c.handle];
    }
    
    getCanvasContext(c : CanvasHandle) : OffscreenCanvasRenderingContext2D {
        // We assume we're going to do something that needs a repaint:
        this.sprites.markDirty();
        return this.canvases[c.handle].getContext("2d") as OffscreenCanvasRenderingContext2D;
    }

    isDirty() : boolean {
        return this.sprites.isDirty();
    }
    
    resetDirty() : void {
        this.sprites.resetDirty();
    }

    getItemsToDraw() : {x: number, y: number, rotation: number, scale: number, img: ImageBitmap | OffscreenCanvas}[] {
        return Array.from(this.sprites.getSprites()).map((p) => {
            return {...p, img: isRemoteImage(p.img) ? this.loadedImages[p.img.handle.handle] : this.canvases[p.img.handle.handle]};
        });
    }

    calculateAllOverlappingAtPos(x: number, y: number) : SpriteHandle[] {
        return this.sprites.calculateAllOverlappingAtPos(x, y).map((s) => makeSpriteHandle(s.id));
    }

    clear() : void {
        this.sprites.clear();
        this.canvases.splice(0);
        // Leave the default background in place:
        this.loadedImages.splice(1);
    }
}

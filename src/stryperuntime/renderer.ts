// This is the mirror of SpriteManager that lives on another thread, listens to updates and
// updates local state to allow rendering:
import {CanvasHandle, ImageHandle, makeCanvasHandle, makeImageHandle, RemoteCanvas, RemoteImage, StrypeSpriteStateUpdate} from "@/stryperuntime/worker_bridge_type";

export class Renderer  {
    // Always has a single black 808x606 image first for the default background:
    private loadedImages : ImageBitmap[]  = [];
    private canvases : OffscreenCanvas[] = [];
    // Mirrored (as in echoed, not as in horizontally flipped) from the Pyodide thread:
    // image is really an index into the loadedImages/canvases arrays
    private sprites : Map<number, {x: number, y: number, rotation: number, scale: number, image: ImageHandle | CanvasHandle}> = new Map();
    private dirty = false;
    
    constructor(recvUpdates: MessagePort) {
        recvUpdates.onmessage = (e) => {
            const update = e.data as StrypeSpriteStateUpdate;
            switch (update.request) {
            case "clear": {
                // Delete everything except the first black background:
                this.loadedImages.splice(1);
                this.sprites.clear();
            }
                break;
            case "add": case "update": {
                this.sprites.set(update.id.handle, {x: update.x, y: update.y, rotation: update.rotation, scale: update.scale, image: update.image});
            }
                break;
            case "remove": {
                this.sprites.delete(update.id.handle);
            }
                break;
            }
            this.dirty = true;
        };
    }
    
    async initialise() : Promise<void> {
        // We have one special image to begin with for the default background; a black 808x606 image:
        const width = 808;
        const height = 606;

        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);

        const bitmap = await createImageBitmap(canvas);

        this.loadedImages.push(bitmap);
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
        return this.canvases[c.handle].getContext("2d") as OffscreenCanvasRenderingContext2D;
    }

    isDirty() : boolean {
        return this.dirty;
    }
    
    resetDirty() : void {
        this.dirty = false;
    }

    getItemsToDraw() : {x: number, y: number, rotation: number, scale: number, img: ImageBitmap | OffscreenCanvas}[] {
        return Array.from(this.sprites.values()).map((p) => {
            return {...p, img: p.image.handleKind == "Image" ? this.loadedImages[p.image.handle] : this.canvases[p.image.handle]};
        });
    }
}

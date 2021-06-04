import {firmwareV1, firmwareV2} from "./firmware";
import { MicropythonFsHex, microbitBoardId } from "@microbit/microbit-fs";
import { readFileAsync } from "@/helpers/readFileAsync";

export default class Compiler {
  micropythonFs: MicropythonFsHex;
  constructor() {
      this.micropythonFs = new MicropythonFsHex([{ hex: firmwareV1, boardId: microbitBoardId.V1 }, 
          { hex: firmwareV2, boardId: microbitBoardId.V2 }]);
      this.micropythonFs.setStorageSize(20 * 1024);
  }
  public compile(inputPython: string) {
      this.micropythonFs.write(
          "main.py",
          inputPython
      );
  }
  public getUniversalHex(): string {
      return this.micropythonFs.getUniversalHex();
  }
  public getBlob(): Blob {
      const code = this.getUniversalHex();

      return new Blob(
          [code],
          { "type": "application/octet-stream" }
      );
  }
  public async getBuffer(): Promise<BufferSource> {
      const code = this.getBlob();

      const buffer = await readFileAsync(code);

      return buffer;
  }
}

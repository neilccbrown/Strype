import firmware from "./firmware";
import { MicropythonFsHex } from "@microbit/microbit-fs";
import { readFileAsync } from "@/helpers/readFileAsync";

export default class Compiler {
  micropythonFs: MicropythonFsHex;
  constructor() {
      this.micropythonFs = new MicropythonFsHex(firmware);
      this.micropythonFs.setStorageSize(20 * 1024);
  }
  public compile(inputPython: string) {
      this.micropythonFs.write(
          "main.py",
          inputPython
      );
  }
  public getIntelHex(): string {
      return this.micropythonFs.getIntelHex();
  }
  public getBlob(): Blob {
      const code = this.getIntelHex();

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

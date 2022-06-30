import fsPromises from "fs/promises";
import fs from "fs";
import { file } from "tmp-promise";
import lineReader from "line-reader";

export type FileMapItem = [name: string, hash: string];

export default class FileMap {
  public readonly tmpFilePath: string;

  /**
   * Yes. I know what you're about to say. *this* is kind of
   * awful. But it enables to avoid storing the list of the
   * values of the file map that can also be awfully long.
   *
   * This makes a temporary file map. When no more modifications
   * are needed, `FileMap.createStream` can be used to write
   * it in the final file map.
   *
   * Please do not use `new FileMap()` to create the FileMap,
   * use `FileMap.new()` instead.
   *
   * @param tmpFilePath temporary file map path
   */
  constructor(tmpFilePath: string) {
    this.tmpFilePath = tmpFilePath;
  }

  /**
   * Adds item to the temporary file map
   * @param plain the plain file name
   * @param encrypted The encrypted file name
   */
  public addItem(plain: string, encrypted: string): Promise<void> {
    return fsPromises.appendFile(
      this.tmpFilePath,
      `${Buffer.from(plain, "utf8").toString("base64url")}:${encrypted}\n`
    );
  }

  /**
   * Creates Readable stream to be able to write the content
   * of the temporary file map in the final file map
   */
  public createStream() {
    return fs.createReadStream(this.tmpFilePath);
  }

  /**
   * Parses file map and map through it
   * @param path Path of the file map to parse
   * @param callback Function that will be executed for every
   * item in the file map
   */
  public async parseAndMap(callback: (value: FileMapItem) => Promise<unknown>) {
    let array: Promise<unknown>[] = [];
    await new Promise<void>((resolve) => {
      lineReader.eachLine(this.tmpFilePath, (line, last) => {
        let values = line.split(":");
        if (values.length !== 2) return null;
        values[0] = Buffer.from(values[0], "base64url").toString("utf8");
        array.push(callback(values as FileMapItem));
        if (last) resolve();
      });
    });
    return array;
  }

  /**
   * Creates new FileMap
   */
  public static async new(): Promise<FileMap>;
  public static async new(encryptedFileMapName: string): Promise<FileMap>;
  public static async new(encryptedFileMapName?: string) {
    let tmpPath = (await file()).path;
    if (encryptedFileMapName)
      await fsPromises.appendFile(
        tmpPath,
        `${Buffer.from("fileMap", "utf8").toString(
          "base64url"
        )}:${encryptedFileMapName}\n`
      );
    return new FileMap(tmpPath);
  }
}

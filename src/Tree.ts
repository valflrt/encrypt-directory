import fsAsync from "fs/promises";
import pathProgram from "path";
import throat from "throat";

/**
 * BaseItem type
 */
export interface BaseItem {
  path: string;
  name: string;
}

/**
 * File type
 */
export interface File extends BaseItem {
  type: "file";
  ext: string | null;
}

/**
 * Dir type
 */
export interface Directory extends BaseItem {
  type: "directory";
}

/**
 * UnknownItem type – Used when the item is neither a File
 * nor a Dir (example: symbolic links, ...)
 */
export interface Unknown extends BaseItem {
  type: "unknown";
}

export type Item = File | Directory | Unknown;
export type ItemArray = Item[];

export default class Tree {
  private _path: string;

  /**
   * Creates a file tree
   * @param path Path of the directory to scan
   */
  constructor(path: string) {
    this._path = path;
  }

  /**
   * Returns an object representation of the tree
   */
  public async map<T>(callback: (item: Item) => T): Promise<T[]> {
    if ((await fsAsync.stat(this._path)).isFile())
      throw new Error("Can't make tree from a file !");

    let output: T[] = [];

    let loopThroughDirectories = async (dirPath: string) => {
      await Promise.all(
        (
          await fsAsync.readdir(dirPath, {
            withFileTypes: true,
          })
        ).map(async (i) => {
          let itemPath = pathProgram.join(dirPath, i.name);
          if (i.isDirectory()) {
            output.push(
              callback({
                type: "directory",
                path: itemPath,
                name: i.name,
              })
            );
            await loopThroughDirectories(itemPath);
          } else if (i.isFile())
            output.push(
              callback({
                type: "file",
                path: itemPath,
                name: i.name,
                ext:
                  pathProgram.extname(i.name) !== ""
                    ? pathProgram.extname(i.name)
                    : null,
              })
            );
          else
            output.push(
              callback({
                type: "unknown",
                path: itemPath,
                name: i.name,
              })
            );
        })
      );
    };
    await loopThroughDirectories(this._path);

    return output;
  }

  public get fileCount() {
    return (async () =>
      (
        await Promise.all(
          await this.map(
            throat(
              20,
              async (i): Promise<number> => (i.type === "file" ? 1 : 0)
            )
          )
        )
      ).reduce((acc, i) => acc + i, 0))();
  }

  public get size() {
    return (async () =>
      (
        await Promise.all(
          await this.map(
            throat(20, async (i) =>
              i.type === "file" ? (await fsAsync.stat(i.path)).size : 0
            )
          )
        )
      ).reduce((acc, i) => acc + i, 0))();
  }

  // Such pain to make that. i won't delete it
  // public createIterator() {
  //   let currentLevelPath = this._path;
  //   let levelsIndexes = [0];
  //   let end: boolean = false;
  //   let next = async (): Promise<Item> => {
  //     if (end) throw new Error("Reached end of tree");
  //     let currentLevelMap = await this._mapLevel(currentLevelPath);
  //     let item = currentLevelMap[levelsIndexes[0]];
  //     levelsIndexes[0]++;
  //     if (item?.type === "directory") {
  //       levelsIndexes.unshift(levelsIndexes[0]);
  //       levelsIndexes[0] = 0;
  //       currentLevelPath = item.path;
  //     }
  //     if (
  //       levelsIndexes[0] === (await this._mapLevel(currentLevelPath)).length &&
  //       levelsIndexes.length !== 1
  //     ) {
  //       levelsIndexes.shift();
  //       currentLevelPath = path.dirname(currentLevelPath);
  //     }
  //     end =
  //       levelsIndexes.length === 1 &&
  //       !(await this._mapLevel(currentLevelPath))[levelsIndexes[0]];
  //     return item;
  //   };
  //   return {
  //     next,
  //     isEnd: () => end,
  //   };
  // }
  // private async _mapLevel(dirPath: string): Promise<ItemArray> {
  //   let items = await fsAsync.readdir(path.resolve(dirPath), {
  //     withFileTypes: true,
  //   });
  //   return items.map<Item>((i) => {
  //     let itemPath = pathProgram.join(dirPath, i.name);
  //     if (i.isDirectory()) {
  //       return {
  //         type: "directory",
  //         path: itemPath,
  //         name: i.name,
  //       };
  //     } else if (i.isFile())
  //       return {
  //         type: "file",
  //         path: itemPath,
  //         name: i.name,
  //         ext:
  //           pathProgram.extname(i.name) !== ""
  //             ? pathProgram.extname(i.name)
  //             : null,
  //       };
  //     else
  //       return {
  //         type: "unknown",
  //         path: itemPath,
  //         name: i.name,
  //       };
  //   });
  // }
}

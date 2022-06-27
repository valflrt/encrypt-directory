import fsAsync from "fs/promises";
import path from "path";
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
export interface UnknownItem extends BaseItem {
  type: "unknown";
}

export type Item = File | Directory | UnknownItem;
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

  public createIterator() {
    let currentLevelPath = this._path;
    let levelsIndexes = [0];

    let end: boolean = false;

    let next = async (): Promise<Item> => {
      if (end) throw new Error("Reached end of tree");

      let currentLevelMap = await this.mapLevel(currentLevelPath);
      let item = currentLevelMap[levelsIndexes[0]];

      levelsIndexes[0]++;

      if (item?.type === "directory") {
        levelsIndexes.unshift(levelsIndexes[0]);
        levelsIndexes[0] = 0;
        currentLevelPath = item.path;
      }
      if (
        levelsIndexes[0] === (await this.mapLevel(currentLevelPath)).length &&
        levelsIndexes.length !== 1
      ) {
        levelsIndexes.shift();
        currentLevelPath = path.dirname(currentLevelPath);
      }

      end =
        levelsIndexes.length === 1 &&
        !(await this.mapLevel(currentLevelPath))[levelsIndexes[0]];

      return item;
    };

    return {
      next,
      isEnd: () => end,
    };
  }

  private async mapLevel(dirPath: string): Promise<ItemArray> {
    let items = await fsAsync.readdir(path.resolve(dirPath), {
      withFileTypes: true,
    });
    return items.map<Item>((i) => {
      let itemPath = pathProgram.join(dirPath, i.name);
      if (i.isDirectory()) {
        return {
          type: "directory",
          path: itemPath,
          name: i.name,
        };
      } else if (i.isFile())
        return {
          type: "file",
          path: itemPath,
          name: i.name,
          ext:
            pathProgram.extname(i.name) !== ""
              ? pathProgram.extname(i.name)
              : null,
        };
      else
        return {
          type: "unknown",
          path: itemPath,
          name: i.name,
        };
    });
  }

  public get fileCount() {
    let iterator = this.createIterator();

    let recurse = async (fileCount: number = 0): Promise<number> => {
      if (iterator.isEnd()) return fileCount;
      else {
        let item = await iterator.next();
        return await recurse(item.type === "file" ? fileCount + 1 : fileCount);
      }
    };
    return recurse();
  }

  public get size() {
    let iterator = this.createIterator();

    let recurse = async (fileCount: number = 0): Promise<number> => {
      if (iterator.isEnd()) return fileCount;
      else {
        let item = await iterator.next();
        return await recurse(
          item.type === "file"
            ? fileCount + (await fsAsync.stat(item.path)).size
            : fileCount
        );
      }
    };
    return recurse();
  }
}

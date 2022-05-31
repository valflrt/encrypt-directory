import fs from "fs";
import path from "path";

/**
 * Item types
 */
export enum ItemTypes {
  Dir,
  File,
  Unknown,
}

/**
 * Item type – Do not use for specific items. (`Dir | File | Unknown`)
 */
export interface Item {
  type: ItemTypes.Dir | ItemTypes.File | ItemTypes.Unknown;
  path: string;
  name: string;
}

/**
 * File type
 */
export interface File extends Item {
  type: ItemTypes.File;
  ext: string | null;
}

/**
 * Dir type
 */
export interface Dir extends Item {
  type: ItemTypes.Dir;
  items: ItemArray;
}

/**
 * UnknownItem type – Used when the item is neither a File nor a Dir (example: symbolic links, ...)
 */
export interface UnknownItem extends Item {
  type: ItemTypes.Unknown;
}

export type Items = File | Dir | UnknownItem;
export type ItemArray = (File | Dir | UnknownItem)[];

export class Tree {
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
  public async toObject() {
    if (fs.statSync(this._path).isFile()) return null;

    let loopThroughDirectories = async (
      dirPath: string
    ): Promise<ItemArray> => {
      return await Promise.all(
        fs
          .readdirSync(dirPath, {
            withFileTypes: true,
          })
          .map(async (i) => {
            let itemPath = path.join(dirPath, i.name);
            if (i.isDirectory())
              return {
                type: ItemTypes.Dir,
                path: itemPath,
                name: i.name,
                items: await loopThroughDirectories(itemPath),
              };
            else if (i.isFile())
              return {
                type: ItemTypes.File,
                path: itemPath,
                name: i.name,
                ext: path.extname(i.name) !== "" ? path.extname(i.name) : null,
              };
            else
              return {
                type: ItemTypes.Unknown,
                path: itemPath,
                name: i.name,
              };
          })
      );
    };

    return {
      type: ItemTypes.Dir,
      path: path.normalize(this._path),
      items: await loopThroughDirectories(this._path),
    } as Dir;
  }

  /**
   * Returns a string representation of the tree
   * @param options Options for toString
   */
  public async toString(options?: {
    /**
     * Indentation size – Default is 2
     */
    indentSize?: number;
    /**
     * Bullet to put before file/dir names (don't forget to add a space) – Default is "- " – If `null` specified uses an empty string
     */
    bullet?: string | null;
  }) {
    let bullet = options?.bullet === null ? "" : options?.bullet ?? "- ";
    let indents = (number: number) =>
      " ".repeat(number * (options?.indentSize ?? 2));

    let loopTroughObject = (items: ItemArray, level: number = 1) => {
      return items
        .map((i): string => {
          let baseString = `${indents(level)}${bullet}${i.path}`;

          if (i.type === ItemTypes.Dir)
            return baseString.concat(
              i.items.length !== 0 ? "\n" : "",
              loopTroughObject(i.items, level + 1)
            );
          else return baseString;
        })
        .join("\n");
    };

    let dir = await this.toObject();
    if (!dir) return null;

    return `${bullet}${dir.path}`.concat(
      dir.items.length !== 0 ? "\n" : "",
      loopTroughObject(dir.items)
    );
  }

  /**
   * Returns a flat array representation of the tree
   */
  public async toFlatArray() {
    let flatArray: ItemArray = [];

    let loopTroughObject = (dir: Dir, level: number = 1) => {
      dir.items.forEach((i) =>
        i.type === ItemTypes.Dir
          ? loopTroughObject(i, level + 1)
          : flatArray.push(i)
      );
    };

    let dir = await this.toObject();
    if (!dir) return null;

    loopTroughObject(dir);

    return flatArray ?? null;
  }

  /**
   * Returns the number of entries in the given Dir object
   * @param dir Dir object
   */
  public static getNumberOfEntries(dir: Dir): number {
    let loopThroughItems = (items: ItemArray): number =>
      items.reduce<number>((acc, i) => {
        if (i.type === ItemTypes.Dir) {
          return acc + loopThroughItems(i.items);
        } else return acc + 1;
      }, 0);
    return loopThroughItems(dir.items);
  }
}

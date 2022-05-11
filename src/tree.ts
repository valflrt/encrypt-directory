import { Stats } from "fs";
import fs from "fs/promises";
import path, { resolve } from "path";

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
   * Returns true or false wether the path leads to a directory
   */
  private get _stat() {
    return new Promise<Stats>(async (resolve, reject) => {
      try {
        resolve(await fs.stat(this._path));
      } catch (e) {
        reject();
      }
    });
  }

  /**
   * Returns an object representation of the tree
   */
  public async toObject() {
    let itemStat = await this._stat;
    if (itemStat.isFile()) return null;

    let loopThroughDirectories = async (
      dirPath: string
    ): Promise<ItemArray> => {
      return await Promise.all(
        (
          await fs.readdir(dirPath, {
            withFileTypes: true,
          })
        ).map(async (i) => {
          let itemPath = path.join(dirPath, i.name);
          if (i.isDirectory())
            return {
              type: ItemTypes.Dir,
              path: itemPath,
              items: await loopThroughDirectories(itemPath),
            };
          else if (i.isFile())
            return {
              type: ItemTypes.File,
              path: itemPath,
              ext: path.extname(i.name) !== "" ? path.extname(i.name) : null,
            };
          else
            return {
              type: ItemTypes.Unknown,
              path: itemPath,
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
}

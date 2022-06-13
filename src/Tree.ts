import fsAsync from "fs/promises";
import pathProgram from "path";

/**
 * Item types
 */
export enum ItemTypes {
  Dir,
  File,
  UnknownItem,
}

/**
 * Item type – Do not use for specific items. (`Dir | File | Unknown`)
 */
export interface Item {
  type: ItemTypes.Dir | ItemTypes.File | ItemTypes.UnknownItem;
  path: string;
  name: string;
}

/**
 * File type
 */
export interface File extends Item {
  type: ItemTypes.File;
  ext: string | null;
  size: number;
}

/**
 * Dir type
 */
export interface Dir extends Item {
  type: ItemTypes.Dir;
  items: ItemArray;
  size: number;
}

/**
 * UnknownItem type – Used when the item is neither a File
 * nor a Dir (example: symbolic links, ...)
 */
export interface UnknownItem extends Item {
  type: ItemTypes.UnknownItem;
}

export type AnyItem = File | Dir | UnknownItem;
export type ItemArray = (File | Dir | UnknownItem)[];

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
  public async toObject(): Promise<Dir> {
    if ((await fsAsync.stat(this._path)).isFile())
      throw new Error("Can't make file tree from a file !");

    let loopThroughDirectories = async (
      dirPath: string
    ): Promise<{ size: number; items: ItemArray }> => {
      let dir = await Promise.all(
        (
          await fsAsync.readdir(dirPath, {
            withFileTypes: true,
          })
        ).map<Promise<AnyItem>>(async (i) => {
          let itemPath = pathProgram.join(dirPath, i.name);
          if (i.isDirectory()) {
            let { items, size } = await loopThroughDirectories(itemPath);
            return {
              type: ItemTypes.Dir,
              path: itemPath,
              name: i.name,
              items,
              size,
            };
          } else if (i.isFile())
            return {
              type: ItemTypes.File,
              path: itemPath,
              name: i.name,
              ext:
                pathProgram.extname(i.name) !== ""
                  ? pathProgram.extname(i.name)
                  : null,
              size: (await fsAsync.stat(itemPath)).size,
            };
          else
            return {
              type: ItemTypes.UnknownItem,
              path: itemPath,
              name: i.name,
            };
        })
      );

      return {
        items: dir,
        size: dir.reduce(
          (acc, v) =>
            v.type === ItemTypes.File || v.type === ItemTypes.Dir
              ? acc + v.size
              : acc,
          0
        ),
      };
    };

    let { items, size: totalSize } = await loopThroughDirectories(this._path);

    return {
      type: ItemTypes.Dir,
      name: pathProgram.parse(this._path).name,
      path: pathProgram.normalize(this._path),
      items,
      size: totalSize,
    };
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
     * Bullet to put before file/dir names (don't forget to add a space)
     * – Default is "- " – If `null` specified uses an
     * empty string
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

    loopTroughObject(await this.toObject());

    return flatArray;
  }

  /**
   * Returns the number of entries in the given Dir object
   * @param dir Dir object
   */
  public static getNumberOfFiles(dir: Dir): number {
    let loopThroughItems = (items: ItemArray): number =>
      items.reduce<number>((acc, i) => {
        if (i.type === ItemTypes.Dir) {
          return acc + loopThroughItems(i.items);
        } else if (i.type === ItemTypes.UnknownItem) return acc;
        else return acc + 1;
      }, 0);
    return loopThroughItems(dir.items);
  }
}

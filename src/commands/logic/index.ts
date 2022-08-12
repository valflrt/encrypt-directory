import fs from "fs";
import fsAsync from "fs/promises";
import pathProgram from "path";
import crypto from "crypto";

import Tree from "../../Tree";

import { Result } from "../../Result";

export interface Item {
  type: "directory" | "file" | "unknown";
  inputPath: string;
  outputPath: string;
  tree?: Tree;
}

// Resolves the given raw paths
export let parsePaths = (...paths: string[]) =>
  new Result<string[]>((resolve) =>
    resolve(paths.map((rawInputPath) => pathProgram.resolve(rawInputPath)))
  );

// Checks if all the items exist
export let getInexistantPaths = (...paths: string[]) =>
  paths.filter((inputPath) => !fs.existsSync(inputPath));

export let makeOutputPath = (path: string, derive: "encrypt" | "decrypt") =>
  new Result<string>((resolve) =>
    resolve(
      derive === "encrypt"
        ? path.concat(".encrypted")
        : path.replace(".encrypted", "").concat(".decrypted")
    )
  );

export let makeItem = (
  itemStats: fs.Stats,
  inputPath: string,
  outputPath: string
): Item =>
  itemStats.isDirectory()
    ? {
        type: "directory",
        inputPath,
        outputPath,
        tree: new Tree(inputPath),
      }
    : itemStats.isFile()
    ? {
        type: "file",
        inputPath,
        outputPath,
      }
    : {
        type: "unknown",
        inputPath,
        outputPath,
      };

/**
 * A function to clean, to remove files/directories
 * that were created in case of error when encrypting/decrypting
 */
export let cleanup = async (...items: Item[]) => {
  await Promise.all(
    items.map(async (i) => {
      await fsAsync.rm(i.outputPath, {
        recursive: true,
        force: true,
      });
    })
  );
};

export let randomKey = () => crypto.randomBytes(8).toString("base64url");

export let generateMd5Hash = <
  Encoding extends "base64" | "base64url" | "binary" | "hex" | undefined
>(
  buffer: Buffer,
  encoding?: Encoding
) => {
  let hash = crypto.createHash("sha256").update(buffer);
  return (
    encoding ? hash.digest(encoding) : hash.digest()
  ) as Encoding extends undefined ? Buffer : string;
};

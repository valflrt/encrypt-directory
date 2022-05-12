import fs from "fs/promises";
import path from "path";

import { Encryption } from "./encryption";
import { ItemArray, ItemTypes, Tree } from "./tree";
import {
  getArgs,
  loopThroughDirToFindNumberOfEntries,
  tryCatch,
} from "./utils";

export interface Command {
  name: string;
  matches: string[];
  execute: () => any;
}

let commands: Command[] = [];

commands.push({
  name: "help",
  matches: ["help", "h"],
  execute: () => {
    console.log("HEEELP");
  },
});

commands.push({
  name: "encrypt",
  matches: ["encrypt", "e"],
  execute: async () => {
    let args = getArgs();

    let resolvedDirPath = tryCatch(
      () => path.resolve(args["path"] ?? args["p"]),
      (e) => {
        if (args["debug"]) console.log(e);
        console.log("You need to specify a proper path !");
      }
    );
    if (!resolvedDirPath) return;

    let key = tryCatch(
      () => path.resolve(args["key"] ?? args["k"]),
      (e) => {
        if (args["debug"]) console.log(e);
        console.log(
          "You need to specify a key a proper to encrypt the files with !"
        );
      }
    );
    if (!key) return;

    let encryption = new Encryption(key);

    console.log("Reading directory...");
    let dir = await new Tree(resolvedDirPath).toObject();
    if (!dir) return console.log("Failed to read directory !");
    console.log(
      `Found ${loopThroughDirToFindNumberOfEntries(dir.items)} items.`
    );

    let parsedDirPath = path.parse(resolvedDirPath);
    let encryptedDirPath = path.join(
      parsedDirPath.dir,
      encryption.encrypt(Buffer.from(parsedDirPath.base)).toString("base64url")
    );

    try {
      await fs.mkdir(encryptedDirPath);
    } catch (e) {
      if (args["debug"]) console.log(e);
    }

    let loopThroughDir = (items: ItemArray, parentPath: string): void => {
      items.map(async (i) => {
        let itemPath = path.join(
          parentPath,
          encryption.encrypt(Buffer.from(i.name)).toString("base64url")
        );
        if (i.type === ItemTypes.Dir) {
          try {
            await fs.mkdir(itemPath);
          } catch (e) {
            if (args["debug"]) console.log(e);
          }
          loopThroughDir(i.items, itemPath);
        } else {
          await fs.writeFile(itemPath, encryption.encryptFile(i.path));
        }
      });
    };
    loopThroughDir(dir.items, encryptedDirPath);

    console.log("Done.");
  },
});

commands.push({
  name: "decrypt",
  matches: ["decrypt", "d"],
  execute: async () => {
    let args = getArgs();

    let resolvedDirPath = tryCatch(
      () => path.resolve(args["path"] ?? args["p"]),
      (e) => {
        if (args["debug"]) console.log(e);
        console.log("You need to specify a proper path !");
      }
    );
    if (!resolvedDirPath) return;

    let key = tryCatch(
      () => path.resolve(args["key"] ?? args["k"]),
      (e) => {
        if (args["debug"]) console.log(e);
        console.log(
          "You need to specify a key a proper to decrypt the files with !"
        );
      }
    );
    if (!key) return;

    let encryption = new Encryption(key);

    console.log("Reading directory...");
    let dir = await new Tree(resolvedDirPath).toObject();
    if (!dir) return console.log("Failed to read directory !");
    console.log(
      `Found ${loopThroughDirToFindNumberOfEntries(dir.items)} items.`
    );

    let parsedDirPath = path.parse(resolvedDirPath);
    let decryptedDirPath = path.join(
      parsedDirPath.dir,
      encryption
        .decrypt(Buffer.from(parsedDirPath.base, "base64url"))
        .toString()
    );

    try {
      await fs.mkdir(decryptedDirPath);
    } catch (e) {
      if (args["debug"]) console.log(e);
    }

    let loopThroughDir = (items: ItemArray, parentPath: string) => {
      items.map(async (i) => {
        let itemPath = path.join(
          parentPath,
          encryption.decrypt(Buffer.from(i.name, "base64url")).toString()
        );
        if (i.type === ItemTypes.Dir) {
          try {
            await fs.mkdir(itemPath);
          } catch (e) {
            if (args["debug"]) console.log(e);
          }
          loopThroughDir(i.items, itemPath);
        } else {
          await fs.writeFile(itemPath, encryption.decryptFile(i.path));
        }
      });
    };
    loopThroughDir(dir.items, decryptedDirPath);

    console.log("Done.");
  },
});

export default commands;

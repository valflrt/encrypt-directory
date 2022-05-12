import fs from "fs/promises";
import path from "path";

import { Encryption } from "../encryption";
import { ItemArray, ItemTypes, Tree } from "../tree";
import {
  getArgs,
  loopThroughDirToFindNumberOfEntries,
  tryCatch,
} from "../utils";

export default {
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
    let dir = await new Tree(resolvedDirPath).toObject().catch((e) => {
      if (args["debug"]) console.log(e);
      console.log("Failed to read directory !");
    });
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

    let loopThroughDir = (items: ItemArray, parentPath: string) => {
      return Promise.all(
        items.map(async (i) => {
          let newItemPath = path.join(
            parentPath,
            encryption.encrypt(Buffer.from(i.name)).toString("base64url")
          );
          if (i.type === ItemTypes.Dir) {
            try {
              await fs.mkdir(newItemPath);
            } catch (e) {
              if (args["debug"]) console.log(e);
            }
            loopThroughDir(i.items, newItemPath);
          } else {
            await fs.writeFile(
              newItemPath,
              encryption
                .encrypt(await fs.readFile(i.path))
                .toString("base64url"),
              "utf8"
            );
          }
        })
      );
    };
    await loopThroughDir(dir.items, encryptedDirPath);

    console.log("Done.");
  },
};

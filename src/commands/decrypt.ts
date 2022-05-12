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
    let dir = await new Tree(resolvedDirPath).toObject().catch((e) => {
      if (args["debug"]) console.log(e);
      console.log("Failed to read directory !");
    });
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
      return Promise.all(
        items.map(async (i) => {
          let newItemPath = path.join(
            parentPath,
            encryption.decrypt(Buffer.from(i.name, "base64url")).toString()
          );
          if (i.type === ItemTypes.Dir) {
            try {
              await fs.mkdir(newItemPath);
            } catch (e) {
              if (args["debug"]) console.log(e);
            }
            await loopThroughDir(i.items, newItemPath);
          } else {
            await fs.writeFile(
              newItemPath,
              encryption.decrypt(
                Buffer.from(await fs.readFile(i.path, "utf8"), "base64url")
              )
            );
          }
        })
      );
    };
    await loopThroughDir(dir.items, decryptedDirPath);

    console.log("Done.");
  },
};

import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";

import { Encryption } from "../encryption";
import { ItemArray, ItemTypes, Tree } from "../tree";
import { getArgs, tryCatch } from "../utils";
import { loopThroughDirToFindNumberOfEntries } from "../misc";

import { Command } from ".";

let decrypt: Command = {
  name: "decrypt",
  aliases: ["d"],
  description: "Decrypts an encrypted directory",
  arguments: [
    { name: "path", description: "Path of the encrypted directory to decrypt" },
    {
      name: "key",
      description: "Key used to decrypt",
    },
  ],

  execute: async () => {
    let args = getArgs();

    let resolvedDirPath = tryCatch(
      () => path.resolve(args._[1]),
      (e) => {
        if (args["debug"]) console.log(e);
        console.log("You need to specify a proper path !");
      }
    );
    if (!resolvedDirPath) return;

    let key = args._[2];
    if (!key) return console.error("You need to specify a proper key !");

    let encryption = new Encryption(key);

    console.log("Reading directory...");
    let dir = await new Tree(resolvedDirPath).toObject().catch((e) => {
      if (args["debug"]) console.log(e);
      console.error("Failed to read directory !");
    });
    if (!dir) return console.error("Failed to read directory !");

    let decryptedDirPath = resolvedDirPath
      .replace(".encrypted", "")
      .concat(".decrypted");
    if (fs.existsSync(decryptedDirPath))
      return console.error(
        `Error: The decrypted directory already exists. Please delete it and try again.\n(path: ${decryptedDirPath})`
      );

    fsPromises
      .mkdir(decryptedDirPath)
      .catch((e) =>
        console.error(`Error while creating base directory:\n${e}`)
      );

    console.log(
      `Found ${loopThroughDirToFindNumberOfEntries(dir.items)} items.`
    );

    let loopThroughDir = async (items: ItemArray, parentPath: string) => {
      await Promise.all(
        items.map(async (i) => {
          let newItemPath = path.join(
            parentPath,
            encryption.decrypt(Buffer.from(i.name, "base64url")).toString()
          );
          if (i.type === ItemTypes.Dir) {
            await fsPromises
              .mkdir(newItemPath, { recursive: true })
              .then(() => loopThroughDir(i.items, newItemPath))
              .catch((e) => {
                throw e;
              });
          } else {
            await fsPromises
              .writeFile(
                newItemPath,
                encryption.decrypt(
                  Buffer.from(fs.readFileSync(i.path, "utf8"), "base64url")
                )
              )
              .catch((e) => {
                throw e;
              });
          }
        })
      );
    };
    try {
      await loopThroughDir(dir.items, decryptedDirPath);
    } catch (e) {
      return console.error(`Error while decrypting:\n${e}`);
    }

    console.log("Done.");
  },
};

export default decrypt;

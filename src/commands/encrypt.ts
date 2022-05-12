import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";

import { Encryption } from "../encryption";
import { ItemArray, ItemTypes, Tree } from "../tree";

import { FrameTypes, Loader } from "../loader";
import { getArgs, tryCatch } from "../utils";
import { loopThroughDirToFindNumberOfEntries } from "../misc";

import { Command } from ".";

let encrypt: Command = {
  name: "encrypt",
  aliases: ["e"],
  description: "Encrypts a directory",
  arguments: [
    { name: "path", description: "Path of the directory to encrypt" },
    {
      name: "key",
      description: "Key used to encrypt",
    },
  ],

  execute: async () => {
    let args = getArgs();

    let resolvedDirPath = tryCatch(
      () => path.resolve(args._[1]),
      (e) => {
        if (args["debug"]) console.log(e);
        console.error("You need to specify a proper path !");
      }
    );
    if (!resolvedDirPath) return;
    if (!fs.existsSync(resolvedDirPath))
      return console.error(
        `The item pointed by this path doesn't exist !\n(path: ${resolvedDirPath})`
      );

    let key = args._[2];
    if (!key) return console.error("You need to specify a proper key !");

    let encryption = new Encryption(key);

    console.log("Reading directory...");
    let dir = await new Tree(resolvedDirPath).toObject().catch((e) => {
      if (args["debug"]) console.log(e);
      console.log("Failed to read directory !");
    });
    if (!dir) return console.log("Failed to read directory !");

    let encryptedDirPath = resolvedDirPath.concat(".encrypted");
    if (fs.existsSync(encryptedDirPath))
      return console.error(
        `Error: The encrypted directory already exists. Please delete it and try again.\n(path: ${encryptedDirPath})`
      );

    fsPromises
      .mkdir(encryptedDirPath)
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
            encryption.encrypt(Buffer.from(i.name)).toString("base64url")
          );
          if (i.type === ItemTypes.Dir) {
            await fsPromises
              .mkdir(newItemPath)
              .then(() => loopThroughDir(i.items, newItemPath))
              .catch((e) => {
                throw e;
              });
          } else {
            await fsPromises
              .writeFile(
                newItemPath,
                encryption
                  .encrypt(fs.readFileSync(i.path))
                  .toString("base64url"),
                "utf8"
              )
              .catch((e) => {
                throw e;
              });
          }
        })
      );
    };
    try {
      let loader = new Loader(FrameTypes.Type0);
      loader.start();
      await loopThroughDir(dir.items, encryptedDirPath).then(() =>
        loader.stop()
      );
    } catch (e) {
      return console.error(`Error while encrypting:\n${e}`);
    }

    console.log("Done.");
  },
};

export default encrypt;

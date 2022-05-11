import minimist from "minimist";
import fs from "fs/promises";
import path from "path";

import { Encryption } from "./encryption";
import { Tree } from "./tree";
import { tryCatch } from "./utils";

export interface Command {
  name: string;
  matches: string[];
  execute: (args: minimist.ParsedArgs) => any;
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
  execute: async (args) => {
    let resolvedPath = tryCatch(
      () => path.resolve(args["path"] ?? args["p"]),
      (e) => {
        if (args["debug"]) console.log(e);
        console.log("You need to specify a proper path !");
      }
    );
    if (!resolvedPath) return;

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

    console.log("Reading directory...");
    let tree = (await new Tree(resolvedPath).toFlatArray())?.filter(
      (i) => !i.path.endsWith(".encrypted")
    );
    if (!tree) return console.log("Failed to read directory !");
    console.log(`Found ${tree.length} items.`);

    let encryption = new Encryption(key);

    tree.forEach((i) => {
      fs.writeFile(i.path.concat(".encrypted"), encryption.encryptFile(i.path));
    });

    console.log("Done.");
  },
});

commands.push({
  name: "decrypt",
  matches: ["decrypt", "d"],
  execute: async (args) => {
    let resolvedPath = tryCatch(
      () => path.resolve(args["path"] ?? args["p"]),
      (e) => {
        if (args["debug"]) console.log(e);
        console.log("You need to specify a proper path !");
      }
    );
    if (!resolvedPath) return;

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

    console.log("Reading directory...");
    let tree = (await new Tree(resolvedPath).toFlatArray())?.filter((i) =>
      i.path.endsWith(".encrypted")
    );
    if (!tree) return console.log("Failed to read directory !");
    console.log(`Found ${tree.length} items.`);

    let encryption = new Encryption(key);

    tree.forEach((i) => {
      fs.writeFile(
        i.path.replace(".encrypted", ""),
        encryption.decryptFile(i.path)
      );
    });

    console.log("Done.");
  },
});

export default commands;

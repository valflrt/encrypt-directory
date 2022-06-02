import program from "../program";

import { gzip } from "node-gzip";

import fs from "fs/promises";
import { existsSync } from "fs";
import pathProgram from "path";

import { Encryption } from "../encryption";
import { ItemArray, ItemTypes, Tree } from "../tree";

import { Loader } from "../loader";

export default program
  .command("encrypt")
  .aliases(["e"])
  .description("encrypts a file/directory")
  .argument("<path>", "path of the file/directory to encrypt")
  .argument("<key>", "key used to encrypt")
  .option("-o, --output [path]", "path of the output directory or file")
  .option("--no-compression", "do not use compression")
  .option(
    "--compression-level [compression level]",
    "custom compression level (1-9)",
    "4"
  )
  .option("-D, --debug", "debug mode")
  .action(async (path, key, options) => {
    try {
      // Resolves the given path
      let resolvedItemPath;
      try {
        resolvedItemPath = pathProgram.resolve(path);
      } catch (e) {
        if (options.debug) console.log(e);
        program.error("error: Invalid path !");
        return;
      }

      // Checks if the item exists
      if (!existsSync(resolvedItemPath)) {
        program.error(
          `error: The item pointed by this path doesn't exist !\n(path: ${resolvedItemPath})`
        );
        return;
      }

      // Creates an Encryption instance
      let encryption = new Encryption(key);

      let itemStats = await fs.stat(resolvedItemPath);
      if (itemStats.isDirectory()) {
        console.log("Reading directory...");

        // Generates directory tree
        let dir;
        try {
          dir = await new Tree(resolvedItemPath).toObject();
          if (dir === null) {
            program.error("error: Failed to read directory !");
            return;
          }
        } catch (e) {
          if (options.debug) console.log(e);
          program.error("error: Failed to read directory !");
          return;
        }

        let outputPath;
        try {
          outputPath = options.output
            ? pathProgram.resolve(options.output)
            : resolvedItemPath.concat(".encrypted");
        } catch (e) {
          if (options.debug) console.error(e);
          program.error("error: Failed to resolve given output path");
          return;
        }
        // Checks if the "encrypted" directory already exists
        if (existsSync(outputPath)) {
          program.error(
            `error: The encrypted directory already exists. Please delete it and try again.\n(path: ${outputPath})`
          );
          return;
        }

        // Creates base directory (typically [name of the dir to encrypt].encrypted)
        try {
          await fs.mkdir(outputPath);
        } catch (e) {
          if (options.debug) console.log(e);
          program.error(`error: Failed to create base directory`);
          return;
        }

        // Counts number of items in the directory
        console.log(`Found ${Tree.getNumberOfEntries(dir)} items.`);

        // Recursion function to encrypt each file in the directory
        let loopThroughDir = async (items: ItemArray, parentPath: string) => {
          await Promise.all(
            items.map(async (i) => {
              // Creates item path
              let newItemPath = pathProgram.join(
                parentPath,
                encryption
                  .encrypt(
                    options.compression
                      ? await gzip(Buffer.from(i.name), {
                          level: Number.parseInt(options.compressionLevel),
                        })
                      : Buffer.from(i.name)
                  )
                  .toString("base64url")
              );

              if (i.type === ItemTypes.Dir) {
                await fs.mkdir(newItemPath);
                loopThroughDir(i.items, newItemPath);
              } else {
                await fs.writeFile(
                  newItemPath,
                  encryption
                    .encrypt(
                      options.compression
                        ? await gzip(await fs.readFile(i.path), {
                            level: Number.parseInt(options.compressionLevel),
                          })
                        : await fs.readFile(i.path)
                    )
                    .toString("base64url"),
                  "utf8"
                );
              }
            })
          );
        };

        console.log("Encrypting directory...");

        // Loading animation
        let loader = new Loader({
          text: "[loader]  Encrypting directory...",
          now: true,
        });

        try {
          await loopThroughDir(dir.items, outputPath);
          loader.stop();
        } catch (e) {
          if (options.debug) console.error(e);
          program.error(`Error while encrypting`);
          return;
        }
      } else if (itemStats.isFile()) {
        // Creates output path
        let newItemPath;
        try {
          newItemPath = options.output
            ? pathProgram.resolve(options.output)
            : resolvedItemPath.concat(".encrypted");
        } catch (e) {
          if (options.debug) console.error(e);
          program.error("error: Failed to resolve given output path");
          return;
        }

        // Loading animation
        let loader = new Loader({
          text: "[loader]  Encrypting file...",
          now: true,
        });

        try {
          await fs.writeFile(
            newItemPath,
            encryption
              .encrypt(
                options.compression
                  ? await gzip(await fs.readFile(resolvedItemPath), {
                      level: Number.parseInt(options.compressionLevel),
                    })
                  : await fs.readFile(resolvedItemPath)
              )
              .toString("base64url"),
            "utf8"
          );
          loader.stop();
        } catch (e) {
          loader.stop();
          if (options.debug) console.error(e);
          program.error(`Error while encrypting`);
          return;
        }
      } else {
        program.error(
          "error: This program only supports files and directories"
        );
        return;
      }

      console.log("Done");
    } catch (e) {
      if (options.debug) console.log(e);
      program.error(
        "error: Unknown error occurred (rerun with --debug for debug information)"
      );
      return;
    }
  });

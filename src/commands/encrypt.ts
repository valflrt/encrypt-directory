import program from "../program";

import { gzip } from "node-gzip";

import fs from "fs/promises";
import { existsSync } from "fs";
import pathProgram from "path";

import { Encryption } from "../encryption";
import { ItemArray, ItemTypes, Tree } from "../tree";

import { Loader } from "../loader";
import Logger from "../logger";

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
  .action(async (path, key, options, cmd) => {
    let logger = new Logger(cmd.optsWithGlobals());

    logger.info("Given options:", cmd.optsWithGlobals());

    try {
      // Resolves the given path
      let resolvedItemPath;
      try {
        resolvedItemPath = pathProgram.resolve(path);
      } catch (e) {
        if (cmd.optsWithGlobals().debug) console.error(e);
        logger.error("Invalid path !");
        process.exit(0);
        return;
      }

      // Checks if the item exists
      if (!existsSync(resolvedItemPath)) {
        // TODO: replace
        program.error(
          `Error: The item pointed by this path doesn't exist !\n(path: ${resolvedItemPath})`
        );
        return;
      }

      // Creates an Encryption instance
      let encryption = new Encryption(key);

      // Custom encrypt function changing depending on options
      let encrypt = async (value: Buffer) => {
        return options.compression
          ? encryption.encrypt(
              await gzip(Buffer.from(value), {
                level: Number.parseInt(options.compressionLevel),
              })
            )
          : encryption.encrypt(Buffer.from(value));
      };

      // Check if the item is a directory, a file or something else
      let itemStats = await fs.stat(resolvedItemPath);
      if (itemStats.isDirectory()) {
        console.log("Reading directory...");

        // Generates directory tree
        let dir;
        try {
          dir = await new Tree(resolvedItemPath).toObject();
          if (dir === null) {
            program.error("Failed to read directory !");
            return;
          }
        } catch (e) {
          if (cmd.optsWithGlobals().debug) console.error(e);
          program.error("Failed to read directory !");
          return;
        }

        let outputPath;
        try {
          outputPath = options.output
            ? pathProgram.resolve(options.output)
            : resolvedItemPath.concat(".encrypted");
        } catch (e) {
          if (cmd.optsWithGlobals().debug) console.error(e);
          program.error("Failed to resolve given output path");
          return;
        }
        // Checks if the "encrypted" directory already exists
        if (existsSync(outputPath)) {
          program.error(
            `Error: The encrypted directory already exists. Please delete it and try again.\n(path: ${outputPath})`
          );
          return;
        }

        // Creates base directory (typically [name of the dir to encrypt].encrypted)
        try {
          await fs.mkdir(outputPath);
        } catch (e) {
          if (cmd.optsWithGlobals().debug) console.error(e);
          program.error("Failed to create base directory");
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
                (await encrypt(Buffer.from(i.name))).toString("base64url")
              );

              if (i.type === ItemTypes.Dir) {
                await fs.mkdir(newItemPath);
                loopThroughDir(i.items, newItemPath);
              } else if (i.type === ItemTypes.File) {
                if (cmd.optsWithGlobals().verbose)
                  console.log(
                    "- encrypting file\n"
                      .concat(`  from "${i.path}"\n`)
                      .concat(`  to "${newItemPath}"`)
                  );
                await fs.writeFile(
                  newItemPath,
                  (
                    await encrypt(await fs.readFile(i.path))
                  ).toString("base64url"),
                  "utf8"
                );
              }
            })
          );
        };

        // Loading animation
        let loader = new Loader({
          text: "[loader]  Encrypting directory...",
          manualStart: cmd.optsWithGlobals().verbose ? true : false,
        });

        try {
          await loopThroughDir(dir.items, outputPath);
          loader.stop();
        } catch (e) {
          if (cmd.optsWithGlobals().debug) console.error(e);
          program.error("Error while encrypting");
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
          if (cmd.optsWithGlobals().debug) console.error(e);
          program.error("Failed to resolve given output path");
          return;
        }

        if (cmd.optsWithGlobals().verbose)
          console.log(
            "- encrypting file\n"
              .concat(`  from "${resolvedItemPath}"\n`)
              .concat(`  to "${newItemPath}"`)
          );

        // Loading animation
        let loader = new Loader({
          text: "[loader]  Encrypting file...",
          manualStart: cmd.optsWithGlobals().verbose ? true : false,
        });

        try {
          await fs.writeFile(
            newItemPath,
            (
              await encrypt(await fs.readFile(resolvedItemPath))
            ).toString("base64url"),
            "utf8"
          );
          loader.stop();
        } catch (e) {
          loader.stop();
          if (cmd.optsWithGlobals().debug) console.error(e);
          program.error("Error while encrypting");
          return;
        }
      } else {
        program.error("This program only supports files and directories");
        return;
      }

      console.log("Done");
    } catch (e) {
      if (cmd.optsWithGlobals().debug) console.error(e);
      program.error(
        "Unknown error occurred (rerun with --debug for debug information)"
      );
      return;
    }
  });

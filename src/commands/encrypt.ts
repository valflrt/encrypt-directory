import { Command } from "commander";

import fs, { existsSync } from "fs";
import fsAsync from "fs/promises";
import pathProgram from "path";

import { Encryption } from "../encryption";
import { ItemArray, ItemTypes, Tree } from "../tree";

import { Loader } from "../loader";
import Logger from "../logger";

export default new Command("encrypt")
  .aliases(["e"])
  .description("encrypts a file/directory")

  .argument("<path>", "path of the file/directory to encrypt")
  .argument("<key>", "key used to encrypt")

  .option("-o, --output [path]", "path of the output directory or file")
  .option(
    "--plain-names",
    "keep file and directory names plain, do not encrypt them",
    false
  )

  .action(async (path, key, options, cmd) => {
    let globalOptions = cmd.optsWithGlobals();

    let logger = new Logger(globalOptions);

    logger.debugOnly.debug("Given options:", globalOptions);

    try {
      // Resolves the given path
      let resolvedItemPath: string;
      try {
        resolvedItemPath = pathProgram.resolve(path);
      } catch (e) {
        logger.debugOnly.error(e);
        logger.error("Invalid path !");
        process.exit();
      }

      // Checks if the item exists
      if (!existsSync(resolvedItemPath)) {
        logger.error(
          `The item pointed by this path doesn't exist !\n(path: ${resolvedItemPath})`
        );
        process.exit();
      }

      // Creates an Encryption instance
      let encryption = new Encryption(key);

      /**
       * Check if the item is a directory, a file or
       * something else
       */
      let itemStats = await fsAsync.stat(resolvedItemPath);
      if (itemStats.isDirectory()) {
        logger.info("Reading directory...");

        // Generates directory tree
        let dir;
        try {
          dir = await new Tree(resolvedItemPath).toObject();
          if (dir === null) {
            logger.error("Failed to read directory !");
            process.exit();
          }
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error("Failed to read directory !");
          process.exit();
        }

        let outputPath;
        try {
          outputPath = options.output
            ? pathProgram.resolve(options.output)
            : resolvedItemPath.concat(".encrypted");
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error("Failed to resolve given output path");
          process.exit();
        }
        // Checks if the "encrypted" directory already exists
        if (existsSync(outputPath)) {
          logger.error(
            `The encrypted directory already exists. Please delete it and try again.\n(path: ${outputPath})`
          );
          process.exit();
        }

        // Creates base directory (typically [name of the dir to encrypt].encrypted)
        try {
          await fsAsync.mkdir(outputPath);
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error("Failed to create base directory");
          process.exit();
        }

        // Counts number of items in the directory
        logger.info(`Found ${Tree.getNumberOfEntries(dir)} items.`);

        /**
         * Recursion function to encrypt each file in the
         * directory
         * @param items Items from Dir object
         * @param parentPath Path of the parent directory
         */
        let loopThroughDir = async (items: ItemArray, parentPath: string) => {
          await Promise.all(
            items.map(async (i) => {
              // Creates item path
              let newItemPath = pathProgram.join(
                parentPath,
                !options.plainNames
                  ? encryption
                      .encrypt(Buffer.from(i.name))
                      .toString("base64url")
                  : i.name
              );

              if (i.type === ItemTypes.Dir) {
                await fsAsync.mkdir(newItemPath, { recursive: true });
                loopThroughDir(i.items, newItemPath);
              } else if (i.type === ItemTypes.File) {
                logger.debugOrVerboseOnly.info(
                  "- encrypting file\n"
                    .concat(`  from "${i.path}"\n`)
                    .concat(`  to "${newItemPath}"`)
                );
                await new Promise((resolve, reject) =>
                  encryption
                    .encryptStream(fs.createReadStream(i.path))
                    .pipe(fs.createWriteStream(newItemPath))
                    .on("finish", resolve)
                    .on("error", reject)
                );
              }
            })
          );
        };

        // Loading animation
        let loader = new Loader({
          text: "[loader]  Encrypting directory...",
          manualStart: globalOptions.verbose ? true : false,
        });

        try {
          await loopThroughDir(dir.items, outputPath);
          loader.stop();
        } catch (e) {
          loader.stop();
          logger.debugOnly.error(e);
          logger.error("Error while encrypting");
          process.exit();
        }
      } else if (itemStats.isFile()) {
        // Creates output path
        let newItemPath: string;
        try {
          newItemPath = options.output
            ? pathProgram.resolve(options.output)
            : resolvedItemPath.concat(".encrypted");
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error("Failed to resolve given output path");
          process.exit();
        }

        // Checks if the item already exists
        if (!existsSync(resolvedItemPath)) {
          logger.error(
            `The item pointed by this path doesn't exist !\n(path: ${resolvedItemPath})`
          );
          process.exit();
        }

        logger.debugOrVerboseOnly.info(
          "- encrypting file\n"
            .concat(`  from "${resolvedItemPath}"\n`)
            .concat(`  to "${newItemPath}"`)
        );

        // Loading animation
        let loader = new Loader({
          text: "[loader]  Encrypting file...",
          manualStart: globalOptions.verbose ? true : false,
        });

        try {
          await new Promise((resolve, reject) =>
            encryption
              .encryptStream(fs.createReadStream(resolvedItemPath))
              .pipe(fs.createWriteStream(newItemPath))
              .on("finish", resolve)
              .on("error", reject)
          );
          loader.stop();
        } catch (e) {
          loader.stop();
          logger.debugOnly.error(e);
          logger.error("Error while encrypting");
          process.exit();
        }
      } else {
        logger.error("This program only supports files and directories");
        process.exit();
      }

      logger.success("Done");
    } catch (e) {
      logger.debugOnly.error(e);
      logger.error(
        "Unknown error occurred (rerun with --debug for debug information)"
      );
      process.exit();
    }
  });

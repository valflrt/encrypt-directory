import { Command } from "commander";

import fs, { existsSync } from "fs";
import fsAsync from "fs/promises";
import pathProgram from "path";

import Encryption from "../encryption";
import Tree, { ItemArray, ItemTypes } from "../tree";

import Logger from "../logger";
import Timer from "../timer";

export default new Command("decrypt")
  .aliases(["d"])
  .description("decrypt an encrypted file/directory")

  .argument("<path>", "path of the directory to decrypt")
  .argument("<key>", "key used to decrypt")

  .option("-o, --output [path]", "set a custom output path")
  .option(
    "-n, --plain-names",
    "keep file and directory names plain, do not encrypt them",
    false
  )

  .action(async (path, key, options, cmd) => {
    let globalOptions = cmd.optsWithGlobals();
    let logger = new Logger(globalOptions);
    let timer = new Timer();

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

        let outputPath: string;
        try {
          outputPath = options.output
            ? pathProgram.resolve(options.output)
            : resolvedItemPath.replace(".encrypted", "").concat(".decrypted");
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error("Failed to resolve given output path");
          process.exit();
        }
        // Checks if the "decrypted" directory already exists
        if (existsSync(outputPath)) {
          logger.error(
            `The decrypted directory already exists. Please delete it and try again.\n(path: ${outputPath})`
          );
          process.exit();
        }

        // Creates base directory (typically [name of the dir to decrypt].decrypted)
        try {
          await fsAsync.mkdir(outputPath);
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error("Failed to create base directory");
          process.exit();
        }

        // Counts number of items in the directory
        logger.info(`Found ${Tree.getNumberOfEntries(dir)} items.`);

        // A function to clean, here remove output directory
        let clean = () =>
          fsAsync.rm(outputPath, { recursive: true, force: true });

        /**
         * Recursion function to decrypt all the files in
         * the directory
         * @param items Items from Dir object
         * @param parentPath Path of the parent directory
         */
        let loopThroughDir = (items: ItemArray, parentPath: string) =>
          Promise.all(
            items.map(async (i) => {
              // Creates item path
              let newItemPath = pathProgram.join(
                parentPath,
                !options.plainNames
                  ? encryption
                      .decrypt(Buffer.from(i.name, "base64url"))
                      .toString("utf8")
                  : i.name
              );

              if (i.type === ItemTypes.Dir) {
                await fsAsync.mkdir(newItemPath, { recursive: true });
                await loopThroughDir(i.items, newItemPath);
              } else if (i.type === ItemTypes.File) {
                logger.debugOrVerboseOnly.info(
                  "- decrypting file\n"
                    .concat(`  from "${i.path}"\n`)
                    .concat(`  to "${newItemPath}"`)
                );
                try {
                  await encryption.decryptStream(
                    fs.createReadStream(i.path),
                    fs.createWriteStream(newItemPath)
                  );
                } catch (e) {
                  logger.debugOnly.error(e);
                  logger.error(
                    "Failed to decrypt, the given key might be wrong."
                  );
                  await clean();
                  process.exit();
                }
              }
            })
          );

        logger.info("Decrypting...");

        try {
          timer.start();
          await loopThroughDir(dir.items, outputPath);
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error(
            "Error while decrypting, the given key might be wrong or the directory you are trying to decrypt might not be a valid encrypted directory"
          );
          await clean();
          process.exit();
        }
      } else if (itemStats.isFile()) {
        // Creates output path
        let newItemPath: string;
        try {
          newItemPath = options.output
            ? pathProgram.resolve(options.output)
            : resolvedItemPath.replace(".encrypted", "").concat(".decrypted");
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

        logger.info("Decrypting...");

        try {
          timer.start();
          await encryption.decryptStream(
            fs.createReadStream(resolvedItemPath),
            fs.createWriteStream(newItemPath)
          );
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error(
            "Error while decrypting, the given key might be wrong or the file you are trying to decrypt might not be a valid encrypted file"
          );
          process.exit();
        }
      } else {
        logger.error("This program only supports files and directories");
        process.exit();
      }
    } catch (e) {
      logger.debugOnly.error(e);
      logger.error(
        "Unknown error occurred (rerun with --debug for debug information)"
      );
      process.exit();
    } finally {
      logger.success(`Done (in ${timer.elapsedTime}ms)`);
    }
  });

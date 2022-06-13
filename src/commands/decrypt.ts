import { Command } from "commander";

import fs, { existsSync } from "fs";
import fsAsync from "fs/promises";
import pathProgram from "path";

import Encryption from "../encryption";
import Tree, { ItemArray, ItemTypes } from "../tree";
import Quantify from "../quantify";

import Logger from "../logger";
import Timer from "../timer";

export default new Command("decrypt")
  .aliases(["d"])
  .description("decrypt an encrypted file/directory")

  .argument("<path>", "path of the directory to decrypt")
  .argument("<key>", "key used to decrypt")

  .option(
    "-f, --force",
    "force operation (overwrite the output directory if it already exists)",
    false
  )
  .option("-o, --output [path]", "set a custom output path")

  .action(async (rawInputPath, key, options, cmd) => {
    let globalOptions = cmd.optsWithGlobals();
    let logger = new Logger(globalOptions);
    let timer = new Timer();

    logger.debugOnly.debug("Given options:", globalOptions);

    try {
      // Tries to resolve the given path
      let inputPath: string;
      try {
        inputPath = pathProgram.resolve(rawInputPath);
      } catch (e) {
        logger.debugOnly.error(e);
        logger.error(`Invalid input path`);
        process.exit();
      }

      // Checks if the item exists
      if (!existsSync(inputPath)) {
        logger.error(`This item doesn't exist.\n(path: ${inputPath})`);
        process.exit();
      }

      // Creates an Encryption instance
      let encryption = new Encryption(key);

      /**
       * Check if the item is a directory, a file or
       * something else
       */
      let itemStats = await fsAsync.stat(inputPath);
      if (itemStats.isDirectory()) {
        // Generates directory tree
        let dir;
        try {
          dir = await new Tree(inputPath).toObject();
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error("Failed to read directory.");
          process.exit();
        }

        let outputPath: string;
        try {
          outputPath = options.output
            ? pathProgram.resolve(options.output)
            : inputPath.replace(".encrypted", "").concat(".decrypted");
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error("Failed to resolve given output path.");
          process.exit();
        }
        // Checks if the "decrypted" directory already exists
        if (existsSync(outputPath)) {
          if (options.force) {
            try {
              await fsAsync.rm(outputPath, { force: true, recursive: true });
            } catch (e) {
              logger.debugOnly.error(e);
              logger.error("Failed to overwrite the output directory.");
            }
          } else {
            logger.error(
              `The output directory already exists.\n(path: ${outputPath})`
            );
            process.exit();
          }
        }

        // Creates base directory (typically [name of the dir to decrypt].decrypted)
        try {
          await fsAsync.mkdir(outputPath);
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error("Failed to create base directory.");
          process.exit();
        }

        // A function to clean, here remove output directory
        let clean = async () => {
          try {
            await fsAsync.rm(outputPath, { recursive: true, force: true });
          } catch (e) {
            logger.debugOnly.error(e);
            logger.error("Failed to clean up.");
          }
        };

        // Reads config file
        let plainNames = false;
        try {
          let config = JSON.parse(
            (
              await fsAsync.readFile(
                pathProgram.join(inputPath, "_config.json")
              )
            ).toString("utf-8")
          );
          if (config.plainNames === true) plainNames = true;
          if (!encryption.validate(Buffer.from(config.test, "base64"))) {
            logger.error("Wrong key, you should be ashamed.");
            await clean();
            process.exit();
          }
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error("Failed to create config file.");
          process.exit();
        }

        // Counts number of items in the directory
        logger.info(
          `Found ${Tree.getNumberOfEntries(
            dir
          )} items (totalizing ${Quantify.parseNumber(dir.size)}B).`
        );

        /**
         * Recursion function to decrypt all the files in
         * the directory
         * @param items Items from Dir object
         * @param parentPath Path of the parent directory
         */
        let loopThroughDir = (items: ItemArray, parentPath: string) =>
          Promise.all(
            items.map(async (i) => {
              if (i.name === "_config.json") return;

              // Creates item path
              let newItemPath;
              newItemPath = pathProgram.join(
                parentPath,
                !plainNames
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
            "Error while decrypting, the given key might be wrong or the directory you are trying to decrypt might not be a valid encrypted directory."
          );
          await clean();
          process.exit();
        }
      } else if (itemStats.isFile()) {
        // Checks if the item already exists
        if (!existsSync(inputPath)) {
          logger.error(`This item doesn't exist.\n(path: ${inputPath})`);
          process.exit();
        }

        // Creates output path
        let outputPath: string;
        try {
          outputPath = options.output
            ? pathProgram.resolve(options.output)
            : inputPath.replace(".encrypted", "").concat(".decrypted");
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error("Failed to resolve given output path.");
          process.exit();
        }
        // Checks if the "decrypted" file already exists
        if (existsSync(outputPath)) {
          if (options.force) {
            try {
              await fsAsync.rm(outputPath);
            } catch (e) {
              logger.debugOnly.error(e);
              logger.error("Failed to overwrite the output file.");
              process.exit();
            }
          } else {
            logger.error(
              `The output file already exists.\n(path: ${outputPath})`
            );
            process.exit();
          }
        }

        if (
          !(await encryption.validateStream(fs.createReadStream(inputPath)))
        ) {
          logger.error("Wrong key, you should be ashamed.");
          process.exit();
        }

        let fileStats;
        try {
          fileStats = await fsAsync.stat(inputPath);
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error("Failed to read file details.");
          process.exit();
        }

        logger.debugOrVerboseOnly.info(
          "- encrypting file\n"
            .concat(`  from "${inputPath}"\n`)
            .concat(`  to "${outputPath}"`)
        );

        logger.info(
          `The file to decrypt is ${Quantify.parseNumber(fileStats.size)}B`
        );

        logger.info("Decrypting...");

        try {
          timer.start();
          await encryption.decryptStream(
            fs.createReadStream(inputPath),
            fs.createWriteStream(outputPath)
          );
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error(
            "Error while decrypting, the given key might be wrong or the file you are trying to decrypt might not be a valid encrypted file."
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
        "Unknown error occurred. (rerun with --verbose to get more information)"
      );
      process.exit();
    } finally {
      logger.success(`Done (in ${timer.elapsedTime}ms)`);
    }
  });

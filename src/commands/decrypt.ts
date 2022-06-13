import { Command } from "commander";

import fs, { existsSync } from "fs";
import fsAsync from "fs/promises";
import pathProgram from "path";

import Encryption from "../Encryption";
import Tree, { ItemArray, ItemTypes } from "../Tree";
import FileSize from "../FileSize";

import Logger from "../Logger";
import Timer from "../Timer";

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

    timer.start();

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
        let flatDir;
        try {
          let tree = new Tree(inputPath);
          dir = await tree.toObject();
          flatDir = await tree.toFlatArray();
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

        logger.info("Validating files...");

        // checks if every file in the directory is valid
        let allValid = (
          await Promise.all(
            flatDir.map((i) =>
              encryption.validateStream(fs.createReadStream(i.path))
            )
          )
        ).every((i) => !!i);
        if (!allValid) {
          logger.error(
            "Invalid files might have been found or the given key is wrong."
          );
          await clean();
          process.exit();
        } else
          logger.info(
            `All files are valid, found ${Tree.getNumberOfFiles(
              dir
            )} items (totalizing ${new FileSize(dir.size)}).`
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
              // Creates item path
              let newItemPath = pathProgram.join(
                parentPath,
                encryption
                  .decrypt(Buffer.from(i.name, "base64url"))
                  .toString("utf8")
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
                await encryption.decryptStream(
                  fs.createReadStream(i.path),
                  fs.createWriteStream(newItemPath)
                );
              }
            })
          );

        logger.info("Decrypting...");

        try {
          await loopThroughDir(dir.items, outputPath);
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error("Error while decrypting.");
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

        // Validates file
        if (
          !(await encryption.validateStream(fs.createReadStream(inputPath)))
        ) {
          logger.error("Invalid file or wrong key.");
          process.exit();
        }

        // Reads file information
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

        logger.info(`The file to decrypt is ${new FileSize(fileStats.size)}`);

        logger.info("Decrypting...");

        try {
          await encryption.decryptStream(
            fs.createReadStream(inputPath),
            fs.createWriteStream(outputPath)
          );
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error("Error while decrypting.");
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

import program from "../program";

import { ungzip } from "node-gzip";

import fs from "fs/promises";
import { existsSync } from "fs";
import pathProgram from "path";

import { Encryption } from "../encryption";
import { ItemArray, ItemTypes, Tree } from "../tree";

import { Loader } from "../loader";
import Logger from "../logger";

export default program
  .command("decrypt")
  .aliases(["d"])
  .description("decrypts an encrypted file/directory")
  .argument("<path>", "path of the encrypted directory to decrypt")
  .argument("<key>", "key used to decrypt")
  .option("-o, --output [path]", "path of the output directory or file")
  .option("--no-compression", "do not use compression")
  .option(
    "--compression-level [compression level]",
    "custom compression level (1-9)",
    "4"
  )
  .action(async (path, key, options, cmd) => {
    let globalOptions = cmd.optsWithGlobals();

    let logger = new Logger(globalOptions);

    logger.debugOnly.debug("Given options:", globalOptions);

    try {
      // Resolves the given path
      let resolvedItemPath;
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
       * Custom decrypt function changing depending on given
       * cli options
       * @param buffer Buffer to decrypt
       */
      let decrypt = async (buffer: Buffer) => {
        return options.compression
          ? await ungzip(encryption.decrypt(buffer), {
              level: Number.parseInt(options.compressionLevel),
            })
          : encryption.decrypt(buffer);
      };

      /**
       * Check if the item is a directory, a file or
       * something else
       */
      let itemStats = await fs.stat(resolvedItemPath);
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
          await fs.mkdir(outputPath);
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error("Failed to create base directory");
          process.exit();
        }

        // Counts number of items in the directory
        logger.info(`Found ${Tree.getNumberOfEntries(dir)} items.`);

        /**
         * Recursion function to decrypt each file in the
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
                (await decrypt(Buffer.from(i.name, "base64url"))).toString()
              );

              if (i.type === ItemTypes.Dir) {
                await fs.mkdir(newItemPath, { recursive: true });
                loopThroughDir(i.items, newItemPath);
              } else if (i.type === ItemTypes.File) {
                logger.debugOrVerboseOnly.info(
                  "- decrypting file\n"
                    .concat(`  from "${i.path}"\n`)
                    .concat(`  to "${newItemPath}"`)
                );
                await fs.writeFile(
                  newItemPath,
                  await decrypt(
                    Buffer.from(await fs.readFile(i.path, "utf8"), "base64url")
                  )
                );
              }
            })
          );
        };

        // Loading animation
        let loader = new Loader({
          text: "[loader]  Decrypting directory...",
          manualStart: globalOptions.verbose ? true : false,
        });

        try {
          await loopThroughDir(dir.items, outputPath);
          loader.stop();
        } catch (e) {
          loader.stop();
          logger.debugOnly.error(e);
          logger.error(
            "Error while decrypting\n".concat(
              "(The directory you are trying to decrypt might not be a valid encrypted directory)"
            )
          );
          process.exit();
        }
      } else if (itemStats.isFile()) {
        // Creates output path
        let newItemPath;
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

        // Loading animation
        let loader = new Loader({
          text: "[loader]  Decrypting file...",
          manualStart: globalOptions.verbose ? true : false,
        });

        try {
          await fs.writeFile(
            newItemPath,
            await decrypt(
              Buffer.from(
                await fs.readFile(resolvedItemPath, "utf8"),
                "base64url"
              )
            )
          );
          loader.stop();
        } catch (e) {
          loader.stop();
          logger.debugOnly.error(e);
          logger.error(
            "Error while decrypting\n".concat(
              "(The file you are trying to decrypt might not be a valid encrypted file)"
            )
          );
          process.exit();
        }
      } else {
        logger.error("This program only supports files and directories");
        process.exit();
      }

      logger.info("Done");
    } catch (e) {
      logger.debugOnly.error(e);
      logger.error(
        "Unknown error occurred (rerun with --debug for debug information)"
      );
      process.exit();
    }
  });

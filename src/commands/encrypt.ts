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
       * Custom encrypt function changing depending on given
       * cli options
       * @param buffer Buffer to encrypt
       */
      let encrypt = async (buffer: Buffer) => {
        return options.compression
          ? encryption.encrypt(
              await gzip(Buffer.from(buffer), {
                level: Number.parseInt(options.compressionLevel),
              })
            )
          : encryption.encrypt(Buffer.from(buffer));
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
          await fs.mkdir(outputPath);
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
                (await encrypt(Buffer.from(i.name))).toString("base64url")
              );

              if (i.type === ItemTypes.Dir) {
                await fs.mkdir(newItemPath, { recursive: true });
                loopThroughDir(i.items, newItemPath);
              } else if (i.type === ItemTypes.File) {
                logger.debugOrVerboseOnly.info(
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
          manualStart: globalOptions.verbose ? true : false,
        });

        try {
          await loopThroughDir(dir.items, outputPath);
          loader.stop();
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error("Error while encrypting");
          process.exit();
        }
      } else if (itemStats.isFile()) {
        // Creates output path
        let newItemPath;
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
          logger.debugOnly.error(e);
          logger.error("Error while encrypting");
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

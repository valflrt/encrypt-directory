import { Command } from "commander";
import fs, { existsSync } from "fs";
import fsAsync from "fs/promises";
import pathProgram from "path";
import throat from "throat";

import Encryption from "../Encryption";
import FileMap from "../FileMap";
import FileSize from "../FileSize";
import Logger from "../Logger";
import { Result } from "../Result";
import Timer from "../Timer";
import Tree from "../Tree";

import {
  cleanup,
  generateMd5Hash,
  getInexistantPaths,
  makeItem,
  parsePaths,
  randomKey,
} from "./logic";

export default new Command("encrypt")
  .aliases(["e"])
  .description("encrypt a file/directory")

  .argument("<paths...>", "path(s) of the item(s) to encrypt")
  .option(
    "-k, --key [key]",
    "key used to encrypt, if not provided, uses random key"
  )

  .option(
    "-f, --force",
    "force operation (overwrite the output item(s) if it already exists)",
    false
  )
  .option(
    "-o, --output [path]",
    "set a custom output path (only supported when one item to encrypt is given)"
  )

  .action(async (rawInputPaths: string[], options, cmd) => {
    let globalOptions = cmd.optsWithGlobals();
    let logger = new Logger(globalOptions);
    let timer = new Timer();

    logger.debugOnly.debug("Given options:", globalOptions);

    timer.start();

    try {
      logger.info("Started.");

      if (options.output && rawInputPaths.length > 1) {
        logger.error(
          "Output path can only be specified when encrypting one item only."
        );
        process.exit();
      }

      // If key is not given, uses random key
      if (!options.key) {
        options.key = randomKey();
        logger.info(
          `No given key, using a random key: "${options.key}". Make sure to keep it to a safe place !`
        );
      }

      // Creates an Encryption instance
      let encryption = new Encryption(options.key);

      // Resolves the given raw paths
      let inputPaths = parsePaths(...rawInputPaths).tryToUnpack((e) => {
        logger.debugOnly.error(e);
        logger.error(`Invalid input path`);
        process.exit();
      })!;

      // Checks if all the items exist
      let inexistantPaths = getInexistantPaths(...inputPaths);
      if (inexistantPaths.length !== 0) {
        logger.error(
          inexistantPaths.length === 1
            ? `This item named ${pathProgram.basename(
                inexistantPaths[0]
              )} doesn't exist.\n(full path: ${inexistantPaths[0]})`
            : `These items don't exist:\n`.concat(
                inexistantPaths
                  .map(
                    (p) => `  - ${pathProgram.basename(p)} (full path: ${p})`
                  )
                  .join("\n")
              )
        );
        process.exit();
      }

      /**
       * Loops through given paths (the cli arguments), runs
       * some checks and maps them.
       */
      let inputItems = await Promise.all(
        inputPaths.map(
          async (
            inputPath
          ): Promise<{
            type: "directory" | "file" | "unknown";
            inputPath: string;
            outputPath: string;
            tree?: Tree;
          }> => {
            // Reads current path stats
            let pathStats = await fsAsync.stat(inputPath);

            // Creates human addressed and readable item type
            let humanAddressedItemType = pathStats.isFile()
              ? "file"
              : pathStats.isDirectory()
              ? "directory"
              : "item";

            // Checks if the item exists
            if (!existsSync(inputPath)) {
              logger.error(
                `This ${humanAddressedItemType} doesn't exist.\n(path: ${inputPath})`
              );
              process.exit();
            }

            // Creates output path
            let outputPath = new Result<string>((resolve) =>
              resolve(
                options.output && rawInputPaths.length <= 1
                  ? pathProgram.resolve(options.output)
                  : inputPath.concat(".encrypted")
              )
            ).tryToUnpack((e) => {
              logger.debugOnly.error(e);
              logger.error("Failed to resolve given output path.");
              process.exit();
            })!;

            // Checks if the "encrypted" item already exists
            if (existsSync(outputPath)) {
              if (options.force) {
                await fsAsync
                  .rm(outputPath, {
                    force: true,
                    recursive: true,
                  })
                  .catch((e) => {
                    logger.debugOnly.error(e);
                    logger.error(
                      `Failed to overwrite the output ${humanAddressedItemType}.\n(path: ${outputPath})`
                    );
                  });
              } else {
                logger.error(
                  `The output ${
                    pathStats.isFile()
                      ? "file"
                      : pathStats.isDirectory()
                      ? "directory"
                      : "item"
                  } already exists.\n(path: ${outputPath})`
                );
                process.exit();
              }
            }

            /**
             * Returns different objects whether the item is
             * a directory, a file or something else
             */
            let item = makeItem(pathStats, inputPath, outputPath);
            if (item.type === "unknown") {
              logger.warn(
                "An item that is neither a file nor directory was found, it will be skipped.\n".concat(
                  `(path: ${inputPath})`
                )
              );
            }
            return item;
          }
        )
      );

      // Counts the total number of items
      logger.info(
        `Found ${(
          await Promise.all(
            inputItems.map(async (i) =>
              i.type === "directory"
                ? await i.tree!.fileCount
                : i.type === "file"
                ? 1
                : 0
            )
          )
        ).reduce((acc, i) => acc + i, 0)} items (totalizing ${new FileSize(
          (
            await Promise.all(
              inputItems.map(async (i) =>
                i.type === "file"
                  ? (
                      await fsAsync.stat(i.inputPath)
                    ).size
                  : i.type === "directory"
                  ? await i.tree!.size
                  : 0
              )
            )
          ).reduce((acc, i) => acc + i, 0)
        )}).`
      );

      logger.info("Encrypting...");

      // Encrypts every given path
      try {
        await Promise.all(
          inputItems.map(async (inputItem) => {
            /**
             * Do something whether the item is a directory,
             * a file or something else
             */
            if (inputItem.type === "directory") {
              // Creates base directory
              await fsAsync.mkdir(inputItem.outputPath).catch((e) => {
                logger.debugOnly.error(e);
                logger.error("Failed to create base directory.");
                process.exit();
              });

              /**
               * Creates new file map name by encrypting its
               * name
               */
              let newFileMapName = generateMd5Hash(
                Buffer.from("fileMap"),
                "base64url"
              );

              // Creates the FileMap object
              let fileMap = await FileMap.new(newFileMapName);

              /**
               * Encrypts items in the directory
               */
              await Promise.all(
                await inputItem.tree!.map(
                  throat(60, async (item) => {
                    if (item.type === "file") {
                      /**
                       * Creates a md5 hash with a 6 characters
                       * long substring of the item's original
                       * name so that hashed file map name is
                       * unique because 7 character long
                       */
                      let newFileName = generateMd5Hash(
                        encryption.encrypt(
                          Buffer.from(item.name.substring(0, 6))
                        ),
                        "base64url"
                      );
                      /**
                       * Adds item to file map
                       */
                      await fileMap.addItem(
                        pathProgram.relative(inputItem.inputPath, item.path),
                        newFileName
                      );
                      /**
                       * Encrypts item
                       */
                      await encryption.encryptStream(
                        fs.createReadStream(item.path),
                        fs.createWriteStream(
                          pathProgram.join(inputItem.outputPath, newFileName)
                        )
                      );
                    }
                  })
                )
              );

              /**
               * Encrypts file map
               */
              await encryption.encryptStream(
                fileMap.createStream(),
                fs.createWriteStream(
                  pathProgram.join(inputItem.outputPath, newFileMapName)
                )
              );
            } else if (inputItem.type === "file") {
              /**
               * Encrypts file
               */
              await encryption.encryptStream(
                fs.createReadStream(inputItem.inputPath),
                fs.createWriteStream(inputItem.outputPath)
              );
            } else return;
          })
        );
      } catch (e) {
        logger.debugOnly.error(e);
        logger.error("Error while encrypting.");
        await cleanup(...inputItems);
        process.exit();
      }
    } catch (e) {
      logger.debugOnly.error(e);
      logger.error(
        "Unknown error occurred. (rerun with --verbose or --debug to get more information)"
      );
      process.exit();
    } finally {
      logger.success(`Done (in ${timer.elapsedTime}ms)`);
    }
  });

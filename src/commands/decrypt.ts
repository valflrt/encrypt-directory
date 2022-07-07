import { Command } from "commander";
import fs, { existsSync } from "fs";
import fsAsync from "fs/promises";
import pathProgram from "path";
import throat from "throat";

import Encryption from "../Encryption";
import Tree from "../Tree";
import FileMap from "../FileMap";
import Logger from "../Logger";
import Timer from "../Timer";
import { generateMd5Hash } from "../misc";

export default new Command("decrypt")
  .aliases(["d"])
  .description("decrypt an encrypted file/directory")

  .argument("<paths...>", "path(s) of the item(s) to decrypt")
  .option("-k, --key <key>", "key used to encrypt")

  .option(
    "-f, --force",
    "force operation (overwrite the output item(s) if it already exists)",
    false
  )
  .option(
    "-o, --output [path]",
    "set a custom output path (only supported when one item to decrypt is given)"
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
          "Output path can only be specified when decrypting one item only."
        );
        process.exit();
      }

      // Creates an Encryption instance
      let encryption = new Encryption(options.key);

      // Resolves the given raw paths
      let inputPaths = rawInputPaths.map((rawInputPath) => {
        let resolvedPath: string;
        try {
          resolvedPath = pathProgram.resolve(rawInputPath);
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error(`Invalid input path`);
          process.exit();
        }
        return resolvedPath;
      });

      // Checks if all the items exist
      let inexistantPaths = inputPaths.filter(
        (inputPath) => !existsSync(inputPath)
      );
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
            let outputPath: string;
            try {
              outputPath =
                options.output && rawInputPaths.length <= 1
                  ? pathProgram.resolve(options.output)
                  : inputPath.replace(".encrypted", "").concat(".decrypted");
            } catch (e) {
              logger.debugOnly.error(e);
              logger.error("Failed to resolve given output path.");
              process.exit();
            }
            // Checks if the "encrypted" item already exists
            if (existsSync(outputPath)) {
              if (options.force) {
                try {
                  await fsAsync.rm(outputPath, {
                    force: true,
                    recursive: true,
                  });
                } catch (e) {
                  logger.debugOnly.error(e);
                  logger.error(
                    `Failed to overwrite the output ${humanAddressedItemType}.\n(path: ${outputPath})`
                  );
                }
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
            if (pathStats.isDirectory()) {
              return {
                type: "directory",
                inputPath,
                outputPath,
                tree: new Tree(inputPath),
              };
            } else if (pathStats.isFile()) {
              return {
                type: "file",
                inputPath,
                outputPath,
              };
            } else {
              logger.warn(
                "An item that is neither a file nor directory was found, it will be skipped.\n".concat(
                  `(path: ${inputPath})`
                )
              );
              return {
                type: "unknown",
                inputPath,
                outputPath,
              };
            }
          }
        )
      );

      /**
       * A function to clean, to remove files/directories
       * that were created in case of error when decrypting
       */
      let clean = async () => {
        try {
          await Promise.all(
            inputItems.map(async (i) => {
              await fsAsync.rm(i.outputPath, {
                recursive: true,
                force: true,
              });
            })
          );
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error("Failed to clean up.");
        }
      };

      logger.info("Validating file(s)...");

      // checks if every item is valid
      try {
        let allValid = (
          await Promise.all(
            inputItems.map(async (item) => {
              if (item.type === "directory") {
                return (
                  await Promise.all(
                    await item.tree!.map((i) =>
                      encryption.validateStream(fs.createReadStream(i.path))
                    )
                  )
                ).every((i) => !!i);
              } else {
                return await encryption.validateStream(
                  fs.createReadStream(item.inputPath)
                );
              }
            })
          )
        ).every((i) => !!i);
        if (!allValid) {
          logger.error(
            "Invalid file(s) might have been found or the given key is wrong."
          );
          await clean();
          process.exit();
        } else {
          logger.success("All files are valid.");
        }
      } catch (e) {
        logger.debugOnly.error(e);
        logger.error(
          "Failed to validate file(s), key must be wrong or file(s) must be invalid."
        );
        process.exit();
      }

      logger.info("Decrypting...");

      // Decrypts every given path
      try {
        await Promise.all(
          inputItems.map(async (inputItem) => {
            /**
             * Do something whether the item is a directory,
             * a file or something else
             */
            if (inputItem.type === "directory") {
              // Creates base directory
              try {
                await fsAsync.mkdir(inputItem.outputPath);
              } catch (e) {
                logger.debugOnly.error(e);
                logger.error("Failed to create base directory.");
                process.exit();
              }

              // Finds file map (the encrypted file itself)
              let fileMapMd5Hash = generateMd5Hash(
                Buffer.from("fileMap")
              ).toString("base64url");
              let fileMapPath = (
                await Promise.all(
                  await inputItem.tree!.map(
                    throat(60, async (item) => {
                      /**
                       * You might think this is not secure
                       * because an encrypted file could also
                       * be named "fileMap", the program will
                       * try to use it as file map, in this
                       * case please see `../encrypt.ts` at
                       * line 293
                       */
                      return item.name === fileMapMd5Hash ? item.path : false;
                    })
                  )
                )
              ).find((i) => !!i);
              if (!fileMapPath) {
                logger.error(
                  "Couldn't decrypt because file map can't be found"
                );
                process.exit();
              }

              /**
               * Creates FileMap object
               */
              let fileMap = await FileMap.new();
              /**
               * Decrypts file map and write the result in
               * the temporary file map created when using
               * FileMap.new();
               */
              await encryption.decryptStream(
                fs.createReadStream(fileMapPath),
                fs.createWriteStream(fileMap.tmpFilePath)
              );

              /**
               * Parses file map and decrypts items depending
               * on it
               */
              await Promise.all(
                await fileMap.parseAndMap(
                  throat(60, async ([plain, hashed]) => {
                    if (hashed === fileMapMd5Hash) return;
                    let newPath = pathProgram.join(inputItem.outputPath, plain);
                    /**
                     * Creates directories if necessary
                     */
                    await fsAsync.mkdir(
                      pathProgram.resolve(pathProgram.dirname(newPath)),
                      {
                        recursive: true,
                      }
                    );
                    /**
                     * Decrypts item
                     */
                    await encryption.decryptStream(
                      fs.createReadStream(
                        pathProgram.join(inputItem.inputPath, hashed)
                      ),
                      fs.createWriteStream(newPath)
                    );
                  })
                )
              );
            } else if (inputItem.type === "file") {
              /**
               * Decrypts file
               */
              await encryption.decryptStream(
                fs.createReadStream(inputItem.inputPath),
                fs.createWriteStream(inputItem.outputPath)
              );
            } else return;
          })
        );
      } catch (e) {
        logger.debugOnly.error(e);
        logger.error("Error while decrypting.");
        await clean();
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

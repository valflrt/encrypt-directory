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
          "Output path can only be specified when encrypting one item only."
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

      // Loops through given paths and gets information about them
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

            let humanReadableItemType = pathStats.isFile()
              ? "file"
              : pathStats.isDirectory()
              ? "directory"
              : "item";

            // Checks if the item exists
            if (!existsSync(inputPath)) {
              logger.error(
                `This ${humanReadableItemType} doesn't exist.\n(path: ${inputPath})`
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
                    `Failed to overwrite the output ${humanReadableItemType}.\n(path: ${outputPath})`
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
                "An item that is neither a file nor directory was found, skipping...\n".concat(
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
            inputItems.map(
              throat(10, async (item) => {
                await fsAsync.rm(item.outputPath, {
                  recursive: true,
                  force: true,
                });
              })
            )
          );
        } catch (e) {
          logger.debugOnly.error(e);
          logger.error("Failed to clean up.");
        }
      };

      logger.info("Validating files...");

      // checks if every item is valid
      try {
        let allValid = (
          await Promise.all(
            inputItems.map(async (i) => {
              if (i.type === "directory") {
                return (
                  await Promise.all(
                    await i.tree!.map((i) =>
                      encryption.validateStream(fs.createReadStream(i.path))
                    )
                  )
                ).every((i) => !!i);
              } else {
                return await encryption.validateStream(
                  fs.createReadStream(i.inputPath)
                );
              }
            })
          )
        ).every((i) => !!i);
        if (!allValid) {
          logger.error(
            "Invalid files might have been found or the given key is wrong."
          );
          await clean();
          process.exit();
        } else {
          logger.success("All files are valid.");
        }
      } catch (e) {
        logger.debugOnly.error(e);
        logger.error("Failed to validate files, key must be wrong.");
        process.exit();
      }

      logger.info("Decrypting...");

      // Encrypts every given path
      try {
        await Promise.all(
          inputItems.map(async (inputItem) => {
            /**
             * Check if the item is a directory, a file or
             * something else
             */
            if (inputItem.type === "directory") {
              // Creates base directory (typically [name of the dir to encrypt].encrypted)
              try {
                await fsAsync.mkdir(inputItem.outputPath);
              } catch (e) {
                logger.debugOnly.error(e);
                logger.error("Failed to create base directory.");
                process.exit();
              }

              // Finds file map
              let fileMap = (
                await Promise.all(
                  await inputItem.tree!.map(
                    throat(20, async (item) => {
                      let bufferedName = Buffer.from(item.name, "base64url");
                      if (
                        encryption.validate(bufferedName) &&
                        encryption.decrypt(bufferedName).toString("utf8") ===
                          "fileMap"
                      ) {
                        let parsed = FileMap.parse(
                          encryption
                            .decrypt(await fsAsync.readFile(item.path))
                            .toString("utf8")
                        )?.items;
                        if (!parsed) return null;
                        else return parsed;
                      } else return null;
                    })
                  )
                )
              ).find((i) => !!i);
              if (!fileMap) {
                logger.error(
                  "Couldn't decrypt because file map can't be found"
                );
                process.exit();
              }

              /**
               * Reads file map and decrypt items depending
               * on it
               */
              await Promise.all(
                fileMap.map(
                  throat(20, async ([plain, randomized]) => {
                    let newPath = pathProgram.join(inputItem.outputPath, plain);
                    await fsAsync.mkdir(
                      pathProgram.resolve(pathProgram.dirname(newPath)),
                      {
                        recursive: true,
                      }
                    );
                    await encryption.decryptStream(
                      fs.createReadStream(
                        pathProgram.join(inputItem.inputPath, randomized)
                      ),
                      fs.createWriteStream(newPath)
                    );
                  })
                )
              );

              // Removes file map
              await fsAsync.rm(
                pathProgram.join(inputItem.outputPath, "fileMap")
              );
            } else if (inputItem.type === "file") {
              await encryption.decryptStream(
                fs.createReadStream(inputItem.inputPath),
                fs.createWriteStream(inputItem.outputPath)
              );
            } else return;
          })
        );
      } catch (e) {
        logger.debugOnly.error(e);
        logger.error("Error while encrypting.");
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

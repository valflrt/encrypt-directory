import { Command } from "commander";

import fs, { existsSync } from "fs";
import fsAsync from "fs/promises";
import pathProgram from "path";
import throat from "throat";

import Encryption from "../Encryption";
import Tree from "../Tree";
import FileSize from "../FileSize";
import FileMap from "../FileMap";

import Logger from "../Logger";
import Timer from "../Timer";

import { randomKey } from "../misc";

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
                  : inputPath.concat(".encrypted");
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
       * that were created in case of error when encrypting
       */
      let clean = async () => {
        try {
          await Promise.all(
            inputItems.map(
              throat(10, async (i) => {
                await fsAsync.rm(i.outputPath, {
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

              // Function used to generate file names
              let randomName = (originalName: string) =>
                encryption
                  .encrypt(Buffer.from(originalName.substring(0, 8)))
                  .toString("base64url");

              // Creates the FileMap object
              let fileMap = new FileMap();

              await Promise.all(
                await inputItem.tree!.map(
                  throat(20, async (item) => {
                    if (item.type === "file") {
                      let newFileName = randomName(item.name);
                      fileMap.addItem(
                        pathProgram.relative(inputItem.inputPath, item.path),
                        newFileName
                      );
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
               * Writes file map in the encrypted directory,
               * its name is encrypted so it can't be recognized
               * among the other encrypted files
               */
              let newFileMapName = encryption
                .encrypt(Buffer.from("fileMap", "utf8"))
                .toString("base64url");
              fileMap.addItem(
                pathProgram.relative(
                  inputItem.inputPath,
                  pathProgram.join(inputItem.inputPath, "fileMap")
                ),
                newFileMapName
              );
              fsAsync.writeFile(
                pathProgram.join(inputItem.outputPath, newFileMapName),
                encryption.encrypt(Buffer.from(JSON.stringify(fileMap.items)))
              );
            } else if (inputItem.type === "file") {
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

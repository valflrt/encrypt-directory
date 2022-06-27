import { Command } from "commander";

import fs, { existsSync } from "fs";
import fsAsync from "fs/promises";
import pathProgram from "path";
import throat from "throat";

import Encryption from "../Encryption";
import Tree, { Dir, ItemArray, ItemTypes } from "../Tree";
import FileSize from "../FileSize";

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
      if (options.output && rawInputPaths.length > 1) {
        logger.error(
          "Output path can only be specified when encrypting one item only."
        );
        process.exit();
      }

      // Creates an Encryption instance
      let encryption = new Encryption(options.key);

      // Tries to resolve the given raw paths
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

      // Loops through given items without encrypting, just getting information about them
      let items = await Promise.all(
        inputPaths.map(
          async (
            inputPath
          ): Promise<{
            type: "directory" | "file" | "unknown";
            inputPath: string;
            outputPath: string;
            dir: Dir | null;
          }> => {
            // Reads current path stats
            let pathStats = await fsAsync.stat(inputPath);

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
                    `Failed to overwrite the output ${
                      pathStats.isFile()
                        ? "file"
                        : pathStats.isDirectory()
                        ? "directory"
                        : "item"
                    }.\n(path: ${outputPath})`
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
              // makes directory tree
              let tree;
              try {
                tree = await new Tree(inputPath).toObject();
              } catch (e) {
                logger.debugOnly.error(e);
                logger.error("Failed to read directory.");
                process.exit();
              }
              return {
                type: "directory",
                inputPath,
                outputPath,
                dir: tree,
              };
            } else if (pathStats.isFile()) {
              // Checks if the file exists
              if (!existsSync(inputPath)) {
                logger.error(`This file doesn't exist.\n(path: ${inputPath})`);
                process.exit();
              }
              return {
                type: "file",
                inputPath,
                outputPath,
                dir: null,
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
                dir: null,
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
            items.map(
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
            items.map(
              throat(10, async (i) => {
                if (i.type === "directory") {
                  let flatArray = await new Tree(i.inputPath).toFlatArray();
                  return (
                    await Promise.all(
                      flatArray.map((i) =>
                        i.type === ItemTypes.Dir || i.type === ItemTypes.File
                          ? encryption.validateStream(
                              fs.createReadStream(i.path)
                            )
                          : true
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

      // Counts the total number of items
      logger.info(
        `Found ${items.reduce(
          (acc, i) =>
            i.type === "directory"
              ? acc + Tree.getNumberOfFiles(i.dir!)
              : i.type === "file"
              ? acc + 1
              : acc,
          0
        )} items (totalizing ${new FileSize(
          (
            await Promise.all(
              items.map(async (i) =>
                i.type === "file"
                  ? (
                      await fsAsync.stat(i.inputPath)
                    ).size
                  : i.type === "directory"
                  ? i.dir!.size
                  : 0
              )
            )
          ).reduce((acc, i) => acc + i, 0)
        )}).`
      );

      logger.info("Decrypting...");

      // Encrypts every item
      try {
        await Promise.all(
          items.map(
            throat(10, async (item) => {
              /**
               * Check if the item is a directory, a file or
               * something else
               */
              if (item.type === "directory") {
                // Creates base directory (typically [name of the dir to encrypt].encrypted)
                try {
                  await fsAsync.mkdir(item.outputPath);
                } catch (e) {
                  logger.debugOnly.error(e);
                  logger.error("Failed to create base directory.");
                  process.exit();
                }

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
                        await encryption.decryptStream(
                          fs.createReadStream(i.path),
                          fs.createWriteStream(newItemPath)
                        );
                      }
                    })
                  );

                await loopThroughDir(item.dir!.items, item.outputPath);
              } else if (item.type === "file") {
                await encryption.decryptStream(
                  fs.createReadStream(item.inputPath),
                  fs.createWriteStream(item.outputPath)
                );
              } else return;
            })
          )
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

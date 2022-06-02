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
    let logger = new Logger(cmd.optsWithGlobals());

    logger.info("Given options: ".concat(cmd.optsWithGlobals()));

    try {
      // Resolves the given path
      let resolvedItemPath;
      try {
        resolvedItemPath = pathProgram.resolve(path);
      } catch (e) {
        if (cmd.optsWithGlobals().debug) console.error(e);
        logger.error("Invalid path !");
        process.exit();
        return;
      }

      // Checks if the item exists
      if (!existsSync(resolvedItemPath)) {
        logger.error(
          `The item pointed by this path doesn't exist !\n(path: ${resolvedItemPath})`
        );
        process.exit();
        return;
      }

      // Creates an Encryption instance
      let encryption = new Encryption(key);

      // Custom decrypt function changing depending on options
      let decrypt = async (buffer: Buffer) => {
        return options.compression
          ? await ungzip(encryption.decrypt(buffer), {
              level: Number.parseInt(options.compressionLevel),
            })
          : encryption.decrypt(buffer);
      };

      // Check if the item is a directory, a file or something else
      let itemStats = await fs.stat(resolvedItemPath);
      if (itemStats.isDirectory()) {
        console.log("Reading directory...");

        // Generates directory tree
        let dir;
        try {
          dir = await new Tree(resolvedItemPath).toObject();
          if (dir === null) {
            logger.error("Failed to read directory !");
            process.exit();
            return;
          }
        } catch (e) {
          if (cmd.optsWithGlobals().debug) console.error(e);
          logger.error("Failed to read directory !");
          process.exit(0);
          return;
        }

        let outputPath;
        try {
          outputPath = options.output
            ? pathProgram.resolve(options.output)
            : resolvedItemPath.replace(".encrypted", "").concat(".decrypted");
        } catch (e) {
          if (cmd.optsWithGlobals().debug) console.error(e);
          logger.error("Failed to resolve given output path");
          process.exit(0);
          return;
        }
        // Checks if the "decrypted" directory already exists
        if (existsSync(outputPath)) {
          logger.error(
            `The decrypted directory already exists. Please delete it and try again.\n(path: ${outputPath})`
          );
          process.exit(0);
          return;
        }

        // Creates base directory (typically [name of the dir to decrypt].decrypted)
        try {
          await fs.mkdir(outputPath);
        } catch (e) {
          if (cmd.optsWithGlobals().debug) console.error(e);
          logger.error("Failed to create base directory");
          process.exit(0);
          return;
        }

        // Counts number of items in the directory
        console.log(`Found ${Tree.getNumberOfEntries(dir)} items.`);

        // Recursion function to decrypt each file in the directory
        let loopThroughDir = async (items: ItemArray, parentPath: string) => {
          await Promise.all(
            items.map(async (i) => {
              let newItemPath = pathProgram.join(
                parentPath,
                (await decrypt(Buffer.from(i.name, "base64url"))).toString()
              );

              if (i.type === ItemTypes.Dir) {
                await fs.mkdir(newItemPath, { recursive: true });
                loopThroughDir(i.items, newItemPath);
              } else if (i.type === ItemTypes.File) {
                if (cmd.optsWithGlobals().verbose)
                  console.log(
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
          manualStart: cmd.optsWithGlobals().verbose ? true : false,
        });

        try {
          await loopThroughDir(dir.items, outputPath);
          loader.stop();
        } catch (e) {
          loader.stop();
          if (cmd.optsWithGlobals().debug) console.error(e);
          logger.error(
            "Error while decrypting\n".concat(
              "(The directory you are trying to decrypt might not be a valid encrypted directory)"
            )
          );
          process.exit(0);
          return;
        }
      } else if (itemStats.isFile()) {
        // Creates output path
        let newItemPath;
        try {
          newItemPath = options.output
            ? pathProgram.resolve(options.output)
            : resolvedItemPath.replace(".encrypted", "").concat(".decrypted");
        } catch (e) {
          if (cmd.optsWithGlobals().debug) console.error(e);
          logger.error("Failed to resolve given output path");
          process.exit(0);
          return;
        }

        if (cmd.optsWithGlobals().verbose)
          console.log(
            "- encrypting file\n"
              .concat(`  from "${resolvedItemPath}"\n`)
              .concat(`  to "${newItemPath}"`)
          );

        // Loading animation
        let loader = new Loader({
          text: "[loader]  Decrypting file...\n",
          manualStart: cmd.optsWithGlobals().verbose ? true : false,
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
          if (cmd.optsWithGlobals().debug) console.error(e);
          logger.error(
            "Error while decrypting\n".concat(
              "(The file you are trying to decrypt might not be a valid encrypted file)"
            )
          );
          process.exit(0);
          return;
        }
      } else {
        logger.error("This program only supports files and directories");
        process.exit(0);
        return;
      }

      console.log("Done");
    } catch (e) {
      if (cmd.optsWithGlobals().debug) console.error(e);
      logger.error(
        "Unknown error occurred (rerun with --debug for debug information)"
      );
      process.exit(0);
      return;
    }
  });

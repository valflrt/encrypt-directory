import program from "../program";

import { ungzip } from "node-gzip";

import fs from "fs/promises";
import { existsSync } from "fs";
import pathProgram from "path";

import { Encryption } from "../encryption";
import { ItemArray, ItemTypes, Tree } from "../tree";

import { Loader } from "../loader";

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
  .option("--verbose", "verbose mode")
  .option("--debug", "debug mode")
  .action(async (path, key, options) => {
    if (options.debug) console.log("given options:", options);

    try {
      // Resolves the given path
      let resolvedItemPath;
      try {
        resolvedItemPath = pathProgram.resolve(path);
      } catch (e) {
        if (options.debug) console.error(e);
        program.error("Error: Invalid path !");
        return;
      }

      // Checks if the item exists
      if (!existsSync(resolvedItemPath)) {
        program.error(
          `Error: The item pointed by this path doesn't exist !\n(path: ${resolvedItemPath})`
        );
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
            program.error("Error: Failed to read directory !");
            return;
          }
        } catch (e) {
          if (options.debug) console.error(e);
          program.error("Error: Failed to read directory !");
          return;
        }

        let outputPath;
        try {
          outputPath = options.output
            ? pathProgram.resolve(options.output)
            : resolvedItemPath.replace(".encrypted", "").concat(".decrypted");
        } catch (e) {
          if (options.debug) console.error(e);
          program.error("Error: Failed to resolve given output path");
          return;
        }
        // Checks if the "decrypted" directory already exists
        if (existsSync(outputPath)) {
          program.error(
            `Error: The decrypted directory already exists. Please delete it and try again.\n(path: ${outputPath})`
          );
          return;
        }

        // Creates base directory (typically [name of the dir to decrypt].decrypted)
        try {
          await fs.mkdir(outputPath);
        } catch (e) {
          if (options.debug) console.error(e);
          program.error("Error: Failed to create base directory");
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
                if (options.verbose)
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
          manualStart: options.verbose ? true : false,
        });

        try {
          await loopThroughDir(dir.items, outputPath);
          loader.stop();
        } catch (e) {
          loader.stop();
          if (options.debug) console.error(e);
          program.error(
            "Error: Error while decrypting\n".concat(
              "(The directory you are trying to decrypt might not be a valid encrypted directory)"
            )
          );
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
          if (options.debug) console.error(e);
          program.error("Error: Failed to resolve given output path");
          return;
        }

        if (options.verbose)
          console.log(
            "- encrypting file\n"
              .concat(`  from "${resolvedItemPath}"\n`)
              .concat(`  to "${newItemPath}"`)
          );

        // Loading animation
        let loader = new Loader({
          text: "[loader]  Decrypting file...\n",
          manualStart: options.verbose ? true : false,
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
          if (options.debug) console.error(e);
          program.error(
            "Error: Error while decrypting\n".concat(
              "(The file you are trying to decrypt might not be a valid encrypted file)"
            )
          );
          return;
        }
      } else {
        program.error(
          "Error: This program only supports files and directories"
        );
        return;
      }

      console.log("Done");
    } catch (e) {
      if (options.debug) console.error(e);
      program.error(
        "Error: Unknown error occurred (rerun with --debug for debug information)"
      );
      return;
    }
  });

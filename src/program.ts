import { program } from "commander";
import packageJson from "../package.json";

export default program
  .name("crypto-vault")
  .description("simple encryption and decryption tool.")
  .version(packageJson.version)
  .showSuggestionAfterError(true)

  .option("--verbose", "verbose mode")
  .option("--debug", "debug mode");

import { program } from "commander";

export default program
  .name("crypto-vault")
  .description("simple encryption and decryption tool.")
  .version("1.2.0")
  .showSuggestionAfterError(true)

  .option("--verbose", "verbose mode")
  .option("--debug", "debug mode");

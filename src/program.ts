import { program } from "commander";
import packageJson from "../package.json";

export default program
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version)

  .showSuggestionAfterError(true)

  .option("--verbose", "verbose mode")
  .option("--debug", "debug mode");

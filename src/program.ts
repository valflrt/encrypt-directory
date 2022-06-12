import { program } from "commander";
import packageJson from "../package.json";

export default program
  .name(packageJson.name)
  .description(packageJson.description)

  .option("--verbose", "enable verbose mode")
  .option("--debug", "enable debug mode")
  .version(packageJson.version, "-v, --version", "show version")

  .showSuggestionAfterError(true);

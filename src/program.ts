import { program } from "commander";
import packageJson from "../package.json";

export default program
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version, "-v, --version")

  .showSuggestionAfterError(true)

  .option("--verbose", "enable verbose mode")
  .option("--debug", "enable debug mode");

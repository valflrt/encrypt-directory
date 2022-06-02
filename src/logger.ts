import chalk from "chalk";

interface LoggerCLIOptions {
  verbose?: boolean;
  debug?: boolean;
}

export default class Logger {
  private _CLIOptions: LoggerCLIOptions;

  constructor(CLIOptions: LoggerCLIOptions) {
    this._CLIOptions = CLIOptions;
  }

  /**
   * Logs info (only logs if verbose mode is enabled)
   * @param items Items to log
   */
  public info(...items: any[]) {
    if (this._CLIOptions.verbose) {
      let lineStart = chalk.greenBright("[INFO]").concat("  ");
      console.log(
        items
          .join(" ")
          .split(/\n/g)
          .map((i) => lineStart.concat(i))
          .join("\n")
      );
    }
  }

  /**
   * Logs warn (only logs if verbose mode is enabled)
   * @param message Message to log
   */
  public warn(message: any) {
    if (this._CLIOptions.verbose)
      console.log(chalk.yellowBright("[WARN]").concat(`  ${message}`));
  }

  /**
   * Logs error (only logs  if verbose mode is enabled)
   * @param message Message to log
   */
  public error(message: any, plainError?: any) {
    console.log(chalk.redBright("[ERROR]").concat(`  ${message}`));
    if (this._CLIOptions.debug && plainError) console.error(plainError);
  }
}

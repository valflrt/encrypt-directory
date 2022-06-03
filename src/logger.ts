import "colors";
import util from "util";

export interface LoggerCLIOptions {
  verbose?: boolean;
  debug?: boolean;
}

export interface LogMethodWithOptionsOptions {
  items: any[];
  verboseOnly?: boolean;
  debugOnly?: boolean;
}

export default class Logger {
  private _CLIOptions: LoggerCLIOptions;

  constructor(CLIOptions: LoggerCLIOptions) {
    this._CLIOptions = CLIOptions;
  }

  /**
   * Logs info
   * @param items Items to log
   */
  public info(...items: any[]) {
    console.log(this.baseFormat(items, "info"));
  }
  /**
   * Logs info
   * @param options Log options
   */
  public infoWithOptions(options: LogMethodWithOptionsOptions) {
    if (this.logOrNo(options)) this.info(...options.items);
  }

  /**
   * Logs warn
   * @param items Items to log
   */
  public warn(...items: any[]) {
    console.log(this.baseFormat(items, "warn"));
  }
  /**
   * Logs warn
   * @param options Log options
   */
  public warnWithOptions(options: LogMethodWithOptionsOptions) {
    if (this.logOrNo(options)) this.warn(...options.items);
  }

  /**
   * Logs error
   * @param items Items to log
   */
  public error(...items: any[]) {
    console.log(this.baseFormat(items, "error"));
  }
  /**
   * Logs error
   * @param options Log options
   */
  public errorWithOptions(options: LogMethodWithOptionsOptions) {
    if (this.logOrNo(options)) this.error(...options.items);
  }

  /**
   * Logs info
   * @param items Items to log
   */
  public debug(...items: any[]) {
    console.log(this.baseFormat(items, "debug"));
  }
  /**
   * Logs info
   * @param options Log options
   */
  public debugWithOptions(options: LogMethodWithOptionsOptions) {
    if (this.logOrNo(options)) this.debug(...options.items);
  }

  /**
   * Formats a an array before to be logged
   * @param items Items to format
   * @param type Type of the log
   */
  private baseFormat(
    items: any[],
    type: "info" | "warn" | "error" | "debug" = "info"
  ) {
    let statusText;
    let stringStart;
    if (type === "warn") {
      statusText = " WARN ";
      stringStart = statusText.yellow.inverse.concat(" ");
    } else if (type === "error") {
      statusText = " ERROR ";
      stringStart = statusText.red.inverse.concat(" ");
    } else if (type === "debug") {
      statusText = " DEBUG ";
      stringStart = statusText.blue.inverse.concat(" ");
    } else {
      statusText = " INFO ";
      stringStart = statusText.green.inverse.concat(" ");
    }

    return stringStart.concat(
      items
        .map((i) => util.formatWithOptions({ colors: true }, i))
        .join(" ")
        .split(/\n/g)
        .join("\n".concat(" ".repeat(statusText.length + 1)))
    );
  }

  /**
   * Whether a log should be logged depending on cli options and log options
   * @param options Options
   */
  private logOrNo(options: LogMethodWithOptionsOptions) {
    return (
      (!options.verboseOnly && !options.debugOnly) ||
      (this._CLIOptions.verbose && options.verboseOnly === true) ||
      (this._CLIOptions.debug && options.debugOnly === true)
    );
  }
}

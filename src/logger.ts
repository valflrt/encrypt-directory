import "colors";
import util from "util";

export interface GivenCLIOptions {
  verbose?: boolean;
  debug?: boolean;
}

export class LogMethods {
  private _log: boolean;

  constructor(log?: boolean) {
    this._log = log ?? true;
  }

  public log(...items: any[]) {
    if (this._log) console.log(...items);
  }

  /**
   * Logs info
   * @param items Items to log
   */
  public info(...items: any[]) {
    this.log(this.baseFormat(items, "info"));
  }

  /**
   * Logs warn
   * @param items Items to log
   */
  public warn(...items: any[]) {
    this.log(this.baseFormat(items, "warn"));
  }

  /**
   * Logs error
   * @param items Items to log
   */
  public error(...items: any[]) {
    this.log(this.baseFormat(items, "error"));
  }

  /**
   * Logs debug
   * @param items Items to log
   */
  public debug(...items: any[]) {
    this.log(this.baseFormat(items, "debug"));
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
}

export default class Logger extends LogMethods {
  private _CLIOptions: GivenCLIOptions;

  constructor(CLIOptions: GivenCLIOptions) {
    super();
    this._CLIOptions = CLIOptions;
  }

  /**
   * Generates log methods but logs only when --debug option
   * is specified
   */
  public get debugOnly() {
    return new LogMethods(!!this._CLIOptions.debug);
  }

  /**
   * Generates log methods but logs only when --verbose
   * option is specified
   */
  public get verboseOnly() {
    return new LogMethods(!!this._CLIOptions.verbose);
  }

  /**
   * Generates log methods but logs only when --debug or
   * --verbose options are specified
   */
  public get debugOrVerboseOnly() {
    return new LogMethods(
      !!this._CLIOptions.debug || !!this._CLIOptions.verbose
    );
  }

  /**
   * Generates log methods but logs only when --debug and
   * --verbose options are specified
   */
  public get debugAndVerboseOnly() {
    return new LogMethods(
      !!this._CLIOptions.debug && !!this._CLIOptions.verbose
    );
  }
}

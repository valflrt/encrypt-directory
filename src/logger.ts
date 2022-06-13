import "colors";
import util from "util";

export interface LogMethodsOptions {
  /**
   * Wether to log or no.
   */
  log?: boolean;
  /**
   * Wether to show status labels or no.
   */
  showLabels?: boolean;
}

export class LogMethods {
  private _log: boolean;
  private _showLabels: boolean;

  /**
   * Creates LogMethods object
   * @param options LogMethods options {@link LogMethodsOptions}
   */
  constructor(options?: LogMethodsOptions) {
    this._log = options?.log ?? true;
    this._showLabels = options?.showLabels ?? true;
  }

  /**
   * Simply logs (quasi-duplicate of console.log)
   * @param items Items to log
   */
  public log(...items: any[]) {
    if (this._log) console.log(...items);
  }

  /**
   * Logs with success label
   * @param items Items to log
   */
  public success(...items: any[]) {
    this.log(this.baseFormat(items, "success"));
  }

  /**
   * Logs with info label
   * @param items Items to log
   */
  public info(...items: any[]) {
    this.log(this.baseFormat(items, "info"));
  }

  /**
   * Logs with warn label
   * @param items Items to log
   */
  public warn(...items: any[]) {
    this.log(this.baseFormat(items, "warn"));
  }

  /**
   * Logs with error label
   * @param items Items to log
   */
  public error(...items: any[]) {
    this.log(this.baseFormat(items, "error"));
  }

  /**
   * Logs with debug label
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
    type: "info" | "success" | "warn" | "error" | "debug" = "info"
  ) {
    let label = " ".concat(
      this._showLabels ? type.toUpperCase().concat(" ") : ""
    );

    let startSequence;
    if (type === "success") {
      startSequence = label.green.inverse.concat(" ");
    } else if (type === "warn") {
      startSequence = label.yellow.inverse.concat(" ");
    } else if (type === "error") {
      startSequence = label.red.inverse.concat(" ");
    } else if (type === "debug") {
      startSequence = label.blue.inverse.concat(" ");
    } else {
      startSequence = label.white.inverse.concat(" ");
    }

    return startSequence.concat(
      items
        .map((i) => util.formatWithOptions({ colors: true }, i))
        .join(" ")
        .split(/\n/g)
        .join(
          "\n".concat(
            this._showLabels ? " ".repeat(label.length + 1) : startSequence
          )
        )
    );
  }
}

export interface GivenCLIOptions {
  verbose?: boolean;
  debug?: boolean;
}

export default class Logger extends LogMethods {
  private _CLIOptions: GivenCLIOptions;

  constructor(CLIOptions?: GivenCLIOptions) {
    super({
      showLabels: !!CLIOptions?.debug || !!CLIOptions?.verbose,
    });
    this._CLIOptions = CLIOptions ?? {};
  }

  /**
   * Generates log methods but logs only when --debug option
   * is specified
   */
  public get debugOnly() {
    return new LogMethods({
      log: !!this._CLIOptions.debug,
    });
  }

  /**
   * Generates log methods but logs only when --verbose
   * option is specified
   */
  public get verboseOnly() {
    return new LogMethods({
      log: !!this._CLIOptions.verbose,
    });
  }

  /**
   * Generates log methods but logs only when --debug or
   * --verbose options are specified
   */
  public get debugOrVerboseOnly() {
    return new LogMethods({
      log: !!this._CLIOptions.debug || !!this._CLIOptions.verbose,
    });
  }

  /**
   * Generates log methods but logs only when --debug and
   * --verbose options are specified
   */
  public get debugAndVerboseOnly() {
    return new LogMethods({
      log: !!this._CLIOptions.debug && !!this._CLIOptions.verbose,
    });
  }
}

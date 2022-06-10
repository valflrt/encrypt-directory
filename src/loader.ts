/**
 * Other loader styles:
 * ⣾⣽⣻⢿⡿⣟⣯⣷
 * ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁
 */

export class Loader {
  private _frames = "⠖⠲⠴⠦".split("");
  private _text: string | null;
  private _interval: NodeJS.Timer | null = null;

  constructor(options: {
    /**
     * Text to display while the loader is running,
     * "[loader]" will be replaced with the loader frames
     * @example [loader] loading...
     */
    text?: `${string}[loader]${string}`;
    /**
     * Frame style
     */
    /**
     * Turns on manual mode
     */
    manualStart?: boolean;
  }) {
    if (!options.text?.includes("[loader]"))
      throw new Error("Invalid loader text format");
    this._text = options.text ?? null;

    if (!options.manualStart) this.start();
  }

  /**
   * Starts the loader
   */
  public start() {
    let x = 0;
    this._interval = setInterval(() => {
      process.stdout.write(
        `\r${
          this._text
            ? this._text.replace("[loader]", this._frames[x++])
            : this._frames[x++]
        }`
      );
      x %= this._frames.length;
    }, 250);
  }

  /**
   * Stops the loader
   */
  public stop() {
    if (this._interval) {
      clearInterval(this._interval);
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    }
  }
}

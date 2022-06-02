let availableStyles: { [K in LoaderStyles]: string[] } = {
  0: "⣾⣽⣻⢿⡿⣟⣯⣷".split("").reverse(),
  1: "▁▂▃▄▅▆▇█▇▆▅▄▃▂▁".split(""),
};

export enum LoaderStyles {
  Type0,
  Type1,
}

export class Loader {
  private _frames: string[];
  private _text: string | null;
  private _interval: NodeJS.Timer | null = null;

  constructor(options: {
    /**
     * Text to display while the loader is running
     * @example hello [loader] !
     */
    text?: `${string}[loader]${string}`;
    /**
     * Frame style
     */
    frameType?: LoaderStyles;
    /**
     * Turns on manual mode
     */
    manualStart?: boolean;
  }) {
    this._frames = availableStyles[options?.frameType ?? LoaderStyles.Type0];
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

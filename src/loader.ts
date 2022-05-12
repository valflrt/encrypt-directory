let availableFrames: { [K in FrameTypes]: string[] } = {
  0: "⣾⣽⣻⢿⡿⣟⣯⣷".split(""),
  1: "▁▂▃▄▅▆▇█▇▆▅▄▃▂▁".split(""),
};

export enum FrameTypes {
  Type0,
  Type1,
}

export class Loader {
  private _frames: string[];
  private _interval: NodeJS.Timer | null = null;

  constructor(frameType: FrameTypes) {
    this._frames = availableFrames[frameType];
  }

  public start() {
    let x = 0;
    this._interval = setInterval(() => {
      process.stdout.write(`\r${this._frames[x++]}`);
      x %= this._frames.length;
    }, 250);
  }

  public stop() {
    if (this._interval) {
      clearInterval(this._interval);
      console.log();
    }
  }
}

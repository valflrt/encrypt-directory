export default class Timer {
  /**
   * Start timestamp
   */
  public timestamp: number | null = null;

  /**
   * Starts the timer
   */
  public start() {
    this.timestamp = Date.now();
  }

  /**
   * Returns elapsed time (if not started before, returns null)
   */
  public get elapsedTime() {
    if (!this.timestamp) return null;
    return Date.now() - this.timestamp;
  }
}

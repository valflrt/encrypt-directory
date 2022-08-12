export class Result<T> {
  private _value!: T;

  private _error?: any = null;

  constructor(
    executor: (
      resolve: (value: T) => void,
      reject: (error?: any) => void
    ) => unknown
  ) {
    try {
      executor(
        (v) => (this._value = v),
        (e: any) => (this._error = e)
      );
    } catch (e) {
      this._error = e;
    }
  }

  /**
   * Returns the Result value or executes the callback if an error was encountered
   */
  public tryToUnpack(catchError: (error: any) => unknown): T | null {
    if (this._error) {
      catchError(this._error);
      return null;
    } else return this._value ?? null;
  }

  /**
   * Returns the Result value (throws if an error was encountered)
   */
  public unpack() {
    if (this._error) throw this._error;
    return this._value;
  }
}

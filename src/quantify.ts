/**
 * Turns large numbers into small numbers with suffixes
 * e.g.: 1000 -> 1K, 44564 -> 464.6K, ...
 */
export default class Quantify {
  /**
   * Functions to round numbers depending on their size (thousands, millions, billions)
   */
  private static rounders = {
    billion: (number: number) => (number * 10 ** -9).toFixed(1),
    million: (number: number) => (number * 10 ** -6).toFixed(1),
    thousand: (number: number) => (number * 10 ** -3).toFixed(1),
  };

  /**
   * Parses a string
   * @param string string to parse
   */
  public static parseString(string: string): string {
    let number = Number.parseFloat(string.trim().toLowerCase());
    if (number >= 1e9) {
      return this.rounders.billion(number).toString().concat("G");
    } else if (number >= 1e6) {
      return this.rounders.million(number).toString().concat("M");
    } else if (number >= 1e3) {
      return this.rounders.thousand(number).toString().concat("K");
    } else return number.toString();
  }

  /**
   * Parses a number
   * @param number number to parse
   */
  public static parseNumber(number: number): string {
    if (number >= 1e9) {
      return this.rounders.billion(number).toString().concat("G");
    } else if (number >= 1e6) {
      return this.rounders.million(number).toString().concat("M");
    } else if (number >= 1e3) {
      return this.rounders.thousand(number).toString().concat("K");
    } else return number.toString();
  }
}

/**
 * Functions to round numbers depending on their size (thousands, millions, billions)
 */
let rounders = {
  billion: (number: number) => (number * 10 ** -9).toFixed(1),
  million: (number: number) => (number * 10 ** -6).toFixed(1),
  thousand: (number: number) => (number * 10 ** -3).toFixed(1),
};

/**
 * Turns large numbers into small numbers with suffixes
 * e.g.: 1000 -> 1K, 44564 -> 464.6K, ...
 */
export default class FileSize extends String {
  /**
   * Parses a number
   * @param number number to parse
   */
  constructor(number: number);
  /**
   * Parses a string
   * @param string string to parse
   */
  constructor(string: string);
  constructor(numberOrString: number | string) {
    let number;
    if (typeof numberOrString === "number") number = numberOrString;
    else if (typeof numberOrString === "string")
      number = Number.parseFloat(numberOrString);
    else {
      throw new Error("Item to parse must be a number or a string");
    }

    super(
      number >= 1e9
        ? rounders.billion(number).toString().concat("GB")
        : number >= 1e6
        ? rounders.million(number).toString().concat("MB")
        : number >= 1e3
        ? rounders.thousand(number).toString().concat("KB")
        : number.toFixed(1).toString()
    );
  }
}

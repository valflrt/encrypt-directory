import minimist from "minimist";

export let tryCatch = <T>(
  tryFunction: () => T,
  catchFunction: (e: any) => any
): T | null => {
  let item: T | null;
  try {
    item = tryFunction();
  } catch (e) {
    item = null;
    catchFunction(e);
  }
  return item;
};

export let getArgs = () => minimist(process.argv.slice(2));

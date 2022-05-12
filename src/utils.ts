import minimist from "minimist";
import { ItemArray, ItemTypes } from "./tree";

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

export let loopThroughDirToFindNumberOfEntries = (items: ItemArray): number => {
  return items.reduce<number>((acc, i) => {
    if (i.type === ItemTypes.Dir) {
      return acc + loopThroughDirToFindNumberOfEntries(i.items);
    } else return acc + 1;
  }, 0);
};

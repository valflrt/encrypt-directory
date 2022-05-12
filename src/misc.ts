import { ItemArray, ItemTypes } from "./tree";

export let loopThroughDirToFindNumberOfEntries = (items: ItemArray): number => {
  return items.reduce<number>((acc, i) => {
    if (i.type === ItemTypes.Dir) {
      return acc + loopThroughDirToFindNumberOfEntries(i.items);
    } else return acc + 1;
  }, 0);
};

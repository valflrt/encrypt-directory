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

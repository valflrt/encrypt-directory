export type FileMapItem = [name: string, hash: string];

export default class FileMap {
  public items: FileMapItem[] = [];

  constructor(items?: FileMapItem[]) {
    if (items) this.items.push(...items);
  }

  public addItem(plain: string, randomized: string) {
    this.items.push([plain, randomized]);
  }

  public static parse(stringified: string) {
    let parsed = JSON.parse(stringified);
    return Array.isArray(parsed) ? new FileMap(parsed) : null;
  }
}

export class ENSContent implements ENSContent {
  public readonly address: string;
  public readonly content_hash: string;
  public readonly options?: object;

  constructor(address: string, content_hash: string, options?: object) {
    this.address = address;
    this.content_hash = content_hash;
    this.options = options;
  }
}

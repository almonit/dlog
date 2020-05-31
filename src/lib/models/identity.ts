import { IPFSPath } from 'ipfs/types/interface-ipfs-core/common';

export class Identity implements Identity {
  public readonly author: IPFSPath;
  private readonly buckets: readonly IPFSPath[];

  constructor(author: IPFSPath, buckets: readonly IPFSPath[] = []) {
    this.author = author;
    this.buckets = buckets;
  }

  public getBucketCID(index: number): IPFSPath {
    return this.buckets[index];
  }

  public asBuffer(): Buffer {
    const identity = {
      author: this.author,
      buckets: this.buckets
    };
    return Buffer.from(JSON.stringify(identity));
  }
}

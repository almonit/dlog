import { IPFSPath } from 'ipfs/types/interface-ipfs-core/common';

export class Identity implements Identity {
  public readonly author: IPFSPath;
  private buckets: IPFSPath[];

  constructor(author: IPFSPath, buckets: IPFSPath[] = []) {
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

  public updateBucket(bucket_cid: IPFSPath, need_archiving: boolean): void {
    //TODO update this as it needs to store 3 buckets at a time
    if (need_archiving) {
      this.buckets.unshift(bucket_cid);
      this.buckets.length = 3;
    } else {
      this.buckets[0] = bucket_cid;
    }
  }
}

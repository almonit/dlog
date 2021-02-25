export class Identity implements Identity {
  private author_cid: any;
  private bucket_cids: any[];
  private static LIVE_BUCKETS_NUMBER = 3;

  constructor(author_cid: any, bucket_cids: any[] = []) {
    this.author_cid = author_cid;
    this.bucket_cids = bucket_cids;
  }

  public getBucketCID(index: number): any {
    return this.bucket_cids[index];
  }

  public asBuffer(): Buffer {
    const identity = {
      author_cid: this.author_cid,
      bucket_cids: this.bucket_cids
    };
    return Buffer.from(JSON.stringify(identity));
  }

  public updateBucketCID(bucket_cid: any, need_archiving: boolean): void {
    //TODO update this as it needs to store 3 buckets at a time
    if (need_archiving) {
      this.bucket_cids.unshift(bucket_cid);
      this.bucket_cids.length = Identity.LIVE_BUCKETS_NUMBER;
    } else {
      this.bucket_cids[0] = bucket_cid;
    }
  }

  public setAuthorCID(author_cid: any) {
    this.author_cid = author_cid;
  }

  public getAuthorCID(): any {
    return this.author_cid;
  }
}

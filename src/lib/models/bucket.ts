import { IPFSPath } from 'ipfs/types/interface-ipfs-core/common';

export class Bucket implements Bucket {
  public static readonly BUCKET_LIMIT = 10;
  public static readonly NON_ARCHIVE_LIMIT = 3; // number of non-archived buckets
  private previous_bucket_cid?: IPFSPath;
  private article_header_cids: IPFSPath[]; // each IPFSPath links to an articleHeader object
  private index!: number; // -1 (if archived), or between 1 and MAX_LIVE_INDEX otherwise

  constructor(
    article_header_cids: IPFSPath[] = [],
    previous_bucket_cid: IPFSPath | any = null
  ) {
    this.article_header_cids = article_header_cids;
    this.previous_bucket_cid = previous_bucket_cid;
  }
  /**
   *
   * @param articleHeader CID [Refers CID of ArticleHeader Object]
   */
  public addArticleHeaderCID(article_header_cid: IPFSPath): void {
    this.article_header_cids.unshift(article_header_cid);
  }

  /**
   * @param {IPFSPath[]} array of articleHeader CIDs
   */
  public addArticleHeaderCIDs(article_header_cids: IPFSPath[]): void {
    for (let i = 0; i < article_header_cids.length; i++) {
      this.article_header_cids.unshift(article_header_cids[i]);
    }
  }

  /**
   *
   * @param Index in the bucket of the CID of an articleHeader
   */
  public getArticleHeaderCID(index: number): IPFSPath {
    return this.article_header_cids[index];
  }

  /**
   *
   * @param removes the CID of last ArticleHeader and returns its CID
   */
  public removeLastArticleHeaderCID(): IPFSPath {
    return this.article_header_cids.pop() as IPFSPath;
  }

  /**
   * size of bucket
   */
  public size(): number {
    return this.article_header_cids.length;
  }

  public setPreviousBucketCID(bucket_cid: IPFSPath): void {
    this.previous_bucket_cid = bucket_cid;
  }

  public getPreviousBucketCID(): IPFSPath | undefined {
    return this.previous_bucket_cid;
  }

  public getIndex(): number {
    return this.index;
  }

  public setIndex(number: number): void {
    this.index = number;
  }

  public loadBucket(bucket: Bucket): void {
    this.article_header_cids = bucket.article_header_cids;
    this.previous_bucket_cid = bucket.previous_bucket_cid;
    if (bucket.index >= -1)
      this.index = bucket.index;
  }
}

import { IPFSPath } from 'ipfs/types/interface-ipfs-core/common';

export class Bucket implements Bucket {
  public static readonly BUCKET_LIMIT = 10;
  public static readonly NON_ARCHIVE_LIMIT = 3; // number of non-archived buckets
  private previous_bucket?: IPFSPath;
  private index!: number; // -1 (if archived), or between 1 and MAX_LIVE_INDEX otherwise
  // -1 (if archived), or between 1 and MAX_LIVE_INDEX otherwise
  private articles: IPFSPath[];

  constructor(
    articles: IPFSPath[] = [],
    previous_bucket: IPFSPath | any = null
  ) {
    this.articles = articles;
    this.previous_bucket = previous_bucket;
  }
  /**
   *
   * @param article_summary_cid [Refers CID of Article Summary Object]
   */
  public addArticle(article_summary_cid: IPFSPath): void {
    this.articles.unshift(article_summary_cid);
  }

  /**
   * @param {IPFSPath[]} array of article summary CIDs
   */
  public addArticles(article_summary_CIDs: IPFSPath[]): void {
    for (let i = 0; i < article_summary_CIDs.length; i++) {
      this.articles.unshift(article_summary_CIDs[i]);
    }
  }

  /**
   *
   * @param index Index of article summary object
   */
  public getArticle(index: number): IPFSPath {
    return this.articles[index];
  }

  /**
   *
   * @param removes the last article and returns its CID
   */
  public removeLastArticle(): IPFSPath {
    return this.articles.pop() as IPFSPath;
  }

  /**
   * size of bucket
   */
  public size(): number {
    return this.articles.length;
  }

  public setPreviousBucket(cid: IPFSPath): void {
    this.previous_bucket = cid;
  }

  public getPreviousBucket(): IPFSPath | undefined {
    return this.previous_bucket;
  }

  public getIndex(): number {
    return this.index;
  }

  public setIndex(number: number): void {
    this.index = number;
  }

  public loadBucket(bucket: Bucket): void {
    this.articles = bucket.articles;
    this.previous_bucket = bucket.previous_bucket;
    if (bucket.index >= -1)
      this.index = bucket.index;
  }
}

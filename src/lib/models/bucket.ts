import { IPFSPath } from 'ipfs/types/interface-ipfs-core/common';

export class Bucket implements Bucket {
  public static readonly BUCKET_LIMIT = 10;
  public static readonly NON_ARCHIVE_LIMIT = 3; // number of non-archived buckets
  public previous_bucket?: IPFSPath;
  public index: number; // -1 (if archived), or between 1 and MAX_LIVE_INDEX otherwise
  public readonly archived: boolean; 
  public readonly articles: IPFSPath[];

  constructor(
    articles: IPFSPath[] = [],
    previous_bucket: IPFSPath | any = null
  ) {
    this.articles = articles;
    this.previous_bucket = previous_bucket;
    this.archived = false;
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
    let i;
    for (i = 0; i < article_summary_CIDs.length; i++) { 
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
    return this.articles.pop();
  }

  /**
   * size of bucket
   */
  public size(): number {
    return this.articles.length;
  }

}

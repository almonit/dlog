import { IPFSPath } from 'ipfs/types/interface-ipfs-core/common';

export class Bucket implements Bucket {
  public static readonly BUCKET_LIMIT = 10;
  public readonly previous_bucket?: IPFSPath;
  public readonly articles: IPFSPath[];

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
   *
   * @param index Index of article summary object
   */
  public getArticle(index: number): IPFSPath {
    return this.articles[index];
  }

  /**
   * size of bucket
   */
  public size(): number {
    return this.articles.length;
  }
}

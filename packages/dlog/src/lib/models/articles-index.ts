/*
This class uses the concept of article_id.
article_id = article title with '-' instead of 
             space + a short hash composed of 
             the publication date of the article (see generateHash function)
 */

export class ArticlesIndex {
  //article_id -> article_header_cid
  private index: Object;

  constructor(index: Object | null) {
    if (index !== null) this.index = index;
    else this.index = new Object();
  }

  public addArticle(article_id: string, article_header_cid: any): string {
    this.index[article_id] = article_header_cid;

    // return article_id, otherwise caller has no way to know which article_id the article got
    return article_id;
  }

  public removeArticle(article_id: string) {
    if (article_id in this.index) {
      delete this.index[article_id];

      // TODO: else throw an error? or do what?
    }
  }

  public updateArticle(article_id: string, article_header_cid: any) {
    this.index[article_id] = article_header_cid;
  }

  // getArticle returns false if article_id is not in index,
  // hence it can be used also for a tool to check for existence of article_id in the index
  public getArticle(article_id: string): any | false {
    const article = this.index[article_id];
    if (article) return this.index[article_id];
    return false;
  }

  public createArticleID(title: string): string {
    let article_id_removed_spaces = title.replace(/ /g, '-');
    let article_id = article_id_removed_spaces + '-' + this.generateHash();

    while (article_id in this.index) {
      article_id = article_id_removed_spaces + '-' + this.generateHash();
    }

    return article_id;
  }

  public asBuffer(): Buffer {
    return Buffer.from(JSON.stringify(this.index));
  }

  /**
   * Auxiliary functions
   */
  private generateHash() {
    const hash =
      Math.floor(2147483648 * Math.random()).toString(36) +
      Math.abs(
        Math.floor(2147483648 * Math.random()) ^ this.getTimestamp()
      ).toString(36);
    return hash;
  }

  private getTimestamp =
    Date.now ||
    function() {
      return +new Date();
    };
}

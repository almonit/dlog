
export class Article {
  public readonly serializedArticle: string;

  public readonly publication_date;

  constructor(
    serializedArticle: string,
  ) {
    this.serializedArticle = serializedArticle;
    this.publication_date = Date.now();
  }
}

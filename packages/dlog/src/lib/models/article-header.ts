import { Author } from './';
export class ArticleHeader {
  public readonly article_cid: any; //any of Article object
  public readonly title: string;
  public readonly article_id: string;
  public readonly author: Author;
  public readonly cover_image: string;
  public readonly summary: string;
  public readonly tags: ReadonlyArray<
    readonly [readonly any[], readonly string[]]
  >;
  public readonly publication_date: any;

  constructor(
    article_cid: any,
    title: string,
    article_id: string,
    author: Author,
    cover_image: string,
    summary: string,
    tags: ReadonlyArray<readonly [readonly any[], readonly string[]]>,
    publication_date?: any
  ) {
    this.article_cid = article_cid;
    this.title = title;
    this.article_id = article_id;
    this.author = author;
    this.cover_image = cover_image;
    this.summary = summary;
    this.tags = tags;

    // set publication date for now
    this.publication_date = publication_date ? publication_date : Date.now();
  }
}

import { Author } from './';
import { IPFSPath } from 'ipfs/types/interface-ipfs-core/common';

export class ArticleHeader {
  public readonly article_cid: IPFSPath; //IPFSPath of Article object
  public readonly title: string;
  public readonly author: Author;
  public readonly cover_image: string;
  public readonly summary: string;
  public readonly tags: ReadonlyArray<
    readonly [readonly IPFSPath[], readonly string[]]
  >;
  public readonly publication_date: Date;

  constructor(
    article_cid: IPFSPath,
    title: string,
    author: Author,
    cover_image: string,
    summary: string,
    tags: ReadonlyArray<readonly [readonly IPFSPath[], readonly string[]]>,
    publication_date?: Date
  ) {
    (this.article_cid = article_cid), (this.title = title);
    this.author = author;
    this.cover_image = cover_image;
    this.summary = summary;
    this.tags = tags;

    // set publication date for now
    this.publication_date = publication_date ? publication_date : new Date();
  }
}

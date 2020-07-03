import { Author } from './';
import { IPFSPath } from 'ipfs/types/interface-ipfs-core/common';

export class ArticleSummary implements ArticleSummary {
  public readonly author: Author;
  public readonly content: IPFSPath;
  public readonly cover_image: string;
  public readonly summary: string;
  public readonly title: string;

  constructor(
    author: Author,
    content: IPFSPath,
    cover_image: string,
    summary: string,
    title: string
  ) {
    this.author = author;
    this.content = content;
    this.cover_image = cover_image;
    this.summary = summary;
    this.title = title;
  }
}

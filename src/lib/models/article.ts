import { IPFSPath } from 'ipfs/types/interface-ipfs-core/common';

export class Article implements Article {
  public readonly author: ReadonlyArray<readonly [IPFSPath, JSON]>;
  public readonly content: string;
  public readonly cover_image: string;
  public readonly tags: ReadonlyArray<
    readonly [readonly IPFSPath[], readonly string[]]
  >;

  constructor(
    author: ReadonlyArray<readonly [IPFSPath, JSON]>,
    content: string,
    cover_image: string,
    tags: ReadonlyArray<readonly [readonly IPFSPath[], readonly string[]]>
  ) {
    this.author = author;
    this.content = content;
    this.cover_image = cover_image;
    this.tags = tags;
  }

  getAuthorCID() {
    return this.author[0];
  }
}

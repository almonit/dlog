// import all from 'it-all';
// import CID from 'cids';
import IPFS from 'ipfs';
import { IPFSPath } from 'ipfs/types/interface-ipfs-core/common';
import Web3 from 'web3';
import BufferList from 'bl';

import {
  Article,
  ArticleSummary,
  Author,
  Bucket,
  ENSContent,
  Identity
} from './models';

export class DLog {
  public static readonly AUTHOR_PAGE: string =
    '/ipfs/QmamDJKm5DtpxtHdF8raZm4Nz7QV19WQSyP64sdUQKDFfi';
  public static readonly IDENTITY_FILE: string = 'identity.json';
  public static readonly INDEX_FILE: string = 'index.html';

  constructor(public node: IPFS, public web3: Web3 | any = null) {
    this.node = node;
    this.web3 = web3;
  }

  /* Public methods */

  public async getAuthor(cid: IPFSPath): Promise<Author> {
    const author = (await this.get(cid)) as Author;
    return author;
  }

  public async putAuthor(author: Author): Promise<IPFSPath> {
    const author_cid: IPFSPath = await this.put({ ...author }, null);
    return author_cid;
  }

  public async getBucket(cid: IPFSPath): Promise<Bucket> {
    const bucket = (await this.get(cid)) as Bucket;
    return bucket;
  }

  public async putBucket(bucket: Bucket): Promise<IPFSPath> {
    const bucket_cid: IPFSPath = await this.put({ ...bucket }, null);
    return bucket_cid;
  }

  /**
   * @desc 
   * Method for getting content hash from given ens address,
   * then will retrieve identity json file from ipfs hash
   * and lastly will read the `buckets` key of the `identity.json`
   * then return the latest bucket CID
   * 
   * @param ens_address ENS address e.g. 'mdt.eth'
   */
  public async retrieveLatestBucket(ens_address: string): Promise<Bucket> {
    const content_hash: string = await this.getContentHash(ens_address);
    const identity: Identity = await this.retrieveIdentity(content_hash);
    const bucket_cid = identity.getBucketCID(0);
    const bucket: Bucket = await this.getBucket(bucket_cid);

    if (bucket.size() >= Bucket.BUCKET_LIMIT) {
      return new Bucket([], bucket_cid);
    }

    return bucket;
  }

  public async getArticleSummary(cid: IPFSPath): Promise<ArticleSummary> {
    const article_summary = (await this.get(cid)) as ArticleSummary;
    return article_summary;
  }

  public async putArticleSummary(article: ArticleSummary): Promise<IPFSPath> {
    const article_cid: IPFSPath = await this.put({ ...article }, null);
    return article_cid;
  }

  public async getArticle(cid: IPFSPath): Promise<Article> {
    const article = (await this.get(cid)) as Article;
    return article;
  }

  public async putArticle(article: Article): Promise<IPFSPath> {
    const article_cid: IPFSPath = await this.put({ ...article }, null);
    return article_cid;
  }

  /**
   * 
   * @param ens_address ENS address e.g. 'mdt.eth'
   * @param article Article Object
   */
  public async publishArticle(
    ens_address: string,
    article: Article
  ): Promise<void> {
    const article_cid: IPFSPath = await this.putArticle(article);
    const { author, cover_image } = article;
    const article_summary: ArticleSummary = {
      author: author[0].toString(),
      content: article_cid,
      cover_image,
      summary: '',
      title: ''
    };
    const article_summary_cid = await this.putArticleSummary(article_summary);
    const bucket: Bucket = await this.retrieveLatestBucket(ens_address);
    bucket.addArticle(article_summary_cid);
    // TO DO continue for return
  }

  /**
   *
   * @param content_hash string of CID object
   */
  public async retrieveIdentity(content_hash: string): Promise<Identity> {
    /**
     * TO DO look for reading identity
     * @see https://github.com/ipfs/js-ipfs/blob/master/docs/core-api/FILES.md#ipfsgetipfspath-options
     * @see https://github.com/ipfs/js-ipfs/blob/master/docs/core-api/OBJECT.md#ipfsobjectgetcid-options
     */
    const identity_data = await this.getFiles(
      this.pathJoin([content_hash, DLog.IDENTITY_FILE])
    );
    const identity: Identity = JSON.parse(identity_data[0].toString());
    return identity;
  }

  /**
   * 
   * @param content_hash CID object of identity
   */
  public async pinIdentity(content_hash: IPFSPath): Promise<IPFSPath> {
    const pinset: Array<{ cid: IPFSPath }> = await this.pin(content_hash);
    // TO DO error handle
    return pinset[0].cid.toString('utf-8');
  }

  /**
   *
   * @param identity [User identity model, has Author CID and list of CID of most recent 3 bucket]
   */
  public async createIdentity(identity: Identity): Promise<IPFSPath> {
    /**
     * TO DO look for writing identity + main page CID
     * @see https://github.com/ipfs/js-ipfs/blob/master/docs/core-api/FILES.md#ipfsadddata-options
     * @see https://github.com/ipfs/js-ipfs/blob/master/docs/core-api/FILES.md#ipfsfilescpfrom-to-options
     */
    // await this.node.files.rm('/stuff', { recursive: true });
    await this.node.files.mkdir('/stuff', {
      parents: true,
      format: 'dag-pb',
      hashAlg: 'sha2-256',
      flush: true
    });
    await this.node.files.write(
      this.pathJoin(['/stuff', DLog.IDENTITY_FILE]),
      identity.asBuffer(),
      { create: true }
    );
    await this.cp(DLog.AUTHOR_PAGE, this.pathJoin(['/stuff', DLog.INDEX_FILE]));
    const { cid }: { cid: IPFSPath } = await this.node.files.stat('/stuff');
    // const directory_contents = await all(this.node.files.ls('/stuff'))
    // const read_chunks = this.node.files.read('/stuff/index.html', {});
    // const read_content = await this.fromBuffer(read_chunks);
    // console.log('read_content', read_content.toString());
    // console.info('directory_contents', directory_contents)
    return cid;
  }

  /**
   *
   * @param identity [User identity model, has Author CID and list of CID of most recent 3 bucket]
   * @param ens_address [sub ENS address of author]
   * @param options [setContentHash options]
   */
  public async register(
    identity: Identity,
    ens_address,
    options?: object
  ): Promise<string> {
    const user_cid = await this.createIdentity(identity);
    const ens = new ENSContent(ens_address, user_cid.toString(), options);
    const result = await this.setContentHash(ens);
    return result;
  }

  /**
   * Return versions of all active libraries
   */
  public async version(): Promise<{
    readonly ipfs: object;
    readonly dlog: string;
  }> {
    const ipfs_version = await this.node.version();
    return { ipfs: ipfs_version, dlog: '0.0.1' }; // TO DO get version from manifest
  }

  private async get(cid: IPFSPath): Promise<object> {
    const object: object = await this.node.dag.get(cid.toString());
    return object;
  }

  private async getFiles(cid: IPFSPath): Promise<Object[]> {
    let contents: Object[] = [];
    for await (const file of this.node.get(cid)) {
      if (!file.content) continue;
      const content = await this.fromBuffer(file.content);
      contents.push(content);
    }
    return contents;
  }

  private async put(object: object, options: any = null): Promise<IPFSPath> {
    const object_cid: IPFSPath = await this.node.dag.put(object, options);
    return object_cid;
  }

  private async pin(cid: IPFSPath): Promise<Array<{ cid: IPFSPath }>> {
    const pinset = await this.node.pin.add(cid.toString(), {
      recursive: true
    });
    return pinset;
  }

  private async cp(from: IPFSPath | string, to: string): Promise<void> {
    try {
      await this.node.files.cp(from, to, {
        parents: true,
        format: 'dag-pb',
        hashAlg: 'sha2-256',
        flush: true,
        timeout: 5000
      }); // TO DO get options as method parameter
    } catch (error) {
      console.warn('IPFS.Files.CP', error.code);
      for await (const file of this.node.get(from)) {
        if (!file.content) continue;
        const cp_content = await this.fromBuffer(file.content);
        await this.node.files.write(to, cp_content, { create: true });
      }
    }
  }

  private async getContentHash(ens_address: string): Promise<string> {
    const content_hash: string = await this.web3.eth.ens.getContent(
      ens_address
    );
    return content_hash;
  }

  private async setContentHash(ens: ENSContent): Promise<string> {
    const result = await this.web3.eth.ens.setContenthash(
      ens.address,
      `ipfs://${ens.content_hash}`,
      ens.options
    );
    return result;
  }

  private async fromBuffer(chunks): Promise<BufferList> {
    const content = new BufferList();
    for await (const chunk of chunks) {
      content.append(chunk);
    }
    return content;
  }

  private pathJoin(parts: String[], separator: string = '/') {
    const replace = new RegExp(separator + '{1,}', 'g');
    return parts.join(separator).replace(replace, separator);
  }
}

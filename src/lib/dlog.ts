// import all from 'it-all';
import BufferList from 'bl';
import CIDs from 'cids';
import contentHash from 'content-hash';
import IPFS from 'ipfs';
import { IPFSPath } from 'ipfs/types/interface-ipfs-core/common';
import namehash from 'eth-ens-namehash';
import Web3 from 'web3';
import { AlpressRegistrar, AlpressResolver } from '../contracts';

import { Article, ArticleHeader, Author, Bucket, Identity } from './models';

export class DLog {
  public static readonly ROOT_DOMAIN: string = 'alpress.eth';
  public static readonly AUTHOR_PAGE: string =
    '/ipfs/QmTRfMMmTVwTynpZ83CTYLi7ASA8Xi3SSLBdDL6eGUUuat';
  public static readonly IDENTITY_FILE: string = 'identity.json';
  public static readonly INDEX_FILE: string = 'index.html';

  public alpress;
  public resolver;
  public subdomain!: string;

  constructor(
    public node: IPFS,
    public web3: Web3 | any = null,
    alpress_address: string,
    alpress_resolver_address: string
  ) {
    this.node = node;
    this.web3 = web3;
    this.alpress = new web3.eth.Contract(AlpressRegistrar.abi, alpress_address);
    this.resolver = new web3.eth.Contract(
      AlpressResolver.abi,
      alpress_resolver_address
    );
  }

  /* Public methods */

  public async getAuthor(cid: IPFSPath): Promise<Author> {
    const { value }: { value: Author } = (await this.get(cid)) as any;
    return value;
  }

  public async putAuthor(author: Author): Promise<IPFSPath> {
    const author_cid: IPFSPath = await this.put({ ...author }, null);
    return author_cid;
  }

  public async getBucket(cid: IPFSPath): Promise<Bucket> {
    const { value }: { value: Bucket } = (await this.get(cid)) as any;
    return value;
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
   * @param subdomain ENS address e.g. 'mdt.eth'
   */
  public async retrieveLatestBucket(): Promise<Bucket> {
    if(!this.subdomain) throw new Error("We couldn't find your account.");
    const content_hash: string = await this.getContenthash(this.subdomain);
    const identity: Identity = await this.retrieveIdentity(content_hash);
    // TO DO be sure returned object is casted into Identity model
    // otherwise the one below will not work
    let bucket_cid: any = identity.getBucketCID(0);
    const bucket = new Bucket([]);
    bucket.setIndex(1);

    if (!bucket_cid) {
      return bucket;
    }
    bucket_cid = new CIDs(
      1,
      bucket_cid.codec,
      Buffer.from(bucket_cid.hash.data)
    );
    const bucket_info = await this.getBucket(bucket_cid);
    bucket.loadBucket(bucket_info);
    return bucket;
  }

  public async getArticleHeader(cid: IPFSPath): Promise<ArticleHeader> {
    const { value }: { value: ArticleHeader } = (await this.get(cid)) as any;
    return value;
  }

  public async putArticleHeader(article_header: ArticleHeader): Promise<IPFSPath> {
    const article_header_cid: IPFSPath = await this.put({ ...article_header }, null);
    return article_header_cid;
  }

  public async getArticle(cid: IPFSPath): Promise<Article> {
    const { value }: { value: Article } = (await this.get(cid)) as any;
    return value;
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
    article: Article,
    author: Author,
    cover_image: string,
    options: object
  ): Promise<void> {
    if(!this.subdomain) throw new Error("We couldn't find your account.");
    const article_cid: IPFSPath = await this.putArticle(article);

    // TO DO think of a way to extract summary, title for Article Summary model
    const article_header = new ArticleHeader(
      article_cid,
      'Test Demo',
      author,
      cover_image,
      'Test Demo',
      []
    );
    const article_header_cid = await this.putArticleHeader(article_header);

    let bucket: Bucket = await this.retrieveLatestBucket();
    const [updated_bucket_cid, need_archiving] = await this.addArticleHeaderCIDToBucket(
      article_header_cid,
      bucket
    );

    console.info(
      'new bucket cid: ',
      updated_bucket_cid,
      ', needs archiving: ',
      need_archiving
    );

    await this._publish(updated_bucket_cid, need_archiving, options);
  }

  public async removeArticle(article_summary_cid: IPFSPath, options: object) {
    if(!this.subdomain) throw new Error("We couldn't find your account.");
    let bucket: Bucket = await this.retrieveLatestBucket();
    const updated_bucket_cid = await this._removeArticle(
      article_summary_cid,
      bucket
    );
    if (updated_bucket_cid) await this._publish(updated_bucket_cid, false, options);
  }

  public async replaceArticle(
    old_article_summary_cid: IPFSPath,
    new_article: Article,
    author: Author,
    cover_image: string,
    options
  ) {
    if(!this.subdomain) throw new Error("We couldn't find your account.");
    const article_cid: IPFSPath = await this.putArticle(new_article);
    // TO DO think of a way to extract summary, title for Article Summary model
    const article_header = new ArticleHeader(
      article_cid,
      'Test Demo',
      author,
      cover_image,
      'Test Demo',
      []
    );
    const new_article_summary_cid = await this.putArticleHeader(article_header);
    let bucket: Bucket = await this.retrieveLatestBucket();
    const updated_bucket_cid = await this._replaceArticle(
      old_article_summary_cid,
      new_article_summary_cid,
      bucket
    );
    if (updated_bucket_cid) await this._publish(updated_bucket_cid, false, options);
  }

  public async addArticleHeaderCIDToBucket(
    article_header_cid: IPFSPath,
    bucket: Bucket
  ): Promise<[IPFSPath, boolean]> {
    let need_archiving: boolean = false;
    let updated_bucket_cid: IPFSPath;
    let bucket_index = bucket.getIndex();

    if (bucket.size() < Bucket.BUCKET_LIMIT) {
      
      // If bucket is not full, just add article
      bucket.addArticleHeaderCID(article_header_cid);

    } else if (bucket_index < Bucket.NON_ARCHIVE_LIMIT) {
      bucket.addArticleHeaderCID(article_header_cid);
      let removed_article_header_cid: IPFSPath = bucket.removeLastArticleHeaderCID();
      let previous_bucket_cid = bucket.getPreviousBucketCID();
      if (previous_bucket_cid == null) {
        let new_bucket = new Bucket([removed_article_header_cid], null);
        new_bucket.setIndex(bucket_index + 1);
        let new_bucket_cid = await this.putBucket(new_bucket);

        bucket.setPreviousBucketCID(new_bucket_cid);
      } else {
        let previous: Bucket = await this.getBucket(previous_bucket_cid);
        let previous_bucket = new Bucket([]);
        previous_bucket.loadBucket(previous);
        [previous_bucket_cid, need_archiving] = await this.addArticleHeaderCIDToBucket(
          removed_article_header_cid,
          previous_bucket
        );
        bucket.setPreviousBucketCID(previous_bucket_cid);
      }

      if (need_archiving) {
        bucket = await this.archiving(bucket);
      }
    } else {
      // bucket.index == bucket.NON_ARCHIVE_LIMIT
      // archive bucket
      bucket.setIndex(-1);
      updated_bucket_cid = await this.putBucket(bucket);

      //create new bucket to replace it. It begins with one article, but will be filled in the archiving process
      let new_bucket = new Bucket([article_header_cid], updated_bucket_cid);
      new_bucket.setIndex(Bucket.NON_ARCHIVE_LIMIT);
      const new_bucket_cid: IPFSPath = (updated_bucket_cid = await this.putBucket(
        new_bucket
      ));

      return [new_bucket_cid, true];
    }

    updated_bucket_cid = await this.putBucket(bucket);
    return [updated_bucket_cid, need_archiving];
  }

  /**
   * removes an article from the dlog.
   * function uses recursive search to find the bucket that has the article.
   * it deletes the articles from the bucket,  and updates recursively all the CIDs.
   * @param  {IPFSPath} article_summary_cid [description]
   * @param  {Bucket}   bucket              bucket from which function start to look for the article
   * @return {Promise}                      returns [CID of updated bucket, true] if article was found
   *                                        or [nul, false] otherwise.
   */
  private async _removeArticle(
    article_summary_cid: IPFSPath,
    bucket: Bucket
  ): Promise<IPFSPath | null> {
    let updated_bucket_cid: IPFSPath | null = null;
    let bucket_cid_update_needed: boolean = false;

    // search article in bucket
    let article_index = bucket.searchArticle(article_summary_cid);

    // if found, remove article
    if (article_index > -1) {
      bucket.removeArticle(article_index);
      bucket_cid_update_needed = true;

      // if not found, search recursively in previous bucket
    } else {
      let previous_bucket_cid = bucket.getPreviousBucketCID();
      if (previous_bucket_cid) {
        // create a bucket object from previous_bucket_cid
        let previous: Bucket = await this.getBucket(previous_bucket_cid);
        let previous_bucket = new Bucket([]);
        previous_bucket.loadBucket(previous);

        updated_bucket_cid = await this._removeArticle(
          article_summary_cid,
          previous_bucket
        );

        if (updated_bucket_cid) {
          bucket.setPreviousBucketCID(updated_bucket_cid);
          bucket_cid_update_needed = true;
        }
      }
    }

    if (bucket_cid_update_needed)
      updated_bucket_cid = await this.putBucket(bucket);

    return updated_bucket_cid;
  }

  private async _replaceArticle(
    old_article_summary_cid: IPFSPath,
    new_article_summary_cid: IPFSPath,
    bucket: Bucket
  ): Promise<IPFSPath | null> {
    let updated_bucket_cid: IPFSPath | null = null;
    let bucket_cid_update_needed: boolean = false;

    // search article in bucket
    let old_article_index = bucket.searchArticle(old_article_summary_cid);

    // if found, modify article
    if (old_article_index > -1) {
      bucket.replaceArticle(old_article_index, new_article_summary_cid);
      bucket_cid_update_needed = true;

      // if not found, search recursively in previous bucket
    } else {
      let previous_bucket_cid = bucket.getPreviousBucketCID();
      if (previous_bucket_cid) {
        // create a bucket object from previous_bucket_cid
        let previous: Bucket = await this.getBucket(previous_bucket_cid);
        let previous_bucket = new Bucket([]);
        previous_bucket.loadBucket(previous);

        updated_bucket_cid = await this._replaceArticle(
          old_article_summary_cid,
          new_article_summary_cid,
          previous_bucket
        );

        if (updated_bucket_cid) {
          bucket.setPreviousBucketCID(updated_bucket_cid);
          bucket_cid_update_needed = true;
        }
      }
    }

    if (bucket_cid_update_needed)
      updated_bucket_cid = await this.putBucket(bucket);

    return updated_bucket_cid;
  }

  public async archiving(bucket: Bucket): Promise<Bucket> {
    let previous: Bucket = await this.getBucket(
      bucket.getPreviousBucketCID() as IPFSPath
    );
    let previous_bucket = new Bucket([]);
    previous_bucket.loadBucket(previous);

    // APBAA = Articles Per Bucket After Archiving
    let base_APBAA_divisor =
      Bucket.BUCKET_LIMIT -
      Math.floor((Bucket.BUCKET_LIMIT - 1) / Bucket.NON_ARCHIVE_LIMIT);
    let base_APBAA_modulo =
      (Bucket.BUCKET_LIMIT - 1) % Bucket.NON_ARCHIVE_LIMIT;

    let article_headers_to_pass = base_APBAA_divisor - previous_bucket.size();
    if (previous_bucket.getIndex() <= base_APBAA_modulo)
      article_headers_to_pass = article_headers_to_pass + 1;

    let article_cids: IPFSPath[] = [];

    for (let i = 0; i < article_headers_to_pass; i++)
      article_cids[i] = bucket.removeLastArticleHeaderCID();

    previous_bucket.addArticleHeaderCIDs(article_cids);
    let previous_bucket_new_cid = await this.putBucket(previous_bucket);
    bucket.setPreviousBucketCID(previous_bucket_new_cid);

    return bucket;
  }

  private async _publish(
    updated_bucket_cid: IPFSPath,
    need_archiving: boolean = false,
    options: object
  ) {
    const content_hash: string = await this.getContenthash(this.subdomain);
    const identity: Identity = await this.retrieveIdentity(content_hash);

    identity.updateBucketCID(updated_bucket_cid, need_archiving);

    const user_cid: IPFSPath = await this.createIdentity(identity);
    try {
      const result = await this.alpress.methods
        .publish(this.subdomain, contentHash.fromIpfs(user_cid.toString()))
        .send(options);
      return result;
    } catch(error) {
      return error;
    }
  }

  /**
   *
   * @param content_hash string of CID object
   */
  public async retrieveIdentity(content_hash: string): Promise<Identity> {
    /**
     * look for reading identity
     * @see https://github.com/ipfs/js-ipfs/blob/master/docs/core-api/FILES.md#ipfsgetipfspath-options
     * @see https://github.com/ipfs/js-ipfs/blob/master/docs/core-api/OBJECT.md#ipfsobjectgetcid-options
     */
    const identity_data = await this.getFiles(
      this.pathJoin([content_hash, DLog.IDENTITY_FILE])
    );
    const { author_cid, bucket_cids } = JSON.parse(identity_data[0].toString());
    const identity = new Identity(
      new CIDs(1, author_cid.codec, Buffer.from(author_cid.hash.data)),
      bucket_cids
    );
    return identity;
  }

  /**
   * // Legacy code
   * @param content_hash CID object of identity
   */
  // public async pinIdentity(content_hash: IPFSPath): Promise<IPFSPath> {
  //   const pinset: Array<{ cid: IPFSPath }> = await this.pin(content_hash);
  //   // TO DO error handle
  //   return pinset[0].cid.toString('utf-8');
  // }

  /**
   *
   * @param identity [User identity model, has Author CID and list of CID of most recent 3 bucket]
   */
  public async createIdentity(identity: Identity): Promise<IPFSPath> {
    /**
     * look for writing identity + main page CID
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
      {
        create: true,
        truncate: true
      }
    );
    await this.cp(
      DLog.AUTHOR_PAGE,
      this.pathJoin(['/stuff', DLog.INDEX_FILE]),
      {
        parents: true,
        format: 'dag-pb',
        hashAlg: 'sha2-256',
        flush: true,
        timeout: 5000
      }
    );
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
    subdomain: string,
    identity: Identity,
    options?: object
  ): Promise<string> {
    const _identity = new Identity(identity.author_cid);
    const user_cid = await this.createIdentity(_identity);
    
    try {
      await this.alpress.methods.buy(subdomain).send({
        ...options,
        value: this.web3.utils.toWei('0.005', 'ether')
      });
    } catch(error) {
      return error;
    }

    try {
      const result = await this.alpress.methods
        .publish(subdomain, contentHash.fromIpfs(user_cid.toString()))
        .send(options);
     
      await this.setSubdomain(options);
      return result;
    } catch(error) {
      return error;
    }
  }

  public async setSubdomain(options): Promise<void> {
    try {
      const result = await this.alpress.methods
        .getName()
        .call(options);

        this.subdomain = result
    } catch(error) {
      return error;
    }
  }

  public async checkTaken(domain: string): Promise<boolean> {
    try {
      const takenResult = await this.alpress.methods.checkTaken(domain).call();
      return takenResult;
    } catch(error) {
      return error;
    }
  }

  /**
   * Return versions of all active libraries
   */
  public async version(): Promise<{
    readonly ipfs: object;
    readonly dlog: string;
  }> {
    const ipfs_version = await this.node.version();
    var pjson = require('../../../package.json');
    let dlog_version: string = pjson.version;
    return { ipfs: ipfs_version, dlog: dlog_version };
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

  /**
   * //Legacy code
   * @param cid IPFS content hash
   */
  // private async pin(cid: IPFSPath): Promise<Array<{ cid: IPFSPath }>> {
  //   const pinset = await this.node.pin.add(cid.toString(), {
  //     recursive: true
  //   });
  //   return pinset;
  // }

  private async cp(
    from: IPFSPath | string,
    to: string,
    options: object = {}
  ): Promise<void> {
    try {
      await this.node.files.cp(from, to, options);
    } catch (error) {
      console.warn('IPFS.Files.CP', error.code, from);
      if (error.code == 'ERR_ALREADY_EXISTS') return;

      for await (const file of this.node.get(from)) {
        if (!file.content) continue;
        const cp_content = await this.fromBuffer(file.content);
        await this.node.files.write(to, cp_content, { create: true });
      }
    }
  }

  // private async getContentHash(ens_address: string): Promise<string> {
  //   const content_hash: string = await this.web3.eth.ens.getContent(
  //     ens_address
  //   );
  //   return content_hash;
  // }

  public async getContenthash(subdomain: string): Promise<string> {
    const sub_address = namehash.hash(`${subdomain}.${DLog.ROOT_DOMAIN}`);

    try {
      const content = await this.resolver.methods.contenthash(sub_address).call();
      const content_hash = contentHash.decode(this.web3.utils.toAscii(content));
      return content_hash;
    } catch(error) {
      return error;
    }
  }

  // private async setContentHash(ens: ENSContent): Promise<string> {
  //   const result = await this.web3.eth.ens.setContentHash(
  //     ens.address,
  //     ens.content_hash,
  //     ens.options
  //   );
  //   return result;
  // }

  private async fromBuffer(chunks: AsyncIterable<BufferList>): Promise<string> {
    const content = new BufferList();
    for await (const chunk of chunks) {
      content.append(chunk);
    }
    return content.toString('utf-8');
  }

  private pathJoin(parts: String[], separator: string = '/') {
    const replace = new RegExp(separator + '{1,}', 'g');
    return parts.join(separator).replace(replace, separator);
  }
  // private getBytes32FromIpfsHash(hash: string): string {
  //   return `0x${bs58
  //     .decode(hash)
  //     .slice(2)
  //     .toString('hex')}`;
  // }
}

export * from './utils';

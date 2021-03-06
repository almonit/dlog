// import all from 'it-all';
import { AlpressRegistrar, AlpressResolver } from '@dlog/alpress-contracts';
import BufferList from 'bl';
import CIDs from 'cids';
import contentHash from 'content-hash';
import { loadJSON } from '@dlog/dlog-utils';
import { IPFS } from 'ipfs';
import namehash from 'eth-ens-namehash';
import Web3 from 'web3';

import {
  Article,
  ArticleHeader,
  ArticlesIndex,
  Author,
  Bucket,
  Identity
} from './models';
import { Session } from './models/session';
import Multiaddr from 'multiaddr';

export class DLog {
  public static readonly ROOT_DOMAIN: string = 'alpress.eth';

  public static readonly IDENTITY_FILE: string = 'identity.json';
  public static readonly ARTICLES_INDEX: string = 'articles_index.json';
  public static readonly INDEX_FILE: string = 'index.html';

  public alpress;
  public resolver;
  public author_page: string;
  private session: Session = new Session();
  private swarm_topic: string = 'AlpressTestnet';

  constructor(
    public node: IPFS,
    public web3: Web3 | any = null,
    alpress_address: string,
    alpress_resolver_address: string,
    author_page: string = '/ipfs/QmTRfMMmTVwTynpZ83CTYLi7ASA8Xi3SSLBdDL6eGUUuat',
    swarm_topic?: string
  ) {
    this.node = node;
    this.web3 = web3;
    this.alpress = new web3.eth.Contract(AlpressRegistrar.abi, alpress_address);
    this.resolver = new web3.eth.Contract(
      AlpressResolver.abi,
      alpress_resolver_address
    );
    this.author_page = author_page;
    if (swarm_topic) this.swarm_topic = swarm_topic;
  }

  /* Public methods */
  public async getAuthor(cid: any): Promise<Author> {
    const { value }: { value: Author } = (await this.get(cid)) as any;
    return value;
  }

  public async putAuthor(author: Author): Promise<any> {
    try {
      const author_cid: any = await this.put({ ...author });
      this.session.setAuthor(author);
      return author_cid;
    } catch (error) {
      throw Error(error);
    }
  }

  public async getBucket(cid: any): Promise<Bucket> {
    const { value }: { value: Bucket } = (await this.get(cid)) as any;
    return value;
  }

  public async putBucket(bucket: Bucket): Promise<any> {
    try {
      const bucket_cid: any = await this.put({ ...bucket });
      return bucket_cid;
    } catch (error) {
      throw Error(error);
    }
  }

  /**
   * @desc
   * Method for getting content hash from given ens address,
   * then will retrieve identity json file from ipfs hash
   * and lastly will read the `buckets` key of the `identity.json`
   * then return the latest bucket CID
   *
   */
  public async retrieveLatestBucket(): Promise<Bucket> {
    const subdomain = this.session.getSubdomain();
    const content_hash: string = await this.getContenthash(subdomain);
    const identity: Identity = await this.retrieveIdentity(content_hash);
    const author: Author = await this.getAuthor(identity.getAuthorCID());
    this.session.setAuthor(author);

    let bucket_cid: any = identity.getBucketCID(0);
    const bucket = new Bucket([]);
    bucket.setIndex(1);
    if (!bucket_cid) {
      return bucket;
    }
    bucket_cid = new CIDs(
      1,
      bucket_cid.codec,
      new Uint8Array(Object.values(bucket_cid.hash))
    );
    const bucket_info = await this.getBucket(bucket_cid);
    bucket.loadBucket(bucket_info);
    return bucket;
  }

  public async retrieveAuthor(): Promise<Author> {
    let identity_file;
    try {
      const subdomain = this.session.getSubdomain();
      const content_hash: string = await this.getContenthash(subdomain);
      const identity_data = await this.getFiles(
        this.pathJoin([content_hash, '/static', DLog.IDENTITY_FILE])
      );
      identity_file = JSON.parse(identity_data[0].toString());
    } catch (error) {
      identity_file = await loadJSON(`./static/${DLog.IDENTITY_FILE}`);
    }
    const identity = new Identity(
      new CIDs(
        1,
        identity_file.author_cid.codec,
        new Uint8Array(Object.values(identity_file.author_cid.hash))
      ),
      identity_file.bucket_cids
    );
    const author: Author = await this.getAuthor(identity.getAuthorCID());

    return author;
  }

  public async getArticleHeader(
    cid: any,
    options = {}
  ): Promise<ArticleHeader> {
    const { value }: { value: ArticleHeader } = (await this.get(
      cid,
      options
    )) as any;
    return value;
  }

  public async putArticleHeader(article_header: ArticleHeader): Promise<any> {
    const article_header_cid: any = await this.put({ ...article_header });
    return article_header_cid;
  }

  public async getArticleHeaderCIDFromIndex(article_id: string): Promise<any | boolean> {
    let articles_index: ArticlesIndex = await this.retrieveArticlesIndex();
    const article_header_cid = articles_index.getArticleHeaderCID(article_id);
    if (!article_header_cid) return false;

    const { version, codec, hash } = article_header_cid
    let cid = new CIDs(
      version,
      codec,
      new Buffer(Object.values(hash))
    );
    return cid.toString();
  }

  public async getArticle(cid: any): Promise<Article> {
    if (typeof cid !== 'string')
      cid = new CIDs(
        cid['version'],
        cid['codec'],
        new Buffer(Object.values(cid['hash']))
      );
    const { value }: { value: Article } = (await this.get(cid)) as any;
    return value;
  }

  public async putArticle(article: Article): Promise<any> {
    const article_cid: any = await this.put({ ...article });
    return article_cid;
  }

  /**
   *
   * @param article     Article Object
   * @param options     send options Object
   */
  public async publishArticle(
    article: Article,
    options: object
  ): Promise<string> {
    const author = this.session.getAuthor();
    const article_cid: any = await this.putArticle(article);
    const { title, cover_image, summary } = this._harvestArticle(
      article.serializedArticle
    );

    // create article_id
    let articles_index: ArticlesIndex = await this.retrieveArticlesIndex();
    let article_id = articles_index.createArticleID(title);

    // TO DO think of a way to extract summary, title for Article Summary model
    const article_header = new ArticleHeader(
      article_cid,
      title,
      article_id,
      author,
      cover_image,
      summary,
      []
    );
    const article_header_cid = await this.putArticleHeader(article_header);

    // add article to index
    articles_index.addArticle(article_id, article_header_cid);

    let bucket: Bucket = await this.retrieveLatestBucket();
    const [
      updated_bucket_cid,
      need_archiving
    ] = await this.addArticleHeaderCIDToBucket(article_header_cid, bucket);

    console.info(
      `new bucket cid: ${updated_bucket_cid}, needs archiving: ${need_archiving}`
    );

    await this._publish(
      updated_bucket_cid,
      articles_index,
      need_archiving,
      options
    );

    return article_id;
  }

  public async removeArticle(
    article_id: string,
    article_summary_cid: any,
    options: object
  ) {
    // remove article_id from index
    let articles_index = await this.retrieveArticlesIndex();
    articles_index.removeArticle(article_id);

    this.session.getSubdomain(); // will throw if no session
    let bucket: Bucket = await this.retrieveLatestBucket();
    const updated_bucket_cid = await this._removeArticle(
      article_summary_cid,
      bucket
    );
    if (updated_bucket_cid)
      await this._publish(updated_bucket_cid, articles_index, false, options);
  }

  public async replaceArticle(
    article_id: string,
    old_article_summary_cid: any,
    new_article: Article,
    options
  ) {
    const author = this.session.getAuthor();
    const article_cid: any = await this.putArticle(new_article);
    const { title, cover_image, summary } = this._harvestArticle(
      new_article.serializedArticle
    );
    // TO DO think of a way to extract summary, title for Article Summary model

    const article_header = new ArticleHeader(
      article_cid,
      title,
      article_id,
      author,
      cover_image,
      summary,
      []
    );
    const new_article_summary_cid = await this.putArticleHeader(article_header);

    // update article_cid in index
    let articles_index = await this.retrieveArticlesIndex();
    articles_index.updateArticle(article_id, new_article_summary_cid);

    let bucket: Bucket = await this.retrieveLatestBucket();
    const updated_bucket_cid = await this._replaceArticle(
      old_article_summary_cid,
      new_article_summary_cid,
      bucket
    );
    if (updated_bucket_cid)
      await this._publish(updated_bucket_cid, articles_index, false, options);
  }

  public async addArticleHeaderCIDToBucket(
    article_header_cid: any,
    bucket: Bucket
  ): Promise<[any, boolean]> {
    let need_archiving: boolean = false;
    let updated_bucket_cid: any;
    let bucket_index = bucket.getIndex();

    if (bucket.size() < Bucket.BUCKET_LIMIT) {
      // If bucket is not full, just add article
      bucket.addArticleHeaderCID(article_header_cid);
    } else if (bucket_index < Bucket.NON_ARCHIVE_LIMIT) {
      bucket.addArticleHeaderCID(article_header_cid);
      let removed_article_header_cid: any = bucket.removeLastArticleHeaderCID();
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
        [
          previous_bucket_cid,
          need_archiving
        ] = await this.addArticleHeaderCIDToBucket(
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
      const new_bucket_cid: any = (updated_bucket_cid = await this.putBucket(
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
   * @param  {any} article_summary_cid [description]
   * @param  {Bucket}   bucket              bucket from which function start to look for the article
   * @return {Promise}                      returns [CID of updated bucket, true] if article was found
   *                                        or [nul, false] otherwise.
   */
  private async _removeArticle(
    article_summary_cid: any,
    bucket: Bucket
  ): Promise<any | null> {
    let updated_bucket_cid: any | null = null;
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
    old_article_summary_cid: any,
    new_article_summary_cid: any,
    bucket: Bucket
  ): Promise<any | null> {
    let updated_bucket_cid: any | null = null;
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
      bucket.getPreviousBucketCID() as any
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

    let article_cids: any[] = [];

    for (let i = 0; i < article_headers_to_pass; i++)
      article_cids[i] = bucket.removeLastArticleHeaderCID();

    previous_bucket.addArticleHeaderCIDs(article_cids);
    let previous_bucket_new_cid = await this.putBucket(previous_bucket);
    bucket.setPreviousBucketCID(previous_bucket_new_cid);

    return bucket;
  }

  private async _publish(
    updated_bucket_cid: any,
    articles_index: ArticlesIndex,
    need_archiving: boolean = false,
    options: object
  ) {
    await this.node.swarm.connect(
      new Multiaddr(
        '/dns4/ipfs.almonit.club/tcp/443/wss/p2p/QmYDZk4ns1qSReQoZHcGa8jjy8SdhdAqy3eBgd1YMgGN9j'
      )
    );
    const subdomain = this.session.getSubdomain();
    const content_hash: string = await this.getContenthash(subdomain);
    const identity: Identity = await this.retrieveIdentity(content_hash);

    identity.updateBucketCID(updated_bucket_cid, need_archiving);

    const user_cid: any = await this.createIdentity(identity, articles_index);

    const msg = `${subdomain} ${user_cid.toString()}`;
    this._connectPublish(this.swarm_topic, msg, 5000);
    
    try {
      const result = await this.alpress.methods
        .publish(subdomain, this.encodeCID(user_cid.toString()))
        .send(options);
      console.log('sent to pin msg: ', msg);
      return result;
    } catch (error) {
      console.warn('error', error);
      return error;
    }
  }

  public async retrieveContentFromFile(): Promise<Bucket> {
    const result = await loadJSON(`./static/${DLog.IDENTITY_FILE}`);
    const identity = new Identity(
      new CIDs(
        1,
        result.author_cid.codec,
        new Uint8Array(Object.values(result.author_cid.hash))
      ),
      result.bucket_cids
    );
    let bucket_cid: any = identity.getBucketCID(0);
    const bucket = new Bucket([]);
    bucket.setIndex(1);

    if (!bucket_cid) {
      return bucket;
    }
    bucket_cid = new CIDs(
      1,
      bucket_cid.codec,
      new Uint8Array(Object.values(bucket_cid.hash))
    );
    const bucket_info = await this.getBucket(bucket_cid);
    bucket.loadBucket(bucket_info);
    return bucket;
  }

  /**
   *
   * @param content_hash string of CID object
   */
  public async retrieveArticlesIndex(): Promise<ArticlesIndex> {
    let article_index_obj;

    try {
      const subdomain = this.session.getSubdomain();
      const content_hash: string = await this.getContenthash(subdomain);
      const articles_index_data = await this.getFiles(
        this.pathJoin([content_hash, '/static', DLog.ARTICLES_INDEX])
      );
      article_index_obj = JSON.parse(articles_index_data[0].toString());
    } catch (error) {
      article_index_obj = await loadJSON(`./static/${DLog.ARTICLES_INDEX}`);
    }

    const articles_index = new ArticlesIndex(article_index_obj);

    return articles_index;
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
      this.pathJoin([content_hash, '/static', DLog.IDENTITY_FILE])
    );
    const { author_cid, bucket_cids } = JSON.parse(identity_data[0].toString());
    const identity = new Identity(
      new CIDs(
        1,
        author_cid.codec,
        new Uint8Array(Object.values(author_cid.hash))
      ),
      bucket_cids
    );
    return identity;
  }

  /**
   *
   * @param identity [User identity model, has Author CID and list of CID of most recent 3 bucket]
   * @description create a CID for  author identity with empty alpress
   * @see https://github.com/ipfs/js-ipfs/blob/master/docs/core-api/FILES.md#ipfsadddata-options
   * @see https://github.com/ipfs/js-ipfs/blob/master/docs/core-api/FILES.md#ipfsfilescpfrom-to-options
   */
  public async createIdentity(
    identity: Identity,
    articles_index: ArticlesIndex
  ): Promise<any> {
    // clear any existing Alprses folder
    await this.rm('/alpress', { recursive: true });

    // copy empty Alpress into the alpress folder
    await this.cp(this.author_page, '/alpress', {
      parents: true,
      format: 'dag-pb',
      hashAlg: 'sha2-256',
      flush: true,
      timeout: 15000
    });

    // copy the author identity file into /alpress/static folder
    await this.node.files.write(
      this.pathJoin(['/alpress', '/static', DLog.IDENTITY_FILE]),
      identity.asBuffer(),
      {
        create: true,
        truncate: true
      }
    );

    // copy the articles index file into /alpress/static folder
    await this.node.files.write(
      this.pathJoin(['/alpress', '/static', DLog.ARTICLES_INDEX]),
      articles_index.asBuffer(),
      {
        create: true,
        truncate: true
      }
    );

    const { cid }: { cid: any } = await this.node.files.stat('/alpress');
    // const directory_contents = await all(this.node.files.ls('/dlog'))
    // const read_chunks = this.node.files.read('/dlog/index.html', {});
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
    const _identity = new Identity(identity['author_cid']);
    const _articles_index = new ArticlesIndex(null);
    const user_cid = await this.createIdentity(_identity, _articles_index);

    try {
      const result = await this.alpress.methods
        .buyAndInitAlpress(subdomain, this.encodeCID(user_cid.toString()))
        .send({
          ...options,
          value: this.web3.utils.toWei('0.005', 'ether')
        });
      await this.setSubdomain(options);
      return result;
    } catch (error) {
      return error;
    }
  }

  public async updateAuthor(author: Author, options?: object): Promise<string> {
    const subdomain = this.session.getSubdomain();
    const content_hash: string = await this.getContenthash(subdomain);
    const identity: Identity = await this.retrieveIdentity(content_hash);
    const articles_index: ArticlesIndex = await this.retrieveArticlesIndex(); // TODO: improve, possible too many IPFS calls here
    const author_cid: any = await this.put({ ...author });
    identity.setAuthorCID(author_cid);
    const user_cid: any = await this.createIdentity(identity, articles_index);

    const msg = `${subdomain} ${user_cid.toString()}`;
    this._connectPublish(this.swarm_topic, msg, 5000);

    try {
      const result = await this.alpress.methods
        .publish(subdomain, this.encodeCID(user_cid.toString()))
        .send(options);
      return result;
    } catch (error) {
      return error;
    }
  }

  public async login(options) {
    if (!options || !Object.keys(options).length) {
      const bucket = await this.retrieveContentFromFile();
      return { subdomain: null, bucket };
    }
    const subdomain = await this.setSubdomain(options);
    if (!subdomain) return { subdomain: null, bucket: null };
    const bucket: Bucket = await this.retrieveLatestBucket();
    return { subdomain, bucket };
  }

  public logout() {
    this.session.clearSession();
  }

  public async setSubdomain(options): Promise<string | null> {
    try {
      const result = await this.alpress.methods.getName().call(options);

      if (result) this.session.setSubdomain(result);

      return result;
    } catch (error) {
      return error;
    }
  }

  public async checkTaken(domain: string): Promise<boolean> {
    try {
      const takenResult = await this.alpress.methods.checkTaken(domain).call();
      return takenResult;
    } catch (error) {
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

  private async get(cid: any, options = {}): Promise<object> {
    const object: object = await this.node.dag.get(cid as any, options);
    return object;
  }

  private async getFiles(cid: any): Promise<Object[]> {
    let contents: Object[] = [];
    for await (const file of this.node.get(cid)) {
      if (!file['content']) continue;
      const content = await this.fromBuffer(file['content']);
      contents.push(content);
    }
    return contents;
  }

  private async put(object: object, options: any = {}): Promise<any> {
    const object_cid: any = await this.node.dag.put(object, options);
    return object_cid;
  }

  // ipfs cp function with added error handling
  private async cp(
    from: any | string,
    to: string,
    options: object = { parents: true, recursive: true, timeout: 5000 }
  ): Promise<void> {
    try {
      await this.node.files.cp(from, to, options);
    } catch (error) {
      console.warn('IPFS.Files.CP', error, from);
      if (error.code == 'ERR_ALREADY_EXISTS') return;

      for await (const file of this.node.get(from)) {
        if (!file['content']) continue;
        const cp_content = await this.fromBuffer(file['content']);
        await this.node.files.write(
          this.pathJoin([to, file['name']]),
          cp_content,
          { create: true }
        );
      }
    }
  }

  // ipfs rm function with added error handling
  private async rm(
    path: string,
    options: object = { parents: true, recursive: true }
  ): Promise<void> {
    try {
      await this.node.files.rm(path, options);
    } catch (error) {
      if (error.code == 'ERR_NOT_FOUND') return;
      else console.log(error);
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
      const content = await this.resolver.methods
        .contenthash(sub_address)
        .call();
      const content_hash = contentHash.decode(content);
      return content_hash;
    } catch (error) {
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

  private encodeCID(cid: string): string {
    return `0x${contentHash.fromIpfs(cid)}`;
  }

  // private getBytes32FromIpfsHash(hash: string): string {
  //   return `0x${bs58
  //     .decode(hash)
  //     .slice(2)
  //     .toString('hex')}`;
  // }

  private async _connectPublish(topic, msg, delay: number) {
    await this.node.swarm.connect(
      new Multiaddr(
        '/dns4/ipfs.almonit.club/tcp/443/wss/p2p/QmYDZk4ns1qSReQoZHcGa8jjy8SdhdAqy3eBgd1YMgGN9j'
      )
    );

    const msgEncoded = new TextEncoder().encode(msg + '\n');

    setTimeout(() => {
      this.node.pubsub
        .publish(topic, msgEncoded, {})
        .then(() => console.log('sent to pin msg: ', msg));
    }, delay);
  }

  private _harvestArticle(article) {
    //Dummy harvesting for PoC
    if (!article) throw Error('no article found!');
    article = JSON.parse(article);
    if (!article.blocks) throw Error('article is empty');
    const title = article.blocks[0].text;
    const image: any = Object.values(article.entityMap).find((entity: any) => {
      return entity['type'] === 'IMAGE';
    });
    const cover_image = image ? image.data.src : null;
    const summary_text: any = Object.values(article.blocks).find(
      (block: any) => {
        return block['text'].length > 7 && block['type'] !== 'header-one';
      }
    );
    const summary = summary_text ? summary_text.text : '';
    return {
      title,
      cover_image,
      summary
    };
  }
}

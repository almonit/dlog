import IPFS from 'ipfs';
import Web3 from 'web3';
import { IPFSPath } from 'ipfs/types/interface-ipfs-core/common';
import { Article, ArticleHeader, Author } from './';
import {encrypt, decrypt} from '@dlog/dlog-utils';

export class DraftsBucket {
  private drafts_headers: ArticleHeader[]; // TODO: should this be IPFSPath[] like in bucket.ts?
  private name: string;
  private address: string;
  private author: Author;

  constructor(
    drafts_headers: ArticleHeader[] = [],
    name: string,
    address: string,
    author: Author
  ) {
    this.drafts_headers = drafts_headers;
    this.name = name;
    this.address = address;
    this.author = author;
  }
 

  // encrypts a draft (Article object) and adds it to IPFS.  
  // creates an article header to the draft and adds it to the draft list. 
  // return  the encrypted draft cid
  public async addDraft(
    draft: Article, title: string, cover_image: string, 
    summary: string, 
    tags: ReadonlyArray<readonly [readonly IPFSPath[], readonly string[]>,
    ipfs: IPFS, web3: Web3): Promise<IPFSPath>
  {

    // encrypt and put draft in ipfs
    let encrypted_draft = await this.encryptDraft(draft, web3);
    let encrypted_draft_cid: IPFSPath = await this.putEncryptedDraft(encrypted_draft, ipfs);

    // create draft_header of encrypted draft
    const draft_header : ArticleHeader = new ArticleHeader( 
      encrypted_draft_cid,
      title,
      this.author,
      cover_image,
      summary,
      []);
    this.drafts_headers.unshift(draft_header);

    return encrypted_draft_cid;
  }

  public replaceDraft(old_encrypted_draft_cid: IPFSPath, new_draft: Article, new_title: string, 
  	new_cover_image: string, 
    new_summary: string, 
    new_tags: ReadonlyArray<readonly [readonly IPFSPath[], readonly string[]>,
    ipfs: IPFS, web3: Web3) : Promise<IPFSPath> | any {

    // search and remove old encrypted draft
    const old_encrypted_draft_index = this.searchDraft(old_encrypted_draft_cid);

     if (old_encrypted_draft_index == -1) {
       console.log("encrypted_draft_cid not found in draft headers");
       return;
     }

     this.drafts_headers.splice(old_encrypted_draft_index,1);

     // add new Draft at the top of the bucket
     const new_encrypted_draft_header_cid = this.addDraft(new_draft, new_title, new_cover_image, new_summary, new_tags, ipfs, web3);

     return new_encrypted_draft_header_cid;
  }

   public removeDraft(encrypted_draft_cid: IPFSPath | any) : void
   {

     // if parameter is empty remove last article
     if (encrypted_draft_cid == null)
       this.drafts_headers.pop() as ArticleHeader;

     const encrypted_draft_index = this.searchDraft(encrypted_draft_cid);

     if (encrypted_draft_index == -1)
       console.log("encrypted_draft_cid not found in draft headers");

     this.drafts_headers.splice(encrypted_draft_index,1);
   }

  public searchDraft(encrypted_draft_cid: IPFSPath): number {
    return this.drafts_headers.findIndex(
      draft_header => draft_header.article_cid.toString() === encrypted_draft_cid.toString()
    );
  } 

  // TODO: is such a function needed? If not, remove those comments
  // public addDrafts(draft_summary_CIDs: ArticleHeader[]): void {
  //   for (let i = 0; i < draft_summary_CIDs.length; i++) {
  //     this.drafts_list_items.unshift(draft_summary_CIDs[i]);
  //   }
  // }


  /**
   *
   * @param removes the last article and returns its CID
   */
  public removeLastDraft(): ArticleHeader {
    return this.drafts_headers.pop() as ArticleHeader;
  }

  /**
   * size of bucket
   */
  public size(): number {
    return this.drafts_headers.length;
  }


  public async encryptDraft(draft: Article, web3: Web3): Promise<string> {
    let draft_serialized = JSON.stringify(draft);
    let encrypted_draft: string = await encrypt(draft_serialized, this.name, this.address, web3);
    
    return encrypted_draft;
  }

  public async decryptDraft(enrypted_draft: string, web3: Web3): Promise<Article> {
    let decypted_draft_serialized: string = await decrypt(enrypted_draft, this.name, this.address, web3);
    let decrypted_draft : Article = JSON.parse(decypted_draft_serialized);

    return decrypted_draft;
  }

  // puts encrypted draft in ipfs 
  public async putEncryptedDraft(encrypted_draft: string, ipfs: IPFS): Promise<IPFSPath> {
    let encrypted_draft_obj = {encrypted_draft: encrypted_draft};
    const encrypted_draft_cid: IPFSPath = await this.put({ ...encrypted_draft_obj, ipfs }, ipfs);
    
    return encrypted_draft_cid;
  }

  // retrieve encrypted draft from ipfs (by CID)
  public async getEncryptedDraft(cid: IPFSPath, ipfs: IPFS, web3: Web3): Promise<string> {
    let result = (await this.get(cid, ipfs)) as any;
    let value = result.value;
    let encrypted_draft = value.encrypted_draft;
    return encrypted_draft;
  }

  private async put(object: object, ipfs: IPFS, options: any = null): Promise<IPFSPath> {
    const object_cid: IPFSPath = await ipfs.dag.put(object, options);
    return object_cid;
  }

  private async get(cid: IPFSPath, ipfs: IPFS): Promise<object> {
    const object: object = await ipfs.dag.get(cid.toString());
    return object;
  }

  // misc
  public async setName(name: string) {
  	this.name = name;
  }

  public async setAddress(address: address) {
  	this.address = address;
  }

  public async setAuthor(author: Author) {
  	this.author = author;
  }
}
// tslint:disable:no-expression-statement
// tslint:disable:no-string-literal
// tslint:disable:no-object-mutation
import test from 'ava';
import bs58 from 'bs58';
import { ENSRegistry, FIFSRegistrar } from '@ensdomains/ens';
import { PublicResolver } from '@ensdomains/resolver';
import IPFS from 'ipfs';
import namehash from 'eth-ens-namehash';
import Web3 from 'web3';
import { DLog } from './dlog';
import { Article, ArticleSummary, Author, Bucket, Identity} from './models';

const ganache = require('ganache-core');

function getRootNodeFromTLD(web3, tld) {
  return {
    namehash: namehash.hash(tld),
    sha3: web3.utils.sha3(tld)
  };
}

test.before(async t => {
  const repoPath = 'repo/ipfs-' + Math.random();
  const ipfs = await IPFS.create({ repo: repoPath });
  // const provider = new Web3.providers.HttpProvider('http://localhost:7545');
  const provider = ganache.provider({
    allowUnlimitedContractSize: true,
    gasLimit: 3000000000,
    gasPrice: 20000
  });
  const web3 = new Web3(
    provider as any
    // 'https://:62ff7188c74447b6a67afbc2de247610@ropsten.infura.io/v3/372375d582d843c48a4eaee6aa5c1b3a'
  );

  const addressLabel = web3.utils.sha3('mdtsomething');
  const address = namehash.hash('mdtsomething.eth');
  const rootNode = getRootNodeFromTLD(web3, 'eth');
  const accounts = await web3.eth.getAccounts();
  const main_account = accounts[0];
  // const RegistryContract = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
  // const FIFSRegistrarContract = '0x21397c1A1F4aCD9132fE36Df011610564b87E24b';
  // const PublicResolverContract = '0xde469c7106a9fbc3fb98912bb00be983a89bddca';
  const send_options = {
    gas: 5000000,
    gasPrice: '3000000',
    from: main_account
  };

  const instanceRegistry = new web3.eth.Contract(ENSRegistry.abi);
  const contractRegistry = await instanceRegistry
    .deploy({
      data: ENSRegistry.bytecode
    })
    .send(send_options);

  const instanceResolver = new web3.eth.Contract(PublicResolver.abi);
  const contractResolver = await instanceResolver
    .deploy({
      data: PublicResolver.bytecode,
      arguments: [contractRegistry.options.address]
    })
    .send(send_options);

  const resolverMethods = contractResolver.methods;

  const instanceTestRegistrar = new web3.eth.Contract(FIFSRegistrar.abi);
  const contractTestRegistrar = await instanceTestRegistrar
    .deploy({
      data: FIFSRegistrar.bytecode,
      arguments: [contractRegistry.options.address, rootNode.namehash]
    })
    .send(send_options);

  await contractRegistry.methods
    .setSubnodeOwner(
      '0x0000000000000000000000000000000000000000',
      rootNode.sha3,
      contractTestRegistrar.options.address
    )
    .send(send_options);

  const owner = await contractRegistry.methods.owner(address).call();
  console.info('owner', owner);
  if (owner === '0x0000000000000000000000000000000000000000') {
    await contractTestRegistrar.methods
      .register(addressLabel, main_account)
      .send(send_options);

    await contractRegistry.methods
      .setResolver(address, contractResolver.options.address)
      .send(send_options);
  }

  t.context['ens'] = {
    address: address,
    account: main_account,
    resolver: resolverMethods,
    sendOptions: send_options
  };
  t.context['dlog'] = new DLog(ipfs, web3);
});

test('verify version', async t => {
  const dlog = t.context['dlog'];
  const version = await dlog.version();
  console.log('version', version);
  t.is(version.dlog, '1.0.0');
});

test('put/get author', async t => {
  const dlog = t.context['dlog'];
  const author: Author = { name: 'mdt', profile_image: '', social_links: [] };
  const cid_author = await dlog.putAuthor(author);
  const result_author = await dlog.getAuthor(cid_author.toString());
  t.context['cid_author'] = cid_author;
  t.context['author'] = author;
  t.is(result_author.name, author.name);
});

test('put/get article', async t => {
  const dlog = t.context['dlog'];
  const author: Author = { name: 'mdt', profile_image: '', social_links: [] };
  const article = new Article(
    author,
    'Test',
    'base64_img',
    []
  );
  const cid_article = await dlog.putArticle(article);
  const result_article = await dlog.getArticle(cid_article.toString());
  t.context['article'] = cid_article;
  t.is(result_article.content, article.content);
});

test('put/get article summary', async t => {
  const dlog = t.context['dlog'];
  const author: Author = { name: 'mdt', profile_image: '', social_links: [] };
  const article = new Article(
    author,
    'Test',
    'base64_img',
    []
  );
  const cid_article = await dlog.putArticle(article);

  const article_summary = new ArticleSummary(
    author,
    cid_article,
    'base64_img',
    'Test',
    'First Title'
  );
  const cid_AS = await dlog.putArticleSummary(article_summary);
  const result_aso = await dlog.getArticleSummary(cid_AS.toString());
  t.context['AS'] = cid_AS;
  t.is(result_aso.title, article_summary.title);
});

test('test archiving', async t => {
  const ARTICLES_TO_PUSH = 31;
  const dlog = t.context['dlog'];
  const author: Author = { name: 'mdt', profile_image: '', social_links: [] };

  const article = new Article(
    author,
    'Test',
    'base64_img',
    []
  );
  const cid_article = await dlog.putArticle(article);

  const article_summary = new ArticleSummary(
    author,
    cid_article,
    'base64_img',
    'Test',
    'First Title'
  );
  const cid_AS = await dlog.putArticleSummary(article_summary);

  const bucket = new Bucket([]);
  bucket.setIndex(1);

  // push many articles to test archiving
  let i;
  for (i=1; i<=ARTICLES_TO_PUSH; i++) {
    var [new_bucket_cid, archiving] = await dlog.addArticleToBucket(cid_AS, bucket);
    let temp_bucket = await dlog.getBucket(new_bucket_cid.toString()) as Bucket;
    bucket.loadBucket(temp_bucket);
  }

  t.is(bucket.size(), 7);
  t.is(archiving, true);
});

test('put/get bucket', async t => {
  const dlog = t.context['dlog'];
  const author: Author = { name: 'mdt', profile_image: '', social_links: [] };
  const article = new Article(
    author,
    'Test',
    'base64_img',
    []
  );
  const cid_article = await dlog.putArticle(article);

  const article_summary = new ArticleSummary(
    author,
    cid_article,
    'base64_img',
    'Test',
    'First Title'
  );
  const cid_AS = await dlog.putArticleSummary(article_summary);

  const bucket = new Bucket([]);
  bucket.addArticle(cid_AS);
  const cid_bucket = await dlog.putBucket(bucket);
  let result_bucket = new Bucket([]);
  let temp_bucket = await dlog.getBucket(cid_bucket.toString()) as Bucket;
  result_bucket.loadBucket(temp_bucket);
  t.deepEqual(result_bucket.getArticle(0), bucket.getArticle(0));
});

test('put/get identity', async t => {
  const dlog = t.context['dlog'];
  const author: Author = { name: 'mdt', profile_image: '', social_links: [] };
  const author_cid = await dlog.putAuthor(author);
  const identity = new Identity(author_cid);
  const identity_cid = await dlog.createIdentity(identity);
  // const pinned_cid = await dlog.pinIdentity(identity_cid);
  const result_identity = await dlog.retrieveIdentity(identity_cid);
  t.is(JSON.stringify(identity), JSON.stringify(result_identity));
});

test('register', async t => {
  const dlog = t.context['dlog'];
  const { address, resolver, sendOptions } = t.context['ens'];
  const author: Author = { name: 'mdt', profile_image: '', social_links: [] };
  const author_cid = await dlog.putAuthor(author);
  const identity = new Identity(author_cid);
  const identity_cid = await dlog.createIdentity(identity);
  // await dlog.register(
  //   'mdtsomething.eth',
  //   identity,
  //   sendOptions
  // );
  await resolver
    .setContenthash(address, getBytes32FromIpfsHash(identity_cid.toString()))
    .send(sendOptions);
  const content = await resolver.contenthash(address).call();
  const content_hash = getIpfsHashFromBytes32(content);
  const retrieved_identity = await dlog.retrieveIdentity(content_hash);
  t.is(retrieved_identity.author.toString(), identity.author.toString());
});


/**
 * Auxiliary functions
 */
function getBytes32FromIpfsHash(hash: string) {
  return `0x${bs58
    .decode(hash)
    .slice(2)
    .toString('hex')}`;
}

function getIpfsHashFromBytes32(bytes32Hex) {
  // Add our default ipfs values for first 2 bytes:
  // function:0x12=sha2, size:0x20=256 bits
  // and cut off leading "0x"
  const hashHex = '1220' + bytes32Hex.slice(2);
  const hashBytes = Buffer.from(hashHex, 'hex');
  const hashStr = bs58.encode(hashBytes);
  return hashStr;
}
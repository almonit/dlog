// tslint:disable:no-expression-statement
// tslint:disable:no-string-literal
// tslint:disable:no-object-mutation
import { ENSRegistry, FIFSRegistrar } from '@ensdomains/ens';
// import { PublicResolver } from '@ensdomains/resolver';
import test from 'ava';
// import bs58 from 'bs58';
import contentHash from 'content-hash';
import namehash from 'eth-ens-namehash';
import IPFS from 'ipfs';
import Web3 from 'web3';
import { AbstractProvider } from 'web3-core/types';

import { AlpressResolver, AlpressRegistrar } from '../contracts';
import { DLog } from './dlog';
import { Article, ArticleSummary, Author, Bucket, Identity } from './models';

const ganache = require('ganache-core');

test.before(async t => {
  const repoPath = 'repo/ipfs-' + Math.random();
  const ipfs = await IPFS.create({ repo: repoPath });
  await ipfs.bootstrap.add(
    '/ip4/95.179.128.10/tcp/5001/p2p/QmYDZk4ns1qSReQoZHcGa8jjy8SdhdAqy3eBgd1YMgGN9j'
  );
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

  const address_label = web3.utils.sha3('alpress');
  const address = namehash.hash('alpress.eth');
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

  const instanceAlpressRegistrar = new web3.eth.Contract(
    AlpressRegistrar.abi as any
  );
  const contractAlpressRegistrar = await instanceAlpressRegistrar
    .deploy({
      data: AlpressRegistrar.bytecode,
      arguments: [
        contractRegistry.options.address,
        '0x0000000000000000000000000000000000000000'
      ]
    })
    .send(send_options);

  const instanceResolver = new web3.eth.Contract(AlpressResolver.abi as any);
  const contractResolver = await instanceResolver
    .deploy({
      data: AlpressResolver.bytecode,
      arguments: [
        contractRegistry.options.address,
        contractAlpressRegistrar.options.address
      ]
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

  if (owner === '0x0000000000000000000000000000000000000000') {
    await contractTestRegistrar.methods
      .register(address_label, main_account)
      .send(send_options);

    await contractRegistry.methods
      .setResolver(address, contractResolver.options.address)
      .send(send_options);
    
    await contractRegistry.methods
      .setOwner(address, contractAlpressRegistrar.options.address)
      .send(send_options);
  }

  await contractAlpressRegistrar.methods
    .setDefaultResolver(contractResolver.options.address)
    .send(send_options);

  t.context['ens'] = {
    address: address,
    account: main_account,
    registry: contractRegistry.methods,
    resolver: resolverMethods,
    sendOptions: send_options,
    web3: web3
  };
  t.context['dlog'] = new DLog(ipfs, web3, contractAlpressRegistrar.options.address);
  t.context['alpress'] = contractAlpressRegistrar;
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
  t.is(result_author.name, author.name);
});

test('put/get article', async t => {
  const dlog = t.context['dlog'];
  const author: Author = { name: 'mdt', profile_image: '', social_links: [] };
  const article = new Article(author, 'Test', 'base64_img', []);
  const cid_article = await dlog.putArticle(article);
  const result_article = await dlog.getArticle(cid_article.toString());
  t.is(result_article.content, article.content);
});

test('put/get article summary', async t => {
  const dlog = t.context['dlog'];
  const author: Author = { name: 'mdt', profile_image: '', social_links: [] };
  const article = new Article(author, 'Test', 'base64_img', []);
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
  t.is(result_aso.title, article_summary.title);
});

test('test archiving', async t => {
  const ARTICLES_TO_PUSH = 31;
  const dlog = t.context['dlog'];
  const author: Author = { name: 'mdt', profile_image: '', social_links: [] };

  const article = new Article(author, 'Test', 'base64_img', []);
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
  for (let i = 1; i <= ARTICLES_TO_PUSH; i++) {
    var [new_bucket_cid, archiving] = await dlog.addArticleToBucket(
      cid_AS,
      bucket
    );
    let temp_bucket = (await dlog.getBucket(
      new_bucket_cid.toString()
    )) as Bucket;
    bucket.loadBucket(temp_bucket);
  }

  t.is(bucket.size(), 7);
  t.is(archiving, true);
});

test('put/get bucket', async t => {
  const dlog = t.context['dlog'];
  const author: Author = { name: 'mdt', profile_image: '', social_links: [] };
  const article = new Article(author, 'Test', 'base64_img', []);
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
  let temp_bucket = (await dlog.getBucket(cid_bucket.toString())) as Bucket;
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
  const { resolver, sendOptions, web3 } = t.context['ens'];
  const author: Author = { name: 'mdt', profile_image: '', social_links: [] };
  const author_cid = await dlog.putAuthor(author);
  const identity = new Identity(author_cid);
  await dlog.register('testing', identity, sendOptions);
  const sub_address = namehash.hash('testing.alpress.eth');
  const content = await resolver.contenthash(sub_address).call();
  console.log('content', content)
  const content_hash = contentHash.decode(web3.utils.toAscii(content));
  const retrieved_identity = await dlog.retrieveIdentity(content_hash);
  t.is(retrieved_identity.author.toString(), identity.author.toString());
});

test('Alpress Contract > non-allocated address', async t => {
  const contract = t.context['alpress'];
  const ownerResult = await contract.methods.getOwner('mdt').call();
  t.is(ownerResult, '0x0000000000000000000000000000000000000000');
});

test('Alpress Contract > non-allocated taken check', async t => {
  const contract = t.context['alpress'];
  const takenResult = await contract.methods.checkTaken('mdt').call();
  t.is(takenResult, false);
});

test('Alpress Contract > non-allocated expiration', async t => {
  const contract = t.context['alpress'];

  await contract.methods.getExpiration('mdt').call();

  const expirationResult = await contract.methods.getExpiration('mdt').call();

  t.is(expirationResult, '0');
});

test('Alpress Contract > buy', async t => {
  const contract = t.context['alpress'];
  const { sendOptions, web3 } = t.context['ens'];

  await contract.methods.buy('mdt').send({
    ...sendOptions,
    value: web3.utils.toWei('0.005', 'ether')
  });
  t.pass();
});

test('Alpress Contract > allocated address', async t => {
  const contract = t.context['alpress'];
  const { account } = t.context['ens'];
  const ownerResult = await contract.methods.getOwner('mdt').call();
  t.is(ownerResult, account);
});

test('Alpress Contract > allocated taken check', async t => {
  const contract = t.context['alpress'];
  const takenResult = await contract.methods.checkTaken('mdt').call();
  t.is(takenResult, true);
});

test('Alpress Contract > allocated expiration', async t => {
  const contract = t.context['alpress'];
  const expirationResult = await contract.methods.getExpiration('mdt').call();
  t.not(expirationResult, '0');
});

test('Alpress Contract > set price', async t => {
  const contract = t.context['alpress'];
  // const { address, registry, sendOptions } = t.context['ens'];
  const { sendOptions } = t.context['ens'];

  await contract.methods.setPrice(5000000000000000).send(sendOptions);

  const priceResult = await contract.methods.getPrice().call();

  t.is(priceResult, '5000000000000000');
});

test('Alpress Contract > renew domain', async t => {
  const contract = t.context['alpress'];
  const { sendOptions, web3 } = t.context['ens'];

  await contract.methods.renew('mdt').send({
    ...sendOptions,
    value: web3.utils.toWei('0.005', 'ether')
  });
  t.pass();
});

test('Alpress Contract > publish', async t => {
  const contract = t.context['alpress'];
  const { sendOptions } = t.context['ens'];
  await contract.methods
    .publish(
      'mdt',
      contentHash.fromIpfs('QmVNJbmxqpCj2kKB8ddtAweKU1dWeNisymCdNiYw6wokyz')
    )
    .send(sendOptions);
  t.pass();
});

test('Alpress Contract > allocated domain buy', async t => {
  const contract = t.context['alpress'];
  const { sendOptions, web3 } = t.context['ens'];

  const promise = contract.methods.buy('mdt').send({
    ...sendOptions,
    value: web3.utils.toWei('0.005', 'ether')
  });
  await t.throwsAsync(promise);
});

test('Alpress Contract > unlist non-expired domain', async t => {
  const contract = t.context['alpress'];
  const { sendOptions } = t.context['ens'];

  const promise = contract.methods.unlist('mdt').send(sendOptions);

  await t.throwsAsync(
    promise,
    'VM Exception while processing transaction: revert Blog is not expired yet'
  );
});

test('Alpress Contract > unlist expired domain', async t => {
  const contract = t.context['alpress'];
  const { sendOptions, web3 } = t.context['ens'];
  const expiration = await contract.methods.getExpiration('mdt').call();
  const diff = expiration - parseInt((Date.now() / 1000).toString());
  // Time travel one day ahead of expiration
  await timeTravel(web3, diff + 60 * 60 * 24);
  await contract.methods.unlist('mdt').send(sendOptions);
  t.pass();
});

test('Alpress Contract > unlisted expiration', async t => {
  const contract = t.context['alpress'];

  await contract.methods.getExpiration('mdt').call();

  const expirationResult = await contract.methods.getExpiration('mdt').call();

  t.is(expirationResult, '0');
});

test('Alpress Contract > unlisted address', async t => {
  const contract = t.context['alpress'];
  const ownerResult = await contract.methods.getOwner('mdt').call();
  t.is(ownerResult, '0x0000000000000000000000000000000000000000');
});

/**
 * Auxiliary functions
 */

function getRootNodeFromTLD(
  web3: Web3,
  tld: string
): { namehash: string; sha3: string | null } {
  return {
    namehash: namehash.hash(tld),
    sha3: web3.utils.sha3(tld)
  };
}

// function getBytes32FromIpfsHash(hash: string): string {
//   return `0x${bs58
//     .decode(hash)
//     .slice(2)
//     .toString('hex')}`;
// }

// function getIpfsHashFromBytes32(bytes32Hex: string): string {
//   // Add our default ipfs values for first 2 bytes:
//   // function:0x12=sha2, size:0x20=256 bits
//   // and cut off leading "0x"
//   const hashHex = '1220' + bytes32Hex.slice(2);
//   const hashBytes = Buffer.from(hashHex, 'hex');
//   const hashStr = bs58.encode(hashBytes);
//   return hashStr;
// }

function timeTravel(
  web3: { currentProvider: AbstractProvider },
  time: number
): Promise<void> {
  return new Promise(resolve => {
    web3.currentProvider.sendAsync(
      {
        jsonrpc: '2.0',
        method: 'evm_increaseTime',
        params: [time],
        id: new Date().getTime()
      },
      error => {
        if (error) throw error;
        resolve();
      }
    );
  });
}

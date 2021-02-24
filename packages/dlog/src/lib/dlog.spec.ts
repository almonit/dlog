// tslint:disable:no-expression-statement
// tslint:disable:no-string-literal
// tslint:disable:no-object-mutation
import test from 'ava';
import contentHash from 'content-hash';

import { DLog } from './dlog';
import {
  Article,
  ArticleHeader,
  ArticlesIndex,
  Author,
  Bucket,
  Identity
} from './models';
import { localSetup, timeTravel } from '@dlog/dlog-utils';

test.before(async t => {
  const {
    address,
    contractAlpressRegistrar,
    contractRegistry,
    ipfs,
    main_account,
    secondary_account,
    contractResolver,
    send_options,
    web3
  } = await localSetup();

  t.context['ens'] = {
    address: address,
    account: main_account,
    secondary_account: secondary_account,
    registry: contractRegistry.methods,
    resolver: contractResolver.methods,
    sendOptions: send_options,
    web3: web3
  };
  t.context['dlog'] = new DLog(
    ipfs,
    web3,
    contractAlpressRegistrar.options.address,
    contractResolver.options.address,
    "/ipfs/QmNhnNDXE2wgPJbijE5Sgx651AJdy4b8jPs7nQezYYLAbE"
  );
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
  const author: Author = new Author('mdt', '', '');
  const cid_author = await dlog.putAuthor(author);
  const result_author = await dlog.getAuthor(cid_author.toString());
  t.is(result_author.name, author.name);
});

test('put/get article', async t => {
  const dlog = t.context['dlog'];
  const article = new Article('Test');
  const cid_article = await dlog.putArticle(article);
  const result_article: Article = await dlog.getArticle(cid_article.toString());
  t.is(result_article.serializedArticle, article.serializedArticle);
});

test('put/get article header', async t => {
  const dlog = t.context['dlog'];
  const author: Author = new Author('mdt', '', '');
  const article = new Article('Test');
  const article_cid = await dlog.putArticle(article);

  const article_header = new ArticleHeader(
    article_cid,
    'Test title',
    'test_id',
    author,
    'base64_img',
    'Test',
    []
  );
  const article_header_cid = await dlog.putArticleHeader(article_header);
  const result_article_header = await dlog.getArticleHeader(
    article_header_cid.toString()
  );
  t.is(result_article_header.title, article_header.title);
});

test('test archiving', async t => {
  const ARTICLES_TO_PUSH = 31;
  const dlog = t.context['dlog'];
  const author: Author = new Author('mdt', '', '');

  const article = new Article(
    '{"blocks":[{"key":"b8nf6","text":"test","type":"header-one","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{}}],"entityMap":{}}'
  );
  const article_cid = await dlog.putArticle(article);

  const article_header = new ArticleHeader(
    article_cid,
    'Test title',
    'test_id',
    author,
    'base64_img',
    'Test',
    []
  );

  const article_header_cid = await dlog.putArticleHeader(article_header);

  const bucket = new Bucket([]);
  bucket.setIndex(1);

  // push many articles to test archiving
  for (let i = 1; i <= ARTICLES_TO_PUSH; i++) {
    var [new_bucket_cid, archiving] = await dlog.addArticleHeaderCIDToBucket(
      article_header_cid,
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
  const author: Author = new Author('mdt', '', '');
  const article = new Article('Test');
  const article_cid = await dlog.putArticle(article);

  const article_header = new ArticleHeader(
    article_cid,
    'Test title',
    'test_id',
    author,
    'base64_img',
    'Test',
    []
  );
  const article_header_cid = await dlog.putArticleHeader(article_header);

  const bucket = new Bucket([]);
  bucket.addArticleHeaderCID(article_header_cid);
  const cid_bucket = await dlog.putBucket(bucket);
  let result_bucket = new Bucket([]);
  let temp_bucket = (await dlog.getBucket(cid_bucket.toString())) as Bucket;
  result_bucket.loadBucket(temp_bucket);
  t.deepEqual(
    result_bucket.getArticleHeaderCID(0).toString(),
    bucket.getArticleHeaderCID(0).toString()
  );
});

test('put/get identity', async t => {
  const dlog = t.context['dlog'];
  const author: Author = new Author('mdt', '', '');
  const author_cid = await dlog.putAuthor(author);
  const identity = new Identity(author_cid);
  const articles_index = new ArticlesIndex(null);
  const identity_cid = await dlog.createIdentity(identity, articles_index);
  // const pinned_cid = await dlog.pinIdentity(identity_cid);
  const result_identity = await dlog.retrieveIdentity(identity_cid);
  t.is(identity.toString(), result_identity.toString());
  dlog.logout();
});

test('register secondary account', async t => {
  const dlog = t.context['dlog'];
  const { secondary_account, sendOptions } = t.context['ens'];
  const author: Author = new Author('mdt', '', '');
  const author_cid = await dlog.putAuthor(author);
  const identity = new Identity(author_cid);
  await dlog.register('testing', identity, {
    ...sendOptions,
    from: secondary_account
  });
  const content_hash = await dlog.getContenthash('testing');
  const retrieved_identity = await dlog.retrieveIdentity(content_hash);
  t.is(
    retrieved_identity.author_cid.toString(),
    identity.getAuthorCID().toString()
  );
  dlog.logout();
});

test('login secondary account', async t => {
  const dlog = t.context['dlog'];
  const { secondary_account, sendOptions } = t.context['ens'];
  const { subdomain } = await dlog.login({
    ...sendOptions,
    from: secondary_account
  });
  t.is(subdomain, 'testing');
});

test('update_author', async t => {
  const dlog = t.context['dlog'];
  const { secondary_account, sendOptions } = t.context['ens'];
  const author: Author = new Author('ufnik', '', '');
  await dlog.updateAuthor(author, {
    ...sendOptions,
    from: secondary_account
  });
  t.pass();
});

test('publish article', async t => {
  const dlog = t.context['dlog'];
  const { secondary_account, sendOptions } = t.context['ens'];
  const article = new Article(
    '{"blocks":[{"key":"b8nf6","text":"test","type":"header-one","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{}}],"entityMap":{}}'
  );
  await dlog.publishArticle(article, {
    ...sendOptions,
    from: secondary_account
  });
  t.pass();
});

test('edit article', async t => {
  const dlog = t.context['dlog'];
  const { secondary_account, sendOptions } = t.context['ens'];

  const article = new Article(
    '{"blocks":[{"key":"b8nf6","text":"test","type":"header-one","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{}}],"entityMap":{}}'
  );
  const article_id: string = await dlog.publishArticle(article, {
    ...sendOptions,
    from: secondary_account
  });
  const {
    article_header_cids: article_cids_old
  } = await dlog.retrieveLatestBucket();
  const article2 = new Article(
    '{"blocks":[{"key":"b8nf6","text":"test 2","type":"header-one","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{}}],"entityMap":{}}'
  );
  await dlog.replaceArticle(article_id, article_cids_old[0], article2, {
    ...sendOptions,
    from: secondary_account
  });
  const {
    article_header_cids: article_cids_new
  } = await dlog.retrieveLatestBucket();
  t.not(article_cids_old[0].toString(), article_cids_new[0].toString());
});

test('remove article', async t => {
  const dlog = t.context['dlog'];
  const { secondary_account, sendOptions } = t.context['ens'];
  const article = new Article(
    '{"blocks":[{"key":"b8nf6","text":"test","type":"header-one","depth":0,"inlineStyleRanges":[],"entityRanges":[],"data":{}}],"entityMap":{}}'
  );
  const article_id: string = await dlog.publishArticle(article, {
    ...sendOptions,
    from: secondary_account
  });
  const {
    article_header_cids: article_cids_old
  } = await dlog.retrieveLatestBucket();

  await dlog.removeArticle(article_id, article_cids_old[0], {
    ...sendOptions,
    from: secondary_account
  });
  const {
    article_header_cids: article_cids_new
  } = await dlog.retrieveLatestBucket();
  t.assert(article_cids_old.length > article_cids_new.length);
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

  const expiration_result = await contract.methods.getExpiration('mdt').call();

  t.is(expiration_result, '0');
});

// test('Alpress Contract > buy', async t => {
//   const contract = t.context['alpress'];
//   const { sendOptions, web3 } = t.context['ens'];

//   await contract.methods.buy('mdt').send({
//     ...sendOptions,
//     value: web3.utils.toWei('0.005', 'ether')
//   });
//   t.pass();
// });

// test('Alpress Contract > publish', async t => {
//   const contract = t.context['alpress'];
//   const { sendOptions } = t.context['ens'];
//   await contract.methods
//     .publish(
//       'mdt',
//       `0x${contentHash.fromIpfs('QmVNJbmxqpCj2kKB8ddtAweKU1dWeNisymCdNiYw6wokyz')}`
//     )
//     .send(sendOptions);
//   t.pass();
// });

test('Alpress Contract > buy and init Alpress', async t => {
  const contract = t.context['alpress'];
  const { sendOptions, web3 } = t.context['ens'];

  await contract.methods
    .buyAndInitAlpress(
      'mdt',
      `0x${contentHash.fromIpfs(
        'QmVNJbmxqpCj2kKB8ddtAweKU1dWeNisymCdNiYw6wokyz'
      )}`
    )
    .send({
      ...sendOptions,
      value: web3.utils.toWei('0.005', 'ether')
    });

  t.pass();
});

test('Alpress Contract > registered address buy', async t => {
  const contract = t.context['alpress'];
  const { sendOptions, web3 } = t.context['ens'];

  const promise = contract.methods.buy('testing').send({
    ...sendOptions,
    value: web3.utils.toWei('0.005', 'ether')
  });
  await t.throwsAsync(promise);
});

test('Alpress Contract > registered address query', async t => {
  const contract = t.context['alpress'];

  const result = await contract.methods.getName().call();
  t.is(result, 'mdt');
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

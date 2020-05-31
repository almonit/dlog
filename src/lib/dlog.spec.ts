// tslint:disable:no-expression-statement
// tslint:disable:no-string-literal
// tslint:disable:no-object-mutation
import test from 'ava';
import IPFS from 'ipfs';
import Web3 from 'web3';
import { DLog } from './dlog';
import { Article, ArticleSummary, Author, Bucket, Identity } from './models';

test.before(async t => {
  const repoPath = 'repo/ipfs-' + Math.random();
  const ipfs = await IPFS.create({ repo: repoPath });
  const web3 = new Web3(
    new Web3.providers.HttpProvider(
      'https://:62ff7188c74447b6a67afbc2de247610@ropsten.infura.io/v3/372375d582d843c48a4eaee6aa5c1b3a'
    )
  );
  t.context['dlog'] = await new DLog(ipfs, web3);
});

test('verify version', async t => {
  const dlog = t.context['dlog'];
  const version = await dlog.version();
  console.log('version', version);
  t.is(version.dlog, '0.0.1');
});

test('put/get author', async t => {
  const dlog = t.context['dlog'];
  const author: Author = { name: 'mdt', profile_image: '', social_links: [] };
  const cid_author = await dlog.putAuthor(author);
  const author_ipfs_object = await dlog.getAuthor(cid_author.toString());
  t.context['author'] = cid_author;
  const {
    value
  }: { readonly value: { readonly name: string } } = author_ipfs_object;
  t.is(value.name, author.name);
});

test('put/get article', async t => {
  const dlog = t.context['dlog'];
  const article = new Article(
    [t.context['author'], { name: 'mdt' }],
    'Test',
    'base64_img',
    []
  );
  const cid_article = await dlog.putArticle(article);
  const article_ipfs_object = await dlog.getArticle(cid_article.toString());
  t.context['article'] = cid_article;
  const { value }: { readonly value: Article } = article_ipfs_object;
  t.is(value.content, article.content);
});

test('put/get article summary', async t => {
  const dlog = t.context['dlog'];
  const article_summary = new ArticleSummary(
    t.context['author'],
    t.context['article'],
    'base64_img',
    'Test',
    'First Title'
  );
  const cid_aso = await dlog.putArticleSummary(article_summary);
  const aso_ipfs_object = await dlog.getArticleSummary(cid_aso.toString());
  t.context['aso'] = cid_aso;
  const {
    value
  }: { readonly value: { readonly title: string } } = aso_ipfs_object;
  t.is(value.title, article_summary.title);
});

test('put/get bucket', async t => {
  const dlog = t.context['dlog'];
  const bucket = new Bucket([]);
  bucket.addArticle(t.context['aso']);
  const cid_aso = await dlog.putBucket(bucket);
  const bucket_ipfs_object = await dlog.getBucket(cid_aso.toString());
  const { value }: { readonly value: Bucket } = bucket_ipfs_object;
  t.is(value.articles[0], bucket.getArticle(0));
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

test('register error', async t => {
  const dlog = t.context['dlog'];
  const author: Author = { name: 'mdt', profile_image: '', social_links: [] };
  const author_cid = await dlog.putAuthor(author);
  const identity = new Identity(author_cid);
  const callRegister = dlog.register.call(dlog, identity, 'mdt.eth', {
    from: '0xa07C63ca83924C47fe522e69ca481d63051Aa5bc'
  });
  const error = await t.throwsAsync(async () => {
    await callRegister(),
      { instanceOf: Error },
      t.is(
        error.message,
        'Returned error: The method eth_sendTransaction does not exist/is not available'
      );
  });
});

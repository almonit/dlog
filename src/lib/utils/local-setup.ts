import { ENSRegistry, FIFSRegistrar } from '@ensdomains/ens';
import { PublicResolver } from '@ensdomains/resolver';
import namehash from 'eth-ens-namehash';
import IPFS from 'ipfs';
import Web3 from 'web3';
import { AbstractProvider } from 'web3-core/types';

import { AlpressRegistrar } from '../../contracts';
import getRootNodeFromTLD from './root-node';
const ganache = require('ganache-core');

export default async function localSetup(provider = null): Promise<any> {
  const repoPath = 'repo/ipfs-' + Math.random();
  const ipfs = await IPFS.create({ repo: repoPath });
  await ipfs.bootstrap.add(
    '/ip4/95.179.128.10/tcp/5001/p2p/QmYDZk4ns1qSReQoZHcGa8jjy8SdhdAqy3eBgd1YMgGN9j'
  );
  // const provider = new Web3.providers.HttpProvider('http://localhost:7545');
  if(!provider)
    provider = ganache.provider({
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

  const instanceAlpressRegistrar = new web3.eth.Contract(
    AlpressRegistrar.abi as any
  );
  const contractAlpressRegistrar = await instanceAlpressRegistrar
    .deploy({
      data: AlpressRegistrar.bytecode,
      arguments: [
        contractRegistry.options.address,
        contractResolver.options.address
      ]
    })
    .send(send_options);

  console.log('public: ', contractTestRegistrar.options.address);

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
  }

  await contractRegistry.methods
    .setOwner(address, contractAlpressRegistrar.options.address)
    .send(send_options);

  return {
    address,
    contractAlpressRegistrar,
    contractRegistry,
    ipfs,
    main_account,
    resolverMethods,
    send_options,
    web3
  };
}

export function timeTravel(
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

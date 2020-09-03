import { ENSRegistry, FIFSRegistrar } from '@ensdomains/ens';
import IPFS from 'ipfs';
import Web3 from 'web3';
import { AbstractProvider } from 'web3-core/types';

// import getNameHashSHA3 from './hash';
import { AlpressResolver, AlpressRegistrar } from '../../contracts';

const ganache = require('ganache-core');

export default async function localSetup(provider = null): Promise<any> {
  const repoPath = 'repo/ipfs-' + Math.random();
  const ipfs = await IPFS.create({ repo: repoPath });
  await ipfs.bootstrap.add(
    '/ip4/95.179.128.10/tcp/5001/p2p/QmYDZk4ns1qSReQoZHcGa8jjy8SdhdAqy3eBgd1YMgGN9j'
  );
  if (!provider)
    provider = ganache.provider({
      allowUnlimitedContractSize: true,
      gasLimit: 3000000000,
      gasPrice: 20000
    });
  const web3 = new Web3(
    provider as any
    // 'https://:62ff7188c74447b6a67afbc2de247610@ropsten.infura.io/v3/372375d582d843c48a4eaee6aa5c1b3a'
  );

    const config = await deploy(
      web3
    );

  return {
    ...config,
    ipfs,
    web3
  };
}

async function deploy(
  web3,
) {

  // const address_label = getNameHashSHA3(web3, 'alpress').sha3;
  const address_label =
    '0xefa02a3c3d5ae7bcd3eb19a279dee2d2584e97a31cb9a3d54eed0182bd398d80';
  // const address = getNameHashSHA3(web3, 'alpress.eth').namehash;
  const address =
    '0x517e65c2f5c4feaca79a1ad6dbb71e140e197bdac570080818992818f6a23065';
  // const rootNode = getNameHashSHA3(web3, 'eth');
  const rootNode = {
    namehash:
      '0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae',
    sha3: '0x4f5b812789fc606be1b3b16908db13fc7a9adf7ca72641f84d75b47069d3d7f0'
  };
  const accounts = await web3.eth.getAccounts();
  const main_account = accounts[0];
  const secondary_account = accounts[1];
  const empty_account = '0x0000000000000000000000000000000000000000';
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
      arguments: [contractRegistry.options.address, empty_account]
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

  const instanceTestRegistrar = new web3.eth.Contract(FIFSRegistrar.abi);
  const contractTestRegistrar = await instanceTestRegistrar
    .deploy({
      data: FIFSRegistrar.bytecode,
      arguments: [contractRegistry.options.address, rootNode.namehash]
    })
    .send(send_options);

  await contractRegistry.methods
    .setSubnodeOwner(
      empty_account,
      rootNode.sha3,
      contractTestRegistrar.options.address
    )
    .send(send_options);

  const owner = await contractRegistry.methods.owner(address).call();

  if (owner === empty_account) {
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

  return {
    address,
    contractAlpressRegistrar,
    contractRegistry,
    contractResolver,
    main_account,
    secondary_account,
    send_options
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

//import Web3 from 'web3';
//import HDWalletProvider from '@truffle/hdwallet-provider';
//import { AlpressResolver, AlpressRegistrar } from '../../contracts';
//
//async function remoteSetup(): Promise<any> {
//  const provider = new HDWalletProvider(
//    "",
//    "https://:62ff7188c74447b6a67afbc2de247610@rinkeby.infura.io/v3/372375d582d843c48a4eaee6aa5c1b3a"
//  );
//
//  const web3 = new Web3(provider);
//  await deploy(web3);
//}
//
//async function deploy(web3) {
//  const ENSRegistryWithFallback = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
//  const accounts = await web3.eth.getAccounts();
//  const main_account = accounts[0];
//  const empty_account = '0x0000000000000000000000000000000000000000';
//  const send_options = {
//    from: main_account
//  };
//
//  const instanceAlpressRegistrar = new web3.eth.Contract(
//    AlpressRegistrar.abi as any
//  );
//  const contractAlpressRegistrar = await instanceAlpressRegistrar
//    .deploy({
//      data: AlpressRegistrar.bytecode,
//      arguments: [ENSRegistryWithFallback, empty_account]
//    })
//    .send(send_options);
//  
//  console.log("Alpress Registrar Address: ", contractAlpressRegistrar.options.address);
//
//  const instanceResolver = new web3.eth.Contract(AlpressResolver.abi as any);
//  const contractResolver = await instanceResolver
//    .deploy({
//      data: AlpressResolver.bytecode,
//      arguments: [
//        ENSRegistryWithFallback,
//        contractAlpressRegistrar.options.address
//      ]
//    })
//    .send(send_options);
//  
//  console.log("Alpress Resolver Address: ", contractResolver.options.address);
//
//  await contractAlpressRegistrar.methods
//    .setDefaultResolver(contractResolver.options.address)
//    .send(send_options);
//  
//  console.log("Contracts deployed successfully!");
//}
//
//remoteSetup();

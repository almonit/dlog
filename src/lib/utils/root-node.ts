import namehash from 'eth-ens-namehash';
import Web3 from 'web3';

export default function getRootNodeFromTLD(
    web3: Web3,
    tld: string
  ): { namehash: string; sha3: string | null } {
    return {
      namehash: namehash.hash(tld),
      sha3: web3.utils.sha3(tld)
    };
  }

import namehash from 'eth-ens-namehash';
import Web3 from 'web3';

export default function getNameHashSHA3(
  web3: Web3,
  name: string
): { namehash: string; sha3: string | null } {
  return {
    namehash: namehash.hash(name),
    sha3: web3.utils.sha3(name)
  };
}

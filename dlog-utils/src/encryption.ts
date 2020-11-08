import Web3 from 'web3';
var crypto = require('crypto');


export async function encrypt(
  dataToEncrypt: string,
  name: string,
  address: string,
  web3: Web3
): Promise<string>  {

  // create password by signing name
  let password = await web3.eth.sign(name, address);  

  // encrypt data
  var mykey = crypto.createCipher('aes-128-cbc', password);
  var encryptedData : string = mykey.update(dataToEncrypt, 'utf8', 'hex')
  encryptedData += mykey.final('hex');

  return encryptedData;
}

export async function decrypt(
  dataToDecrypt: string,
  name: string,
  address: string,
  web3: Web3
): Promise<string>  {

  // create password by signing name
  let password = await web3.eth.sign(name, address);  

  // decrypt data
  var mykey = crypto.createDecipher('aes-128-cbc', password);
  var decrypteddData = mykey.update(dataToDecrypt, 'utf8', 'hex')
  decrypteddData += mykey.final('hex');

  return decrypteddData;
}

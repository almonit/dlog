var crypto = require('crypto');


export async function encrypt(
  data: string,
  symmetricKey: any
): Promise<string>  {

  // encrypt data
  var encryptedData : string = symmetricKey.update(data, 'utf8', 'hex')
  encryptedData += symmetricKey.final('hex');

  return encryptedData;
}

export async function decrypt(
  dataToDecrypt: string,
  symmetricKey: any
): Promise<string>  {

  // decrypt data
  var mykey = crypto.createDecipher('aes-128-cbc', symmetricKey);
  var decrypteddData = mykey.update(dataToDecrypt, 'utf8', 'hex')
  decrypteddData += mykey.final('hex');

  return decrypteddData;
}

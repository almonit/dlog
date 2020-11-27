import Web3 from 'web3';
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

// *** Misc *** //
String.prototype.hexEncode = function(){
    var hex, i;

    var result = "";
    for (i=0; i<this.length; i++) {
        hex = this.charCodeAt(i).toString(16);
        result += ("000"+hex).slice(-4);
    }

    return result
}

String.prototype.hexDecode = function(){
    var j;
    var hexes = this.match(/.{1,4}/g) || [];
    var back = "";
    for(j = 0; j<hexes.length; j++) {
        back += String.fromCharCode(parseInt(hexes[j], 16));
    }

    return back;
}
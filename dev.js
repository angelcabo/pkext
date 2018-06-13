const SHA224 = require('crypto-js/sha224');

let message = 'Hello, 世界!';
let hash = SHA224(message);

console.log(hash.toString());
import crypto from 'crypto';

const passphrase = process.argv[2];

if (!passphrase) {
  console.error('Usage: node src/key-generator.js "your-passphrase"');
  process.exit(1);
}

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
    cipher: 'aes-256-cbc',
    passphrase,
  },
});

console.log('\nPublic key (upload this to Meta):\n');
console.log(publicKey);
console.log('\nPrivate key (store this as PRIVATE_KEY):\n');
console.log(privateKey);

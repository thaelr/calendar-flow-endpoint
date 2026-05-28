import crypto from 'crypto';

const PEM_PRIVATE_KEY_PATTERN = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const PRIVATE_KEY_HEADER = '-----BEGIN PRIVATE KEY-----';
const PRIVATE_KEY_FOOTER = '-----END PRIVATE KEY-----';

function formatPrivateKey(privateKey) {
  if (!privateKey) {
    throw new Error('PRIVATE_KEY is empty');
  }

  const normalized = privateKey
    .replace(/^["']|["']$/g, '')
    .replace(/\\n/g, '\n')
    .trim();

  if (PEM_PRIVATE_KEY_PATTERN.test(normalized)) {
    return normalized;
  }

  return `${PRIVATE_KEY_HEADER}\n${normalized}\n${PRIVATE_KEY_FOOTER}`;
}

export function decryptRequest(body, privateKey, passphrase) {
  const { encrypted_aes_key: encryptedAesKey, encrypted_flow_data: encryptedFlowData, initial_vector: initialVector } = body;

  const decryptedAesKey = crypto.privateDecrypt(
    {
      key: formatPrivateKey(privateKey),
      passphrase,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(encryptedAesKey, 'base64'),
  );

  const flowDataBuffer = Buffer.from(encryptedFlowData, 'base64');
  const initialVectorBuffer = Buffer.from(initialVector, 'base64');

  const tagLength = 16;
  const encryptedFlowDataBody = flowDataBuffer.subarray(0, -tagLength);
  const encryptedFlowDataTag = flowDataBuffer.subarray(-tagLength);

  const decipher = crypto.createDecipheriv('aes-128-gcm', decryptedAesKey, initialVectorBuffer);
  decipher.setAuthTag(encryptedFlowDataTag);

  const decryptedJSONString = Buffer.concat([
    decipher.update(encryptedFlowDataBody),
    decipher.final(),
  ]).toString('utf8');

  return {
    decryptedBody: JSON.parse(decryptedJSONString),
    aesKeyBuffer: decryptedAesKey,
    initialVectorBuffer,
  };
}

export function encryptResponse(responseData, aesKeyBuffer, initialVectorBuffer) {
  const flippedIvBuffer = Buffer.from(initialVectorBuffer.map((byte) => byte ^ 0xff));
  const cipher = crypto.createCipheriv('aes-128-gcm', aesKeyBuffer, flippedIvBuffer);

  const encryptedJSONString = Buffer.concat([
    cipher.update(JSON.stringify(responseData), 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return encryptedJSONString.toString('base64');
}

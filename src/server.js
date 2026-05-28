import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import { config, hasEncryptionConfig } from './config.js';
import { decryptRequest, encryptResponse } from './encryption.js';
import { getNextScreen } from './flow.js';

class FlowEndpointError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'FlowEndpointError';
    this.statusCode = statusCode;
  }
}

function verifySignature(appSecret, rawBody, signature) {
  if (!appSecret) return;
  if (!signature) {
    throw new FlowEndpointError(432, 'Missing X-Hub-Signature-256 header');
  }

  const expected = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')}`;

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new FlowEndpointError(432, 'Request signature validation failed');
  }
}

function sanitizeLogPayload(payload) {
  return {
    action: payload?.action ?? null,
    screen: payload?.screen ?? null,
    version: payload?.version ?? null,
    flow_token_present: Boolean(payload?.flow_token),
    trigger: payload?.data?.trigger ?? null,
  };
}

const app = express();

app.use(express.json({
  verify: (req, _res, buffer) => {
    req.rawBody = buffer;
  },
}));

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'woof-whatsapp-flow-endpoint',
    endpoint_path: config.endpointPath,
  });
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    encryption_ready: hasEncryptionConfig(),
  });
});

app.post(config.endpointPath, async (req, res, next) => {
  try {
    if (!hasEncryptionConfig()) {
      throw new FlowEndpointError(500, 'PRIVATE_KEY and PASSPHRASE must be configured');
    }

    verifySignature(
      config.appSecret,
      req.rawBody || Buffer.from(JSON.stringify(req.body || {})),
      req.get('X-Hub-Signature-256'),
    );

    const { decryptedBody, aesKeyBuffer, initialVectorBuffer } = decryptRequest(
      req.body,
      config.privateKey,
      config.passphrase,
    );

    console.log('[flow] request', sanitizeLogPayload(decryptedBody));

    const response = await getNextScreen(decryptedBody);

    console.log('[flow] response', {
      screen: response?.screen ?? null,
      has_extension_message_response: Boolean(response?.data?.extension_message_response),
    });

    const encryptedResponse = encryptResponse(response, aesKeyBuffer, initialVectorBuffer);
    res.send(encryptedResponse);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const statusCode = error instanceof FlowEndpointError ? error.statusCode : 500;
  console.error('[flow] error', error.message);
  res.status(statusCode).json({
    error: error.message,
  });
});

app.listen(config.port, () => {
  console.log(`Woof WhatsApp Flow endpoint listening on port ${config.port}`);
  console.log(`POST ${config.endpointPath}`);
});

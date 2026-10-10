/**
 * Minimal HTTP host for the wording proxy. Node 22.18+ / 24 runs this file
 * directly (type stripping):
 *
 *   OPENAI_API_KEY=… ALLOWED_ORIGINS=chrome-extension://<id> node server/wording-proxy/server.ts
 *
 * Put it behind HTTPS (a platform load balancer or reverse proxy) and set the
 * extension's WXT_WORDING_PROXY_URL to its public URL. Set a low monthly
 * spending limit on the OpenAI key.
 */
import { createServer } from 'node:http';
import { createProxy, MAX_BODY_CHARS } from './proxy.ts';

const apiKey = process.env.OPENAI_API_KEY ?? '';
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!apiKey || allowedOrigins.length === 0) {
  console.error('Set OPENAI_API_KEY and ALLOWED_ORIGINS (comma-separated chrome-extension://<id> origins).');
  process.exitCode = 1;
} else {
  start();
}

function start() {
  const port = Number(process.env.PORT ?? 8787);
  const handle = createProxy({
    apiKey,
    model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
    allowedOrigins,
    requestsPerMinute: Number(process.env.REQUESTS_PER_MINUTE ?? 30),
    fetch: (url, init) => fetch(url, init),
  });

  createServer((req, res) => {
    let body = '';
    let tooLarge = false;
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > MAX_BODY_CHARS) {
        tooLarge = true;
        req.destroy();
      }
    });
    req.on('end', async () => {
      if (tooLarge) return;
      const response = await handle({
        method: req.method ?? 'GET',
        origin: req.headers.origin ?? null,
        client: req.socket.remoteAddress ?? 'unknown',
        body,
      });
      res.writeHead(response.status, response.headers).end(response.body);
    });
  }).listen(port, () => {
    // Never log request bodies.
    console.log(`Worth It wording proxy listening on :${port}`);
  });
}

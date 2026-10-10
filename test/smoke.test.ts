import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

const SECURITY = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
};
const INDEX = '<!doctype html><html><body><div id="root"></div><script type="module" src="/assets/index-abc123.js"></script></body></html>';

type Breakage = 'none' | 'no-hsts' | 'api-returns-html' | 'index-cached';

/** A stand-in for CloudFront + API Gateway that behaves correctly unless told to break one thing. */
function fakeEnvironment(breakage: Breakage): Server {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    const security: Record<string, string> = { ...SECURITY };
    if (breakage === 'no-hsts') delete security['Strict-Transport-Security'];
    const url = req.url ?? '/';
    if (url === '/api/v1/healthz') {
      res.writeHead(200, { ...security, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end('{"status":"ok","version":"abc123"}');
    } else if (url.startsWith('/api/') && breakage !== 'api-returns-html') {
      res.writeHead(404, { ...security, 'Content-Type': 'application/problem+json', 'Cache-Control': 'no-store' });
      res.end('{"type":"urn:therapy-service-hours:problem:not-found","title":"Not Found","status":404}');
    } else if (url.startsWith('/assets/')) {
      res.writeHead(200, { ...security, 'Content-Type': 'text/javascript', 'Cache-Control': 'public, max-age=31536000, immutable' });
      res.end('console.log(1)');
    } else {
      res.writeHead(200, { ...security, 'Content-Type': 'text/html', 'Cache-Control': breakage === 'index-cached' ? 'max-age=3600' : 'no-cache' });
      res.end(INDEX);
    }
  });
}

let server: Server | undefined;
afterEach(() => {
  server?.close();
  server = undefined;
});

async function runSmoke(breakage: Breakage): Promise<{ status: number | null; output: string }> {
  server = fakeEnvironment(breakage);
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const script = join(__dirname, '..', 'scripts', 'smoke.sh');
  // Async spawn: the fake server runs in this process and must keep serving while the script runs.
  // SMOKE_BASH lets Windows developers point at Git Bash; CI (Linux) uses bash from PATH.
  return new Promise((resolve) => {
    const bash = process.env.SMOKE_BASH ?? (process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash');
    const child = spawn(bash, [script, `http://127.0.0.1:${port}`]);
    let output = '';
    child.stdout.on('data', (d: Buffer) => (output += d.toString()));
    child.stderr.on('data', (d: Buffer) => (output += d.toString()));
    child.on('close', (status) => resolve({ status, output }));
  });
}

describe('scripts/smoke.sh', () => {
  test('passes against a correctly configured environment', async () => {
    const r = await runSmoke('none');
    expect(r.output).toContain('Smoke test passed');
    expect(r.status).toBe(0);
  });

  test.each([
    ['no-hsts', 'strict-transport-security'],
    ['api-returns-html', 'unknown API path returned 200'],
    ['index-cached', 'cache-control'],
  ] as const)('fails when %s', async (breakage, message) => {
    const r = await runSmoke(breakage);
    expect(r.status).toBe(1);
    expect(r.output).toContain(message);
  });
});

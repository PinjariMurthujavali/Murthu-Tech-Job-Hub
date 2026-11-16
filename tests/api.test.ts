import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { apiFetch } from '../src/lib/api.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function respond(body: unknown, contentType = 'application/json', status = 200) {
  globalThis.fetch = async () => new Response(
    contentType === 'text/html' ? String(body) : JSON.stringify(body),
    { status, headers: { 'Content-Type': contentType } },
  );
}

test('rejects the SPA HTML fallback instead of returning it as API data', async () => {
  respond('<!doctype html><html></html>', 'text/html');
  await assert.rejects(apiFetch('/api/jobs/categories'), /service is unavailable/);
});

test('rejects non-array category payloads before they enter React state', async () => {
  for (const payload of [null, {}, { error: 'unavailable' }, 'html']) {
    respond(payload);
    await assert.rejects(apiFetch('/api/jobs/categories'), /invalid list/);
  }
});

test('rejects malformed job collections, including requests with query parameters', async () => {
  respond({ items: null });
  await assert.rejects(apiFetch('/api/jobs?limit=6'), /invalid listings/);
});

test('preserves valid API lists and job responses', async () => {
  respond([]);
  assert.deepEqual(await apiFetch('/api/jobs/categories'), []);
  respond({ items: [], pagination: { total: 0, totalPages: 1 } });
  assert.deepEqual(await apiFetch('/api/jobs?limit=6'), {
    items: [], pagination: { total: 0, totalPages: 1 },
  });
});

test('preserves API error handling and POST responses', async () => {
  respond({ error: 'Please sign in' }, 'application/json', 401);
  await assert.rejects(apiFetch('/api/user/saved-jobs'), /Please sign in/);
  respond({ success: true });
  assert.deepEqual(await apiFetch('/api/jobs', { method: 'POST' }), { success: true });
});

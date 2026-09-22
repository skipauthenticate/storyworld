import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchAllowed, isAllowedUrl } from './index.ts';

test('proxy accepts only approved HTTPS hosts and checks each redirect before fetching', async () => {
  assert.equal(isAllowedUrl('http://github.com/file'), false);
  assert.equal(isAllowedUrl('https://github.com.evil.test/file'), false);
  assert.equal(isAllowedUrl('https://github.com/file'), true);

  const seen: string[] = [];
  const fetcher = async (url: string | URL | Request) => {
    seen.push(String(url));
    return new Response(null, {
      status: 302,
      headers: { location: 'http://127.0.0.1/private' },
    });
  };

  await assert.rejects(fetchAllowed('https://github.com/file', fetcher as typeof fetch));
  assert.deepEqual(seen, ['https://github.com/file']);
});

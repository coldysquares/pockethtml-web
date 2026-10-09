const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('active HTML segment stays on this origin while PDF opens PocketPDF', () => {
  const switcher = html.match(/<nav class="pocket-switch"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(switcher, 'Pocket tools navigation exists');

  const activeHtml = switcher.match(/<([a-z][a-z0-9-]*)\b([^>]*)>HTML<\/\1>/i);
  assert.ok(activeHtml, 'active HTML segment exists');
  assert.equal(activeHtml[1].toLowerCase(), 'span', 'current HTML item is non-navigating');
  assert.doesNotMatch(activeHtml[2], /\bhref\s*=/i, 'current HTML item has no destination');
  assert.match(activeHtml[2], /\baria-current="page"/i, 'current page is announced accessibly');

  assert.match(
    switcher,
    /<a\b[^>]*href="https:\/\/pocketpdf\.vercel\.app\/"[^>]*>PDF<\/a>/i,
    'PDF link still opens the separate PocketPDF app'
  );
});

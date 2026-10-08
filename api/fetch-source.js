const dns = require('node:dns').promises;
const net = require('node:net');

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return true;

  const [a, b, c] = parts;

  if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && (b === 0 || b === 168)) return true;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return true;
  if (a === 203 && b === 0 && c === 113) return true;

  return false;
}

function isPrivateIPv6(ip) {
  const value = ip.toLowerCase();
  if (value === '::' || value === '::1') return true;
  if (value.startsWith('fc') || value.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(value)) return true;
  if (value.startsWith('2001:db8:')) return true;

  if (value.startsWith('::ffff:')) {
    const mapped = value.slice(7);
    if (net.isIP(mapped) === 4) return isPrivateIPv4(mapped);
  }

  return false;
}

function isPrivateIp(ip) {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true;
}

async function validatePublicUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Enter a valid URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http:// and https:// URLs are supported.');
  }

  if (url.username || url.password) {
    throw new Error('URLs with embedded credentials are not supported.');
  }

  if (url.port && !['80', '443'].includes(url.port)) {
    throw new Error('Only standard web ports are supported.');
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  ) {
    throw new Error('Local network addresses are not supported.');
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('Private network addresses are not supported.');
    return url;
  }

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error('That hostname could not be resolved.');
  }

  if (!addresses.length || addresses.some(entry => isPrivateIp(entry.address))) {
    throw new Error('That address is not available for public import.');
  }

  return url;
}

async function fetchHtml(rawUrl) {
  let currentUrl = await validatePublicUrl(rawUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'PocketHTML/1.0 (+https://pockethtml-web.vercel.app)',
        'Accept': 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5,*/*;q=0.1'
      },
      signal: AbortSignal.timeout(12000)
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`Redirect failed (HTTP ${response.status}).`);
      if (redirectCount === MAX_REDIRECTS) throw new Error('Too many redirects.');

      currentUrl = await validatePublicUrl(new URL(location, currentUrl).href);
      continue;
    }

    if (!response.ok) {
      throw new Error(`The site returned HTTP ${response.status}.`);
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (
      contentType &&
      !contentType.includes('text/html') &&
      !contentType.includes('application/xhtml+xml') &&
      !contentType.includes('text/plain')
    ) {
      throw new Error('That URL did not return HTML.');
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_BYTES) throw new Error('That page source is larger than 2 MB.');

    if (!response.body) throw new Error('The site returned an empty response.');

    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        reader.cancel();
        throw new Error('That page source is larger than 2 MB.');
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const charsetMatch = contentType.match(/charset=([^;\s]+)/i);
    const charset = charsetMatch ? charsetMatch[1].replace(/["']/g, '') : 'utf-8';

    let html;
    try {
      html = new TextDecoder(charset).decode(bytes);
    } catch {
      html = new TextDecoder('utf-8').decode(bytes);
    }

    return { html, finalUrl: currentUrl.href };
  }

  throw new Error('Could not fetch that page.');
}

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Use POST.' });
  }

  const rawUrl = typeof request.body?.url === 'string' ? request.body.url.trim() : '';
  if (!rawUrl) return response.status(400).json({ error: 'Paste a page URL first.' });

  try {
    const result = await fetchHtml(rawUrl);
    return response.status(200).json(result);
  } catch (error) {
    return response.status(400).json({
      error: error instanceof Error ? error.message : 'Could not import that page.'
    });
  }
};

// Downloads an image from a link an admin pasted. The server opens the link, so it is
// locked down against SSRF: public internet only, no private/metadata addresses, size and
// time limits, and every redirect is checked again.
const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');
const { HttpError } = require('./http');
const { saveImage, sniffImage } = require('./images');

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    return x === '::' || x === '::1' || x.startsWith('::ffff:') || x.startsWith('64:ff9b') ||
      /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith('ff');
  }
  return true;
}

// runs when the socket connects, so a hostname cannot switch to a private IP afterwards
function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err);
    const list = Array.isArray(address) ? address : [{ address }];
    if (!list.length || list.some((a) => isPrivateIp(a.address))) return callback(new Error('Blocked address'));
    callback(null, address, family);
  });
}

const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_PAGE = 2 * 1024 * 1024;

function fetchLimited(urlStr, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(urlStr); } catch { return reject(new HttpError(400, 'That is not a valid link')); }
    if (!['http:', 'https:'].includes(u.protocol)) return reject(new HttpError(400, 'Only http and https links are allowed'));
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(host) && isPrivateIp(host)) return reject(new HttpError(400, 'That address is not allowed'));

    const lib = u.protocol === 'https:' ? https : http;
    let finished = false;
    const done = (fn, v) => { if (!finished) { finished = true; fn(v); } };

    const req = lib.get(u, {
      lookup: safeLookup,
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShopNestImageFetcher/1.0)', Accept: 'text/html,image/*;q=0.9,*/*;q=0.5' },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) return done(reject, new HttpError(400, 'Too many redirects'));
        let next;
        try { next = new URL(res.headers.location, u).toString(); } catch { return done(reject, new HttpError(400, 'Bad redirect')); }
        finished = true;
        return resolve(fetchLimited(next, redirectsLeft - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return done(reject, new HttpError(400, `That link answered with status ${res.statusCode}`));
      }
      const contentType = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const isImage = contentType.startsWith('image/');
      const limit = isImage ? MAX_IMAGE : MAX_PAGE;
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size > limit) {
          req.destroy();
          // a long web page is fine (the image tags are near the top), a huge image is not
          return isImage
            ? done(reject, new HttpError(400, 'The image is larger than 5 MB'))
            : done(resolve, { buffer: Buffer.concat(chunks), contentType, finalUrl: u.toString() });
        }
        chunks.push(c);
      });
      res.on('end', () => done(resolve, { buffer: Buffer.concat(chunks), contentType, finalUrl: u.toString() }));
      res.on('error', () => done(reject, new HttpError(400, 'The download was interrupted')));
    });
    req.on('timeout', () => { req.destroy(); done(reject, new HttpError(400, 'That link took too long to respond')); });
    req.on('error', () => done(reject, new HttpError(400, 'Could not open that link')));
  });
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[2] !== undefined ? m[2] : m[3]) : null;
}

function absolute(href, base) {
  try { return new URL(href.replace(/&amp;/g, '&'), base).toString(); } catch { return null; }
}

// looks for the picture a shop page uses for sharing (og:image), then falls back to the first <img>
function extractImageFromHtml(html, baseUrl) {
  const metas = html.match(/<meta\b[^>]*>/gi) || [];
  for (const wanted of ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']) {
    for (const tag of metas) {
      const key = (attr(tag, 'property') || attr(tag, 'name') || '').toLowerCase();
      const content = attr(tag, 'content');
      if (key === wanted && content) {
        const url = absolute(content, baseUrl);
        if (url) return url;
      }
    }
  }
  const link = (html.match(/<link\b[^>]*>/gi) || []).find((t) => (attr(t, 'rel') || '').toLowerCase() === 'image_src');
  if (link && attr(link, 'href')) return absolute(attr(link, 'href'), baseUrl);
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  for (const tag of imgs) {
    const src = attr(tag, 'src');
    if (src && !src.startsWith('data:') && !/\.(svg|gif)(\?|$)/i.test(src)) return absolute(src, baseUrl);
  }
  return null;
}

// link can be a direct image link or a product page
async function importImageFromLink(link) {
  let { buffer, contentType, finalUrl } = await fetchLimited(String(link || '').trim());
  if (!sniffImage(buffer)) {
    if (!/text\/html|application\/xhtml/.test(contentType)) {
      throw new HttpError(400, 'That link is neither an image nor a web page');
    }
    const imageUrl = extractImageFromHtml(buffer.toString('utf8'), finalUrl);
    if (!imageUrl) throw new HttpError(400, 'No product image found on that page. Paste a direct image link instead.');
    ({ buffer } = await fetchLimited(imageUrl));
  }
  return saveImage(buffer);
}

module.exports = { importImageFromLink, extractImageFromHtml, isPrivateIp };

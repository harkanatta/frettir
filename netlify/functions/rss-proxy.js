// Server-side RSS fetch + parse. Avoids third-party proxies (rss2json now
// requires a registered key) and CORS issues entirely, since this runs on
// Netlify's servers, not in the visitor's browser.

exports.handler = async function (event) {
  const rssUrl = event.queryStringParameters && event.queryStringParameters.url;
  if (!rssUrl) {
    return { statusCode: 400, body: JSON.stringify({ status: 'error', error: 'missing url param' }) };
  }

  try {
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AmplifiedNewsBot/1.0; +https://netlify.app)' },
    });
    if (!res.ok) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'error', error: 'upstream ' + res.status, items: [] }),
      };
    }
    const xml = await res.text();
    const items = parseFeed(xml);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
      body: JSON.stringify({ status: 'ok', items }),
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'error', error: String(e), items: [] }),
    };
  }
};

function parseFeed(xml) {
  const items = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRegex.exec(xml)) && items.length < 30) {
    items.push(extractFields(m[1], false));
  }
  if (items.length === 0) {
    const entryRegex = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
    while ((m = entryRegex.exec(xml)) && items.length < 30) {
      items.push(extractFields(m[1], true));
    }
  }
  return items;
}

function tagText(block, name) {
  const re = new RegExp('<' + name + '\\b[^>]*>([\\s\\S]*?)<\\/' + name + '>', 'i');
  const m = block.match(re);
  if (!m) return '';
  return decode(stripCdata(m[1])).trim();
}

function stripCdata(s) {
  return s.replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '');
}

function decode(s) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractFields(block, isAtom) {
  let link = tagText(block, 'link');
  if (isAtom) {
    const m = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
    if (m) link = m[1];
  }
  return {
    title: tagText(block, 'title'),
    link: link,
    description: tagText(block, 'description') || tagText(block, 'summary') || tagText(block, 'content'),
    pubDate: tagText(block, 'pubDate') || tagText(block, 'published') || tagText(block, 'updated'),
  };
}

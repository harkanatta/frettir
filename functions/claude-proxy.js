// Server-side proxy for the Claude fallback feature.
// Keeps ANTHROPIC_API_KEY on the server (Netlify env var) so it is never
// exposed to the browser. Set ANTHROPIC_API_KEY in Netlify > Site
// configuration > Environment variables for this to work.

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured on this Netlify site' }),
    };
  }

  let prompt;
  try {
    prompt = JSON.parse(event.body || '{}').prompt;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid JSON body' }) };
  }
  if (!prompt) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing prompt' }) };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    return {
      statusCode: res.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: String(e) }) };
  }
};

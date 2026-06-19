// cloudflare-worker/index.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // WebRTC sinyalleme için CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  // Rate limiting
  const clientIP = request.headers.get('CF-Connecting-IP');
  const rateLimitKey = `rate_limit:${clientIP}`;
  
  // Basit rate limiting (100 istek/dakika)
  const currentRequests = await RATE_LIMITER.get(rateLimitKey);
  if (currentRequests && parseInt(currentRequests) > 100) {
    return new Response('Rate limit exceeded', { status: 429 });
  }
  
  await RATE_LIMITER.put(rateLimitKey, (parseInt(currentRequests) || 0) + 1, {
    expirationTtl: 60
  });

  // Ana proxy mantığı
  const response = await fetch(request);
  
  const modifiedResponse = new Response(response.body, response);
  modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
  modifiedResponse.headers.set('X-Frame-Options', 'DENY');
  modifiedResponse.headers.set('X-Content-Type-Options', 'nosniff');
  
  return modifiedResponse;
}

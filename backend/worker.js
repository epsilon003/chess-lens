export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin':  env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    if (url.pathname === '/api/analyze-image' && request.method === 'POST') {
      try {
        const formData = await request.formData()
        const response = await fetch(`${env.VISION_SERVICE_URL}/recognize`, {
          method:  'POST',
          body:    formData,
        })
        const data = await response.json()
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Vision service unavailable' }), {
          status:  503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response('Not found', { status: 404 })
  }
}
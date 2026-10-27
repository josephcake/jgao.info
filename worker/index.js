// The link preview is one of a few pictures, picked fresh each time a site asks for it; everything
// else is the built site as it is
const PREVIEWS = ['/og/happy.jpg', '/og/joseph.jpg', '/og/central-park.jpg', '/og/sensor.jpg']

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname !== '/og.jpg') return env.ASSETS.fetch(request)

    const pick = PREVIEWS[Math.floor(Math.random() * PREVIEWS.length)]
    const res = await env.ASSETS.fetch(new Request(new URL(pick, url), request))
    const headers = new Headers(res.headers)
    headers.set('cache-control', 'no-store')
    headers.delete('etag')
    return new Response(res.body, { status: res.status, headers })
  },
}

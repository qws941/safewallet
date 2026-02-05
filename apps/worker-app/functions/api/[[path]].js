const API_WORKER_URL = "https://safework2-api.jclee.workers.dev";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const apiPath = url.pathname.replace(/^\/api/, "");
  const targetUrl = `${API_WORKER_URL}${apiPath}${url.search}`;

  const headers = new Headers(context.request.headers);
  headers.set("X-Forwarded-Host", url.host);

  const init = {
    method: context.request.method,
    headers,
  };

  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    init.body = context.request.body;
    init.duplex = "half";
  }

  const response = await fetch(targetUrl, init);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

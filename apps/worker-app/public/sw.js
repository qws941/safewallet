if (!self.define) {
  let e,
    s = {};
  const n = (n, t) => (
    (n = new URL(n + ".js", t).href),
    s[n] ||
      new Promise((s) => {
        if ("document" in self) {
          const e = document.createElement("script");
          ((e.src = n), (e.onload = s), document.head.appendChild(e));
        } else ((e = n), importScripts(n), s());
      }).then(() => {
        let e = s[n];
        if (!e) throw new Error(`Module ${n} didn’t register its module`);
        return e;
      })
  );
  self.define = (t, c) => {
    const a =
      e ||
      ("document" in self ? document.currentScript.src : "") ||
      location.href;
    if (s[a]) return;
    let i = {};
    const r = (e) => n(e, a),
      o = { module: { uri: a }, exports: i, require: r };
    s[a] = Promise.all(t.map((e) => o[e] || r(e))).then((e) => (c(...e), i));
  };
}
define(["./workbox-495fd258"], function (e) {
  "use strict";
  (importScripts(),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        {
          url: "/_next/app-build-manifest.json",
          revision: "6ae4a1c90c4ab3ebb0fd8f618df39c1b",
        },
        {
          url: "/_next/static/chunks/117-65c50c71e739f278.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/127-9b5acee6d299a9fa.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/248-e971a7bd3f2799eb.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/253-6dc923e8e0308682.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/5-9f27001f370ff481.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/50-f1c7cb3b6dada6db.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/597-213abf063ce3a8ad.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/648-48473403c931f509.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/676-6b566d3d3f4bf51e.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/757.a8d9e776f7413600.js",
          revision: "a8d9e776f7413600",
        },
        {
          url: "/_next/static/chunks/833-9f0e0a0ca8ef3e3a.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/938-754da016b7c33132.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/993.2988e9ef2af3907e.js",
          revision: "2988e9ef2af3907e",
        },
        {
          url: "/_next/static/chunks/app/_not-found/page-a5cad56980e65cd6.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/app/actions/page-0c610d9851bc9b2b.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/app/actions/view/page-fc47ddea67702a45.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/app/announcements/page-b1e6cd42b4172caf.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/app/education/page-748e14b78249b19d.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/app/education/quiz-take/page-5f76c17390e81544.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/app/education/view/page-3ab3a81352bef3ca.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/app/home/page-0138da418fc686fb.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/app/layout-92d95f784186e58f.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/app/login/page-287752728101825b.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/app/page-1186233945dc0b36.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/app/points/page-3f91bdc1f2102b92.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/app/posts/new/page-8cbb7b30e026be6e.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/app/posts/page-1127b67abfc80a71.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/app/posts/view/page-617681105f79d079.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/app/profile/page-0841845816751946.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/app/register/page-08489fef24022cf3.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/app/votes/page-ff844e3dd5673450.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/fd9d1056-6c3c5b1e091a7145.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/framework-3664cab31236a9fa.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/main-56e518773d60c5df.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/main-app-999810146bad9514.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/pages/_app-72b849fbd24ac258.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/pages/_error-7ba65e1336b92748.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/chunks/polyfills-42372ed130431b0a.js",
          revision: "846118c33b2c0e922d7b3a7676f81f6f",
        },
        {
          url: "/_next/static/chunks/webpack-135a4e3b5cd1838b.js",
          revision: "jS8cgQC09e-AR2ZW7kKkg",
        },
        {
          url: "/_next/static/css/f830fd8ed3c19657.css",
          revision: "f830fd8ed3c19657",
        },
        {
          url: "/_next/static/jS8cgQC09e-AR2ZW7kKkg/_buildManifest.js",
          revision: "c155cce658e53418dec34664328b51ac",
        },
        {
          url: "/_next/static/jS8cgQC09e-AR2ZW7kKkg/_ssgManifest.js",
          revision: "b6652df95db52feb4daf4eca35380933",
        },
        {
          url: "/icons/icon-192.png",
          revision: "e5e771fba9593a2d51204424b5e1bcf0",
        },
        {
          url: "/icons/icon-512.png",
          revision: "e903933ad601cd320e2657307a901fad",
        },
        { url: "/manifest.json", revision: "476e0fe841e968f4b4603a205f06a653" },
        { url: "/robots.txt", revision: "22163ed738f0eca45747dcab1a4a3350" },
        { url: "/sw-push.js", revision: "031192e2f41962a83f7e1bf35acd906d" },
      ],
      { ignoreURLParametersMatching: [] },
    ),
    e.cleanupOutdatedCaches(),
    e.registerRoute(
      "/",
      new e.NetworkFirst({
        cacheName: "start-url",
        plugins: [
          {
            cacheWillUpdate: async ({
              request: e,
              response: s,
              event: n,
              state: t,
            }) =>
              s && "opaqueredirect" === s.type
                ? new Response(s.body, {
                    status: 200,
                    statusText: "OK",
                    headers: s.headers,
                  })
                : s,
          },
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      new e.CacheFirst({
        cacheName: "google-fonts-webfonts",
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 31536e3 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      new e.StaleWhileRevalidate({
        cacheName: "google-fonts-stylesheets",
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      new e.StaleWhileRevalidate({
        cacheName: "static-font-assets",
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      new e.StaleWhileRevalidate({
        cacheName: "static-image-assets",
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /\/_next\/image\?url=.+$/i,
      new e.StaleWhileRevalidate({
        cacheName: "next-image",
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:mp3|wav|ogg)$/i,
      new e.CacheFirst({
        cacheName: "static-audio-assets",
        plugins: [
          new e.RangeRequestsPlugin(),
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:mp4)$/i,
      new e.CacheFirst({
        cacheName: "static-video-assets",
        plugins: [
          new e.RangeRequestsPlugin(),
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:js)$/i,
      new e.StaleWhileRevalidate({
        cacheName: "static-js-assets",
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:css|less)$/i,
      new e.StaleWhileRevalidate({
        cacheName: "static-style-assets",
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /\/_next\/data\/.+\/.+\.json$/i,
      new e.StaleWhileRevalidate({
        cacheName: "next-data",
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:json|xml|csv)$/i,
      new e.NetworkFirst({
        cacheName: "static-data-assets",
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      ({ url: e }) => {
        if (!(self.origin === e.origin)) return !1;
        const s = e.pathname;
        return !s.startsWith("/api/auth/") && !!s.startsWith("/api/");
      },
      new e.NetworkFirst({
        cacheName: "apis",
        networkTimeoutSeconds: 10,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      ({ url: e }) => {
        if (!(self.origin === e.origin)) return !1;
        return !e.pathname.startsWith("/api/");
      },
      new e.NetworkFirst({
        cacheName: "others",
        networkTimeoutSeconds: 10,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      ({ url: e }) => !(self.origin === e.origin),
      new e.NetworkFirst({
        cacheName: "cross-origin",
        networkTimeoutSeconds: 10,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 3600 }),
        ],
      }),
      "GET",
    ));
});

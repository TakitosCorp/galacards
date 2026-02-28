const CACHE_NAME = "cache-v1.0.8";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    fetch("/images")
      .then((response) => response.json())
      .then(async (imageList) => {
        const imageUrls = imageList.map(
          (imageName) => `/public/images/${imageName}`,
        );
        const cache = await caches.open(CACHE_NAME);
        return await cache.addAll(imageUrls);
      })
      .catch((error) => {
        console.error("Error preloading images:", error);
      }),
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  if (requestUrl.protocol === "chrome-extension:") {
    return;
  }

  if (requestUrl.pathname === "/list") {
    return;
  }

  if (
    requestUrl.origin === self.location.origin &&
    event.request.method === "GET"
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((networkResponse) => {
            if (
              networkResponse &&
              networkResponse.ok &&
              networkResponse.status !== 206
            ) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone).catch((error) => {
                  console.error(
                    "Error caching resource:",
                    event.request.url,
                    error,
                  );
                });
              });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.error("Error fetching resource:", event.request.url, error);

            return new Response("Content not available", {
              status: 503,
              statusText: "Service unavailable",
            });
          });
      }),
    );
  }
});

self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(async (cacheNames) => {
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        }),
      );
      self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((client) => {
          client.navigate(client.url);
        });
      });
    }),
  );
  self.clients.claim();
});

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = "upa-pay-v1";
const OFFLINE_URLS = [
    "/",
    "/pay",
    "/pay/scan",
    "/pay/confirm",
    "/pay/success",
    "/pay/queued",
    "/officer",
    "/dashboard",
    "/auth",
];

// ─── Install: pre-cache app shell ───
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(OFFLINE_URLS);
        })
    );
    self.skipWaiting();
});

// ─── Activate: clean old caches ───
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

// ─── Fetch: network-first, cache fallback for navigation ───
self.addEventListener("fetch", (event) => {
    const { request } = event;

    // Only intercept GET requests
    if (request.method !== "GET") return;

    // Skip API routes — let them go to network directly
    if (request.url.includes("/api/")) return;

    event.respondWith(
        fetch(request)
            .then((response) => {
                // Cache successful responses
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, clone);
                    });
                }
                return response;
            })
            .catch(async () => {
                // Network failed — serve from cache
                const cached = await caches.match(request);
                if (cached) return cached;

                // For navigation requests, serve the cached index page
                if (request.mode === "navigate") {
                    const indexCached = await caches.match("/pay");
                    if (indexCached) return indexCached;
                }

                return new Response("Offline", { status: 503 });
            })
    );
});

// ─── Background Sync: auto-sync queued transactions ───
self.addEventListener("sync", (event: any) => {
    if (event.tag === "sync-transactions") {
        event.waitUntil(syncQueuedPayments());
    }
});

// ─── Periodic Sync: check for queued transactions periodically ───
self.addEventListener("periodicsync" as any, (event: any) => {
    if (event.tag === "auto-sync-transactions") {
        event.waitUntil(syncQueuedPayments());
    }
});

async function syncQueuedPayments(): Promise<void> {
    try {
        // Open IndexedDB directly (can't use Dexie in SW context easily)
        const db = await openIDB();
        const tx = db.transaction("transactions", "readonly");
        const store = tx.objectStore("transactions");

        const queued: any[] = [];
        const cursor = store.openCursor();

        await new Promise<void>((resolve, reject) => {
            cursor.onsuccess = (e: any) => {
                const result = e.target.result;
                if (result) {
                    if (
                        result.value.status === "queued" ||
                        result.value.status === "syncing"
                    ) {
                        queued.push(result.value);
                    }
                    result.continue();
                } else {
                    resolve();
                }
            };
            cursor.onerror = () => reject(cursor.error);
        });

        if (queued.length === 0) return;

        // Mark as syncing
        const txWrite = db.transaction("transactions", "readwrite");
        const writeStore = txWrite.objectStore("transactions");
        for (const item of queued) {
            item.status = "syncing";
            writeStore.put(item);
        }

        // Attempt sync via API
        const payments = queued.map((item) => ({
            qrPayload: JSON.parse(item.payload),
            signature: item.signature,
            nonce: item.nonce,
            publicKey: item.publicKey,
        }));

        const response = await fetch("/api/transactions/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payments }),
        });

        const result = await response.json();

        // Update statuses based on result
        const txUpdate = db.transaction("transactions", "readwrite");
        const updateStore = txUpdate.objectStore("transactions");

        if (result.results && Array.isArray(result.results)) {
            for (let i = 0; i < queued.length; i++) {
                const serverResult = result.results[i];
                if (serverResult) {
                    queued[i].status =
                        serverResult.status === "settled" ? "settled" : "failed";
                    queued[i].error =
                        serverResult.status === "rejected"
                            ? serverResult.reason
                            : undefined;
                    queued[i].syncedAt =
                        serverResult.status === "settled" ? Date.now() : undefined;
                } else {
                    queued[i].status = "failed";
                    queued[i].error = "no_server_response";
                }
                updateStore.put(queued[i]);
            }
        }

        // Notify the client
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
            client.postMessage({
                type: "SYNC_COMPLETE",
                synced: queued.filter((q) => q.status === "settled").length,
                failed: queued.filter((q) => q.status === "failed").length,
            });
        }
    } catch (error) {
        console.error("[SW] Background sync failed:", error);
    }
}

function openIDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open("UPAOfflineDB", 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains("transactions")) {
                req.result.createObjectStore("transactions", {
                    keyPath: "id",
                    autoIncrement: true,
                });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export {};

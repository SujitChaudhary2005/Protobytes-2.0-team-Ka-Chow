/* Service Worker for UPA Pay - Offline Support v3 */

var CACHE_NAME = "upa-pay-v3";
var STATIC_CACHE = "upa-pay-static-v3";

// Only cache the offline fallback during install — don't try to cache SSR pages
// (SSR pages might redirect/fail which kills the entire SW installation)
var PRECACHE_URLS = [
    "/offline.html",
    "/manifest.json",
];

// ─── Install: only pre-cache the offline fallback (guaranteed to succeed) ───
self.addEventListener("install", function (event) {
    console.log("[SW] Installing...");
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            console.log("[SW] Pre-caching offline fallback");
            return cache.addAll(PRECACHE_URLS);
        })
    );
    self.skipWaiting();
});

// ─── Activate: clean old caches and claim clients immediately ───
self.addEventListener("activate", function (event) {
    console.log("[SW] Activating...");
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.filter(function (k) {
                    return k !== CACHE_NAME && k !== STATIC_CACHE;
                }).map(function (k) {
                    console.log("[SW] Deleting old cache:", k);
                    return caches.delete(k);
                })
            );
        }).then(function () {
            console.log("[SW] Claiming clients");
            return self.clients.claim();
        })
    );
});

// Helper: should we cache this request?
function shouldCache(url) {
    // Cache Next.js static assets (JS, CSS chunks)
    if (url.includes("/_next/static/")) return true;
    // Cache static files from public/
    if (url.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf|json)(\?|$)/)) return true;
    return false;
}

// ─── Fetch: network-first with aggressive caching ───
self.addEventListener("fetch", function (event) {
    var request = event.request;

    // Only intercept GET requests
    if (request.method !== "GET") return;

    // Skip API routes entirely
    if (request.url.includes("/api/")) return;

    // Skip non-http requests
    if (!request.url.startsWith("http")) return;

    // Strategy for static assets: cache-first (they have hashed filenames)
    if (shouldCache(request.url)) {
        event.respondWith(
            caches.match(request).then(function (cached) {
                if (cached) return cached;
                return fetch(request).then(function (response) {
                    if (response.ok) {
                        var clone = response.clone();
                        caches.open(STATIC_CACHE).then(function (cache) {
                            cache.put(request, clone);
                        });
                    }
                    return response;
                }).catch(function () {
                    return new Response("", { status: 503 });
                });
            })
        );
        return;
    }

    // Strategy for navigation/pages: network-first, cache fallback, offline fallback
    event.respondWith(
        fetch(request).then(function (response) {
            // Cache successful page responses for offline use
            if (response.ok) {
                var clone = response.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                    cache.put(request, clone);
                });
            }
            return response;
        }).catch(function () {
            // Network failed — try cache
            return caches.match(request).then(function (cached) {
                if (cached) return cached;

                // For page navigations, try cached pages then offline fallback
                if (request.mode === "navigate") {
                    // Try NFC pages first (most likely to be needed offline)
                    return caches.match("/pay/nfc").then(function (nfcCached) {
                        if (nfcCached && request.url.includes("/pay/nfc")) return nfcCached;
                        return caches.match("/merchant/nfc").then(function (merchantNfcCached) {
                            if (merchantNfcCached && request.url.includes("/merchant/nfc")) return merchantNfcCached;
                            return caches.match("/pay").then(function (payCached) {
                                if (payCached) return payCached;
                                return caches.match("/").then(function (rootCached) {
                                    if (rootCached) return rootCached;
                                    return caches.match("/auth").then(function (authCached) {
                                        if (authCached) return authCached;
                                        // Last resort: show offline fallback page
                                        return caches.match("/offline.html");
                                    });
                                });
                            });
                        });
                    });
                }

                return new Response("Offline", { status: 503 });
            });
        })
    );
});

// ─── Background Sync: auto-sync queued transactions ───
self.addEventListener("sync", function (event) {
    if (event.tag === "sync-transactions") {
        event.waitUntil(syncQueuedPayments());
    }
});

// ─── Periodic Sync: check for queued transactions periodically ───
self.addEventListener("periodicsync", function (event) {
    if (event.tag === "auto-sync-transactions") {
        event.waitUntil(syncQueuedPayments());
    }
});

function syncQueuedPayments() {
    return openIDB().then(function (db) {
        var tx = db.transaction("transactions", "readonly");
        var store = tx.objectStore("transactions");
        var queued = [];
        var cursor = store.openCursor();

        return new Promise(function (resolve, reject) {
            cursor.onsuccess = function (e) {
                var result = e.target.result;
                if (result) {
                    if (
                        result.value.status === "queued" ||
                        result.value.status === "syncing"
                    ) {
                        queued.push(result.value);
                    }
                    result.continue();
                } else {
                    resolve(queued);
                }
            };
            cursor.onerror = function () { reject(cursor.error); };
        });
    }).then(function (queued) {
        if (queued.length === 0) return;

        return openIDB().then(function (db) {
            // Mark as syncing
            var txWrite = db.transaction("transactions", "readwrite");
            var writeStore = txWrite.objectStore("transactions");
            for (var i = 0; i < queued.length; i++) {
                queued[i].status = "syncing";
                writeStore.put(queued[i]);
            }

            // Attempt sync via API
            var payments = queued.map(function (item) {
                return {
                    payload: item.payload,
                    signature: item.signature,
                    nonce: item.nonce,
                    publicKey: item.publicKey,
                    client_tx_id: item.client_tx_id || undefined,
                    timestamp: item.timestamp,
                };
            });

            return fetch("/api/transactions/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payments: payments }),
            })
                .then(function (response) { return response.json(); })
                .then(function (result) {
                    return openIDB().then(function (db2) {
                        var txUpdate = db2.transaction("transactions", "readwrite");
                        var updateStore = txUpdate.objectStore("transactions");

                        if (result.results && Array.isArray(result.results)) {
                            for (var j = 0; j < queued.length; j++) {
                                var serverResult = result.results[j];
                                if (serverResult) {
                                    queued[j].status =
                                        (serverResult.status === "settled" || serverResult.status === "success") ? "settled" : "failed";
                                    queued[j].error =
                                        (serverResult.status === "rejected" || serverResult.status === "expired")
                                            ? (serverResult.error || serverResult.reason)
                                            : undefined;
                                    queued[j].syncedAt =
                                        serverResult.status === "settled" ? Date.now() : undefined;
                                } else {
                                    queued[j].status = "failed";
                                    queued[j].error = "no_server_response";
                                }
                                updateStore.put(queued[j]);
                            }
                        }

                        // Notify the client
                        return self.clients.matchAll({ type: "window" }).then(function (clients) {
                            for (var c = 0; c < clients.length; c++) {
                                clients[c].postMessage({
                                    type: "SYNC_COMPLETE",
                                    synced: queued.filter(function (q) { return q.status === "settled"; }).length,
                                    failed: queued.filter(function (q) { return q.status === "failed"; }).length,
                                });
                            }
                        });
                    });
                });
        });
    }).catch(function (error) {
        console.error("[SW] Background sync failed:", error);
    });
}

function openIDB() {
    return new Promise(function (resolve, reject) {
        var req = indexedDB.open("UPAOfflineDB", 2);
        req.onupgradeneeded = function (event) {
            var db = req.result;
            if (!db.objectStoreNames.contains("transactions")) {
                var store = db.createObjectStore("transactions", {
                    keyPath: "id",
                    autoIncrement: true,
                });
                store.createIndex("timestamp", "timestamp", { unique: false });
                store.createIndex("status", "status", { unique: false });
                store.createIndex("recipient", "recipient", { unique: false });
                store.createIndex("nonce", "nonce", { unique: false });
                store.createIndex("client_tx_id", "client_tx_id", { unique: false });
                store.createIndex("settlement_state", "settlement_state", { unique: false });
            } else if (event.oldVersion < 2) {
                // Upgrade existing store with new indexes
                var txStore = req.transaction.objectStore("transactions");
                if (!txStore.indexNames.contains("nonce")) txStore.createIndex("nonce", "nonce", { unique: false });
                if (!txStore.indexNames.contains("client_tx_id")) txStore.createIndex("client_tx_id", "client_tx_id", { unique: false });
                if (!txStore.indexNames.contains("settlement_state")) txStore.createIndex("settlement_state", "settlement_state", { unique: false });
            }
            if (!db.objectStoreNames.contains("offlineAcceptedTxs")) {
                var oaStore = db.createObjectStore("offlineAcceptedTxs", {
                    keyPath: "id",
                    autoIncrement: true,
                });
                oaStore.createIndex("client_tx_id", "client_tx_id", { unique: false });
                oaStore.createIndex("settlement_state", "settlement_state", { unique: false });
                oaStore.createIndex("acceptedAt", "acceptedAt", { unique: false });
                oaStore.createIndex("expiresAt", "expiresAt", { unique: false });
                oaStore.createIndex("senderUPA", "senderUPA", { unique: false });
                oaStore.createIndex("receiverUPA", "receiverUPA", { unique: false });
            }
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
    });
}

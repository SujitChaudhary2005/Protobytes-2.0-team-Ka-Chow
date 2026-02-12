"use client";

import { useState, useEffect } from "react";

export function useNetwork() {
    const [online, setOnline] = useState(true);
    const [lastChecked, setLastChecked] = useState(0);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (typeof window === "undefined") return;

        const updateOnlineStatus = () => {
            setOnline(navigator.onLine);
            setLastChecked(Date.now());
        };

        // Set initial state
        setOnline(navigator.onLine);
        setLastChecked(Date.now());

        window.addEventListener("online", updateOnlineStatus);
        window.addEventListener("offline", updateOnlineStatus);

        // Check periodically
        const interval = setInterval(() => {
            updateOnlineStatus();
        }, 5000);

        return () => {
            window.removeEventListener("online", updateOnlineStatus);
            window.removeEventListener("offline", updateOnlineStatus);
            clearInterval(interval);
        };
    }, []);

    return { online: mounted ? online : true, lastChecked };
}


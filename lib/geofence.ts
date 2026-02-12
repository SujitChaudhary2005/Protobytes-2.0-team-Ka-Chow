/**
 * Geo-Fencing Module for QR Payment Verification
 *
 * Locks QR codes to specific GPS coordinates so that
 * payments can only be made within a defined radius
 * of where the QR was issued (e.g., traffic fine at
 * the intersection where it was issued).
 */

export interface GeoCoordinates {
    lat: number;
    lng: number;
}

export interface GeofenceConfig {
    lat: number;
    lng: number;
    radiusMeters: number;
}

const DEFAULT_RADIUS_METERS = 500;

/**
 * Get current GPS position
 */
export function getCurrentPosition(): Promise<GeoCoordinates> {
    return new Promise((resolve, reject) => {
        if (!("geolocation" in navigator)) {
            reject(new Error("Geolocation not supported"));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                });
            },
            (err) => {
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        reject(new Error("Location permission denied. Enable GPS to pay."));
                        break;
                    case err.POSITION_UNAVAILABLE:
                        reject(new Error("Location unavailable. Try again outdoors."));
                        break;
                    case err.TIMEOUT:
                        reject(new Error("Location request timed out."));
                        break;
                    default:
                        reject(new Error("Could not get location."));
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000,
            }
        );
    });
}

/**
 * Calculate distance between two GPS points using the Haversine formula
 * @returns Distance in meters
 */
export function haversineDistance(a: GeoCoordinates, b: GeoCoordinates): number {
    const R = 6371000; // Earth's radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);

    const h =
        sinDLat * sinDLat +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;

    return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Verify that the payer is within the geofence radius
 * @returns Object with isWithin boolean + distance info
 */
export async function verifyGeofence(
    geofence: GeofenceConfig
): Promise<{
    isWithin: boolean;
    distance: number;
    maxDistance: number;
    payerLocation: GeoCoordinates;
}> {
    const payerLocation = await getCurrentPosition();
    const distance = haversineDistance(payerLocation, {
        lat: geofence.lat,
        lng: geofence.lng,
    });
    const maxDistance = geofence.radiusMeters || DEFAULT_RADIUS_METERS;

    return {
        isWithin: distance <= maxDistance,
        distance: Math.round(distance),
        maxDistance,
        payerLocation,
    };
}

/**
 * Create a geofence config from current position
 */
export async function createGeofenceFromCurrentLocation(
    radiusMeters: number = DEFAULT_RADIUS_METERS
): Promise<GeofenceConfig> {
    const pos = await getCurrentPosition();
    return {
        lat: pos.lat,
        lng: pos.lng,
        radiusMeters,
    };
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
    if (meters < 1000) {
        return `${meters}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
}

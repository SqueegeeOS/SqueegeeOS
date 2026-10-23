export const CHICO_SEARCH_BIAS = {
  latitude: 39.7285,
  longitude: -121.8375,
  radiusMeters: 50_000,
};

// Google Places accepts circular location biases only through 50 km.
// Keep every search path behind this helper so service-area expansion can
// never produce an invalid request.
export const GOOGLE_PLACES_MAX_LOCATION_BIAS_METERS = 50_000;

export function getPlacesSearchRadiusMeters(serviceAreaMode = false): number {
  const requestedRadius = serviceAreaMode
    ? CHICO_SEARCH_BIAS.radiusMeters * 1.5
    : CHICO_SEARCH_BIAS.radiusMeters;

  return Math.min(requestedRadius, GOOGLE_PLACES_MAX_LOCATION_BIAS_METERS);
}

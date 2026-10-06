import { describe, expect, it } from "vitest";

import {
  CHICO_SEARCH_BIAS,
  GOOGLE_PLACES_MAX_LOCATION_BIAS_METERS,
  getPlacesSearchRadiusMeters,
} from "./places-search-config";

describe("Places search radius", () => {
  it("keeps the standard search within Google's circular bias limit", () => {
    expect(getPlacesSearchRadiusMeters()).toBe(CHICO_SEARCH_BIAS.radiusMeters);
    expect(getPlacesSearchRadiusMeters()).toBeLessThanOrEqual(
      GOOGLE_PLACES_MAX_LOCATION_BIAS_METERS,
    );
  });

  it("caps service-area expansion at Google's circular bias limit", () => {
    expect(getPlacesSearchRadiusMeters(true)).toBe(
      GOOGLE_PLACES_MAX_LOCATION_BIAS_METERS,
    );
  });
});

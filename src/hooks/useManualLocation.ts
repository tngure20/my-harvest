import { useCallback, useEffect, useState } from "react";
import { clearWeatherCache } from "@/services/weatherService";

export interface ManualLocation {
  country: string;       // e.g. "Kenya"
  countryCode: string;   // e.g. "KE"
  region: string;        // county/state/province (free text or selected)
}

const STORAGE_KEY = "harvest_manual_location_v1";

export function getManualLocation(): ManualLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ManualLocation) : null;
  } catch {
    return null;
  }
}

export function setManualLocation(loc: ManualLocation | null): void {
  try {
    if (loc) localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
    else localStorage.removeItem(STORAGE_KEY);
    // Force weather + downstream services to re-fetch with the new pin
    clearWeatherCache();
    window.dispatchEvent(new CustomEvent("harvest:location-changed", { detail: loc }));
  } catch {
    /* storage quota — non-fatal */
  }
}

export function useManualLocation() {
  const [location, setLocationState] = useState<ManualLocation | null>(getManualLocation);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ManualLocation | null>).detail;
      setLocationState(detail ?? null);
    };
    window.addEventListener("harvest:location-changed", handler);
    return () => window.removeEventListener("harvest:location-changed", handler);
  }, []);

  const update = useCallback((loc: ManualLocation | null) => {
    setManualLocation(loc);
    setLocationState(loc);
  }, []);

  return { location, setLocation: update };
}

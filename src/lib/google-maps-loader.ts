import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

type MapsBundle = {
  maps: google.maps.MapsLibrary;
  marker: google.maps.MarkerLibrary;
};

let loaderPromise: Promise<MapsBundle> | null = null;

export function loadGoogleMaps(): Promise<MapsBundle> {
  if (loaderPromise) return loaderPromise;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error("NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY is not set"),
    );
  }
  setOptions({ key: apiKey, v: "weekly" });
  loaderPromise = Promise.all([importLibrary("maps"), importLibrary("marker")]).then(
    ([maps, marker]) => ({ maps, marker }),
  );
  return loaderPromise;
}

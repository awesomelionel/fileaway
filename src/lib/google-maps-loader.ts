import { Loader } from "@googlemaps/js-api-loader";

let loaderPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (loaderPromise) return loaderPromise;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error("NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY is not set"),
    );
  }
  const loader = new Loader({
    apiKey,
    version: "weekly",
    libraries: [],
  });
  loaderPromise = loader.load();
  return loaderPromise;
}

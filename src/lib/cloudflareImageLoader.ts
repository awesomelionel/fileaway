/**
 * Custom next/image loader for Cloudflare Image Resizing.
 * Requires Cloudflare Pro plan with Image Resizing enabled on the zone.
 *
 * To activate, update next.config.mjs:
 *   images: { loader: "custom", loaderFile: "./src/lib/cloudflareImageLoader.ts" }
 */
export default function cloudflareLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  const params = [`width=${width}`, "format=auto"];
  if (quality) params.push(`quality=${quality}`);

  const url = new URL(src);
  return `${url.origin}/cdn-cgi/image/${params.join(",")}${url.pathname}`;
}

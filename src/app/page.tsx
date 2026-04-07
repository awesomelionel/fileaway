import { Suspense } from "react";
import { preloadQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "../../convex/_generated/api";
import { FeedApp } from "@/components/feed/FeedApp";
import { FeedSkeleton } from "@/components/feed/FeedSkeleton";

/** Preloads Convex data inside Suspense so the shell can stream before queries finish (better FCP/TTFB). */
async function FeedWithPreload() {
  const token = await convexAuthNextjsToken();
  const [preloadedItems, preloadedCategories] = await Promise.all([
    preloadQuery(api.items.list, { view: "feed" }, { token }),
    preloadQuery(api.adminCategories.listCategories, {}, { token }),
  ]);

  return (
    <FeedApp preloadedItems={preloadedItems} preloadedCategories={preloadedCategories} />
  );
}

export default function Home() {
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <FeedWithPreload />
    </Suspense>
  );
}

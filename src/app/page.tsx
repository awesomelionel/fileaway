import { Suspense } from "react";
import { preloadQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "../../convex/_generated/api";
import { FeedApp } from "@/components/feed/FeedApp";
import { FeedSkeleton } from "@/components/feed/FeedSkeleton";

export default async function Home() {
  const token = await convexAuthNextjsToken();
  const [preloadedItems, preloadedCategories] = await Promise.all([
    preloadQuery(api.items.list, { view: "feed" }, { token }),
    preloadQuery(api.adminCategories.listCategories, {}, { token }),
  ]);

  return (
    <Suspense fallback={<FeedSkeleton />}>
      <FeedApp preloadedItems={preloadedItems} preloadedCategories={preloadedCategories} />
    </Suspense>
  );
}

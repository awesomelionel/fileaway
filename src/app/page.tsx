import { Suspense } from "react";
import { FeedApp } from "@/components/feed/FeedApp";

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d0d0f]" />}>
      <FeedApp />
    </Suspense>
  );
}

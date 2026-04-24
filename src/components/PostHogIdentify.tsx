"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function PostHogIdentify() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");

  useEffect(() => {
    if (isLoading) return;
    if (!posthog.__loaded) return;
    if (isAuthenticated && viewer?._id) {
      posthog.identify(viewer._id, {
        email: viewer.email ?? undefined,
      });
    } else if (!isAuthenticated) {
      posthog.reset();
    }
  }, [isAuthenticated, isLoading, viewer?._id, viewer?.email]);

  return null;
}

import { useState } from "react";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { useMutation } from "convex/react";
import { api } from "../backend";
import type { Id } from "../../../convex/_generated/dataModel";
import { useToast } from "./Toast";
import { HowToGuideModal } from "./HowToGuideModal";
import { actionLabel, runAction } from "./itemCard/actions";
import {
  FailedBody,
  FitnessBody,
  FoodBody,
  GenericBody,
  HowToBody,
  PendingBody,
  ProcessingBody,
  RecipeBody,
  TravelBody,
  VideoBody,
} from "./itemCard/bodies";
import { cardStyles as styles } from "./itemCard/styles";
import { extractHowToSteps, getCategoryMeta, PLATFORM_LABELS, relativeTime } from "./itemCard/types";
import type { FeedItem, ItemStatus, PlatformType } from "./itemCard/types";

export type { FeedItem, ItemStatus, PlatformType };

interface ItemCardProps {
  item: FeedItem;
}

/** Renders one saved item: header (category/platform/status), body, and the category-specific action button. */
export function ItemCard({ item }: ItemCardProps) {
  const [showGuide, setShowGuide] = useState(false);
  const retryItem = useMutation(api.items.retryItem);
  const { showToast } = useToast();
  const meta = getCategoryMeta(item.category);
  const data = (item.extracted_data ?? {}) as Record<string, unknown>;

  const handleRetry = async () => {
    try {
      await retryItem({ id: item.id as Id<"savedItems"> });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Retry failed — try again");
    }
  };

  return (
    <View style={[styles.card, { borderLeftColor: meta.color }]}>
      <View style={styles.header}>
        <View style={styles.chipRow}>
          <View style={[styles.chip, { backgroundColor: `${meta.color}22` }]}>
            <Text style={[styles.chipText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{PLATFORM_LABELS[item.platform] ?? item.platform}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {item.status === "pending" && <Text style={styles.statusPending}>Queued</Text>}
          {item.status === "processing" && <Text style={styles.statusProcessing}>Processing</Text>}
          {item.status === "failed" && <Text style={styles.statusFailed}>Failed</Text>}
          <Text style={styles.timestamp}>{relativeTime(item.created_at)}</Text>
        </View>
      </View>

      {item.status === "done" && item.thumbnail_url && (
        <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} contentFit="cover" alt="" />
      )}

      <View style={styles.body}>
        {item.status === "pending" && <PendingBody url={item.source_url} />}
        {item.status === "processing" && <ProcessingBody url={item.source_url} />}
        {item.status === "failed" && <FailedBody url={item.source_url} onRetry={handleRetry} />}
        {item.status === "done" && item.extracted_data && (
          <>
            {item.category === "food" ? (
              <FoodBody data={data} />
            ) : item.category === "recipe" ? (
              <RecipeBody data={data} />
            ) : item.category === "fitness" ? (
              <FitnessBody data={data} />
            ) : item.category === "how-to" ? (
              <HowToBody data={data} />
            ) : item.category === "video-analysis" ? (
              <VideoBody data={data} />
            ) : item.category === "travel" ? (
              <TravelBody data={data} />
            ) : (
              <GenericBody data={data} />
            )}
          </>
        )}
      </View>

      {item.status === "done" && (
        <View style={styles.footer}>
          <Pressable
            style={[styles.actionButton, { borderColor: meta.color }]}
            onPress={() => runAction(item, () => setShowGuide(true), showToast)}
          >
            <Text style={[styles.actionLabel, { color: meta.color }]}>{actionLabel(item.category, data)}</Text>
          </Pressable>
        </View>
      )}

      {item.category === "how-to" && (
        <HowToGuideModal
          visible={showGuide}
          onClose={() => setShowGuide(false)}
          title={data.title as string | undefined}
          summary={data.summary as string | undefined}
          steps={extractHowToSteps(data)}
        />
      )}
    </View>
  );
}

import { Pressable, Text, View } from "react-native";
import { cardStyles as styles } from "./styles";
import { extractHowToSteps } from "./types";

// ─── Category-specific bodies ──────────────────────────────────────────────

export function FoodBody({ data }: { data: Record<string, unknown> }) {
  const name = data.name as string | undefined;
  const address = data.address as string | undefined;
  const cuisine = data.cuisine as string | undefined;
  const whyVisit = data.why_visit as string | undefined;
  const priceRange = data.price_range as string | undefined;

  return (
    <View style={styles.bodyGap}>
      {name && <Text style={styles.bodyTitle}>{name}</Text>}
      <View style={styles.chipRow}>
        {cuisine && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{cuisine}</Text>
          </View>
        )}
        {priceRange && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{priceRange}</Text>
          </View>
        )}
      </View>
      {address && <Text style={styles.bodySecondary}>📍 {address}</Text>}
      {whyVisit && <Text style={styles.bodyQuote}>{whyVisit}</Text>}
    </View>
  );
}

export function RecipeBody({ data }: { data: Record<string, unknown> }) {
  const dishName = data.dish_name as string | undefined;
  const ingredients = (data.ingredients as string[] | undefined) ?? [];
  const prepTime = data.prep_time_minutes as number | undefined;
  const cookTime = data.cook_time_minutes as number | undefined;
  const servings = data.servings as number | undefined;

  return (
    <View style={styles.bodyGap}>
      {dishName && <Text style={styles.bodyTitle}>{dishName}</Text>}
      <View style={styles.chipRow}>
        {prepTime !== undefined && <Text style={styles.bodySecondary}>Prep {prepTime}m</Text>}
        {!!cookTime && <Text style={styles.bodySecondary}>Cook {cookTime}m</Text>}
        {servings !== undefined && <Text style={styles.bodySecondary}>Serves {servings}</Text>}
      </View>
      {ingredients.length > 0 && (
        <View>
          <Text style={styles.sectionLabel}>Ingredients</Text>
          {ingredients.slice(0, 5).map((ing, i) => (
            <Text key={i} style={styles.listItem}>
              · {ing}
            </Text>
          ))}
          {ingredients.length > 5 && (
            <Text style={styles.muted}>+{ingredients.length - 5} more</Text>
          )}
        </View>
      )}
    </View>
  );
}

export function FitnessBody({ data }: { data: Record<string, unknown> }) {
  const workoutName = data.workout_name as string | undefined;
  const exercises =
    (data.exercises as Array<{ name: string; sets: number; reps: number | string }> | undefined) ?? [];
  const duration = data.duration_minutes as number | undefined;
  const difficulty = data.difficulty as string | undefined;

  return (
    <View style={styles.bodyGap}>
      {workoutName && <Text style={styles.bodyTitle}>{workoutName}</Text>}
      <View style={styles.chipRow}>
        {!!duration && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{duration}m</Text>
          </View>
        )}
        {difficulty && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{difficulty}</Text>
          </View>
        )}
      </View>
      {exercises.length > 0 && (
        <View>
          {exercises.slice(0, 4).map((ex, i) => (
            <View key={i} style={styles.exerciseRow}>
              <Text style={styles.bodySecondary}>{ex.name}</Text>
              <Text style={styles.exerciseReps}>
                {Number(ex.sets) > 1 ? `${ex.sets}×` : ""}
                {ex.reps}
              </Text>
            </View>
          ))}
          {exercises.length > 4 && (
            <Text style={styles.muted}>+{exercises.length - 4} more exercises</Text>
          )}
        </View>
      )}
    </View>
  );
}

export function HowToBody({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string | undefined;
  const summary = data.summary as string | undefined;
  const previewPoints = extractHowToSteps(data).slice(0, 3);

  return (
    <View style={styles.bodyGap}>
      {title && <Text style={styles.bodyTitle}>{title}</Text>}
      {summary && (
        <Text style={styles.bodySecondary} numberOfLines={3}>
          {summary}
        </Text>
      )}
      {previewPoints.map((pt, i) => (
        <Text key={i} style={styles.listItem}>
          → {pt}
        </Text>
      ))}
    </View>
  );
}

export function VideoBody({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string | undefined;
  const summary = data.summary as string | undefined;

  return (
    <View style={styles.bodyGap}>
      {title && <Text style={styles.bodyTitle}>{title}</Text>}
      {summary && (
        <Text style={styles.bodySecondary} numberOfLines={3}>
          {summary}
        </Text>
      )}
    </View>
  );
}

export function TravelBody({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string | undefined;
  const primaryLocation = data.primary_location as string | undefined;
  const itinerary =
    (data.itinerary as Array<{ name?: string; location_text?: string }> | undefined) ?? [];

  return (
    <View style={styles.bodyGap}>
      {title && <Text style={styles.bodyTitle}>{title}</Text>}
      {primaryLocation && <Text style={styles.bodySecondary}>🗺️ {primaryLocation}</Text>}
      {itinerary.slice(0, 4).map((stop, i) => (
        <Text key={i} style={styles.listItem}>
          {i + 1}. {stop.name ?? "Stop"}
        </Text>
      ))}
    </View>
  );
}

export function GenericBody({ data }: { data: Record<string, unknown> }) {
  const title = data.title as string | undefined;
  const summary = data.summary as string | undefined;
  if (!title && !summary) return null;
  return (
    <View style={styles.bodyGap}>
      {title && <Text style={styles.bodyTitle}>{title}</Text>}
      {summary && (
        <Text style={styles.bodySecondary} numberOfLines={3}>
          {summary}
        </Text>
      )}
    </View>
  );
}

// ─── Status bodies ──────────────────────────────────────────────────────────

export function PendingBody({ url }: { url: string }) {
  return (
    <View style={styles.bodyGap}>
      <Text style={styles.muted}>Queued for processing…</Text>
      <Text style={styles.urlText} numberOfLines={1}>
        {url}
      </Text>
    </View>
  );
}

export function ProcessingBody({ url }: { url: string }) {
  return (
    <View style={styles.bodyGap}>
      <Text style={styles.muted}>AI is analyzing this link…</Text>
      <Text style={styles.urlText} numberOfLines={1}>
        {url}
      </Text>
    </View>
  );
}

export function FailedBody({ url, onRetry }: { url: string; onRetry: () => void }) {
  return (
    <View style={styles.bodyGap}>
      <Text style={styles.errorText}>Could not extract content</Text>
      <Text style={styles.urlText} numberOfLines={1}>
        {url}
      </Text>
      <Pressable style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryLabel}>Retry</Text>
      </Pressable>
    </View>
  );
}

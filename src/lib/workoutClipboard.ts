type WorkoutExercise = {
  name?: unknown;
  sets?: unknown;
  reps?: unknown;
  notes?: unknown;
};

function exerciseLine(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const ex = raw as WorkoutExercise;
  const name = typeof ex.name === "string" ? ex.name.trim() : "";
  if (!name) return null;

  const setCount =
    typeof ex.sets === "number"
      ? ex.sets
      : typeof ex.sets === "string" && ex.sets.trim() !== "" && Number.isFinite(Number(ex.sets))
        ? Number(ex.sets)
        : null;
  const sets = setCount !== null && Number.isFinite(setCount) && setCount > 1 ? `${setCount}×` : "";
  const reps =
    typeof ex.reps === "number" || typeof ex.reps === "string"
      ? String(ex.reps).trim()
      : "";
  const dose = `${sets}${reps}`;
  const notes =
    typeof ex.notes === "string" && ex.notes.trim() ? ` (${ex.notes.trim()})` : "";

  return dose ? `${name} — ${dose}${notes}` : `${name}${notes}`;
}

/** Plain text for the fitness "Copy workout" button. */
export function formatWorkoutClipboard(
  data: Record<string, unknown> | null | undefined,
): string {
  if (!data) return "";

  const workoutName =
    typeof data.workout_name === "string" ? data.workout_name.trim() : "";
  const lines = (Array.isArray(data.exercises) ? data.exercises : [])
    .map(exerciseLine)
    .filter((line): line is string => Boolean(line));

  if (workoutName && lines.length > 0) return `${workoutName}\n\n${lines.join("\n")}`;
  return workoutName || lines.join("\n");
}

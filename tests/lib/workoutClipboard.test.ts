import { formatWorkoutClipboard } from "../../src/lib/workoutClipboard";

describe("formatWorkoutClipboard", () => {
  it("copies the workout name and each exercise", () => {
    expect(
      formatWorkoutClipboard({
        workout_name: "Medicine Ball Ab Workout",
        exercises: [
          { name: "Medicine Ball Russian Twists", sets: 3, reps: 15 },
          { name: "Plank", sets: 1, reps: "45s", notes: "brace core" },
          { name: "Dead Bug", sets: "3", reps: "8" },
        ],
      }),
    ).toBe(
      "Medicine Ball Ab Workout\n\nMedicine Ball Russian Twists — 3×15\nPlank — 45s (brace core)\nDead Bug — 3×8",
    );
  });

  it("returns an empty string when there is nothing to copy", () => {
    expect(formatWorkoutClipboard(null)).toBe("");
    expect(formatWorkoutClipboard({})).toBe("");
    expect(formatWorkoutClipboard({ exercises: [{ sets: 3 }] })).toBe("");
  });
});

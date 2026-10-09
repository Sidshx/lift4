export type Muscle =
  | "Chest"
  | "Back"
  | "Shoulders"
  | "Biceps"
  | "Triceps"
  | "Quads"
  | "Hamstrings/Glutes"
  | "Calves"
  | "Core";

export type Exercise = {
  id: string;
  name: string;
  img: string;
  gear: "DB" | "Cable" | "Bench" | "BW" | "Machine";
  muscle: Muscle; // counts toward weekly volume
  feel: string; // where you should feel it
  sets: number;
  reps: [number, number];
  unit: "lb" | "sec" | "bw";
  perSide?: boolean;
  rest: number; // seconds
  inhale: string;
  exhale: string;
  cues: [string, string, string];
  start: string; // starting load hint
};

export type Block = { name: string; detail: string };

export type Day = {
  n: 1 | 2 | 3 | 4;
  weekday: string;
  dow: number; // JS getDay()
  title: string;
  short: string;
  muscles: Muscle[];
  warmup: Block[];
  main: Exercise[];
  finisher: Exercise;
  stretch: Block[];
};

export const PLAN: Day[] = [
  {
    n: 1,
    weekday: "Mon",
    dow: 1,
    title: "Chest + Triceps",
    short: "Push",
    muscles: ["Chest", "Triceps", "Shoulders"],
    warmup: [
      { name: "Arm circles", detail: "30s fwd / 30s back" },
      { name: "Band or cable pull-apart", detail: "2 × 15, light" },
      { name: "Push-ups", detail: "1 × 10, slow" },
      { name: "DB bench, ramp-up", detail: "1 × 12 at 50% weight" },
    ],
    main: [
      {
        id: "db-bench",
        name: "Dumbbell Bench Press",
        img: "Dumbbell_Bench_Press",
        gear: "DB",
        muscle: "Chest",
        feel: "Mid chest, front delts",
        sets: 4,
        reps: [8, 10],
        unit: "lb",
        rest: 90,
        inhale: "Lowering",
        exhale: "Pressing up",
        cues: ["Shoulder blades pinched + down", "Lower 3s to chest level", "Elbows ~45° from body"],
        start: "20–25 lb each",
      },
      {
        id: "incline-db-press",
        name: "Incline Dumbbell Press",
        img: "Incline_Dumbbell_Press",
        gear: "DB",
        muscle: "Chest",
        feel: "Upper chest, below collarbone",
        sets: 3,
        reps: [10, 12],
        unit: "lb",
        rest: 90,
        inhale: "Lowering",
        exhale: "Pressing up",
        cues: ["Seat at 30°, not steeper", "DBs over upper chest", "Don't clang DBs at top"],
        start: "15–20 lb each",
      },
      {
        id: "cable-crossover",
        name: "Cable Crossover (mid)",
        img: "Cable_Crossover",
        gear: "Cable",
        muscle: "Chest",
        feel: "Inner chest squeeze",
        sets: 3,
        reps: [12, 15],
        unit: "lb",
        rest: 60,
        inhale: "Arms opening",
        exhale: "Hugging in",
        cues: ["Pulleys at shoulder height", "Soft fixed elbow bend", "Squeeze 1s at center"],
        start: "Light stack, 10–20 lb",
      },
      {
        id: "db-pullover",
        name: "Dumbbell Pullover",
        img: "Straight-Arm_Dumbbell_Pullover",
        gear: "DB",
        muscle: "Chest",
        feel: "Chest stretch + lats",
        sets: 3,
        reps: [10, 12],
        unit: "lb",
        rest: 60,
        inhale: "Lowering behind head",
        exhale: "Pulling over chest",
        cues: ["Hold one DB, both hands", "Slight elbow bend, fixed", "Stop when ribs flare"],
        start: "20–25 lb, one DB",
      },
      {
        id: "rope-pushdown",
        name: "Rope Triceps Pushdown",
        img: "Triceps_Pushdown_-_Rope_Attachment",
        gear: "Cable",
        muscle: "Triceps",
        feel: "Back of arm, horseshoe",
        sets: 3,
        reps: [10, 12],
        unit: "lb",
        rest: 60,
        inhale: "Rope rising",
        exhale: "Pushing down",
        cues: ["Elbows pinned to sides", "Split rope at bottom", "Only forearms move"],
        start: "20–30 lb stack",
      },
      {
        id: "db-oh-ext",
        name: "Overhead DB Triceps Ext.",
        img: "Standing_Dumbbell_Triceps_Extension",
        gear: "DB",
        muscle: "Triceps",
        feel: "Long head, deep stretch",
        sets: 3,
        reps: [10, 12],
        unit: "lb",
        rest: 60,
        inhale: "Lowering behind head",
        exhale: "Extending up",
        cues: ["Sit upright, back on pad", "Elbows point forward", "Full stretch at bottom"],
        start: "20–25 lb, one DB",
      },
    ],
    finisher: {
      id: "pushups",
      name: "Push-ups to failure",
      img: "Pushups",
      gear: "BW",
      muscle: "Chest",
      feel: "Chest + triceps pump",
      sets: 2,
      reps: [10, 25],
      unit: "bw",
      rest: 60,
      inhale: "Lowering",
      exhale: "Pushing up",
      cues: ["Body in a straight line", "Chest to fist height", "Stop 1 rep before form breaks"],
      start: "Bodyweight",
    },
    stretch: [
      { name: "Doorway chest stretch", detail: "30s / side" },
      { name: "Overhead triceps stretch", detail: "30s / side" },
    ],
  },
  {
    n: 2,
    weekday: "Tue",
    dow: 2,
    title: "Back + Biceps",
    short: "Pull",
    muscles: ["Back", "Biceps", "Shoulders"],
    warmup: [
      { name: "Cat–cow", detail: "10 slow reps" },
      { name: "Light lat pulldown", detail: "1 × 15" },
      { name: "Band or cable pull-apart", detail: "2 × 15" },
      { name: "Dead hang / arm swings", detail: "30s" },
    ],
    main: [
      {
        id: "lat-pulldown",
        name: "Wide Lat Pulldown",
        img: "Wide-Grip_Lat_Pulldown",
        gear: "Cable",
        muscle: "Back",
        feel: "Lats, sides of back",
        sets: 4,
        reps: [8, 10],
        unit: "lb",
        rest: 90,
        inhale: "Arms rising",
        exhale: "Pulling down",
        cues: ["Chest up, slight lean back", "Pull bar to upper chest", "Drive elbows to back pockets"],
        start: "40–60 lb stack",
      },
      {
        id: "seated-row",
        name: "Seated Cable Row",
        img: "Seated_Cable_Rows",
        gear: "Cable",
        muscle: "Back",
        feel: "Mid back, between blades",
        sets: 3,
        reps: [10, 12],
        unit: "lb",
        rest: 90,
        inhale: "Reaching forward",
        exhale: "Rowing in",
        cues: ["Torso still, chest proud", "Handle to belly button", "Squeeze blades 1s"],
        start: "40–50 lb stack",
      },
      {
        id: "db-row",
        name: "One-Arm Dumbbell Row",
        img: "One-Arm_Dumbbell_Row",
        gear: "DB",
        muscle: "Back",
        feel: "Lat + lower lats",
        sets: 3,
        reps: [10, 12],
        unit: "lb",
        perSide: true,
        rest: 60,
        inhale: "Lowering",
        exhale: "Rowing up",
        cues: ["Hand + knee on bench, flat back", "Pull DB to hip, not chest", "No torso twisting"],
        start: "25–30 lb",
      },
      {
        id: "face-pull",
        name: "Face Pull",
        img: "Face_Pull",
        gear: "Cable",
        muscle: "Shoulders",
        feel: "Rear delts, upper back",
        sets: 3,
        reps: [12, 15],
        unit: "lb",
        rest: 60,
        inhale: "Returning",
        exhale: "Pulling to face",
        cues: ["Rope at forehead height", "Pull to eyes, elbows high", "Thumbs back at end"],
        start: "15–25 lb stack",
      },
      {
        id: "incline-curl",
        name: "Incline Dumbbell Curl",
        img: "Incline_Dumbbell_Curl",
        gear: "DB",
        muscle: "Biceps",
        feel: "Biceps peak, full stretch",
        sets: 3,
        reps: [10, 12],
        unit: "lb",
        rest: 60,
        inhale: "Lowering",
        exhale: "Curling up",
        cues: ["Seat at 45–60°", "Arms hang straight down", "Lower slow, 3s"],
        start: "12–15 lb each",
      },
      {
        id: "hammer-curl",
        name: "Hammer Curl",
        img: "Hammer_Curls",
        gear: "DB",
        muscle: "Biceps",
        feel: "Forearm + outer biceps",
        sets: 3,
        reps: [10, 12],
        unit: "lb",
        rest: 60,
        inhale: "Lowering",
        exhale: "Curling up",
        cues: ["Palms face each other", "Elbows stay at sides", "No swinging"],
        start: "15–20 lb each",
      },
    ],
    finisher: {
      id: "back-ext",
      name: "Back Extension (Paramount)",
      img: "Hyperextensions_Back_Extensions",
      gear: "Bench",
      muscle: "Back",
      feel: "Lower back, glutes",
      sets: 2,
      reps: [12, 15],
      unit: "bw",
      rest: 60,
      inhale: "Lowering",
      exhale: "Rising up",
      cues: ["Hinge at hips, controlled", "Rise to a straight line only", "Squeeze glutes at top"],
      start: "Bodyweight",
    },
    stretch: [
      { name: "Child's pose", detail: "45s" },
      { name: "Biceps wall stretch", detail: "30s / side" },
    ],
  },
  {
    n: 3,
    weekday: "Thu",
    dow: 4,
    title: "Legs + Core",
    short: "Legs",
    muscles: ["Quads", "Hamstrings/Glutes", "Calves", "Core"],
    warmup: [
      { name: "Bodyweight squats", detail: "2 × 12" },
      { name: "Leg swings", detail: "10 / side, both ways" },
      { name: "Glute bridge", detail: "1 × 15" },
      { name: "Leg extension, light", detail: "1 × 15" },
    ],
    main: [
      {
        id: "goblet-squat",
        name: "Goblet Squat",
        img: "Goblet_Squat",
        gear: "DB",
        muscle: "Quads",
        feel: "Front thighs, glutes",
        sets: 4,
        reps: [8, 12],
        unit: "lb",
        rest: 90,
        inhale: "Squatting down",
        exhale: "Standing up",
        cues: ["DB held at chest", "3s down, knees over toes", "Hips below knees, chest up"],
        start: "25–35 lb, one DB",
      },
      {
        id: "leg-extension",
        name: "Machine Leg Extension",
        img: "Leg_Extensions",
        gear: "Machine",
        muscle: "Quads",
        feel: "Front thigh, above knee",
        sets: 3,
        reps: [10, 15],
        unit: "lb",
        rest: 60,
        inhale: "Lowering (3s)",
        exhale: "Extending",
        cues: ["Back pad upright, knees at seat edge", "Squeeze 2s at the top", "Grip handles, hips stay down"],
        start: "Light stack, ~30–40 lb",
      },
      {
        id: "db-rdl",
        name: "Dumbbell Romanian Deadlift",
        img: "Stiff-Legged_Dumbbell_Deadlift",
        gear: "DB",
        muscle: "Hamstrings/Glutes",
        feel: "Hamstring stretch, glutes",
        sets: 3,
        reps: [8, 12],
        unit: "lb",
        rest: 90,
        inhale: "Hinging down",
        exhale: "Driving hips forward",
        cues: ["Soft knees, flat back", "Push hips back, DBs slide thighs", "Stop at mid-shin"],
        start: "25 lb each",
      },
      {
        id: "leg-curl",
        name: "Lying Leg Curl (machine)",
        img: "Lying_Leg_Curls",
        gear: "Machine",
        muscle: "Hamstrings/Glutes",
        feel: "Back of thigh, behind knee",
        sets: 3,
        reps: [10, 12],
        unit: "lb",
        rest: 60,
        inhale: "Lowering (3s)",
        exhale: "Curling up",
        cues: ["Back pad down, knees just off the edge", "Hips pressed into pad", "Squeeze 1s, don't swing"],
        start: "Light stack, ~25–35 lb",
      },
      {
        id: "split-squat",
        name: "Bulgarian Split Squat",
        img: "Split_Squat_with_Dumbbells",
        gear: "DB",
        muscle: "Quads",
        feel: "Front quad, glute stretch",
        sets: 3,
        reps: [8, 10],
        unit: "lb",
        perSide: true,
        rest: 60,
        inhale: "Lowering",
        exhale: "Rising",
        cues: ["Rear foot on seat", "Torso slightly forward", "Front knee stable, no cave"],
        start: "10–15 lb each",
      },
      {
        id: "calf-raise",
        name: "Standing DB Calf Raise",
        img: "Standing_Dumbbell_Calf_Raise",
        gear: "DB",
        muscle: "Calves",
        feel: "Calves burn",
        sets: 4,
        reps: [12, 15],
        unit: "lb",
        rest: 45,
        inhale: "Lowering heels",
        exhale: "Rising on toes",
        cues: ["Toes on a plate/step", "Full stretch at bottom", "Pause 1s at top"],
        start: "25 lb each",
      },
    ],
    finisher: {
      id: "cable-crunch",
      name: "Kneeling Cable Crunch",
      img: "Cable_Crunch",
      gear: "Cable",
      muscle: "Core",
      feel: "Upper + mid abs",
      sets: 3,
      reps: [12, 15],
      unit: "lb",
      rest: 45,
      inhale: "Rising up",
      exhale: "Crunching down",
      cues: ["Rope by your ears", "Curl ribs to hips", "Hips stay still"],
      start: "30–40 lb stack",
    },
    stretch: [
      { name: "Hamstring stretch", detail: "30s / side" },
      { name: "Couch / hip-flexor stretch", detail: "30s / side" },
    ],
  },
  {
    n: 4,
    weekday: "Sat",
    dow: 6,
    title: "Shoulders + Arms + Upper Chest",
    short: "Delts/Arms",
    muscles: ["Shoulders", "Chest", "Biceps", "Triceps"],
    warmup: [
      { name: "Arm circles", detail: "30s fwd / 30s back" },
      { name: "Cable external rotation", detail: "1 × 12 / side, light" },
      { name: "Light lateral raise", detail: "1 × 15" },
      { name: "Shoulder press, ramp-up", detail: "1 × 10 at 50%" },
    ],
    main: [
      {
        id: "seated-db-press",
        name: "Seated DB Shoulder Press",
        img: "Seated_Dumbbell_Press",
        gear: "DB",
        muscle: "Shoulders",
        feel: "Front + side delts",
        sets: 4,
        reps: [8, 10],
        unit: "lb",
        rest: 90,
        inhale: "Lowering",
        exhale: "Pressing up",
        cues: ["Seat upright, back on pad", "DBs to ear level", "Don't lock elbows hard"],
        start: "15–20 lb each",
      },
      {
        id: "low-high-fly",
        name: "Low-to-High Cable Fly",
        img: "Low_Cable_Crossover",
        gear: "Cable",
        muscle: "Chest",
        feel: "Upper chest",
        sets: 3,
        reps: [12, 15],
        unit: "lb",
        rest: 60,
        inhale: "Lowering",
        exhale: "Sweeping up",
        cues: ["Pulleys at lowest", "Sweep hands to chin height", "Squeeze upper chest 1s"],
        start: "10–15 lb stack",
      },
      {
        id: "lateral-raise",
        name: "Dumbbell Lateral Raise",
        img: "Side_Lateral_Raise",
        gear: "DB",
        muscle: "Shoulders",
        feel: "Side delts (width)",
        sets: 4,
        reps: [12, 15],
        unit: "lb",
        rest: 60,
        inhale: "Lowering",
        exhale: "Raising",
        cues: ["Lead with elbows", "Stop at shoulder height", "Lower slow, no swing"],
        start: "10–12 lb each",
      },
      {
        id: "rear-delt-fly",
        name: "Cable Rear Delt Fly",
        img: "Cable_Rear_Delt_Fly",
        gear: "Cable",
        muscle: "Shoulders",
        feel: "Back of shoulders",
        sets: 3,
        reps: [12, 15],
        unit: "lb",
        rest: 60,
        inhale: "Arms crossing",
        exhale: "Pulling apart",
        cues: ["Cross cables at chest height", "Arms nearly straight", "Pull wide, not back"],
        start: "5–10 lb stack",
      },
      {
        id: "cable-curl",
        name: "Cable Biceps Curl",
        img: "Standing_Biceps_Cable_Curl",
        gear: "Cable",
        muscle: "Biceps",
        feel: "Biceps, constant tension",
        sets: 3,
        reps: [10, 12],
        unit: "lb",
        rest: 60,
        inhale: "Lowering",
        exhale: "Curling up",
        cues: ["Elbows fixed at sides", "Squeeze hard at top", "Slow 3s down"],
        start: "20–30 lb stack",
      },
      {
        id: "cable-oh-ext",
        name: "Cable Overhead Triceps Ext.",
        img: "Cable_Rope_Overhead_Triceps_Extension",
        gear: "Cable",
        muscle: "Triceps",
        feel: "Long head stretch",
        sets: 3,
        reps: [10, 12],
        unit: "lb",
        rest: 60,
        inhale: "Rope behind head",
        exhale: "Extending forward",
        cues: ["Face away, staggered stance", "Elbows by ears", "Full lockout, squeeze"],
        start: "20–30 lb stack",
      },
    ],
    finisher: {
      id: "db-shrug",
      name: "Dumbbell Shrug",
      img: "Dumbbell_Shrug",
      gear: "DB",
      muscle: "Shoulders",
      feel: "Upper traps",
      sets: 3,
      reps: [12, 15],
      unit: "lb",
      rest: 45,
      inhale: "Lowering",
      exhale: "Shrugging up",
      cues: ["Straight up, no rolling", "Hold 1s at top", "Arms stay straight"],
      start: "25–30 lb each",
    },
    stretch: [
      { name: "Cross-body shoulder", detail: "30s / side" },
      { name: "Chest + biceps wall", detail: "30s / side" },
    ],
  },
];

export const ALL_EXERCISES: (Exercise & { day: number })[] = PLAN.flatMap((d) =>
  [...d.main, d.finisher].map((e) => ({ ...e, day: d.n })),
);

export const MUSCLES: Muscle[] = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Quads",
  "Hamstrings/Glutes",
  "Calves",
  "Core",
];

export const PROFILE = {
  weeklyGainKg: [0.25, 0.5] as [number, number],
};

export function imgSrc(id: string, frame: 0 | 1) {
  return `${import.meta.env.BASE_URL}ex/${id}_${frame}.jpg`;
}

export function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Day number for today; if rest day, the next upcoming training day. */
export function todaysDay(date = new Date()): { n: number; rest: boolean } {
  const dow = date.getDay();
  const exact = PLAN.find((d) => d.dow === dow);
  if (exact) return { n: exact.n, rest: false };
  for (let i = 1; i <= 7; i++) {
    const next = PLAN.find((d) => d.dow === (dow + i) % 7);
    if (next) return { n: next.n, rest: true };
  }
  return { n: 1, rest: true };
}

/** Monday-based week key, YYYY-MM-DD of that week's Monday. */
export function weekKey(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const shift = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - shift);
  return todayISO(dt);
}

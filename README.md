# Lift4

4-day, 60-minute muscle and weight gain plan as an offline-first web app (PWA).

- Day pages with demo images, target muscle, breathing, form cues, set logging and rest timer
- Data saved on the device; syncs to a Google Sheet via Apps Script (`apps-script/Code.gs`) when online
- Coaching: next-session target per exercise (double progression), one-tap set logging at the target, Fitbit readiness adjusts targets (Green push / Yellow hold / Red 1 fewer set)
- Weekly muscle-group coverage: sets count on any day; groups can be paused on purpose; suggests which day covers what's left
- Progress charts: bodyweight, strength, weekly volume per muscle, workouts per week

Build: `npm run build:pages` → `dist/public`.

Exercise images: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense).

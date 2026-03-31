# FAANG Habit Performance Tracker

Mobile-first habit accountability dashboard built with Next.js App Router + Firebase Auth/Firestore.

## Stack

- Next.js 16 (App Router)
- TypeScript
- Firebase Auth (Google only)
- Firestore
- Tailwind CSS v4
- Recharts

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Add Firebase config to `.env.local` (already added in this workspace) or copy from `.env.example`:

```bash
cp .env.example .env.local
```

3. Start dev server:

```bash
npm run dev
```

4. Open http://localhost:3000

## Firebase Setup Checklist

1. In Firebase Console, enable Authentication -> Sign-in method -> Google.
2. In Firestore Database, create database in production or test mode.
3. Add localhost app domain if required by your auth settings.
4. Ensure your Firebase web app config is set in `.env.local` using `NEXT_PUBLIC_FIREBASE_*` keys.

## Implemented Features

- Daily tracker with binary toggles (check or cross)
- Dynamic progress bar + direct performance feedback bands
- Weekly line chart with:
	- Best day
	- Worst day
	- Weekly score
	- Streak counter
- Monthly calendar heatmap (GitHub-style intensity)
- Long-term analytics:
	- Monthly averages
	- Half-year trend line
	- Yearly performance average
	- Habit-level consistency breakdown
- Weekly reflection workflow:
	- What went well
	- Where you failed
	- What distracted you
	- What to fix next week
- Reflection history list for pattern awareness
- Motivation engine:
	- Urgency prompts
	- Streak warnings
	- FAANG countdown (365 days from account creation)
- Fixed top banner: `JESUS IS MY CEO`

## Firestore Structure

The app stores user-specific data under:

```text
users/{userId}/habits/{date}
users/{userId}/weeklySummaries/{weekId}
users/{userId}/reflections/{weekId}
users/{userId}/stats/current
```

Habit document example:

```json
{
	"date": "2026-03-31",
	"habits": {
		"morningPrayer": true,
		"scriptureMemorization": false
	},
	"updatedAt": "serverTimestamp"
}
```

# Jesus is my CEO — Habit & Analytics Tracker

A high-performance, mobile-first web application built with Next.js designed to track spiritual disciplines alongside coding progression (LeetCode, MERN stack). It features a sleek dark-themed UI, generative AI weekly reflections (powered by Gemini), and GitHub-style habit activity calendars.

## Core Features

- **Unified Tracking**: Track spiritual disciplines (prayer, Bible reading, memorization) alongside physical health and career goals (LeetCode, technical reading, MERN practice).
- **Intelligent Logging**: Interactive prompts ask specific follow-up questions for key habits. Log the Bible chapters you read, the specific LeetCode problem you solved, or the features you built.
- **Epic AI Reflections**: Uses the Gemini API to analyze your week's logs, generating an "epic movie trailer" summary, actionable insights, pattern recognition, and spiritual overview.
- **AI Scripture Flashcards**: Automatically turns memory verses and technical notes generated throughout the week into interactive flashcards for spaced repetition testing.
- **Advanced Activity Analytics**: View 6-month historical activity via a GitHub-style contribution graph and percentage breakdown charts on a dedicated `/stats` page.
- **Custom Day Boundaries**: Features a customized 3:00 AM reset time, preventing late-night (post-midnight) grinds from mistakenly logging into the next calendar day.
- **Mobile-First Design**: Fully responsive tailored for an app-like experience on mobile screens, complete with bottom tab navigation.

## Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Database / Auth**: Firebase (Firestore, Authentication)
- **Data Visualization**: Recharts
- **AI Integration**: Google Gemini 2.0 API (`@google/generative-ai`)

## Getting Started

### 1. Configure Firebase
1. Create a project in the [Firebase Console](https://console.firebase.google.com).
2. Enable Authentication (Email/Password) and Firestore Database.
3. Configure Firestore Security Rules to secure user data:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

### 2. Environment Variables
Create a `.env.local` file in the root directory and populate it with your Firebase config and Gemini token:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_value
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_value
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_value
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_value
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_value
NEXT_PUBLIC_FIREBASE_APP_ID=your_value

# Required for AI Reflections and Flashcards
GEMINI_API_KEY=your_value
```

### 3. Install & Run
Run the application locally:
```bash
npm install
npm run dev
```

Navigate to [http://localhost:3000](http://localhost:3000) to create a user and begin tracking.

---
*Built with intent and discipline.*

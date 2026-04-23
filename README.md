# GamePortal — Multiplayer Gaming Hub

Real-time multiplayer gaming platform with UNO and Call Bridge, built with React + Firebase.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Firebase

Copy `.env.example` to `.env` and fill in your Firebase project credentials:

```bash
cp .env.example .env
```

Required values from your Firebase Console:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=        ← Realtime Database URL (required)
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### 3. Firebase Console setup

**Authentication**
- Go to Authentication → Sign-in method → Enable Google

**Firestore**
- Go to Firestore → Create database (used for user profiles only)
- Start in production mode, allow writes to `users` collection for authenticated users

**Realtime Database**
- Go to Realtime Database → Create database
- Choose your region
- Start in **locked mode**
- Then go to Rules tab and paste the contents of `firebase-rules.json`

### 4. Apply Security Rules

In Firebase Console → Realtime Database → Rules tab, paste the full JSON from `firebase-rules.json`.

### 5. Run development server

```bash
npm run dev
```

App runs at `http://localhost:3000`

### 6. Deploy

```bash
npm run build
```

Upload the `dist/` folder to Vercel, Netlify, or Firebase Hosting.

---

## What was fixed in this version

### Ready System
- Player ready state writes directly to RTDB without any read-modify-write cycle — no race conditions possible
- Ready status updates are instant for all players via Firebase listener

### Start Game
- Full server-side validation: checks player count AND all ready before allowing start
- Double-start protected with a `useRef` guard
- Host cannot start if not enough players or someone is unready

### Multi-Room Join Prevention
- `userRooms/{uid}` node in RTDB tracks which room each user is in
- Joining any room first checks this node — throws error if already in a different room
- Survives page refresh (not just Zustand state)

### Voice Chat
- Switched from `onValue` (reruns on all changes) to `onChildAdded` (new signals only)
- Peer connection conflict resolution: higher UID wins when both sides initiate simultaneously
- Microphone access failure shows a user-friendly error and disables voice without crashing

### Game Init Race Condition
- `initializingRef` prevents host from calling `initGame` twice when RTDB fires multiple callbacks
- Non-host clients wait for `gameInitialized` flag before acting

### Data Architecture
- All room data lives in RTDB only (removed Firestore room duplication)
- Invite codes indexed at `inviteCodes/{code}` for O(1) lookup without Firestore queries
- Signaling namespace cleared on connect to prevent stale WebRTC signals

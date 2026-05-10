# ZzzPool

A tiny friends-only sleep status pool: asleep, not ignoring you.

## Backend

This MVP uses Firebase on the free Spark plan:

- Firebase Authentication for sign-in.
- Cloud Firestore for profiles, statuses, usernames, and friendships.
- Firestore Security Rules for friends-only status visibility.
- GitHub Pages for static hosting.

## Firebase Setup

1. Create a Firebase project.
2. Enable Authentication providers:
   - Google
   - Anonymous, if you want the guest button to work.
3. Create a Cloud Firestore database.
4. Publish `firestore.rules` in Firebase Console, or use the Firebase CLI.
5. Copy `.env.local.example` to `.env.local` and fill in the web app config values.
6. Add your GitHub Pages URL to Firebase Auth authorized domains after deployment.

## Local Development

```bash
npm install
npm run dev
```

## GitHub Pages Deployment

The workflow in `.github/workflows/pages.yml` builds a static Next.js export into `out/`.

Add these repository secrets in GitHub:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Then enable GitHub Pages with source set to GitHub Actions.

## Data Model

```text
usernames/{username}
  uid
  username

profiles/{uid}
  username
  displayName
  avatarStyle
  createdAt

statuses/{uid}
  userId
  isSleeping
  updatedAt

friendships/{uidA_uidB}
  users
  requesterId
  addresseeId
  status
  createdAt
```

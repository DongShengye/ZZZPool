# ZZZPool

A tiny community sleep status pool: asleep, not ignoring you.

## Backend

This MVP uses Firebase on the free Spark plan:

- Firebase Authentication for sign-in.
- Cloud Firestore for profiles, statuses, usernames, friendships, and community-pool visibility.
- Firestore Security Rules for public community status visibility plus private/friends-only protections.
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

Do not commit `.env.local`. Firebase web config is injected from local env vars during development and GitHub Actions secrets during deployment.

## Local Development

```bash
npm install
npm run dev
```

## GitHub Pages Deployment

The workflow in `.github/workflows/pages.yml` builds a static Next.js export into `out/`.

Add these repository secrets in GitHub at `Settings -> Secrets and variables -> Actions -> Repository secrets`:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

The workflow in `.github/workflows/pages.yml` reads those secrets and exposes them only to the static build step.

Then enable GitHub Pages with source set to GitHub Actions and rerun the deployment workflow.

After rotating the Firebase API key, update both `.env.local` and the `NEXT_PUBLIC_FIREBASE_API_KEY` GitHub secret.

## Data Model

```text
usernames/{username}
  uid
  username

profiles/{uid}
  username
  displayName
  avatarStyle
  showInCommunity
  hiddenFromPool
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

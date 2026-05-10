import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import {
  type Auth,
  getAuth,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithPopup
} from "firebase/auth";
import {
  collection,
  doc,
  type Firestore,
  getDoc,
  getFirestore,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where
} from "firebase/firestore";

function envValue(value: string | undefined) {
  return value?.trim();
}

const firebaseConfig = {
  apiKey: envValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: envValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: envValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: envValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: envValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: envValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID)
};

const requiredFirebaseEnv = [
  ["NEXT_PUBLIC_FIREBASE_API_KEY", firebaseConfig.apiKey],
  ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", firebaseConfig.authDomain],
  ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", firebaseConfig.projectId],
  ["NEXT_PUBLIC_FIREBASE_APP_ID", firebaseConfig.appId]
] as const;

export type Profile = {
  id: string;
  username: string;
  displayName: string;
  avatarStyle: string;
  hiddenFromPool?: boolean;
  showInCommunity?: boolean;
  createdAt?: Timestamp;
};

export type SleepStatus = {
  userId: string;
  isSleeping: boolean;
  updatedAt?: Timestamp;
};

export type Friendship = {
  id: string;
  users: string[];
  requesterId: string;
  addresseeId: string;
  status: "pending" | "accepted" | "blocked";
  createdAt?: Timestamp;
};

export type PoolFriend = {
  profile: Profile;
  status: SleepStatus;
  friendship?: Friendship;
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function getMissingFirebaseEnvVars() {
  return requiredFirebaseEnv.filter(([, value]) => !value).map(([key]) => key);
}

export function hasFirebaseConfig() {
  return getMissingFirebaseEnvVars().length === 0;
}

export function explainFirebaseError(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("auth/popup-blocked")) {
      return "Your browser blocked the Google sign-in popup. Allow popups for this site and try again.";
    }

    if (error.message.includes("auth/unauthorized-domain")) {
      return "Firebase rejected this domain. Add localhost and your GitHub Pages domain in Firebase Auth settings.";
    }

    if (error.message.includes("auth/operation-not-allowed")) {
      return "Google sign-in is not enabled yet. Turn it on in Firebase Authentication.";
    }

    if (error.message.includes("auth/configuration-not-found")) {
      return "Firebase Authentication is not set up for this project yet. In Firebase Console, open Authentication, click Get started, then enable Google and Anonymous sign-in.";
    }

    if (error.message.includes("Firebase env vars are missing")) {
      return error.message;
    }

    return error.message;
  }

  return "Something went wrong while talking to Firebase.";
}

function getFirebaseApp() {
  if (!hasFirebaseConfig()) {
    throw new Error(
      `Firebase env vars are missing: ${getMissingFirebaseEnvVars().join(", ")}. Fill .env.local, then restart npm run dev.`
    );
  }

  app = app || (getApps().length ? getApps()[0] : initializeApp(firebaseConfig));
  return app;
}

export function getFirebaseAuth() {
  auth = auth || getAuth(getFirebaseApp());
  return auth;
}

function getFirebaseDb() {
  db = db || getFirestore(getFirebaseApp());
  return db;
}

export async function signInWithGoogle() {
  return signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
}

export async function signInAsGuest() {
  return signInAnonymously(getFirebaseAuth());
}

export async function createProfile(
  uid: string,
  username: string,
  displayName: string,
  avatarStyle: string
) {
  const normalized = username.trim().toLowerCase();

  const database = getFirebaseDb();

  try {
    await runTransaction(database, async (transaction) => {
      const usernameRef = doc(database, "usernames", normalized);
      const profileRef = doc(database, "profiles", uid);
      const statusRef = doc(database, "statuses", uid);
      const usernameSnap = await transaction.get(usernameRef);

      if (usernameSnap.exists() && usernameSnap.data().uid !== uid) {
        throw new Error("That username is already floating in another pool.");
      }

      if (!usernameSnap.exists()) {
        transaction.set(usernameRef, { uid, username: normalized });
      }

      transaction.set(profileRef, {
        username: normalized,
        displayName: displayName.trim() || normalized,
        avatarStyle,
        hiddenFromPool: false,
        showInCommunity: true,
        createdAt: serverTimestamp()
      });
      transaction.set(statusRef, {
        userId: uid,
        isSleeping: false,
        updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    throw new Error(`Profile setup failed: ${explainFirebaseError(error)}`);
  }
}

export function watchProfile(uid: string, onChange: (profile: Profile | null) => void) {
  return onSnapshot(doc(getFirebaseDb(), "profiles", uid), (snapshot) => {
    onChange(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Profile) : null);
  });
}

export function watchStatus(uid: string, onChange: (status: SleepStatus | null) => void) {
  return onSnapshot(doc(getFirebaseDb(), "statuses", uid), (snapshot) => {
    onChange(snapshot.exists() ? (snapshot.data() as SleepStatus) : null);
  });
}

export async function setSleeping(uid: string, isSleeping: boolean) {
  await setDoc(
    doc(getFirebaseDb(), "statuses", uid),
    {
      userId: uid,
      isSleeping,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function setHiddenFromPool(uid: string, hiddenFromPool: boolean) {
  await updateDoc(doc(getFirebaseDb(), "profiles", uid), {
    hiddenFromPool,
    showInCommunity: !hiddenFromPool
  });
}

export async function setCommunityVisibility(uid: string, showInCommunity: boolean) {
  await updateDoc(doc(getFirebaseDb(), "profiles", uid), { showInCommunity });
}

export async function updateProfileBasics(
  uid: string,
  displayName: string,
  avatarStyle: string
) {
  await updateDoc(doc(getFirebaseDb(), "profiles", uid), {
    displayName: displayName.trim() || "Sleepy Friend",
    avatarStyle
  });
}

export async function addFriendByUsername(uid: string, username: string) {
  const normalized = username.trim().toLowerCase();
  const database = getFirebaseDb();
  const usernameSnap = await getDoc(doc(database, "usernames", normalized));

  if (!usernameSnap.exists()) {
    throw new Error("No sleeper found with that username.");
  }

  const addresseeId = usernameSnap.data().uid as string;
  if (addresseeId === uid) {
    throw new Error("You are already in your own pool.");
  }

  const friendshipId = [uid, addresseeId].sort().join("_");
  const friendshipRef = doc(database, "friendships", friendshipId);

  try {
    await setDoc(friendshipRef, {
      users: [uid, addresseeId].sort(),
      requesterId: uid,
      addresseeId,
      status: "pending",
      createdAt: serverTimestamp()
    });
  } catch (error) {
    const message = explainFirebaseError(error);

    if (message.includes("Missing or insufficient permissions")) {
      throw new Error("A friend request may already exist for this person.");
    }

    throw error;
  }
}

export async function updateFriendship(friendshipId: string, status: Friendship["status"]) {
  await updateDoc(doc(getFirebaseDb(), "friendships", friendshipId), { status });
}

export function watchFriendships(uid: string, onChange: (friendships: Friendship[]) => void) {
  const friendshipsQuery = query(collection(getFirebaseDb(), "friendships"), where("users", "array-contains", uid));

  return onSnapshot(friendshipsQuery, (snapshot) => {
    onChange(
      snapshot.docs.map((friendship) => ({
        id: friendship.id,
        ...friendship.data()
      })) as Friendship[]
    );
  });
}

export function watchCommunityProfiles(onChange: (profiles: Profile[]) => void) {
  const communityQuery = query(
    collection(getFirebaseDb(), "profiles"),
    where("showInCommunity", "==", true),
    limit(36)
  );

  return onSnapshot(communityQuery, (snapshot) => {
    onChange(
      snapshot.docs.map((profile) => ({
        id: profile.id,
        ...profile.data()
      })) as Profile[]
    );
  });
}

export async function loadCommunityPool(uid: string, profiles: Profile[]) {
  const uniqueProfiles = profiles.filter((profile) => profile.id !== uid);
  const members = await Promise.all(
    uniqueProfiles.map(async (profile) => {
      const statusSnap = await getDoc(doc(getFirebaseDb(), "statuses", profile.id));

      if (!statusSnap.exists()) return null;

      return {
        profile,
        status: statusSnap.data() as SleepStatus
      };
    })
  );

  return members.filter(Boolean) as PoolFriend[];
}

export async function loadPoolFriends(uid: string, friendships: Friendship[]) {
  const accepted = friendships.filter((friendship) => friendship.status === "accepted");
  const friends = await Promise.all(
    accepted.map(async (friendship) => {
      const friendId = friendship.users.find((id) => id !== uid);
      if (!friendId) return null;

      const [profileSnap, statusSnap] = await Promise.all([
        getDoc(doc(getFirebaseDb(), "profiles", friendId)),
        getDoc(doc(getFirebaseDb(), "statuses", friendId))
      ]);

      if (!profileSnap.exists() || !statusSnap.exists()) return null;

      return {
        profile: { id: profileSnap.id, ...profileSnap.data() } as Profile,
        status: statusSnap.data() as SleepStatus,
        friendship
      };
    })
  );

  return (friends.filter(Boolean) as PoolFriend[]).filter((friend) => !friend.profile.hiddenFromPool);
}

export async function lookupFriendStatusByUsername(uid: string, username: string) {
  const normalized = username.trim().toLowerCase();
  if (!normalized) return null;

  const database = getFirebaseDb();
  const usernameSnap = await getDoc(doc(database, "usernames", normalized));

  if (!usernameSnap.exists()) {
    throw new Error("No sleeper found with that username.");
  }

  const friendId = usernameSnap.data().uid as string;
  if (friendId === uid) {
    throw new Error("That's you. Your own status is already on your float.");
  }

  const profileSnap = await getDoc(doc(database, "profiles", friendId));
  if (!profileSnap.exists()) {
    return null;
  }

  const profile = { id: profileSnap.id, ...profileSnap.data() } as Profile;
  const friendshipId = [uid, friendId].sort().join("_");
  const friendshipSnap = await getDoc(doc(database, "friendships", friendshipId));
  const isAcceptedFriend = friendshipSnap.exists() && friendshipSnap.data().status === "accepted";
  const isPublic = profile.showInCommunity === true;

  if (!isAcceptedFriend && !isPublic) {
    throw new Error("Only public pool members or accepted friends can be checked.");
  }

  const statusSnap = await getDoc(doc(database, "statuses", friendId));

  if (!statusSnap.exists()) {
    return null;
  }

  return {
    profile,
    status: statusSnap.data() as SleepStatus,
    friendship: friendshipSnap.exists()
      ? ({ id: friendshipSnap.id, ...friendshipSnap.data() } as Friendship)
      : undefined
  };
}

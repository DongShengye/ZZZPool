"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { Check, LogOut, Moon, Plus, Search, Sun, UserPlus, Waves } from "lucide-react";
import {
  addFriendByUsername,
  createProfile,
  explainFirebaseError,
  getFirebaseAuth,
  getMissingFirebaseEnvVars,
  hasFirebaseConfig,
  lookupFriendStatusByUsername,
  loadCommunityPool,
  setCommunityVisibility,
  setSleeping,
  signInAsGuest,
  signInWithGoogle,
  updateProfileBasics,
  updateFriendship,
  watchFriendships,
  watchCommunityProfiles,
  watchProfile,
  watchStatus,
  type Friendship,
  type PoolFriend,
  type Profile,
  type SleepStatus
} from "@/lib/firebase";
import { approximateTimeAgo, isStale } from "@/lib/time";

const avatars = Array.from({ length: 30 }, (_, index) => {
  const number = index + 1;
  return {
    id: `avatar-${String(number).padStart(2, "0")}`,
    label: `float ${number}`
  };
});

const legacyAvatarMap: Record<string, string> = {
  otter: "avatar-01",
  duck: "avatar-02",
  star: "avatar-03",
  jelly: "avatar-04",
  moon: "avatar-05",
  sprout: "avatar-06"
};

const poolThemes = ["lagoon", "sakura", "moon", "melon", "candy"] as const;
type PoolTheme = (typeof poolThemes)[number];

function avatarImagePath(avatar: string) {
  const avatarId = legacyAvatarMap[avatar] || avatar || avatars[0].id;
  return `avatars/${avatarId}.png`;
}

function randomPoolTheme(): PoolTheme {
  return poolThemes[Math.floor(Math.random() * poolThemes.length)];
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<SleepStatus | null>(null);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [communityProfiles, setCommunityProfiles] = useState<Profile[]>([]);
  const [communityMembers, setCommunityMembers] = useState<PoolFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState<"google" | "guest" | null>(null);
  const [message, setMessage] = useState("");
  const [poolTheme, setPoolTheme] = useState<PoolTheme>("lagoon");
  const missingFirebaseEnv = getMissingFirebaseEnvVars();
  const firebaseReady = hasFirebaseConfig();

  useEffect(() => {
    try {
      return onAuthStateChanged(getFirebaseAuth(), (nextUser) => {
        setUser(nextUser);
        if (nextUser) {
          setPoolTheme(randomPoolTheme());
        }
        setMessage("");
        setLoading(false);
      });
    } catch (error) {
      setMessage(explainFirebaseError(error));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setStatus(null);
      setFriendships([]);
      setCommunityProfiles([]);
      setCommunityMembers([]);
      return;
    }

    const unwatchProfile = watchProfile(user.uid, setProfile);
    const unwatchStatus = watchStatus(user.uid, setStatus);
    const unwatchFriendships = watchFriendships(user.uid, setFriendships);
    const unwatchCommunity = watchCommunityProfiles(setCommunityProfiles);

    return () => {
      unwatchProfile();
      unwatchStatus();
      unwatchFriendships();
      unwatchCommunity();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    loadCommunityPool(user.uid, communityProfiles)
      .then(setCommunityMembers)
      .catch((error) => setMessage(error.message));
  }, [communityProfiles, user]);

  const pendingRequests = useMemo(
    () =>
      friendships.filter(
        (friendship) => friendship.status === "pending" && friendship.addresseeId === user?.uid
      ),
    [friendships, user]
  );

  if (loading) {
    return <Shell>Filling the pool...</Shell>;
  }

  if (!user) {
    return (
      <Shell>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">ZzzPool</p>
            <h1>Asleep, not ignoring you.</h1>
            <p>
              A tiny friends-only pool where your avatar floats awake, snoozes on a floatie, or
              quietly says you are unavailable without turning life into a tracking app.
            </p>
            <div className="hero-actions">
              <button
                className="primary-button"
                disabled={authBusy !== null}
                onClick={async () => {
                  setAuthBusy("google");
                  setMessage(firebaseReady ? "Opening Google sign-in..." : "");
                  try {
                    await signInWithGoogle();
                  } catch (error) {
                    setMessage(explainFirebaseError(error));
                  } finally {
                    setAuthBusy(null);
                  }
                }}
              >
                <Waves size={18} />
                {authBusy === "google" ? "Opening Google..." : "Continue with Google"}
              </button>
              <button
                className="ghost-button"
                disabled={authBusy !== null}
                onClick={async () => {
                  setAuthBusy("guest");
                  setMessage(firebaseReady ? "Starting guest mode..." : "");
                  try {
                    await signInAsGuest();
                  } catch (error) {
                    setMessage(explainFirebaseError(error));
                  } finally {
                    setAuthBusy(null);
                  }
                }}
              >
                {authBusy === "guest" ? "Starting..." : "Try as guest"}
              </button>
            </div>
            {!firebaseReady && (
              <div className="setup-warning">
                <strong>Firebase is not connected yet.</strong>
                <span>
                  Add these to <code>.env.local</code>, then restart the dev server:
                </span>
                <code>{missingFirebaseEnv.join(", ")}</code>
              </div>
            )}
            {message && <p className="message error">{message}</p>}
          </div>
          <PoolPreview />
        </section>
      </Shell>
    );
  }

  if (!profile) {
    return (
      <Shell>
        <ProfileSetup uid={user.uid} emailName={user.displayName || user.email || ""} />
      </Shell>
    );
  }

  return (
    <Shell>
      <main className="app-grid">
        <section className="control-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">My Float</p>
              <h1>{profile.displayName}</h1>
              <p className="subtle">@{profile.username}</p>
            </div>
            <button className="icon-button" title="Sign out" onClick={() => signOut(getFirebaseAuth())}>
              <LogOut size={18} />
            </button>
          </div>

          <SelfAvatar profile={profile} status={status} />

          <ProfileEditor
            profile={profile}
            onSave={async (displayName, avatarStyle) => {
              await updateProfileBasics(user.uid, displayName, avatarStyle);
              setMessage("Profile updated.");
            }}
          />

          <div className="toggle-row">
            <button
              className={!status?.isSleeping ? "state-button awake active" : "state-button awake"}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await setSleeping(user.uid, false);
                setBusy(false);
              }}
            >
              <Sun size={18} />
              I'm awake
            </button>
            <button
              className={status?.isSleeping ? "state-button sleeping active" : "state-button sleeping"}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await setSleeping(user.uid, true);
                setBusy(false);
              }}
            >
              <Moon size={18} />
              I'm sleeping
            </button>
          </div>

          <FriendAdder
            onAdd={async (username) => {
              await addFriendByUsername(user.uid, username);
              setMessage("Friend request sent.");
            }}
          />

          <PrivacyToggle
            visible={profile.showInCommunity !== false && !profile.hiddenFromPool}
            onChange={async (visible) => {
              await setCommunityVisibility(user.uid, visible);
              setMessage(visible ? "You are in the community pool." : "You are hidden from the community pool.");
            }}
          />

          <FriendStatusLookup
            onLookup={(username) => lookupFriendStatusByUsername(user.uid, username)}
          />

          {pendingRequests.length > 0 && (
            <div className="requests">
              <h2>Requests</h2>
              {pendingRequests.map((request) => (
                <button
                  className="request-button"
                  key={request.id}
                  onClick={() => updateFriendship(request.id, "accepted")}
                >
                  <Check size={16} />
                  Accept pool invite
                </button>
              ))}
            </div>
          )}

          {message && <p className="message">{message}</p>}
        </section>

        <section
          className={`pool-stage pool-theme-${poolTheme}`}
          aria-label="Community pool"
          style={{ "--pool-art": 'url("backgrounds/digital-pool.png")' } as React.CSSProperties}
        >
          <div className="pool-topline">
            <div>
              <p className="eyebrow">Community Pool</p>
              <h2>
                {communityMembers.length
                  ? `${communityMembers.length + 1} floaties nearby`
                  : "Just you for now"}
              </h2>
            </div>
          </div>

          <div className="water">
            <PoolCharacter profile={profile} status={status} self />
            {communityMembers.map((member, index) => (
              <PoolCharacter
                key={member.profile.id}
                profile={member.profile}
                status={member.status}
                offset={index}
              />
            ))}
          </div>

          <div className="friend-list">
            {[{ profile, status: status || undefined }, ...communityMembers.slice(0, 8)].map((friend) => (
              <FriendCard
                key={friend.profile.id}
                profile={friend.profile}
                status={friend.status}
                self={friend.profile.id === user.uid}
              />
            ))}
          </div>
        </section>
      </main>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="page-shell">{children}</div>;
}

function ProfileSetup({ uid, emailName }: { uid: string; emailName: string }) {
  const suggestedName = emailName.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16);
  const [username, setUsername] = useState(suggestedName.toLowerCase());
  const [displayName, setDisplayName] = useState(emailName.split("@")[0] || "Sleepy Friend");
  const [avatarStyle, setAvatarStyle] = useState(avatars[0].id);
  const [error, setError] = useState("");

  return (
    <main className="setup-card">
      <p className="eyebrow">Create Profile</p>
      <h1>Pick your pool float.</h1>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          try {
            await createProfile(uid, username, displayName, avatarStyle);
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Profile setup failed.");
          }
        }}
      >
        <label>
          Username
          <input
            value={username}
            pattern="[a-z0-9_]{3,20}"
            onChange={(event) => setUsername(event.target.value.toLowerCase())}
            placeholder="sleepybean"
            required
          />
        </label>
        <label>
          Display name
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Sleepy Bean"
            required
          />
        </label>
        <div className="avatar-picker">
          {avatars.map((avatar) => (
            <button
              className={avatarStyle === avatar.id ? "avatar-choice selected" : "avatar-choice"}
              key={avatar.id}
              type="button"
              onClick={() => setAvatarStyle(avatar.id)}
            >
              <AvatarFace avatar={avatar.id} />
              <span>{avatar.label}</span>
            </button>
          ))}
        </div>
        <button className="primary-button" type="submit">
          <Plus size={18} />
          Enter the pool
        </button>
        {error && <p className="message error">{error}</p>}
      </form>
    </main>
  );
}

function FriendAdder({ onAdd }: { onAdd: (username: string) => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="friend-adder"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onAdd(username);
          setUsername("");
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Could not send invite.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Add by username
        <div className="input-action">
          <Search size={17} />
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="friend_username"
          />
          <button className="icon-button" disabled={busy} title="Send friend request">
            <UserPlus size={18} />
          </button>
        </div>
      </label>
      {error && <p className="message error">{error}</p>}
    </form>
  );
}

function PrivacyToggle({
  visible,
  onChange
}: {
  visible: boolean;
  onChange: (visible: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <section className="privacy-panel">
      <label className="switch-row">
        <input
          checked={visible}
          disabled={busy}
          type="checkbox"
          onChange={async (event) => {
            setBusy(true);
            setError("");
            try {
              await onChange(event.target.checked);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Could not update privacy.");
            } finally {
              setBusy(false);
            }
          }}
        />
        <span>
          <strong>Show me in the community pool</strong>
          <small>Anyone signed in can see your public pool status. Friends can still add/search you.</small>
        </span>
      </label>
      {error && <p className="message error">{error}</p>}
    </section>
  );
}

function FriendStatusLookup({
  onLookup
}: {
  onLookup: (username: string) => Promise<PoolFriend | null>;
}) {
  const [username, setUsername] = useState("");
  const [result, setResult] = useState<PoolFriend | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="friend-lookup"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        setResult(null);
        try {
          const friend = await onLookup(username);
          setResult(friend);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Could not check that status.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Check friend by username
        <div className="input-action">
          <Search size={17} />
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value.toLowerCase())}
            placeholder="hidden_friend"
          />
          <button className="icon-button" disabled={busy} title="Check status">
            <Search size={18} />
          </button>
        </div>
      </label>
      {result && <FriendCard profile={result.profile} status={result.status} />}
      {error && <p className="message error">{error}</p>}
    </form>
  );
}

function SelfAvatar({ profile, status }: { profile: Profile; status: SleepStatus | null }) {
  const sleeping = Boolean(status?.isSleeping);

  return (
    <div className="self-avatar">
      <div className={sleeping ? "mini-float sleeping" : "mini-float awake"}>
        <AvatarFace avatar={profile.avatarStyle} />
        <span>{sleeping ? "ZZZ" : "hi"}</span>
      </div>
      <div>
        <p>{sleeping ? "You are tucked in." : "You are awake and available-ish."}</p>
        <span>Updated {approximateTimeAgo(status?.updatedAt)}</span>
      </div>
    </div>
  );
}

function ProfileEditor({
  profile,
  onSave
}: {
  profile: Profile;
  onSave: (displayName: string, avatarStyle: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatarStyle, setAvatarStyle] = useState(profile.avatarStyle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDisplayName(profile.displayName);
    setAvatarStyle(profile.avatarStyle);
  }, [profile.avatarStyle, profile.displayName]);

  return (
    <section className="profile-editor">
      <button className="ghost-button edit-profile-button" type="button" onClick={() => setOpen(!open)}>
        {open ? "Close profile editor" : "Change name or picture"}
      </button>
      {open && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              await onSave(displayName, avatarStyle);
              setOpen(false);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Could not update profile.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Display name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Sleepy Friend"
              required
            />
          </label>
          <div className="avatar-picker compact">
            {avatars.map((avatar) => (
              <button
                className={avatarStyle === avatar.id ? "avatar-choice selected" : "avatar-choice"}
                key={avatar.id}
                type="button"
                onClick={() => setAvatarStyle(avatar.id)}
              >
                <AvatarFace avatar={avatar.id} />
              </button>
            ))}
          </div>
          <button className="primary-button" disabled={busy} type="submit">
            Save profile
          </button>
          {error && <p className="message error">{error}</p>}
        </form>
      )}
    </section>
  );
}

function PoolCharacter({
  profile,
  status,
  self = false,
  offset = 0
}: {
  profile: Profile;
  status: SleepStatus | null | undefined;
  self?: boolean;
  offset?: number;
}) {
  const sleeping = Boolean(status?.isSleeping);
  const stale = isStale(status?.updatedAt);

  return (
    <div
      className={[
        "pool-character",
        sleeping ? "is-sleeping" : "is-awake",
        stale ? "is-stale" : "",
        self ? "is-self" : ""
      ].join(" ")}
      style={{ "--float-offset": `${offset * 31}px` } as React.CSSProperties}
    >
      <div className="floatie">
        <AvatarFace avatar={profile.avatarStyle} />
        {sleeping ? <span className="zzz">ZZZ</span> : <span className="wave">hi</span>}
      </div>
      <strong>{self ? "You" : profile.displayName}</strong>
    </div>
  );
}

function FriendCard({
  profile,
  status,
  self = false
}: {
  profile: Profile;
  status?: SleepStatus | null;
  self?: boolean;
}) {
  const sleeping = Boolean(status?.isSleeping);

  return (
    <article className={sleeping ? "friend-card sleeping" : "friend-card awake"}>
      <div className="mini-avatar">
        <AvatarFace avatar={profile.avatarStyle} />
      </div>
      <div>
        <h3>{self ? `${profile.displayName} (you)` : profile.displayName}</h3>
        <p>{sleeping ? "Sleeping" : "Awake"}</p>
      </div>
      <span>{approximateTimeAgo(status?.updatedAt)}</span>
    </article>
  );
}

function AvatarFace({ avatar }: { avatar: string }) {
  return (
    <span className={`avatar-face ${avatar}`} aria-hidden="true">
      <img src={avatarImagePath(avatar)} alt="" />
    </span>
  );
}

function PoolPreview() {
  const demoProfiles = [
    { id: "1", username: "mika", displayName: "Mika", avatarStyle: "avatar-07" },
    { id: "2", username: "jun", displayName: "Jun", avatarStyle: "avatar-14" },
    { id: "3", username: "bea", displayName: "Bea", avatarStyle: "avatar-23" }
  ];

  return (
    <div className="preview-pool">
      {demoProfiles.map((profile, index) => (
        <PoolCharacter
          key={profile.id}
          profile={profile}
          status={{ userId: profile.id, isSleeping: index === 1 }}
          offset={index}
        />
      ))}
    </div>
  );
}

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebaseConfig';
import {
  DEFAULT_ALLOWED_PATHS,
  matchPathPattern,
  normalizePath,
} from './lib/pageAccessConfig';

const MEMBER_REQUIRED_PATHS = ['/portfolio', '/watchlist'];

const AuthContext = createContext(null);

function buildInitialProfile(user) {
  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    role: 'guest',
    allowedPaths: [...DEFAULT_ALLOWED_PATHS],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };
}

function ensureMemberPathsForRole(paths = [], role = 'guest') {
  const normalizedPaths = Array.isArray(paths) ? [...paths] : [];

  const matchesMemberPath = (candidate, target) =>
    matchPathPattern(candidate, target) || matchPathPattern(target, candidate);

  if (role === 'member' || role === 'admin') {
    const nextPaths = [...normalizedPaths];
    MEMBER_REQUIRED_PATHS.forEach((memberPath) => {
      const hasMemberPath = nextPaths.some((path) =>
        matchesMemberPath(path, memberPath)
      );
      if (!hasMemberPath) {
        nextPaths.push(memberPath);
      }
    });
    return Array.from(new Set(nextPaths));
  }

  const filtered = normalizedPaths.filter(
    (path) =>
      !MEMBER_REQUIRED_PATHS.some((memberPath) =>
        matchesMemberPath(path, memberPath)
      )
  );

  return Array.from(new Set(filtered));
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) {
      setProfile(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError('');
    const userRef = doc(collection(db, 'users'), firebaseUser.uid);
    let unsubscribeProfile = () => {};

    const prepareUserDocument = async () => {
      try {
        const snapshot = await getDoc(userRef);
        if (!snapshot.exists()) {
          await setDoc(userRef, buildInitialProfile(firebaseUser));
        } else {
          await updateDoc(userRef, {
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || '',
            lastLoginAt: serverTimestamp(),
          });
        }

        unsubscribeProfile = onSnapshot(
          userRef,
          (docSnap) => {
            const data = docSnap.data();
            if (data) {
              const normalizedPaths = Array.isArray(data.allowedPaths)
                ? data.allowedPaths
                : DEFAULT_ALLOWED_PATHS;
              const withMemberPaths = ensureMemberPathsForRole(
                normalizedPaths,
                data.role || 'guest'
              );

              setProfile({
                ...data,
                uid: docSnap.id,
                allowedPaths: withMemberPaths,
              });
            } else {
              setProfile(null);
            }
            setLoading(false);
          },
          (subscribeError) => {
            console.error('사용자 정보 실시간 구독 실패', subscribeError);
            setError('회원 정보를 불러올 수 없습니다. 새로고침 해주세요.');
            setProfile(null);
            setLoading(false);
          }
        );
      } catch (docError) {
        console.error('사용자 정보 준비 실패', docError);
        setError('로그인 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
        setProfile(null);
        setLoading(false);
      }
    };

    prepareUserDocument();

    return () => {
      unsubscribeProfile();
    };
  }, [firebaseUser]);

  const signIn = async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (signInError) {
      console.error('Google 로그인 실패', signInError);
      setError('Google 로그인에 실패했습니다. 새로고침 후 다시 시도해주세요.');
      throw signInError;
    }
  };

  const logout = async () => {
    setError('');
    try {
      await firebaseSignOut(auth);
    } catch (signOutError) {
      console.error('로그아웃 실패', signOutError);
      setError('로그아웃 중 문제가 발생했습니다. 다시 시도해주세요.');
      throw signOutError;
    }
  };

  const hasRole = useMemo(() => {
    return (role) => {
      if (!profile?.role) return false;
      if (profile.role === 'admin') return true;
      return profile.role === role;
    };
  }, [profile]);

  const hasAccess = useMemo(() => {
    return (path) => {
      const normalizedTarget = normalizePath(path);

      if (!profile) {
        return false;
      }

      if (profile.role === 'admin') {
        return true;
      }

      if (normalizedTarget.startsWith('/admin')) {
        return false;
      }

      const allowedPaths = Array.isArray(profile.allowedPaths)
        ? profile.allowedPaths
        : DEFAULT_ALLOWED_PATHS;

      if (
        normalizedTarget === '/portfolio' &&
        (profile.role === 'member' || profile.role === 'admin')
      ) {
        return true;
      }

      return allowedPaths.some((pattern) => matchPathPattern(pattern, normalizedTarget));
    };
  }, [profile]);

  const value = useMemo(
    () => ({
      user: firebaseUser,
      profile,
      loading,
      error,
      signIn,
      logout,
      hasRole,
      hasAccess,
    }),
    [firebaseUser, profile, loading, error, hasRole, hasAccess]
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export default function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth 훅은 AuthProvider 내부에서만 사용할 수 있습니다.');
  }
  return context;
}

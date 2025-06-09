// src/firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Firebase 콘솔에서 복사한 firebaseConfig 객체를 여기에 붙여넣습니다.
const firebaseConfig = {
apiKey: "AIzaSyBFkKARCzMVcVuaHMgB23HdIF-zoHPt_9E",
authDomain: "stocksrlab-re.firebaseapp.com",
projectId: "stocksrlab-re",
storageBucket: "stocksrlab-re.firebasestorage.app",
messagingSenderId: "812353657196",
appId: "1:812353657196:web:bfec508fefbe14086a7b49",
measurementId: "G-1539BD821P"
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// Firestore 인스턴스 가져오기
const db = getFirestore(app);

// Storage 인스턴스 가져오기
const storage = getStorage(app);

// Auth 및 Google 로그인 제공자
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { db, storage, auth, googleProvider }; // 다른 파일에서 사용할 수 있도록 내보내기

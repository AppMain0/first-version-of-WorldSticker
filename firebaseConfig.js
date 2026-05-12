import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyAXh3eaP2GVaVytP2k4_rJlFRlztvjl2FI",
  authDomain: "worldsticker-49f5e.firebaseapp.com",
  projectId: "worldsticker-49f5e",
  storageBucket: "worldsticker-49f5e.firebasestorage.app",
  messagingSenderId: "770905460454",
  appId: "1:770905460454:web:e0da5fda08fd1c72823527",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
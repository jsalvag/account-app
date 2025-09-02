import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: mover a variables de entorno cuando deployees
export const firebaseConfig = {
  apiKey: "AIzaSyC6sphev5P21O76NcBUhQReBPsH_lbhpdc",
  authDomain: "accountant-app-525.firebaseapp.com",
  projectId: "accountant-app-525",
  storageBucket: "accountant-app-525.firebasestorage.app",
  messagingSenderId: "779711295306",
  appId: "1:779711295306:web:2cd9dba7bd33204a479bb3",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

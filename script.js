import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup,
    onAuthStateChanged, 
    signOut,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCq7skNHlN6mF45b-TjqNyJJ-OBwGu5YBs",
  authDomain: "animetracker-171ba.firebaseapp.com",
  projectId: "animetracker-171ba",
  storageBucket: "animetracker-171ba.firebasestorage.app",
  messagingSenderId: "1083378734621",
  appId: "1:1083378734621:web:531e2c1cab0c4ed1e918f4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Adatok tárolása
let currentUser = null;
let userData = { toWatch: [], watched: [], archive: [] };
let currentTab = 'toWatch';

// --- AUTH LOGIKA ---

// Kényszerítsük a böngészőt, hogy emlékezzen ránk frissítés után is
setPersistence(auth, browserLocalPersistence)
  .catch((error) => console.error("Persistence error:", error));

onAuthStateChanged(auth, user => {
    console.log("Auth állapot változott:", user ? "Belépve: " + user.displayName : "Nincs belépve");
    if (user) {
        currentUser = user;
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        document.getElementById('username-text').innerText = user.displayName;
        loadUserData();
    } else {
        currentUser = null;
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('app-container').style.display = 'none';
    }
});

document.getElementById('login-btn').onclick = async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        console.log("Sikeres login:", result.user);
    } catch (error) {
        console.error("Login hiba kódja:", error.code);
        // Ez megmondja, mi a konkrét hiba!
        if (error.code === 'auth/unauthorized-domain') {
            alert("HIBA: Ez a weboldal nincs engedélyezve a Firebase-ben! (Authorized Domains)");
        } else if (error.code === 'auth/popup-blocked') {
            alert("HIBA: A böngésző blokkolta a felugró ablakot!");
        } else {
            alert("Hiba történt: " + error.message);
        }
    }
};

document.getElementById('logout-btn').onclick = () => signOut(auth);

// --- TÖBBI FÜGGVÉNY (Változatlanul hagytam őket a logikád szerint) ---

async function loadUserData() {
    const docRef = doc(db, "users", currentUser.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        userData = docSnap.data();
        if (!userData.archive) userData.archive = []; 
    }
    render();
}

async function sync() {
    if (currentUser) {
        await setDoc(doc(db, "users", currentUser.uid), userData);
        render();
    }
}

// Global scope-ba rakjuk a render-t és a tab váltót, hogy az HTML-ből elérhető legyen
window.switchTab = (t) => {
    currentTab = t;
    document.getElementById('tabToWatch').classList.toggle('active', t === 'toWatch');
    document.getElementById('tabWatched').classList.toggle('active', t === 'watched');
    document.getElementById('tabArchive').classList.toggle('active', t === 'archive');
    render();
};

window.render = () => {
    const container = document.getElementById('listContainer');
    if (!container) return;
    container.innerHTML = '';
    
    let list = currentTab === 'toWatch' ? userData.toWatch : (currentTab === 'watched' ? userData.watched : userData.archive);
    
    document.getElementById('countTW').innerText = userData.toWatch.length;
    document.getElementById('countW').innerText = userData.watched.length;
    document.getElementById('countA').innerText = userData.archive ? userData.archive.length : 0;

    list.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'list-item';
        const name = currentTab === 'toWatch' ? item : item.name;
        div.innerHTML = `<strong>${name}</strong>`;
        container.appendChild(div);
    });
};

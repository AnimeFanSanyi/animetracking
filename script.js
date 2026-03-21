import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

let currentUser = null;
let userData = { toWatch: [], watched: [] };
let currentTab = 'toWatch';
let lastPickedIndex = -1;

// --- AUTH ---
document.getElementById('login-btn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logout-btn').onclick = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        document.getElementById('username-text').innerText = user.displayName;
        await loadUserData();
    } else {
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('app-container').style.display = 'none';
    }
});

async function loadUserData() {
    const docRef = doc(db, "users", currentUser.uid);
    const docSnap = await getDoc(docRef);
    userData = docSnap.exists() ? docSnap.data() : { toWatch: [], watched: [] };
    render();
}

async function sync() {
    if (currentUser) await setDoc(doc(db, "users", currentUser.uid), userData);
    render();
}

// --- SMART IMPORT (Fixes the 263 vs 261 issue) ---
window.importFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const lines = e.target.result.split(/\r?\n/);
        let addedCount = 0;
        lines.forEach(line => {
            const name = line.trim();
            if (!name) return;
            
            // Check both lists case-insensitively
            const exists = userData.toWatch.some(i => i.toLowerCase() === name.toLowerCase()) || 
                           userData.watched.some(i => i.name.toLowerCase() === name.toLowerCase());
            
            if (!exists) {
                userData.toWatch.push(name);
                addedCount++;
            }
        });
        sync();
        alert(`Imported ${addedCount} new unique titles!`);
    };
    reader.readAsText(file);
};

// --- WIPE FUNCTION (With 3 Alerts) ---
window.clearCurrentList = () => {
    const listName = currentTab === 'toWatch' ? 'To Watch' : 'Watched';
    if (!confirm(`WARNING 1: Delete everything in ${listName}?`)) return;
    if (!confirm(`WARNING 2: This wipes ${listName === 'To Watch' ? userData.toWatch.length : userData.watched.length} items. Sure?`)) return;
    if (!confirm(`FINAL WARNING: This cannot be undone. Nuke it?`)) return;

    if (currentTab === 'toWatch') userData.toWatch = [];
    else userData.watched = [];
    sync();
};

window.addAnime = () => {
    const input = document.getElementById('searchInput');
    const val = input.value.trim();
    if (!val) return;
    const isDup = userData.toWatch.some(i => i.toLowerCase() === val.toLowerCase()) || 
                  userData.watched.some(i => i.name.toLowerCase() === val.toLowerCase());
    if (isDup) return alert("Already in list!");
    userData.toWatch.push(val);
    input.value = '';
    sync();
};

window.switchTab = (t) => {
    currentTab = t;
    document.getElementById('tabToWatch').classList.toggle('active', t === 'toWatch');
    document.getElementById('tabWatched').classList.toggle('active', t === 'watched');
    render();
};

window.handleSearch = () => render();

window.pickRandom = () => {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const pool = userData.toWatch.filter(i => i.toLowerCase().includes(search));
    if (pool.length === 0) return alert("No anime to pick!");
    const choice = pool[Math.floor(Math.random() * pool.length)];
    lastPickedIndex = userData.toWatch.indexOf(choice);
    document.getElementById('random-result').innerText = choice;
    document.getElementById('overlay').style.display = 'flex';
};

window.moveToWatchedFromRandom = () => {
    if (lastPickedIndex > -1) {
        const name = userData.toWatch.splice(lastPickedIndex, 1)[0];
        userData.watched.unshift({ name, time: new Date().toLocaleString() });
        document.getElementById('overlay').style.display = 'none';
        sync();
    }
};

window.closeOverlay = () => document.getElementById('overlay').style.display = 'none';

window.deleteItem = (index) => {
    if (!confirm("Delete this?")) return;
    if (currentTab === 'toWatch') userData.toWatch.splice(index, 1);
    else userData.watched.splice(index, 1);
    sync();
};

window.render = () => {
    const container = document.getElementById('listContainer');
    const search = document.getElementById('searchInput').value.toLowerCase();
    container.innerHTML = '';
    const list = currentTab === 'toWatch' ? userData.toWatch : userData.watched;
    document.getElementById('countTW').innerText = userData.toWatch.length;
    document.getElementById('countW').innerText = userData.watched.length;

    list.forEach((item, index) => {
        const name = currentTab === 'toWatch' ? item : item.name;
        if (name.toLowerCase().includes(search)) {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `<div><strong>${name}</strong>${currentTab === 'watched' ? `<br><small>${item.time}</small>` : ''}</div>
                             <button onclick="deleteItem(${index})" style="width:auto; background:#f43f5e; padding:5px 10px;">X</button>`;
            container.appendChild(div);
        }
    });
};

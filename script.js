// 1. Import the Firebase SDKs from the CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. YOUR FIREBASE CONFIG (Paste your actual keys here!)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// App State
let currentUser = null;
let userData = { toWatch: [], watched: [] };
let currentTab = 'toWatch';
let lastPickedIndex = -1;

// --- AUTHENTICATION LOGIC ---

// Login Function
document.getElementById('login-btn').onclick = () => {
    signInWithPopup(auth, provider).catch(error => alert("Login failed: " + error.message));
};

// Logout Function
document.getElementById('logout-btn').onclick = () => {
    signOut(auth).then(() => location.reload());
};

// Monitor Auth State
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

// --- DATABASE SYNC ---

async function loadUserData() {
    const docRef = doc(db, "users", currentUser.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        userData = docSnap.data();
    } else {
        userData = { toWatch: [], watched: [] };
    }
    render();
}

async function sync() {
    if (!currentUser) return;
    await setDoc(doc(db, "users", currentUser.uid), userData);
    render();
}

// --- CORE APP FUNCTIONS ---

window.switchTab = (t) => {
    currentTab = t;
    document.getElementById('tabToWatch').classList.toggle('active', t === 'toWatch');
    document.getElementById('tabWatched').classList.toggle('active', t === 'watched');
    render();
};

window.handleSearch = () => render();

window.addAnime = () => {
    const input = document.getElementById('searchInput');
    const val = input.value.trim();
    if (!val) return;

    const isDup = userData.toWatch.some(i => i.toLowerCase() === val.toLowerCase()) || 
                  userData.watched.some(i => i.name.toLowerCase() === val.toLowerCase());
    
    if (isDup) return alert("Already in your list!");

    userData.toWatch.push(val);
    input.value = '';
    sync();
};

window.importFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const lines = e.target.result.split(/\r?\n/);
        lines.forEach(line => {
            const name = line.trim();
            if (name && !userData.toWatch.includes(name)) userData.toWatch.push(name);
        });
        sync();
        alert("Import Complete!");
    };
    reader.readAsText(file);
};

// --- RANDOMIZER LOGIC ---

window.pickRandom = () => {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const pool = userData.toWatch.filter(i => i.toLowerCase().includes(search));
    
    if (pool.length === 0) return alert("No anime to pick from!");
    
    const choice = pool[Math.floor(Math.random() * pool.length)];
    lastPickedIndex = userData.toWatch.indexOf(choice);
    
    document.getElementById('random-result').innerText = choice;
    document.getElementById('overlay').style.display = 'flex';
};

window.moveToWatchedFromRandom = () => {
    if (lastPickedIndex > -1) {
        const name = userData.toWatch.splice(lastPickedIndex, 1)[0];
        userData.watched.unshift({ name, time: new Date().toLocaleString() });
        window.closeOverlay();
        sync();
    }
};

window.closeOverlay = () => {
    document.getElementById('overlay').style.display = 'none';
};

window.deleteItem = (index) => {
    if (!confirm("Delete this entry?")) return;
    if (currentTab === 'toWatch') userData.toWatch.splice(index, 1);
    else userData.watched.splice(index, 1);
    sync();
};

// --- UI RENDERER ---

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
            div.innerHTML = `
                <div class="item-info">
                    <strong>${name}</strong>
                    ${currentTab === 'watched' ? `<span class="timestamp">Watched: ${item.time}</span>` : ''}
                </div>
                <button class="delete-btn" onclick="deleteItem(${index})" style="width:auto; background: #f43f5e; padding: 5px 10px; font-size: 11px;">Delete</button>
            `;
            container.appendChild(div);
        }
    });
};

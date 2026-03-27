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
let selectedItemIndex = -1; // Az opciók menühöz

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

// --- IMPORT ---
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
            const exists = userData.toWatch.some(i => i.toLowerCase() === name.toLowerCase()) || 
                           userData.watched.some(i => i.name.toLowerCase() === name.toLowerCase());
            if (!exists) {
                if (currentTab === 'toWatch') {
                    userData.toWatch.unshift(name);
                } else {
                    userData.watched.unshift({ name: name, time: new Date().toLocaleString() });
                }
                addedCount++;
            }
        });
        sync();
        alert(`Sikeresen importálva ${addedCount} új anime a(z) ${currentTab === 'toWatch' ? 'To Watch' : 'Watched'} listába!`);
        event.target.value = ''; // Input reset
    };
    reader.readAsText(file);
};

// --- EXPORT ---
window.exportFile = () => {
    const listToExport = currentTab === 'toWatch' ? userData.toWatch : userData.watched.map(a => a.name);
    
    if (listToExport.length === 0) return alert("A jelenlegi lista üres!");
    
    const content = listToExport.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const listName = currentTab === 'toWatch' ? 'ToWatch' : 'Watched';
    a.download = `Anime_Tracker_${listName}_${new Date().toLocaleDateString()}.txt`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// --- WIPE ---
window.clearCurrentList = () => {
    const listName = currentTab === 'toWatch' ? 'To Watch' : 'Watched';
    if (!confirm(`FIGYELEM: Biztosan törölsz mindent a(z) ${listName} listából?`)) return;
    if (!confirm(`VÉGSŐ FIGYELMEZTETÉS: Ezt nem lehet visszavonni. Biztos?`)) return;
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
    if (isDup) return alert("Ez már szerepel valamelyik listádban!");
    
    if (currentTab === 'toWatch') {
        userData.toWatch.unshift(val);
    } else {
        userData.watched.unshift({ name: val, time: new Date().toLocaleString() });
    }
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

// --- RANDOM PICKER ---
window.pickRandom = () => {
    const pool = userData.toWatch; // Szigorúan csak a To Watch-ból sorsol
    if (pool.length === 0) return alert("Nincs miből sorsolni a To Watch listában!");
    
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

// --- ITEM OPTIONS (3 PONTOS MENÜ) ---
window.openOptions = (index, name) => {
    selectedItemIndex = index;
    document.getElementById('options-title').innerText = name;
    
    const moveBtn = document.getElementById('move-btn');
    if (currentTab === 'toWatch') {
        moveBtn.innerHTML = '➡️ Áthelyezés ide: Watched';
    } else {
        moveBtn.innerHTML = '⬅️ Vissza ide: To Watch';
    }
    
    document.getElementById('options-modal').style.display = 'flex';
};

window.closeOptions = () => {
    document.getElementById('options-modal').style.display = 'none';
    selectedItemIndex = -1;
};

window.editItemPrompt = () => {
    if (selectedItemIndex === -1) return;
    const oldName = currentTab === 'toWatch' ? userData.toWatch[selectedItemIndex] : userData.watched[selectedItemIndex].name;
    const newName = prompt("Mire szeretnéd átírni?", oldName);
    
    if (newName && newName.trim() !== "" && newName !== oldName) {
        if (currentTab === 'toWatch') {
            userData.toWatch[selectedItemIndex] = newName.trim();
        } else {
            userData.watched[selectedItemIndex].name = newName.trim();
        }
        sync();
    }
    closeOptions();
};

window.moveListItem = () => {
    if (selectedItemIndex === -1) return;
    
    if (currentTab === 'toWatch') {
        const name = userData.toWatch.splice(selectedItemIndex, 1)[0];
        userData.watched.unshift({ name, time: new Date().toLocaleString() });
    } else {
        const name = userData.watched.splice(selectedItemIndex, 1)[0].name;
        userData.toWatch.unshift(name);
    }
    sync();
    closeOptions();
};

window.confirmDelete = () => {
    if (selectedItemIndex === -1) return;
    if (confirm("Biztosan törölni szeretnéd ezt az elemet?")) {
        if (currentTab === 'toWatch') {
            userData.toWatch.splice(selectedItemIndex, 1);
        } else {
            userData.watched.splice(selectedItemIndex, 1);
        }
        sync();
    }
    closeOptions();
};

// --- RENDER ---
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
            // A name.replace megoldja, ha az anime nevében aposztróf (') van, nehogy eltörje az onclick-et
            const safeName = name.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            
            div.innerHTML = `
                <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; padding-right: 10px;">
                    <strong>${name}</strong>
                    ${currentTab === 'watched' ? `<br><small style="color: #94a3b8;">${item.time}</small>` : ''}
                </div>
                <button class="btn-options" onclick="openOptions(${index}, '${safeName}')">⋮</button>
            `;
            container.appendChild(div);
        }
    });
};

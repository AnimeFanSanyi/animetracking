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
let userData = { toWatch: [], watched: [], library: [] };
let currentTab = 'toWatch';
let lastPickedIndex = -1;
let selectedItemIndex = -1; 

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
    if (docSnap.exists()) {
        userData = docSnap.data();
        if (!userData.library) userData.library = [];
    } else {
        userData = { toWatch: [], watched: [], library: [] };
    }
    render();
}

async function sync() {
    if (currentUser) await setDoc(doc(db, "users", currentUser.uid), userData);
    render();
}

// --- TAB SWITCH ---
window.switchTab = (t) => {
    currentTab = t;
    document.getElementById('tabToWatch').classList.toggle('active', t === 'toWatch');
    document.getElementById('tabWatched').classList.toggle('active', t === 'watched');
    document.getElementById('tabLibrary').classList.toggle('active', t === 'library');
    
    // UI frissítése a fültől függően
    const searchInput = document.getElementById('searchInput');
    const btnAddMain = document.getElementById('btn-add-main');
    const randomBtn = document.getElementById('btn-random-main');
    const importExport = document.getElementById('import-export-section');
    const btnClear = document.getElementById('btn-clear-main');
    
    if (t === 'library') {
        searchInput.style.display = 'none';
        randomBtn.style.display = 'none';
        importExport.style.display = 'none';
        btnClear.style.display = 'none';
        btnAddMain.innerText = '+ Új Főelem';
        btnAddMain.onclick = () => openAddNodeModal(null); 
    } else {
        searchInput.style.display = 'block';
        randomBtn.style.display = 'block';
        importExport.style.display = 'block';
        btnClear.style.display = 'block';
        btnAddMain.innerText = '+ Add';
        btnAddMain.onclick = addAnime;
    }
    
    render();
};

window.handleSearch = () => render();

// --- ALAP LISTA FUNKCIÓK (To Watch / Watched) ---
window.addAnime = () => {
    const input = document.getElementById('searchInput');
    const val = input.value.trim();
    if (!val) return;
    const isDup = userData.toWatch.some(i => i.toLowerCase() === val.toLowerCase()) || 
                  userData.watched.some(i => i.name.toLowerCase() === val.toLowerCase());
    if (isDup) return alert("Ez már szerepel valamelyik listádban!");
    
    if (currentTab === 'toWatch') userData.toWatch.unshift(val);
    else userData.watched.unshift({ name: val, time: new Date().toLocaleString() });
    
    input.value = '';
    sync();
};

window.clearCurrentList = () => {
    const listName = currentTab === 'toWatch' ? 'To Watch' : 'Watched';
    if (!confirm(`FIGYELEM: Biztosan törölsz mindent a(z) ${listName} listából?`)) return;
    if (!confirm(`VÉGSŐ FIGYELMEZTETÉS: Ezt nem lehet visszavonni. Biztos?`)) return;
    if (currentTab === 'toWatch') userData.toWatch = [];
    else userData.watched = [];
    sync();
};

window.pickRandom = () => {
    const pool = userData.toWatch;
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

// --- ITEM OPTIONS LOGIKA ---
window.openOptions = (index, name) => {
    selectedItemIndex = index;
    document.getElementById('options-title').innerText = name;
    const moveBtn = document.getElementById('move-btn');
    moveBtn.innerHTML = currentTab === 'toWatch' ? '➡️ Áthelyezés ide: Watched' : '⬅️ Vissza ide: To Watch';
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
        if (currentTab === 'toWatch') userData.toWatch[selectedItemIndex] = newName.trim();
        else userData.watched[selectedItemIndex].name = newName.trim();
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
        if (currentTab === 'toWatch') userData.toWatch.splice(selectedItemIndex, 1);
        else userData.watched.splice(selectedItemIndex, 1);
        sync();
    }
    closeOptions();
};

// --- IMPORT / EXPORT ---
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
                if (currentTab === 'toWatch') userData.toWatch.unshift(name);
                else userData.watched.unshift({ name: name, time: new Date().toLocaleString() });
                addedCount++;
            }
        });
        sync();
        alert(`Sikeresen importálva ${addedCount} új anime a(z) ${currentTab === 'toWatch' ? 'To Watch' : 'Watched'} listába!`);
        event.target.value = '';
    };
    reader.readAsText(file);
};

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

// --- LIBRARY / TREE LOGIKA ---
let targetPathForAdd = null; 

// Rekurzív kereső: megkeresi a fában az adott ID-jű elemet
function findNodeById(nodes, id) {
    for (let node of nodes) {
        if (node.id === id) return node;
        if (node.children && node.children.length > 0) {
            const found = findNodeById(node.children, id);
            if (found) return found;
        }
    }
    return null;
}

window.openAddNodeModal = (parentId) => {
    targetPathForAdd = parentId;
    const subtitle = document.getElementById('add-node-subtitle');
    
    if (parentId === null) {
        subtitle.innerText = "Ide: Gyökérkönyvtár";
    } else {
        const parentNode = findNodeById(userData.library, parentId);
        subtitle.innerText = `Ide: ${parentNode ? parentNode.name : 'Ismeretlen'}`;
    }
    
    document.getElementById('node-name-input').value = '';
    document.getElementById('add-node-modal').style.display = 'flex';
};

window.closeAddNodeModal = () => {
    document.getElementById('add-node-modal').style.display = 'none';
    targetPathForAdd = null;
};

window.confirmAddNode = () => {
    const type = document.getElementById('node-type-select').value;
    const name = document.getElementById('node-name-input').value.trim();
    
    if (!name) return alert("Kérlek adj meg egy nevet!");

    const newNode = {
        id: Date.now().toString(),
        type: type,
        name: name,
        expanded: false,
        children: []
    };

    if (targetPathForAdd === null) {
        userData.library.push(newNode);
    } else {
        const parentNode = findNodeById(userData.library, targetPathForAdd);
        if (parentNode) {
            if (!parentNode.children) parentNode.children = [];
            parentNode.children.push(newNode);
            parentNode.expanded = true; // Nyissuk is ki, ha már adtunk alá valamit
        }
    }

    sync();
    closeAddNodeModal();
};

window.toggleTreeNode = (id) => {
    const node = findNodeById(userData.library, id);
    if (node) {
        node.expanded = !node.expanded;
        sync(); // Menti az állapotot és újra renderel
    }
};

// --- RENDER ---
function renderTree(nodes) {
    let html = '';
    nodes.forEach(node => {
        const hasChildren = node.children && node.children.length > 0;
        const icon = hasChildren ? (node.expanded ? '▼' : '►') : '•';
        
        html += `
        <div class="tree-item">
            <div class="tree-header">
                <div class="tree-title-area" onclick="toggleTreeNode('${node.id}')">
                    <span class="tree-toggle">${icon}</span>
                    <span class="badge">#${node.type.toLowerCase()}</span> 
                    <strong>${node.name}</strong>
                </div>
                <button class="btn-add-child" onclick="openAddNodeModal('${node.id}')">+ Alá</button>
            </div>
            ${hasChildren ? `<div class="tree-children ${node.expanded ? 'expanded' : ''}">${renderTree(node.children)}</div>` : ''}
        </div>`;
    });
    return html;
}

window.render = () => {
    const container = document.getElementById('listContainer');
    document.getElementById('countTW').innerText = userData.toWatch.length;
    document.getElementById('countW').innerText = userData.watched.length;
    
    container.innerHTML = '';

    if (currentTab === 'library') {
        if (userData.library.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 30px;">A Library üres. Adj hozzá egy új főelemet (pl. animét vagy mangát)!</p>';
        } else {
            container.innerHTML = renderTree(userData.library);
        }
        return;
    }

    // Régi To Watch / Watched renderelés
    const search = document.getElementById('searchInput').value.toLowerCase();
    const list = currentTab === 'toWatch' ? userData.toWatch : userData.watched;

    list.forEach((item, index) => {
        const name = currentTab === 'toWatch' ? item : item.name;
        if (name.toLowerCase().includes(search)) {
            const div = document.createElement('div');
            div.className = 'list-item';
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

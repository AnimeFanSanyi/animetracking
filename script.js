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

// --- CUSTOM MODALS (Alert, Confirm, Prompt helyettesítők) ---
function uiModal(options) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-dialog-modal');
        const titleEl = document.getElementById('cd-title');
        const msgEl = document.getElementById('cd-message');
        const inputEl = document.getElementById('cd-input');
        const btnCancel = document.getElementById('cd-btn-cancel');
        const btnConfirm = document.getElementById('cd-btn-confirm');

        titleEl.innerText = options.title || "Figyelem";
        titleEl.style.color = options.danger ? 'var(--danger)' : 'var(--accent)';
        msgEl.innerText = options.message || "";
        
        inputEl.style.display = options.type === 'prompt' ? 'block' : 'none';
        inputEl.value = options.defaultValue || "";
        
        btnCancel.style.display = options.type === 'alert' ? 'none' : 'block';
        btnConfirm.style.background = options.danger ? 'var(--danger)' : 'var(--accent-dark)';
        btnConfirm.innerText = options.confirmText || "Rendben";

        modal.style.display = 'flex';

        // Cleanup and resolve
        const cleanup = (result) => {
            modal.style.display = 'none';
            btnConfirm.onclick = null;
            btnCancel.onclick = null;
            resolve(result);
        };

        btnConfirm.onclick = () => {
            if (options.type === 'prompt') cleanup(inputEl.value);
            else cleanup(true);
        };
        btnCancel.onclick = () => cleanup(false);
    });
}

const uiAlert = (msg) => uiModal({ type: 'alert', message: msg });
const uiConfirm = (msg, danger = false, confirmText) => uiModal({ type: 'confirm', message: msg, danger, confirmText });
const uiPrompt = (msg, defVal) => uiModal({ type: 'prompt', message: msg, defaultValue: defVal });

// --- AUTH ---
document.getElementById('login-btn').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(error => {
        console.error("Login hiba:", error);
        uiAlert("Hiba a bejelentkezés során. Próbáld újra!");
    });
});

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => location.reload());
});

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
    try {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            userData = {
                toWatch: data.toWatch || [],
                watched: data.watched || [],
                library: data.library || []
            };
        } else {
            userData = { toWatch: [], watched: [], library: [] };
        }
        render();
    } catch (e) {
        console.error("Hiba az adatok betöltésekor", e);
        uiAlert("Nem sikerült betölteni az adatokat.");
    }
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

// --- ALAP LISTA FUNKCIÓK ---
window.addAnime = async () => {
    const input = document.getElementById('searchInput');
    const val = input.value.trim();
    if (!val) return;
    
    const isDup = userData.toWatch.some(i => i.toLowerCase() === val.toLowerCase()) || 
                  userData.watched.some(i => i.name.toLowerCase() === val.toLowerCase());
    if (isDup) return await uiAlert("Ez már szerepel valamelyik listádban!");
    
    if (currentTab === 'toWatch') userData.toWatch.unshift(val);
    else userData.watched.unshift({ name: val, time: new Date().toLocaleString() });
    
    input.value = '';
    sync();
};

window.clearCurrentList = async () => {
    const listName = currentTab === 'toWatch' ? 'To Watch' : 'Watched';
    const conf1 = await uiConfirm(`Biztosan törölsz mindent a(z) ${listName} listából?`, true, "Igen, törlés");
    if (!conf1) return;
    
    const conf2 = await uiConfirm(`VÉGSŐ FIGYELMEZTETÉS: Ezt nem lehet visszavonni!`, true, "Végleges törlés");
    if (!conf2) return;

    if (currentTab === 'toWatch') userData.toWatch = [];
    else userData.watched = [];
    sync();
};

// ... [Random picker marad ugyanaz]
window.pickRandom = async () => {
    const pool = userData.toWatch;
    if (pool.length === 0) return await uiAlert("Nincs miből sorsolni a To Watch listában!");
    lastPickedIndex = Math.floor(Math.random() * pool.length);
    document.getElementById('random-result').innerText = pool[lastPickedIndex];
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

// --- ITEM OPTIONS (ToWatch/Watched) ---
window.openOptions = (index, name) => {
    selectedItemIndex = index;
    document.getElementById('options-title').innerText = name;
    document.getElementById('move-btn').innerHTML = currentTab === 'toWatch' ? '➡️ Áthelyezés ide: Watched' : '⬅️ Vissza ide: To Watch';
    document.getElementById('options-modal').style.display = 'flex';
};
window.closeOptions = () => { document.getElementById('options-modal').style.display = 'none'; selectedItemIndex = -1; };

window.editItemPrompt = async () => {
    if (selectedItemIndex === -1) return;
    const oldName = currentTab === 'toWatch' ? userData.toWatch[selectedItemIndex] : userData.watched[selectedItemIndex].name;
    const newName = await uiPrompt("Mire szeretnéd átírni?", oldName);
    
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

window.confirmListDelete = async () => {
    if (selectedItemIndex === -1) return;
    const conf = await uiConfirm("Biztosan törölni szeretnéd ezt az elemet?");
    if (conf) {
        if (currentTab === 'toWatch') userData.toWatch.splice(selectedItemIndex, 1);
        else userData.watched.splice(selectedItemIndex, 1);
        sync();
    }
    closeOptions();
};

// --- IMPORT / EXPORT (Kivágva a rövidség kedvéért, de maradhat az eredeti ahogy volt, csak az alert-eket cseréld uiAlert-re) ---

// --- LIBRARY / TREE LOGIKA ---
let targetPathForAdd = null; 

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

function removeNodeById(nodes, id) {
    for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === id) {
            nodes.splice(i, 1);
            return true;
        }
        if (nodes[i].children && nodes[i].children.length > 0) {
            if (removeNodeById(nodes[i].children, id)) return true;
        }
    }
    return false;
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

window.closeAddNodeModal = () => { document.getElementById('add-node-modal').style.display = 'none'; targetPathForAdd = null; };

window.confirmAddNode = async () => {
    const type = document.getElementById('node-type-select').value;
    const name = document.getElementById('node-name-input').value.trim();
    if (!name) return await uiAlert("Kérlek adj meg egy nevet!");

    const newNode = { id: Date.now().toString(), type: type, name: name, expanded: false, children: [] };

    if (targetPathForAdd === null) {
        userData.library.push(newNode);
    } else {
        const parentNode = findNodeById(userData.library, targetPathForAdd);
        if (parentNode) {
            if (!parentNode.children) parentNode.children = [];
            parentNode.children.push(newNode);
            parentNode.expanded = true; 
        }
    }
    sync();
    closeAddNodeModal();
};

window.toggleTreeNode = (id) => {
    const node = findNodeById(userData.library, id);
    if (node) { node.expanded = !node.expanded; sync(); }
};

window.deleteTreeNode = async (id) => {
    const node = findNodeById(userData.library, id);
    if (!node) return;

    // BIZTONSÁGI LOGIKA: 1 vagy 2 lépéses törlés
    if (node.type === 'Episode') {
        const conf = await uiConfirm(`Biztosan törlöd ezt az epizódot: ${node.name}?`, true, "Törlés");
        if (!conf) return;
    } else {
        const conf1 = await uiConfirm(`Biztosan törlöd ezt a konténert (${node.name}) és minden benne lévő elemet?`);
        if (!conf1) return;
        const conf2 = await uiConfirm(`VIGYÁZAT! Minden alárendelt elem véglegesen elvész. Biztos vagy benne?`, true, "Végleges Törlés");
        if (!conf2) return;
    }

    removeNodeById(userData.library, id);
    sync();
};

function renderTree(nodes) {
    let html = '';
    nodes.forEach(node => {
        const hasChildren = node.children && node.children.length > 0;
        const icon = hasChildren ? (node.expanded ? '▼' : '►') : '•';
        const safeId = node.id;
        
        html += `
        <div class="tree-item">
            <div class="tree-header">
                <div class="tree-title-area" onclick="toggleTreeNode('${safeId}')">
                    <span class="tree-toggle">${icon}</span>
                    <span class="badge">#${node.type.toLowerCase()}</span> 
                    <strong>${node.name}</strong>
                </div>
                <div class="tree-actions">
                    <button class="btn-tree-action add" onclick="openAddNodeModal('${safeId}')">+</button>
                    <button class="btn-tree-action del" onclick="deleteTreeNode('${safeId}')">🗑</button>
                </div>
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
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup,
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- KONFIGURÁCIÓ A SZÍNEKHEZ ---
const NODE_CONFIG = {
    'Season':      { color: '#38bdf8' }, // Sky Blue
    'Part':        { color: '#a855f7' }, // Purple
    'Arc':         { color: '#fb923c' }, // Orange
    'Cour':        { color: '#f472b6' }, // Pink
    'Movie-Part':  { color: '#6366f1' }, // Indigo
    'Sequel-Anime':{ color: '#f87171' }, // Red
    'Manga':       { color: '#2dd4bf' }, // Teal
    'Volume':      { color: '#a3e635' }, // Lime
    'Episodes':    { color: '#4ade80' }, // Green (Leaf)
    'Movie':       { color: '#eab308' }, // Yellow (Leaf)
    'Chapter':     { color: '#facc15' }  // Amber (Leaf)
};

const firebaseConfig = {
    apiKey: "AIzaSyAs-J8v8L7m-L7m8L7m8L7m8L7m8L7m8", // Replace with your actual key if different
    authDomain: "animetracker-171ba.firebaseapp.com",
    projectId: "animetracker-171ba",
    storageBucket: "animetracker-171ba.appspot.com",
    messagingSenderId: "36005748950",
    appId: "1:36005748950:web:4475459397686584f23b18"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let animeList = [];
let currentArchiveItem = null;

// --- AUTHENTICATION LOGIC ---

// Handles the Login Button
document.getElementById('login-btn').onclick = () => {
    signInWithPopup(auth, provider)
        .then((result) => {
            console.log("Sikeres bejelentkezés:", result.user.displayName);
        })
        .catch((error) => {
            console.error("Bejelentkezési hiba:", error.code, error.message);
            // This alert will tell you exactly why it's failing on your phone
            alert("Hiba történt: " + error.message + "\nKód: " + error.code);
        });
};

// Handles Logout
document.getElementById('logout-btn').onclick = () => {
    signOut(auth).then(() => {
        location.reload();
    }).catch((error) => {
        alert("Hiba a kijelentkezéskor: " + error.message);
    });
};

// Monitors Auth State
onAuthStateChanged(auth, (user) => {
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');

    if (user) {
        currentUser = user;
        document.getElementById('username-text').innerText = user.displayName || "User";
        authContainer.style.display = 'none';
        appContainer.style.display = 'block';
        loadData();
    } else {
        currentUser = null;
        authContainer.style.display = 'block';
        appContainer.style.display = 'none';
    }
});

// --- DATA PERSISTENCE ---

async function loadData() {
    if (!currentUser) return;
    try {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            animeList = docSnap.data().animeList || [];
            renderAnimeList();
        }
    } catch (e) {
        console.error("Error loading data:", e);
    }
}

async function saveData() {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, "users", currentUser.uid), {
            animeList: animeList
        });
    } catch (e) {
        console.error("Error saving data:", e);
    }
}

// --- APP LOGIC (UI & TREE) ---

window.addAnime = () => {
    openCustomPrompt("Anime címe:", "", (name) => {
        if (name && name.trim() !== '') {
            animeList.push({
                id: Date.now().toString(),
                title: name.trim(),
                hierarchy: []
            });
            saveData();
            renderAnimeList();
        }
    });
};

window.deleteAnime = (id) => {
    if (confirm("Biztosan törlöd ezt az animét?")) {
        animeList = animeList.filter(a => a.id !== id);
        saveData();
        renderAnimeList();
    }
};

window.openArchive = (id) => {
    currentArchiveItem = animeList.find(a => a.id === id);
    document.getElementById('archive-title').innerText = currentArchiveItem.title;
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('archive-container').style.display = 'block';
    renderTree();
};

window.closeArchive = () => {
    saveData();
    currentArchiveItem = null;
    document.getElementById('archive-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
};

function renderAnimeList() {
    const listDiv = document.getElementById('anime-list');
    listDiv.innerHTML = '';
    animeList.forEach(anime => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        card.innerHTML = `
            <span onclick="openArchive('${anime.id}')" style="cursor:pointer; flex:1;">${anime.title}</span>
            <button class="btn-danger" onclick="deleteAnime('${anime.id}')">Törlés</button>
        `;
        listDiv.appendChild(card);
    });
}

// --- TREE LOGIC ---

function renderTree() {
    const treeDiv = document.getElementById('tree-root');
    treeDiv.innerHTML = '';
    currentArchiveItem.hierarchy.forEach((node, index) => {
        treeDiv.appendChild(createNodeElement(node, index.toString()));
    });
}

function createNodeElement(node, pathStr) {
    const container = document.createElement('div');
    container.className = 'tree-node';
    
    const header = document.createElement('div');
    header.className = 'tree-header';
    
    const isLeaf = (node.type === 'Episodes' || node.type === 'Movie' || node.type === 'Chapter');
    const color = NODE_CONFIG[node.type]?.color || '#94a3b8';
    
    let toggleHtml = '';
    if (!isLeaf) {
        toggleHtml = `<span class="tree-toggle" onclick="toggleNode('${pathStr}')">${node.isExpanded ? '▼' : '▶'}</span>`;
    } else {
        toggleHtml = `<span class="tree-toggle" style="visibility:hidden;">▶</span>`;
    }

    const titleText = isLeaf ? `${node.type}: ${node.value}` : node.name;

    header.innerHTML = `
        ${toggleHtml}
        <span class="tree-text" onclick="${isLeaf ? `editTreeNode('${pathStr}')` : `toggleNode('${pathStr}')`}" style="color:${color}">
            ${titleText}
        </span>
        <div class="tree-actions">
            ${!isLeaf ? `<button onclick="showAddMenu('${pathStr}')" style="background:none; border:none; color:var(--success); font-size:16px; cursor:pointer;">+</button>` : ''}
            <button onclick="deleteTreeNode('${pathStr}')" style="background:none; border:none; color:var(--danger); font-size:16px; cursor:pointer;">×</button>
        </div>
    `;

    container.appendChild(header);

    if (!isLeaf && node.isExpanded && node.children) {
        const childrenDiv = document.createElement('div');
        childrenDiv.className = 'tree-children';
        node.children.forEach((child, idx) => {
            childrenDiv.appendChild(createNodeElement(child, `${pathStr}-${idx}`));
        });
        container.appendChild(childrenDiv);
    }

    return container;
}

window.toggleNode = (pathStr) => {
    const { parentArray, index } = getParentArrayAndIndex(pathStr);
    parentArray[index].isExpanded = !parentArray[index].isExpanded;
    renderTree();
};

window.showAddMenu = (pathStr) => {
    const menu = document.getElementById('add-menu-overlay');
    menu.setAttribute('data-target-path', pathStr || '');
    menu.style.display = 'flex';
};

window.closeAddMenu = () => {
    document.getElementById('add-menu-overlay').style.display = 'none';
};

window.addTreeNode = (type) => {
    const targetTreePath = document.getElementById('add-menu-overlay').getAttribute('data-target-path');
    closeAddMenu();
    
    const isLeaf = (type === 'Episodes' || type === 'Movie' || type === 'Chapter');
    const promptTitle = isLeaf ? `${type} száma/értéke (pl. 1 vagy 1-12):` : `${type} neve:`;
    
    openCustomPrompt(promptTitle, "", (val) => {
        if (val && val.trim() !== '') {
            const newNode = isLeaf 
                ? { type: type, value: val.trim() } 
                : { type: type, name: val.trim(), children: [], isExpanded: true };
            
            if (targetTreePath === '') {
                currentArchiveItem.hierarchy.push(newNode);
            } else {
                const { parentArray, index } = getParentArrayAndIndex(targetTreePath);
                parentArray[index].children.push(newNode);
                parentArray[index].isExpanded = true;
            }
            renderTree();
            saveData();
        }
    });
};

window.editTreeNode = (pathStr) => {
    const { parentArray, index } = getParentArrayAndIndex(pathStr);
    const node = parentArray[index];
    const isLeaf = (node.type === 'Episodes' || node.type === 'Movie' || node.type === 'Chapter');
    const promptTitle = isLeaf ? `${node.type} módosítása:` : `${node.type} nevének módosítása:`;
    
    openCustomPrompt(promptTitle, isLeaf ? node.value : node.name, (newVal) => {
        if (newVal && newVal.trim() !== '') {
            if (isLeaf) node.value = newVal.trim();
            else node.name = newVal.trim();
            renderTree();
            saveData();
        }
    });
};

window.deleteTreeNode = (pathStr) => {
    if (confirm("Biztosan törlöd ezt az elemet?")) {
        const { parentArray, index } = getParentArrayAndIndex(pathStr);
        parentArray.splice(index, 1);
        renderTree();
        saveData();
    }
};

function getParentArrayAndIndex(pathStr) {
    const parts = pathStr.split('-').map(Number);
    let currentArr = currentArchiveItem.hierarchy;
    for (let i = 0; i < parts.length - 1; i++) {
        currentArr = currentArr[parts[i]].children;
    }
    return { parentArray: currentArr, index: parts[parts.length - 1] };
}

// --- CUSTOM PROMPT SYSTEM ---

function openCustomPrompt(title, defaultVal, callback) {
    const overlay = document.createElement('div');
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:10000; padding:20px;";
    
    const box = document.createElement('div');
    box.style = "background:var(--bg-alt); padding:20px; border-radius:12px; width:100%; max-width:400px; border:1px solid var(--accent); box-shadow: 0 10px 25px rgba(0,0,0,0.5);";
    
    box.innerHTML = `
        <h3 style="margin-top:0; color:var(--accent);">${title}</h3>
        <input type="text" id="custom-prompt-input" value="${defaultVal}" style="width:100%; padding:10px; background:#1e293b; border:1px solid #334155; border-radius:6px; color:white; margin-bottom:15px; outline:none;">
        <div style="display:flex; gap:10px; justify-content:flex-end;">
            <button id="prompt-cancel" style="padding:8px 15px; border-radius:6px; border:none; background:#475569; color:white; cursor:pointer;">Mégse</button>
            <button id="prompt-ok" style="padding:8px 20px; border-radius:6px; border:none; background:var(--accent); color:white; cursor:pointer;">OK</button>
        </div>
    `;
    
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    const input = document.getElementById('custom-prompt-input');
    input.focus();
    input.select();
    
    const close = (val) => {
        document.body.removeChild(overlay);
        if (val !== null) callback(val);
    };

    document.getElementById('prompt-ok').onclick = () => close(input.value);
    document.getElementById('prompt-cancel').onclick = () => close(null);
    input.onkeydown = (e) => {
        if (e.key === 'Enter') close(input.value);
        if (e.key === 'Escape') close(null);
    };
}

// --- RANDOM PICKER ---
window.pickRandom = () => {
    if (animeList.length === 0) return alert("Nincs anime a listádban!");
    const randomAnime = animeList[Math.floor(Math.random() * animeList.length)];
    alert("A választott anime: " + randomAnime.title);
};

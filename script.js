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
    'Movie':       { color: '#eab308' }, // Gold (Leaf)
    'Chapter':     { color: '#d97706' }, // Amber (Leaf)
    'OVA':         { color: '#10b981' }  // Emerald Green (Leaf)
};

// --- MOBILE DEBUGGER ---
window.onerror = (msg, url, line) => alert(`Error: ${msg}\nLine: ${line}`);

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCq7skNHlN6mF45b-TjqNyJJ-OBwGu5YBs",
  authDomain: "animetracker-171ba.firebaseapp.com",
  projectId: "animetracker-171ba",
  storageBucket: "animetracker-171ba.firebasestorage.app",
  messagingSenderId: "1083378734621",
  appId: "1:1083378734621:web:531e2c1cab0c4ed1e918f4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ÁLLAPOTOK
let currentUser = null;
let userData = { toWatch: [], watched: [], archive: [] };
let currentTab = 'toWatch';
let lastPickedIndex = -1;
let selectedItemIndex = -1;
let customPromptCallback = null;

// Törléshez
let deleteTargetIndex = -1;
let deleteStep = 0;
const deleteMessages = [
    "Biztosan törölni szeretnéd ezt a fő elemet az Archívumból?",
    "VIGYÁZAT: Ez egy visszavonhatatlan művelet. Minden al-elem és a teljes hierarchia elvész.",
    "UTOLSÓ ESÉLY! Tényleg törlöd?"
];

// Archive Modalhoz
let currentArchiveItem = null; 
let isEditingArchive = false;
let editingArchiveIndex = -1;
let targetTreePath = ''; 

// --- AUTH & SYNC ---
onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        document.getElementById('username-text').innerText = user.displayName;
        loadUserData();
    } else {
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('app-container').style.display = 'none';
    }
});

document.getElementById('login-btn').onclick = () => {
    signInWithPopup(auth, provider).catch((error) => {
        console.error("Login failed:", error);
        alert("Hiba történt a bejelentkezés során: " + error.message);
    });
};
document.getElementById('logout-btn').onclick = () => signOut(auth);

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

// --- CUSTOM PROMPT ---
window.openCustomPrompt = (title, defaultValue, callback) => {
    document.getElementById('custom-prompt-title').innerText = title;
    const input = document.getElementById('custom-prompt-input');
    input.value = defaultValue;
    customPromptCallback = callback;
    document.getElementById('custom-prompt-modal').style.display = 'flex';
    input.focus();
};

window.closeCustomPrompt = () => {
    document.getElementById('custom-prompt-modal').style.display = 'none';
    customPromptCallback = null;
};

document.getElementById('custom-prompt-btn').onclick = () => {
    const val = document.getElementById('custom-prompt-input').value;
    if (customPromptCallback) customPromptCallback(val);
    closeCustomPrompt();
};

// --- ALAP FUNKCIÓK (To Watch / Watched) ---
window.addAnime = () => {
    if (currentTab === 'archive') { openArchiveModal(); return; }

    openCustomPrompt("Hozzáadás:", "", (val) => {
        if (!val || val.trim() === '') return;
        const finalVal = val.trim();
        
        if (currentTab === 'toWatch') {
            userData.toWatch.unshift(finalVal);
        } else {
            userData.watched.unshift({ name: finalVal, time: new Date().toLocaleString() });
        }
        document.getElementById('searchInput').value = ''; 
        sync();
    });
};

document.getElementById('searchInput').addEventListener('input', () => render());

window.clearCurrentList = () => {
    openCustomPrompt("Biztos törlöd a jelenlegi listát? Írd be: 'Igen'", "", (val) => {
        if (val && val.toLowerCase() === 'igen') {
            if (currentTab === 'toWatch') userData.toWatch = [];
            else if (currentTab === 'watched') userData.watched = [];
            else userData.archive = [];
            sync();
        }
    });
};

window.pickRandom = () => {
    if (userData.toWatch.length === 0) return openCustomPrompt("Hiba", "A To Watch lista üres!", () => {});
    let randomIndex;
    do { randomIndex = Math.floor(Math.random() * userData.toWatch.length); } 
    while (randomIndex === lastPickedIndex && userData.toWatch.length > 1);
    lastPickedIndex = randomIndex;
    document.getElementById('random-result').innerText = userData.toWatch[randomIndex];
    document.getElementById('overlay').style.display = 'flex';
};

window.closeOverlay = () => document.getElementById('overlay').style.display = 'none';

window.moveToWatchedFromRandom = () => {
    const item = userData.toWatch.splice(lastPickedIndex, 1)[0];
    userData.watched.unshift({ name: item, time: new Date().toLocaleString() });
    sync();
    closeOverlay();
};

window.openOptions = (index, name) => {
    selectedItemIndex = index;
    document.getElementById('options-title').innerText = name;
    document.getElementById('move-btn').innerText = currentTab === 'toWatch' ? '🔄 Áthelyezés Watched-be' : '🔄 Áthelyezés To Watch-ba';
    document.getElementById('options-modal').style.display = 'flex';
};
window.closeOptions = () => document.getElementById('options-modal').style.display = 'none';

window.editItemPrompt = () => {
    const oldVal = currentTab === 'toWatch' ? userData.toWatch[selectedItemIndex] : userData.watched[selectedItemIndex].name;
    openCustomPrompt("Szerkesztés:", oldVal, (newVal) => {
        if (newVal && newVal.trim() !== '') {
            if (currentTab === 'toWatch') userData.toWatch[selectedItemIndex] = newVal.trim();
            else userData.watched[selectedItemIndex].name = newVal.trim();
            sync();
        }
        closeOptions();
    });
};

window.toggleMoveItem = () => {
    if (currentTab === 'toWatch') {
        const item = userData.toWatch.splice(selectedItemIndex, 1)[0];
        userData.watched.unshift({ name: item, time: new Date().toLocaleString() });
    } else {
        const item = userData.watched.splice(selectedItemIndex, 1)[0].name;
        userData.toWatch.unshift(item);
    }
    sync();
    closeOptions();
};

window.confirmDelete = () => {
    if (currentTab === 'toWatch') userData.toWatch.splice(selectedItemIndex, 1);
    else userData.watched.splice(selectedItemIndex, 1);
    sync();
    closeOptions();
};

// --- RENDER (Főképernyő) ---
window.switchTab = (t) => {
    currentTab = t;
    document.getElementById('tabToWatch').classList.toggle('active', t === 'toWatch');
    document.getElementById('tabWatched').classList.toggle('active', t === 'watched');
    document.getElementById('tabArchive').classList.toggle('active', t === 'archive');
    render();
};

window.render = () => {
    const container = document.getElementById('listContainer');
    const searchInput = document.getElementById('searchInput').value.toLowerCase();
    const searchTerms = searchInput.split(/\s+/).filter(t => t.length > 0); 
    container.innerHTML = '';
    
    // Kezeljük az Import/Export gombok láthatóságát
    const importExportContainer = document.getElementById('import-export-container');
    if (importExportContainer) {
        importExportContainer.style.display = currentTab === 'archive' ? 'none' : 'flex';
    }

    let list = currentTab === 'toWatch' ? userData.toWatch : (currentTab === 'watched' ? userData.watched : userData.archive);
    
    document.getElementById('countTW').innerText = userData.toWatch.length;
    document.getElementById('countW').innerText = userData.watched.length;
    document.getElementById('countA').innerText = userData.archive ? userData.archive.length : 0;

    list.forEach((item, index) => {
        const name = currentTab === 'toWatch' ? item : item.name;
        
        let match = true;
        if (searchTerms.length > 0) {
            const searchString = currentTab === 'archive' 
                ? `${item.name} ${item.type} ${item.status}`.toLowerCase()
                : name.toLowerCase();
            match = searchTerms.every(term => searchString.includes(term));
        }

        if (match) {
            const div = document.createElement('div');
            div.className = 'list-item';
            
            if (currentTab === 'archive') {
                const typeColor = item.type === 'Manga' ? '#2dd4bf' : (item.type === 'StandaloneMovie' ? '#f59e0b' : '#38bdf8');
                let statusColor = '#94a3b8';
                if(item.status === '#ended') statusColor = '#f43f5e';
                if(item.status === '#continue-sometime') statusColor = '#2dd4bf';
                if(item.status === '#airing') statusColor = '#a3e635';

                div.innerHTML = `
                    <div style="flex:1;" onclick="openArchiveModal(${index})">
                        <div style="font-weight:bold; font-size: 16px;">${item.name}</div>
                        <div style="margin-top: 5px; display:flex; gap: 5px; flex-wrap: wrap;">
                            <span class="hashtag" style="color: ${typeColor}; border: 1px solid ${typeColor}; background: transparent;">#${item.type}</span>
                            <span class="hashtag" style="color: ${statusColor}; background: rgba(255,255,255,0.05);">${item.status}</span>
                        </div>
                    </div>
                `;
            } else {
                div.innerHTML = `
                    <div style="flex: 1;" onclick="openOptions(${index}, '${name.replace(/'/g, "\\'")}')">
                        <div style="font-weight: 500;">${name}</div>
                        ${currentTab === 'watched' ? `<div class="date-text">${item.time}</div>` : ''}
                    </div>
                `;
            }
            container.appendChild(div);
        }
    });
};

// --- ARCHIVE LOGIKA ---
window.switchArchTab = (num) => {
    document.getElementById('archTab1').classList.toggle('active', num === 1);
    document.getElementById('archTab2').classList.toggle('active', num === 2);
    document.getElementById('arch-tab1-content').style.display = num === 1 ? 'block' : 'none';
    document.getElementById('arch-tab2-content').style.display = num === 2 ? 'block' : 'none';
};

window.openArchiveModal = (index = -1) => {
    switchArchTab(1);
    if (index === -1) {
        isEditingArchive = false;
        editingArchiveIndex = -1;
        document.getElementById('archive-modal-title').innerText = "Új Archív Elem";
        currentArchiveItem = { name: '', type: 'Anime', status: '#ended', manga: [], ova: [], movie: [], sequel: [], hierarchy: [] };
    } else {
        isEditingArchive = true;
        editingArchiveIndex = index;
        currentArchiveItem = JSON.parse(JSON.stringify(userData.archive[index]));
        if(!currentArchiveItem.manga) currentArchiveItem.manga = [];
        if(!currentArchiveItem.ova) currentArchiveItem.ova = [];
        if(!currentArchiveItem.movie) currentArchiveItem.movie = [];
        if(!currentArchiveItem.sequel) currentArchiveItem.sequel = [];
        if(!currentArchiveItem.hierarchy) currentArchiveItem.hierarchy = [];
        if(!currentArchiveItem.status) currentArchiveItem.status = '#ended';
    }
    
    document.getElementById('arch-name').value = currentArchiveItem.name;
    document.getElementById('arch-type').value = currentArchiveItem.type;
    document.getElementById('arch-status').value = currentArchiveItem.status;
    
    renderArchSubItems();
    renderTree();
    
    document.getElementById('arch-delete-btn').style.display = isEditingArchive ? 'block' : 'none';
    document.getElementById('archive-modal').style.display = 'flex';
};

window.closeArchiveModal = () => document.getElementById('archive-modal').style.display = 'none';

window.saveArchiveItem = () => {
    const name = document.getElementById('arch-name').value.trim();
    if (name === '') return alert("A Cím nem lehet üres!");
    
    currentArchiveItem.name = name;
    currentArchiveItem.type = document.getElementById('arch-type').value;
    currentArchiveItem.status = document.getElementById('arch-status').value;
    
    if (isEditingArchive) userData.archive[editingArchiveIndex] = currentArchiveItem;
    else userData.archive.unshift(currentArchiveItem);
    
    sync();
    closeArchiveModal();
};

window.deleteArchiveItem = () => {
    openCustomPrompt("Törlés megerősítése: Írd be 'Igen'", "", (val) => {
        if(val && val.toLowerCase() === 'igen') {
            userData.archive.splice(editingArchiveIndex, 1);
            sync();
            closeArchiveModal();
        }
    });
};

// --- SUB-ITEMS (Manga, OVA, Movie, Sequel) ---
window.addArchSubItem = (type) => {
    openCustomPrompt(`Új ${type.toUpperCase()} hozzáadása:`, "", (val) => {
        if (val && val.trim() !== '') {
            currentArchiveItem[type].push(val.trim());
            renderArchSubItems();
        }
    });
};

window.removeArchSubItem = (type, index) => {
    currentArchiveItem[type].splice(index, 1);
    renderArchSubItems();
};

window.renderArchSubItems = () => {
    const container = document.getElementById('arch-subitems-container');
    container.innerHTML = '';
    const types = [
        { key: 'manga', label: 'Manga', color: '#2dd4bf' },
        { key: 'ova', label: 'OVA', color: '#f472b6' },
        { key: 'movie', label: 'Movie', color: '#f59e0b' },
        { key: 'sequel', label: 'Sequel', color: '#38bdf8' }
    ];

    types.forEach(t => {
        if (currentArchiveItem[t.key] && currentArchiveItem[t.key].length > 0) {
            currentArchiveItem[t.key].forEach((item, idx) => {
                const div = document.createElement('div');
                div.className = 'sub-item';
                div.innerHTML = `
                    <span><span style="color: ${t.color}; font-weight: bold; margin-right:5px;">[${t.label}]</span> ${item}</span>
                    <button class="btn-icon" onclick="removeArchSubItem('${t.key}', ${idx})">❌</button>
                `;
                container.appendChild(div);
            });
        }
    });
};

// --- HIERARCHY TREE LOGIC ---
const getParentArrayAndIndex = (pathStr) => {
    if (pathStr === '') return { parentArray: currentArchiveItem.hierarchy, index: -1 };
    const path = pathStr.split(',').map(Number);
    let currentArray = currentArchiveItem.hierarchy;
    for (let i = 0; i < path.length - 1; i++) currentArray = currentArray[path[i]].children;
    return { parentArray: currentArray, index: path[path.length - 1] };
};

window.renderTree = () => {
    const container = document.getElementById('tree-container');
    let totalCount = 0;

    const countNodes = (nodes) => {
        nodes.forEach(n => {
            totalCount++;
            if (n.children) countNodes(n.children);
        });
    };
    countNodes(currentArchiveItem.hierarchy);
    document.getElementById('arch-hier-count').innerText = totalCount;

    const buildTreeHTML = (nodes = currentArchiveItem.hierarchy, path = []) => {
        container.innerHTML = '';
        if (nodes.length === 0 && path.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); text-align:center; font-size: 13px;">A hierarchia üres. Adj hozzá egy Fő elemet!</p>';
            return;
        }

        nodes.forEach((node, idx) => {
            const currentPath = [...path, idx];
            const pathStr = currentPath.join(',');
            const config = NODE_CONFIG[node.type] || { color: '#94a3b8' };
            
            const isLeaf = (node.type === 'Episodes' || node.type === 'Movie' || node.type === 'Chapter' || node.type === 'OVA');
            
            const div = document.createElement('div');
            div.className = 'tree-node';
            
            let toggleBtn = isLeaf 
                ? '<span style="width:23px; display:inline-block;"></span>' 
                : `<button class="btn-icon tree-toggle" style="margin-right: 5px; font-size: 12px; width: 20px; padding: 0; color: var(--accent);" onclick="toggleTreeNode('${pathStr}')">${node.isExpanded ? '▼' : '▶'}</button>`;
            
            let displayHTML = '';
            if (node.type === 'Episodes') displayHTML = `📺 Epizódok: <strong style="color:white;">${node.value}</strong>`;
            else if (node.type === 'Movie') displayHTML = `🎬 Movie: <strong style="color:white;">${node.value}</strong>`;
            else if (node.type === 'Chapter') displayHTML = `📖 Chapter: <strong style="color:white;">${node.value}</strong>`;
            else if (node.type === 'OVA') displayHTML = `📀 OVA: <strong style="color:white;">${node.value}</strong>`;
            else displayHTML = `${node.name}`;

            let headerHTML = `
                <div class="tree-header" id="header-${pathStr}" style="border-left: 3px solid ${config.color};">
                    <div style="display:flex; align-items:center; flex:1;">
                        ${path.length === 0 ? `<div class="drag-handle" onpointerdown="startDrag(event, this.parentElement.parentElement, ${idx})">≡</div>` : ''}
                        ${toggleBtn}
                        <span class="hashtag" style="margin-right: 8px; color: ${config.color}; border: 1px solid ${config.color}; background: transparent;">${node.type}</span>
                        <div class="tree-text" onclick="editTreeNode('${pathStr}')">${displayHTML}</div>
                    </div>
                    <div class="tree-actions">
                        ${!isLeaf ? `<button class="btn-icon" onclick="openTreeNodeSelector('${pathStr}')" style="color: var(--success);">➕</button>` : ''}
                        <button class="btn-icon" onclick="deleteTreeNode('${pathStr}')" style="color: var(--danger);">❌</button>
                    </div>
                </div>
            `;
            
            div.innerHTML = headerHTML;

            if (!isLeaf && node.children && node.children.length > 0) {
                const childrenDiv = document.createElement('div');
                childrenDiv.className = 'tree-children';
                childrenDiv.style.display = node.isExpanded ? 'block' : 'none';
                
                const buildChildren = (children, currentPathStr, parentDiv) => {
                    children.forEach((child, cIdx) => {
                        const childPathStr = currentPathStr + ',' + cIdx;
                        const childConfig = NODE_CONFIG[child.type] || { color: '#94a3b8' };
                        const childIsLeaf = (child.type === 'Episodes' || child.type === 'Movie' || child.type === 'Chapter' || child.type === 'OVA');
                        
                        const cDiv = document.createElement('div');
                        cDiv.className = 'tree-node';
                        
                        let cToggleBtn = childIsLeaf 
                            ? '<span style="width:23px; display:inline-block;"></span>' 
                            : `<button class="btn-icon tree-toggle" style="margin-right: 5px; font-size: 12px; width: 20px; padding: 0; color: var(--accent);" onclick="toggleTreeNode('${childPathStr}')">${child.isExpanded ? '▼' : '▶'}</button>`;
                        
                        let cDisplayHTML = '';
                        if (child.type === 'Episodes') cDisplayHTML = `📺 Epizódok: <strong style="color:white;">${child.value}</strong>`;
                        else if (child.type === 'Movie') cDisplayHTML = `🎬 Movie: <strong style="color:white;">${child.value}</strong>`;
                        else if (child.type === 'Chapter') cDisplayHTML = `📖 Chapter: <strong style="color:white;">${child.value}</strong>`;
                        else if (child.type === 'OVA') cDisplayHTML = `📀 OVA: <strong style="color:white;">${child.value}</strong>`;
                        else cDisplayHTML = `${child.name}`;

                        let cHeaderHTML = `
                            <div class="tree-header" id="header-${childPathStr}" style="border-left: 3px solid ${childConfig.color};">
                                <div style="display:flex; align-items:center; flex:1;">
                                    ${cToggleBtn}
                                    <span class="hashtag" style="margin-right: 8px; color: ${childConfig.color}; border: 1px solid ${childConfig.color}; background: transparent;">${child.type}</span>
                                    <div class="tree-text" onclick="editTreeNode('${childPathStr}')">${cDisplayHTML}</div>
                                </div>
                                <div class="tree-actions">
                                    ${!childIsLeaf ? `<button class="btn-icon" onclick="openTreeNodeSelector('${childPathStr}')" style="color: var(--success);">➕</button>` : ''}
                                    <button class="btn-icon" onclick="deleteTreeNode('${childPathStr}')" style="color: var(--danger);">❌</button>
                                </div>
                            </div>
                        `;
                        cDiv.innerHTML = cHeaderHTML;
                        parentDiv.appendChild(cDiv);

                        if (!childIsLeaf && child.children && child.children.length > 0) {
                            const subChildrenDiv = document.createElement('div');
                            subChildrenDiv.className = 'tree-children';
                            subChildrenDiv.style.display = child.isExpanded ? 'block' : 'none';
                            buildChildren(child.children, childPathStr, subChildrenDiv);
                            cDiv.appendChild(subChildrenDiv);
                        }
                    });
                };
                buildChildren(node.children, pathStr, childrenDiv);
                div.appendChild(childrenDiv);
            }
            container.appendChild(div);
        });
    };
    buildTreeHTML();
};

window.toggleTreeNode = (pathStr) => {
    const { parentArray, index } = getParentArrayAndIndex(pathStr);
    parentArray[index].isExpanded = !parentArray[index].isExpanded;
    renderTree();
};

window.openTreeNodeSelector = (pathStr) => {
    targetTreePath = pathStr;
    document.getElementById('tree-node-selector-modal').style.display = 'flex';
};
window.closeTreeNodeSelector = () => {
    document.getElementById('tree-node-selector-modal').style.display = 'none';
    targetTreePath = '';
};

window.addTreeNode = (type) => {
    closeTreeNodeSelector();
    const isLeaf = (type === 'Episodes' || type === 'Movie' || type === 'Chapter' || type === 'OVA');
    
    let promptTitle = type === 'Episodes' ? 'Epizód Number vagy Range (pl. 1 vagy 1-12):' :
                      type === 'Movie' ? 'Film címe:' :
                      type === 'Chapter' ? 'Chapter Number vagy Range (pl. 1 vagy 1-15):' :
                      type === 'OVA' ? 'OVA címe vagy Epizód száma:' :
                      `${type} Neve:`;

    openCustomPrompt(promptTitle, "", (val) => {
        if (val && val.trim() !== '') {
            const newNode = isLeaf 
                ? { type: type, value: val.trim() } 
                : { type: type, name: val.trim(), children: [], isExpanded: true };
            
            if (targetTreePath === '') currentArchiveItem.hierarchy.push(newNode);
            else {
                const { parentArray, index } = getParentArrayAndIndex(targetTreePath);
                parentArray[index].children.push(newNode);
                parentArray[index].isExpanded = true;
            }
            renderTree();
        }
    });
};

window.editTreeNode = (pathStr) => {
    const { parentArray, index } = getParentArrayAndIndex(pathStr);
    const node = parentArray[index];
    const isLeaf = (node.type === 'Episodes' || node.type === 'Movie' || node.type === 'Chapter' || node.type === 'OVA');
    const promptTitle = isLeaf ? `${node.type} módosítása:` : `${node.type} nevének módosítása:`;
    
    openCustomPrompt(promptTitle, isLeaf ? node.value : node.name, (newVal) => {
        if (newVal && newVal.trim() !== '') {
            if (isLeaf) node.value = newVal.trim();
            else node.name = newVal.trim();
            renderTree();
        }
    });
};

window.deleteTreeNode = (pathStr) => {
    const { parentArray, index } = getParentArrayAndIndex(pathStr);
    const node = parentArray[index];
    
    const performDelete = () => {
        parentArray.splice(index, 1);
        renderTree();
        deleteTargetIndex = -1;
        deleteStep = 0;
    };

    if (node.children && node.children.length > 0) {
        deleteTargetIndex = index;
        deleteStep = 0;
        
        const ask = () => {
            if (deleteStep >= deleteMessages.length) {
                performDelete();
            } else {
                openCustomPrompt(`${deleteMessages[deleteStep]} (Írd be: Igen)`, "", (val) => {
                    if (val && val.toLowerCase() === 'igen') {
                        deleteStep++;
                        ask();
                    } else {
                        deleteTargetIndex = -1;
                        deleteStep = 0;
                    }
                });
            }
        };
        ask();
    } else {
        openCustomPrompt(`Biztosan törlöd ezt az elemet: ${node.name || node.value || node.type}? (Írd be: Igen)`, "", (val) => {
            if (val && val.toLowerCase() === 'igen') performDelete();
        });
    }
};

// --- DRAG & DROP MOBILRA ---
window.startDrag = (e, element, index) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    
    const headerDiv = element.querySelector('.tree-header');
    if (!headerDiv) return;

    let holdTimer;
    const startX = e.clientX;
    const startY = e.clientY;

    const cancelPress = () => {
        clearTimeout(holdTimer);
        headerDiv.removeEventListener('pointerup', cancelPress);
        headerDiv.removeEventListener('pointercancel', cancelPress);
        headerDiv.removeEventListener('pointermove', checkMovement);
    };

    holdTimer = setTimeout(() => {
        cancelPress();
        initDrag(e, element, index);
    }, 200);

    const checkMovement = (e) => {
        if ((Math.abs(e.clientY - startY) > 15 || Math.abs(e.clientX - startX) > 15)) cancelPress();
    };

    headerDiv.addEventListener('pointerup', cancelPress);
    headerDiv.addEventListener('pointercancel', cancelPress);
    headerDiv.addEventListener('pointermove', checkMovement);
};

window.initDrag = (e, element, index) => {
    const container = document.getElementById('tree-container');
    container.style.position = 'relative';
    document.body.style.touchAction = 'none';
    document.body.style.overflow = 'hidden';

    window.preventTouchScroll = function(event) { event.preventDefault(); };
    document.addEventListener('touchmove', window.preventTouchScroll, { passive: false });

    const nodeData = currentArchiveItem.hierarchy[index];
    if (nodeData.children && nodeData.children.length > 0) {
        nodeData.isExpanded = false;
        const childrenDiv = element.querySelector('.tree-children');
        if (childrenDiv) childrenDiv.style.display = 'none';
        const toggleBtn = element.querySelector('.tree-toggle');
        if (toggleBtn) toggleBtn.innerText = '▶';
    }

    const rect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const placeholder = document.createElement('div');
    placeholder.className = 'drag-placeholder';
    placeholder.style.height = `${rect.height}px`;
    element.parentNode.insertBefore(placeholder, element);

    element.style.position = 'absolute';
    element.style.zIndex = '9000';
    element.style.width = `${rect.width}px`;
    element.style.boxShadow = '0 10px 20px rgba(0,0,0,0.5)';
    element.style.opacity = '0.9';
    element.style.left = `${rect.left - containerRect.left}px`;
    element.style.top = `${rect.top - containerRect.top + container.scrollTop}px`;
    element.classList.add('dragging');

    let startY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
    let currentY = startY;
    let initialTop = parseFloat(element.style.top);

    const onMove = (moveEvent) => {
        moveEvent.preventDefault();
        const clientY = moveEvent.clientY || (moveEvent.touches ? moveEvent.touches[0].clientY : 0);
        const deltaY = clientY - startY;
        element.style.top = `${initialTop + deltaY}px`;
        currentY = clientY;

        const siblings = Array.from(container.children).filter(c => c !== element && c.classList.contains('tree-node'));
        let targetSibling = null;

        for (let sibling of siblings) {
            const sibRect = sibling.getBoundingClientRect();
            if (currentY > sibRect.top && currentY < sibRect.bottom) {
                targetSibling = sibling;
                break;
            }
        }

        if (targetSibling) {
            const sibRect = targetSibling.getBoundingClientRect();
            if (currentY < sibRect.top + sibRect.height / 2) {
                container.insertBefore(placeholder, targetSibling);
            } else {
                container.insertBefore(placeholder, targetSibling.nextSibling);
            }
        }
    };

    const onEnd = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('pointerup', onEnd);
        document.removeEventListener('touchend', onEnd);
        document.removeEventListener('touchmove', window.preventTouchScroll);
        
        document.body.style.touchAction = '';
        document.body.style.overflow = '';
        container.style.position = '';

        element.style.position = '';
        element.style.zIndex = '';
        element.style.width = '';
        element.style.boxShadow = '';
        element.style.opacity = '';
        element.style.left = '';
        element.style.top = '';
        element.classList.remove('dragging');

        const siblings = Array.from(container.children).filter(c => c.classList.contains('tree-node') || c.classList.contains('drag-placeholder'));
        const newIndex = siblings.indexOf(placeholder);
        
        let actualNewIndex = newIndex;
        if (newIndex > index) actualNewIndex--;

        if (actualNewIndex !== index && actualNewIndex >= 0) {
            const item = currentArchiveItem.hierarchy.splice(index, 1)[0];
            currentArchiveItem.hierarchy.splice(actualNewIndex, 0, item);
        }

        placeholder.remove();
        renderTree();
    };

    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('pointerup', onEnd);
    document.addEventListener('touchend', onEnd);
};

// --- IMPORT / EXPORT FUNKCIÓK ---
window.exportList = () => {
    if (currentTab === 'archive') return;
    
    const list = currentTab === 'toWatch' ? userData.toWatch : userData.watched.map(item => item.name);
    if (list.length === 0) return alert("A lista üres, nincs mit exportálni!");
    
    const content = list.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `animetracker_${currentTab}_list.txt`;
    a.click();
    URL.revokeObjectURL(url);
};

window.importList = () => {
    if (currentTab === 'archive') return;
    document.getElementById('importFileInput').click();
};

window.handleImportFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const lines = e.target.result.split(/\r?\n/);
        let addedCount = 0;
        
        const currentListNames = currentTab === 'toWatch' 
            ? userData.toWatch.map(n => n.toLowerCase()) 
            : userData.watched.map(item => item.name.toLowerCase());

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed !== '') {
                const lower = trimmed.toLowerCase();
                if (!currentListNames.includes(lower)) {
                    if (currentTab === 'toWatch') {
                        userData.toWatch.push(trimmed); 
                    } else {
                        userData.watched.unshift({ name: trimmed, time: new Date().toLocaleString() });
                    }
                    currentListNames.push(lower);
                    addedCount++;
                }
            }
        });
        
        document.getElementById('importFileInput').value = ''; 
        if (addedCount > 0) {
            sync(); 
            alert(`${addedCount} új elem sikeresen importálva a ${currentTab} listába!`);
        } else {
            alert("Nem volt új elem az importált fájlban (minden elem már szerepel a listán, vagy a fájl üres).");
        }
    };
    reader.readAsText(file);
};

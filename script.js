import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithRedirect,
    getRedirectResult,
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- MOBILE DEBUGGER ---
window.onerror = (msg, url, line) => alert(`Error: ${msg}\nLine: ${line}`);

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

// ALAP ÁLLAPOTOK
let currentUser = null;
let userData = { toWatch: [], watched: [], archive: [] };
let currentTab = 'toWatch';
let lastPickedIndex = -1;
let selectedItemIndex = -1;

// EGYEDI PROMPT ÁLLAPOTOK
let customPromptCallback = null;

// TÖRLÉS ÁLLAPOTOK (Archive)
let deleteTargetIndex = -1;
let deleteStep = 0;
const deleteMessages = [
    "Biztosan törölni szeretnéd ezt a fő elemet az Archívumból?",
    "VIGYÁZAT: Ez egy visszavonhatatlan művelet. Minden al-elem és a teljes hierarchia elvész. Biztosan folytatod?",
    "UTOLSÓ ESÉLY! Ha most rányomsz, az elem végleg megsemmisül. Tényleg törlöd?"
];

// ARCHIVE MODAL ÁLLAPOTOK
let currentArchiveItem = null; 
let isEditingArchive = false;
let editingArchiveIndex = -1;
let targetTreePath = ''; 

// --- AUTH & SYNC ---
getRedirectResult(auth)
    .then((result) => {
        if (result?.user) {
            console.log("Redirect login successful");
        }
    })
    .catch((error) => {
        console.error("Auth Error:", error);
        alert("Login Error: " + error.message);
    });

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

document.getElementById('login-btn').onclick = () => signInWithRedirect(auth, provider);
document.getElementById('logout-btn').onclick = () => signOut(auth);

async function loadUserData() {
    const docRef = doc(db, "users", currentUser.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        userData = docSnap.data();
        if (!userData.archive) userData.archive = []; 
    } else {
        userData = { toWatch: [], watched: [], archive: [] };
    }
    render();
}

async function sync() {
    if (currentUser) {
        await setDoc(doc(db, "users", currentUser.uid), userData);
        render();
    }
}

// --- EGYEDI PROMPT LOGIKA ---
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
    if (currentTab === 'archive') {
        openArchiveModal(); 
        return;
    }

    openCustomPrompt("Új anime hozzáadása:", "", (val) => {
        if (!val || val.trim() === '') return;
        const finalVal = val.trim();
        
        const isDup = userData.toWatch.some(i => i.toLowerCase() === finalVal.toLowerCase()) || 
                      userData.watched.some(i => i.name.toLowerCase() === finalVal.toLowerCase());
        
        if (isDup) {
            setTimeout(() => {
                openCustomPrompt("Hiba", "Ez már szerepel valamelyik listádban!", () => {}); 
            }, 50);
            return;
        }
        
        if (currentTab === 'toWatch') {
            userData.toWatch.unshift(finalVal);
        } else {
            userData.watched.unshift({ name: finalVal, time: new Date().toLocaleString() });
        }
        
        document.getElementById('searchInput').value = ''; 
        sync();
    });
};

document.getElementById('searchInput').addEventListener('input', function () {
    render(); 
});

document.getElementById('searchInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault(); 
    }
});

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
    if (userData.toWatch.length === 0) {
        openCustomPrompt("Hiba", "A To Watch lista üres!", () => {});
        return;
    }
    let randomIndex;
    do {
        randomIndex = Math.floor(Math.random() * userData.toWatch.length);
    } while (randomIndex === lastPickedIndex && userData.toWatch.length > 1);
    
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

// --- OPCIÓK MODAL (To Watch / Watched) ---
window.openOptions = (index, name) => {
    selectedItemIndex = index;
    document.getElementById('options-title').innerText = name;
    
    const moveBtn = document.getElementById('move-btn');
    moveBtn.innerText = currentTab === 'toWatch' ? '🔄 Áthelyezés Watched-be' : '🔄 Áthelyezés To Watch-ba';
    
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
    });
    closeOptions();
};

window.moveListItem = () => {
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

// --- RENDER (Főképernyő & Search Fix) ---
window.switchTab = (t) => {
    currentTab = t;
    document.getElementById('tabToWatch').classList.toggle('active', t === 'toWatch');
    document.getElementById('tabWatched').classList.toggle('active', t === 'watched');
    document.getElementById('tabArchive').classList.toggle('active', t === 'archive');
    render();
};

window.render = () => {
    const container = document.getElementById('listContainer');
    // Szétszedjük a keresési szöveget szóközök mentén, hogy több tage-t is kezelni tudjunk
    const searchInput = document.getElementById('searchInput').value.toLowerCase();
    const searchTerms = searchInput.split(/\s+/).filter(t => t.length > 0); 
    container.innerHTML = '';
    
    let list = [];
    if (currentTab === 'toWatch') list = userData.toWatch;
    else if (currentTab === 'watched') list = userData.watched;
    else list = userData.archive;
    
    document.getElementById('countTW').innerText = userData.toWatch.length;
    document.getElementById('countW').innerText = userData.watched.length;
    document.getElementById('countA').innerText = userData.archive ? userData.archive.length : 0;

    list.forEach((item, index) => {
        const name = currentTab === 'toWatch' ? item : item.name;
        
        // Összerakjuk a kereshető szöveget a névből és a tagekből
        let searchableText = name.toLowerCase();
        if (currentTab === 'archive') {
            searchableText += ` #${item.type.toLowerCase()} ${item.status ? item.status.toLowerCase() : ''}`;
        }

        // Akkor jelenítjük meg, ha a keresőbe írt MINDEN szó/tag szerepel a fenti szövegben
        const matchesSearch = searchTerms.length === 0 || searchTerms.every(term => searchableText.includes(term));

        if (matchesSearch) {
            const div = document.createElement('div');
            div.className = 'list-item';
            const safeName = name.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            
            if (currentTab === 'archive') {
                // Generáljuk a státusz taget (a '#' jelet levágjuk a CSS classhoz)
                const statusClass = item.status ? item.status.replace('#', '') : 'ended';
                const statusTag = item.status ? `<span class="hashtag tag-${statusClass}">${item.status}</span>` : '';
                
                div.innerHTML = `
                    <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; padding-right: 10px; display: flex; align-items: center; flex-wrap: wrap; gap: 5px;">
                        <strong>${name}</strong>
                        <span class="hashtag">#${item.type}</span>
                        ${statusTag}
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn-icon" style="color: var(--accent);" onclick="openArchiveModal(${index})">✎</button>
                        <button class="btn-icon" onclick="startDelete(${index})">🗑️</button>
                    </div>
                `;
            } else {
                div.innerHTML = `
                    <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; padding-right: 10px;">
                        <strong>${name}</strong>
                        ${currentTab === 'watched' ? `<br><small style="color: #94a3b8;">${item.time}</small>` : ''}
                    </div>
                    <button class="btn-options" onclick="openOptions(${index}, '${safeName}')">⋮</button>
                `;
            }
            container.appendChild(div);
        }
    });
};

// --- ARCHIVE: 3-LÉPCSŐS TÖRLÉS ---
window.startDelete = (index) => {
    deleteTargetIndex = index;
    deleteStep = 0;
    updateDeleteModal();
    document.getElementById('delete-modal').style.display = 'flex';
};

window.updateDeleteModal = () => {
    document.getElementById('delete-msg').innerText = deleteMessages[deleteStep];
    const btn = document.getElementById('btn-confirm-delete');
    if (deleteStep === 2) {
        btn.innerText = "VÉGLEGES TÖRLÉS";
        btn.style.boxShadow = "0 0 15px var(--danger)";
    } else {
        btn.innerText = "Tovább";
        btn.style.boxShadow = "none";
    }
};

window.processDeleteStep = () => {
    deleteStep++;
    if (deleteStep < 3) {
        updateDeleteModal();
    } else {
        userData.archive.splice(deleteTargetIndex, 1);
        sync();
        cancelDelete();
    }
};

window.cancelDelete = () => {
    document.getElementById('delete-modal').style.display = 'none';
    deleteTargetIndex = -1;
    deleteStep = 0;
};

// --- ARCHIVE: ADD / EDIT MODAL ---
window.switchArchTab = (num) => {
    document.getElementById('archTab1').classList.toggle('active', num === 1);
    document.getElementById('archTab2').classList.toggle('active', num === 2);
    document.getElementById('arch-tab1-content').style.display = num === 1 ? 'block' : 'none';
    document.getElementById('arch-tab2-content').style.display = num === 2 ? 'block' : 'none';
};

// HELPER: Sets all tree nodes to collapsed by default
function collapseAllNodes(nodes) {
    if (!nodes) return;
    nodes.forEach(node => {
        node.isExpanded = false;
        if (node.children) collapseAllNodes(node.children);
    });
}

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
        if(!currentArchiveItem.sequel) currentArchiveItem.sequel = []; // <--- EZ AZ ÚJ SOR
        if(!currentArchiveItem.hierarchy) currentArchiveItem.hierarchy = [];
        if(!currentArchiveItem.status) currentArchiveItem.status = '#ended'; 
    }

    document.getElementById('arch-name').value = currentArchiveItem.name;
    document.getElementById('arch-type').value = currentArchiveItem.type;
    document.getElementById('arch-status').value = currentArchiveItem.status;
    
    renderArchSubItems();
    renderTree(); 
    document.getElementById('archive-modal').style.display = 'flex';
};
window.closeArchiveModal = () => {
    document.getElementById('archive-modal').style.display = 'none';
    currentArchiveItem = null;
};

window.saveArchiveItem = () => {
    const name = document.getElementById('arch-name').value.trim();
    if (!name) return openCustomPrompt("Hiba", "A cím nem lehet üres!", () => {});

    currentArchiveItem.name = name;
    currentArchiveItem.type = document.getElementById('arch-type').value;
    currentArchiveItem.status = document.getElementById('arch-status').value;

    if (isEditingArchive) userData.archive[editingArchiveIndex] = currentArchiveItem;
    else userData.archive.unshift(currentArchiveItem);

    sync();
    closeArchiveModal();
};

window.renderArchSubItems = () => {
    // Itt adtuk hozzá a 'sequel'-t a listához
    const categories = ['manga', 'ova', 'movie', 'sequel']; 
    categories.forEach(cat => {
        const container = document.getElementById(`arch-${cat}-list`);
        container.innerHTML = '';
        currentArchiveItem[cat].forEach((subName, i) => {
            const div = document.createElement('div');
            div.className = 'sub-item';
            div.innerHTML = `
                <span title="Dupla kattintás a szerkesztéshez">${subName}</span>
                <button class="btn-icon" onclick="deleteArchSubItem('${cat}', ${i})">🗑️</button>
            `;
            div.querySelector('span').ondblclick = () => {
                openCustomPrompt(`${cat.toUpperCase()} elem szerkesztése:`, subName, (newVal) => {
                    if (newVal && newVal.trim() !== '') {
                        currentArchiveItem[cat][i] = newVal.trim();
                        renderArchSubItems();
                    }
                });
            };
            container.appendChild(div);
        });
    });
};

window.openSubItemPrompt = (category) => {
    openCustomPrompt(`${category.toUpperCase()} hozzáadása:`, "", (val) => {
        if (val && val.trim() !== '') {
            currentArchiveItem[category].push(val.trim());
            renderArchSubItems();
        }
    });
};

window.deleteArchSubItem = (category, index) => {
    currentArchiveItem[category].splice(index, 1);
    renderArchSubItems();
};

// --- ARCHIVE: 2. FÜL LOGIKA (HIERARCHIA - COLLAPSIBLE TREE) ---
function getParentArrayAndIndex(pathStr) {
    if (pathStr === '') return { parentArray: currentArchiveItem.hierarchy, index: null };
    const parts = pathStr.split(',').map(Number);
    const index = parts.pop();
    let curr = currentArchiveItem.hierarchy;
    for (let i = 0; i < parts.length; i++) {
        curr = curr[parts[i]].children;
    }
    return { parentArray: curr, index: index };
}

// TOGGLE FUNCTION: Flips node open/closed
window.toggleTreeNode = (pathStr) => {
    const { parentArray, index } = getParentArrayAndIndex(pathStr);
    const node = parentArray[index];
    node.isExpanded = !node.isExpanded;
    renderTree();
};

window.renderTree = (container = document.getElementById('tree-container'), nodes = currentArchiveItem.hierarchy, path = []) => {
    container.innerHTML = '';
    if (nodes.length === 0 && path.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; font-size: 13px;">A hierarchia üres. Adj hozzá egy Fő elemet!</p>';
        return;
    }

    nodes.forEach((node, idx) => {
        const currentPath = [...path, idx];
        const pathStr = currentPath.join(',');
        
        const div = document.createElement('div');
        div.className = 'tree-node';

        let innerHTML = '';
        
        // COLLAPSE/EXPAND LOGIC
        const isLeafType = (node.type === 'Episodes'); // Episodes don't have children
        let toggleBtn = '';
        if (!isLeafType) {
            const icon = node.isExpanded ? '▼' : '▶';
            toggleBtn = `<button class="btn-icon" style="margin-right: 5px; font-size: 12px; width: 20px; padding: 0;" onclick="toggleTreeNode('${pathStr}')">${icon}</button>`;
        }

        if (node.type === 'Episodes') {
            innerHTML = `${toggleBtn}<span class="tree-text" title="Kattints duplán a szerkesztéshez" ondblclick="editTreeNode('${pathStr}')">📺 Epizódok: <strong style="color:var(--accent);">${node.value}</strong></span>`;
        } else {
            innerHTML = `${toggleBtn}<span class="tree-text" title="Kattints duplán a szerkesztéshez" ondblclick="editTreeNode('${pathStr}')">📂 ${node.type}: <strong style="color:var(--text);">${node.name}</strong></span>`;
        }

        innerHTML += `<div class="tree-actions">`;
        if (!isLeafType) {
            innerHTML += `<button class="btn-icon" onclick="openTreeNodeSelector('${pathStr}')">➕</button>`;
        }
        innerHTML += `<button class="btn-icon" onclick="deleteTreeNode('${pathStr}')">🗑️</button></div>`;

        const headerDiv = document.createElement('div');
        headerDiv.className = 'tree-header';
        // Add a little padding if it's a leaf to align it with folders that have toggle arrows
        if(isLeafType) headerDiv.style.paddingLeft = '25px'; 
        headerDiv.innerHTML = innerHTML;
        div.appendChild(headerDiv);

        if (node.children && node.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children';
            
            // Apply expanded/collapsed view
            if (!node.isExpanded) {
                childrenContainer.style.display = 'none';
            } else {
                childrenContainer.style.display = 'block';
                // Slight indent to show hierarchy structure visually
                childrenContainer.style.paddingLeft = '10px';
                childrenContainer.style.borderLeft = '1px dashed #475569';
                childrenContainer.style.marginLeft = '12px';
            }
            
            renderTree(childrenContainer, node.children, currentPath);
            div.appendChild(childrenContainer);
        }
        container.appendChild(div);
    });
};

window.openTreeNodeSelector = (pathStr) => {
    targetTreePath = pathStr;
    document.getElementById('tree-node-selector-modal').style.display = 'flex';
};
window.closeTreeNodeSelector = () => {
    document.getElementById('tree-node-selector-modal').style.display = 'none';
};

window.addTreeNode = (type) => {
    closeTreeNodeSelector();
    const promptTitle = type === 'Episodes' ? 'Epizód Number vagy Range (pl. 1 vagy 1-12):' : `${type} neve:`;
    
    openCustomPrompt(promptTitle, "", (val) => {
        if (val && val.trim() !== '') {
            const newNode = type === 'Episodes' 
                ? { type: type, value: val.trim() } 
                : { type: type, name: val.trim(), children: [], isExpanded: true }; // NEW: Folders start open
            
            if (targetTreePath === '') {
                currentArchiveItem.hierarchy.push(newNode);
            } else {
                const { parentArray, index } = getParentArrayAndIndex(targetTreePath);
                parentArray[index].children.push(newNode);
                parentArray[index].isExpanded = true; // NEW: Auto-open parent when adding!
            }
            renderTree();
        }
    });
};

window.editTreeNode = (pathStr) => {
    const { parentArray, index } = getParentArrayAndIndex(pathStr);
    const node = parentArray[index];
    
    const isLeafType = (node.type === 'Episodes' || node.type === 'Movie');
    const promptTitle = isLeafType ? `${node.type} módosítása:` : `${node.type} nevének módosítása:`;
    const oldVal = isLeafType ? node.value : node.name;

    openCustomPrompt(promptTitle, oldVal, (newVal) => {
        if (newVal && newVal.trim() !== '') {
            if (isLeafType) node.value = newVal.trim();
            else node.name = newVal.trim();
            renderTree();
        }
    });
};

window.deleteTreeNode = (pathStr) => {
    const { parentArray, index } = getParentArrayAndIndex(pathStr);
    parentArray.splice(index, 1);
    renderTree();
};

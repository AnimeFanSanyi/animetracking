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
    'Chapter':     { color: '#d97706' }  // Amber (Leaf)
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

// --- CUSTOM PROMPT (A megse gombok miatt fontos, hogy rendben legyen) ---
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
    
    let list = currentTab === 'toWatch' ? userData.toWatch : (currentTab === 'watched' ? userData.watched : userData.archive);
    
    document.getElementById('countTW').innerText = userData.toWatch.length;
    document.getElementById('countW').innerText = userData.watched.length;
    document.getElementById('countA').innerText = userData.archive ? userData.archive.length : 0;

    list.forEach((item, index) => {
        const name = currentTab === 'toWatch' ? item : item.name;
        
        let searchableText = name.toLowerCase();
        if (currentTab === 'archive') searchableText += ` #${item.type.toLowerCase()} ${item.status ? item.status.toLowerCase() : ''}`;

        if (searchTerms.length === 0 || searchTerms.every(term => searchableText.includes(term))) {
            const div = document.createElement('div');
            div.className = 'list-item';
            const safeName = name.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            
            if (currentTab === 'archive') {
                const statusClass = item.status ? item.status.replace('#', '') : 'ended';
                div.innerHTML = `
                    <div style="flex: 1; display: flex; align-items: center; flex-wrap: wrap; gap: 5px;">
                        <strong>${name}</strong>
                        <span class="hashtag">#${item.type}</span>
                        <span class="hashtag tag-${statusClass}">${item.status || '#ended'}</span>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn-icon" style="color: var(--accent);" onclick="openArchiveModal(${index})">✎</button>
                        <button class="btn-icon" onclick="startDelete(${index})">🗑️</button>
                    </div>
                `;
            } else {
                div.innerHTML = `
                    <div style="flex: 1;">
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
    if (deleteStep < 3) updateDeleteModal();
    else {
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
                openCustomPrompt(`${cat.toUpperCase()} szerkesztése:`, subName, (newVal) => {
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

// --- ARCHIVE: 2. FÜL LOGIKA (HIERARCHIA - BAL OLDALI SZÍNES ÁRNYÉKKAL) ---
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

window.toggleTreeNode = (pathStr) => {
    const { parentArray, index } = getParentArrayAndIndex(pathStr);
    parentArray[index].isExpanded = !parentArray[index].isExpanded;
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
        
        const config = NODE_CONFIG[node.type] || { color: '#94a3b8' }; // Ha nincs a listában, kap egy szürkét
        const isLeaf = (node.type === 'Episodes' || node.type === 'Movie' || node.type === 'Chapter');

        const div = document.createElement('div');
        div.className = 'tree-node';

        let toggleBtn = isLeaf ? '<span style="width:23px; display:inline-block;"></span>' : 
            `<button class="btn-icon tree-toggle" style="margin-right: 5px; font-size: 12px; width: 20px; padding: 0; color: var(--accent);" onclick="toggleTreeNode('${pathStr}')">${node.isExpanded ? '▼' : '▶'}</button>`;

        let displayHTML = '';
        if (node.type === 'Episodes') displayHTML = `📺 Epizódok: <strong style="color:white;">${node.value}</strong>`;
        else if (node.type === 'Movie') displayHTML = `🎬 Movie: <strong style="color:white;">${node.value}</strong>`;
        else if (node.type === 'Chapter') displayHTML = `📄 Chapter: <strong style="color:white;">${node.value}</strong>`;
        else displayHTML = `📂 ${node.type}: <strong style="color:white;">${node.name}</strong>`;

        let actionsHTML = `<div class="tree-actions">`;
        if (!isLeaf) {
            actionsHTML += `<button class="btn-icon" style="color: ${config.color}; font-weight: bold;" onclick="openTreeNodeSelector('${pathStr}')">＋</button>`;
        }
        actionsHTML += `<button class="btn-icon" style="color: ${config.color}; font-weight: bold;" onclick="deleteTreeNode('${pathStr}')">✕</button></div>`;

        const headerDiv = document.createElement('div');
        headerDiv.className = 'tree-header';
        
        // ITT VAN A BAL OLDALI ÁRNYÉK ÉS SZEGÉLY LOGIKA
        headerDiv.style.borderLeft = `4px solid ${config.color}`;
        headerDiv.style.boxShadow = `-6px 0px 10px -4px ${config.color}`;
        
        if(isLeaf) headerDiv.style.paddingLeft = '25px'; 
        
        headerDiv.innerHTML = `${toggleBtn}<span class="tree-text" style="color: ${config.color}" ondblclick="editTreeNode('${pathStr}')">${displayHTML}</span>${actionsHTML}`;

        if (path.length === 0) {
            div.classList.add('root-node');
            div.setAttribute('data-root-index', idx);
            addDragListeners(headerDiv, div, idx);
        }

        div.appendChild(headerDiv);

        if (!isLeaf && node.children && node.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children';
            childrenContainer.style.display = node.isExpanded ? 'block' : 'none';
            renderTree(childrenContainer, node.children, currentPath);
            div.appendChild(childrenContainer);
        }
        container.appendChild(div);
    });
};

// --- DRAG ÉS DROP (Teljesen megőrizve a javított változatot) ---
let dragContext = null;

window.addDragListeners = (headerDiv, nodeDiv, idx) => {
    let pressTimer = null;
    let startY = 0; let startX = 0;

    headerDiv.style.touchAction = 'pan-y';

    headerDiv.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        startX = e.clientX; startY = e.clientY;
        pressTimer = setTimeout(() => {
            if (navigator.vibrate) navigator.vibrate(50);
            initDrag(e, nodeDiv, idx);
        }, 500);
    });

    const cancelPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
    const checkMovement = (e) => {
        if (pressTimer && (Math.abs(e.clientY - startY) > 15 || Math.abs(e.clientX - startX) > 15)) cancelPress();
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
    placeholder.className = 'tree-node drag-placeholder';
    placeholder.style.height = `${rect.height}px`;
    element.before(placeholder);

    element.style.position = 'absolute';
    element.style.top = `${rect.top - containerRect.top + container.scrollTop}px`;
    element.style.left = `0px`;
    element.style.width = `100%`;
    element.style.zIndex = '1000';
    element.style.pointerEvents = 'none';
    element.classList.add('dragging');

    dragContext = { element, placeholder, startIndex: index, offsetY: e.clientY - rect.top };
    document.getElementById('archive-modal').querySelector('.modal-content').style.overflow = 'hidden';

    document.addEventListener('pointermove', handleDragMove, {passive: false});
    document.addEventListener('pointerup', handleDragEnd);
    document.addEventListener('pointercancel', handleDragEnd);
};

window.handleDragMove = (e) => {
    if (!dragContext) return;
    e.preventDefault();
    const container = document.getElementById('tree-container');
    const containerRect = container.getBoundingClientRect();
    let y = e.clientY - containerRect.top + container.scrollTop - dragContext.offsetY;
    dragContext.element.style.top = `${y}px`;

    const nodes = Array.from(container.children).filter(c => 
        (c.classList.contains('root-node') || c.classList.contains('drag-placeholder')) && !c.classList.contains('dragging')
    );
    const elemBelow = document.elementFromPoint(containerRect.left + (containerRect.width / 2), e.clientY);

    if (elemBelow) {
        const closestRootNode = elemBelow.closest('.tree-node.root-node');
        if (closestRootNode && closestRootNode !== dragContext.placeholder) {
            const placeholderIdx = nodes.indexOf(dragContext.placeholder);
            const hoverIdx = nodes.indexOf(closestRootNode);
            if (hoverIdx > placeholderIdx) closestRootNode.after(dragContext.placeholder);
            else closestRootNode.before(dragContext.placeholder);
        }
    }
};

window.handleDragEnd = (e) => {
    if (!dragContext) return;
    document.removeEventListener('pointermove', handleDragMove);
    document.removeEventListener('pointerup', handleDragEnd);
    document.removeEventListener('pointercancel', handleDragEnd);
    document.body.style.touchAction = '';
    document.body.style.overflow = '';
    document.removeEventListener('touchmove', window.preventTouchScroll);
    document.getElementById('archive-modal').querySelector('.modal-content').style.overflow = 'auto';

    const container = document.getElementById('tree-container');
    const nodes = Array.from(container.children).filter(c => 
        (c.classList.contains('root-node') || c.classList.contains('drag-placeholder')) && !c.classList.contains('dragging')
    );

    const finalOrderIndices = [];
    nodes.forEach(n => {
        if (n === dragContext.placeholder) finalOrderIndices.push(dragContext.startIndex);
        else if (n.hasAttribute('data-root-index')) finalOrderIndices.push(parseInt(n.getAttribute('data-root-index')));
    });

    currentArchiveItem.hierarchy = finalOrderIndices.map(i => currentArchiveItem.hierarchy[i]);
    dragContext.element.style = '';
    dragContext.element.classList.remove('dragging');
    dragContext.placeholder.remove();
    dragContext = null;
    renderTree();
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
    const isLeaf = (type === 'Episodes' || type === 'Movie' || type === 'Chapter');
    const promptTitle = type === 'Episodes' ? 'Epizód Number vagy Range (pl. 1 vagy 1-12):' : 
                        type === 'Movie' ? 'Film címe:' : 
                        type === 'Chapter' ? 'Chapter Number vagy Range (pl. 1 vagy 1-12):' : `${type} neve:`;
    
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
    const isLeaf = (node.type === 'Episodes' || node.type === 'Movie' || node.type === 'Chapter');
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
    parentArray.splice(index, 1);
    renderTree();
};

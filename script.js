/**
 * Freyer Library - Main Script
 * Handles state management, UI rendering, and user interactions.
 */

// Import Firebase (Modular SDK from CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, signOut, onAuthStateChanged, OAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyDZjpkS6LWHg-Snp5TweDacV2NZ8IJ99jg",
    authDomain: "freyerkonyvtar.firebaseapp.com",
    projectId: "freyerkonyvtar",
    storageBucket: "freyerkonyvtar.firebasestorage.app",
    messagingSenderId: "131738249131",
    appId: "1:131738249131:web:b4611367be8a7279ae14ee",
    measurementId: "G-EEMF28VET7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- State Management ---
const AppState = {
    user: null, // Logged in user
    concepts: [], // Synced from Firestore
    selectedConceptId: null, // Name is still used as ID for UI selection
    view: 'empty', // 'empty', 'detail', 'form'
    isEditing: false,
    originalName: null,
    hasUnsavedChanges: false, // For local edits before saving? In Firestore save is immediate, so mainly for form field changes.
    unsubscribe: null // Firestore listener
};

// --- DOM Elements ---
const Elements = {
    // Auth UI
    loginOverlay: document.getElementById('loginOverlay'),
    loginBtn: document.getElementById('loginBtn'),
    appContainer: document.getElementById('appContainer'),
    userProfile: document.getElementById('userProfile'),
    userName: document.getElementById('userName'),
    logoutBtn: document.getElementById('logoutBtn'),

    // App UI
    csvInput: document.getElementById('csvInput'),
    importBtn: document.getElementById('importBtn'), /* Enabled */
    exportBtn: document.getElementById('exportBtn'), /* Enabled */
    addBtn: document.getElementById('addBtn'),

    searchInput: document.getElementById('searchInput'),
    conceptList: document.getElementById('conceptList'),

    contentPanel: document.getElementById('contentPanel'),
    emptyState: document.getElementById('emptyState'),
    frayerView: document.getElementById('frayerView'),

    // Edit Button
    editBtn: document.getElementById('editBtn'),

    conceptForm: document.getElementById('conceptForm'),

    // View Fields
    viewName: document.getElementById('viewName'),
    viewDefinition: document.getElementById('viewDefinition'),
    viewCharacteristics: document.getElementById('viewCharacteristics'),
    viewExamples: document.getElementById('viewExamples'),
    viewNonExamples: document.getElementById('viewNonExamples'),

    // Form
    form: document.getElementById('form'),
    formTitle: document.querySelector('#conceptForm h2'),
    nameInput: document.getElementById('nameInput'),
    defInput: document.getElementById('defInput'),
    charInput: document.getElementById('charInput'),
    exInput: document.getElementById('exInput'),
    nonExInput: document.getElementById('nonExInput'),
    cancelBtn: document.getElementById('cancelBtn'),
    deleteBtn: document.getElementById('deleteBtn') // New
};

// --- Auth Service ---
function initAuth() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Logged In
            console.log('User logged in:', user.displayName);
            AppState.user = user;

            // UI Switch
            if (Elements.loginOverlay) Elements.loginOverlay.hidden = true;
            if (Elements.appContainer) Elements.appContainer.hidden = false;
            if (Elements.userProfile) Elements.userProfile.hidden = false;
            if (Elements.userName) Elements.userName.textContent = user.displayName || user.email;

            // Load Data
            initDataListener();
        } else {
            // Logged Out
            console.log('User logged out');
            AppState.user = null;

            // UI Switch
            if (Elements.loginOverlay) Elements.loginOverlay.hidden = false;
            if (Elements.appContainer) Elements.appContainer.hidden = true;

            // Cleanup: clear data and unsubscribe
            AppState.concepts = [];
            if (AppState.unsubscribe) {
                AppState.unsubscribe();
                AppState.unsubscribe = null;
            }
        }
    });

    if (Elements.loginBtn) {
        Elements.loginBtn.addEventListener('click', () => {
            const provider = new OAuthProvider('microsoft.com');
            provider.setCustomParameters({
                prompt: 'select_account',
                tenant: 'fb6ed267-0587-4bca-8f76-c672df6eb313'
            });
            signInWithPopup(auth, provider)
                .then((result) => {
                    // Success handled by onAuthStateChanged
                })
                .catch((error) => {
                    console.error('Login error:', error);
                    alert('Hiba a belépés során: ' + error.message);
                });
        });
    }

    if (Elements.logoutBtn) {
        Elements.logoutBtn.addEventListener('click', () => {
            signOut(auth);
        });
    }
}

// --- Data Service (Firestore) ---
function initDataListener() {
    if (!AppState.user) return;

    // Safety check: unsubscribe previous
    if (AppState.unsubscribe) AppState.unsubscribe();

    const userConceptsRef = collection(db, 'users', AppState.user.uid, 'concepts');
    const q = query(userConceptsRef, orderBy('name'));

    console.log('Listening to concepts in Firestore...');
    AppState.unsubscribe = onSnapshot(q, (snapshot) => {
        const concepts = [];
        snapshot.forEach((doc) => {
            concepts.push({ id: doc.id, ...doc.data() });
        });

        AppState.concepts = concepts;
        renderSidebar(Elements.searchInput.value);

        // Restore view state if needed, or handle deletion while viewing
        if (AppState.selectedConceptId) {
            const stillExists = concepts.find(c => c.name === AppState.selectedConceptId);
            if (!stillExists && AppState.view === 'detail') {
                // Concept was deleted remotely
                AppState.view = 'empty';
                updateView();
            } else if (stillExists && AppState.view === 'detail') {
                // Concept updated remotely, refresh view
                updateView();
            }
        }
    }, (error) => {
        console.error("Firestore error:", error);
    });
}

// --- Initialization ---
function init() {
    try {
        console.log('App initializing...');
        initAuth();
        setupEventListeners();
        console.log('App initialized successfully.');
    } catch (err) {
        console.error('Initialization error:', err);
        alert('Hiba történt az alkalmazás indításakor: ' + err.message);
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    Elements.backBtn = document.getElementById('backBtn');

    // Navigation: Add (New)
    if (Elements.addBtn) {
        Elements.addBtn.addEventListener('click', () => {
            startCreate();
        });
    }

    // Navigation: Edit
    if (Elements.editBtn) {
        Elements.editBtn.addEventListener('click', () => {
            startEdit();
        });
    }

    if (Elements.backBtn) {
        Elements.backBtn.addEventListener('click', () => {
            AppState.view = 'empty';
            AppState.selectedConceptId = null;
            AppState.isEditing = false;
            updateView();
            renderSidebar();
        });
    }

    if (Elements.cancelBtn) {
        Elements.cancelBtn.addEventListener('click', () => {
            if (AppState.originalName) {
                AppState.selectedConceptId = AppState.originalName;
                AppState.view = 'detail';
            } else {
                AppState.view = AppState.selectedConceptId ? 'detail' : 'empty';
            }
            AppState.isEditing = false;
            AppState.originalName = null;
            updateView();
        });
    }

    if (Elements.deleteBtn) {
        Elements.deleteBtn.addEventListener('click', handleDelete);
    }

    // Form Submission
    if (Elements.form) {
        Elements.form.addEventListener('submit', handleFormSubmit);
    }

    // Search
    if (Elements.searchInput) {
        Elements.searchInput.addEventListener('input', (e) => {
            renderSidebar(e.target.value);
        });
    }

    // Unload Warning - Only check dirty forms
    // Since saves are now async to DB, "unsaved" mainly applies to open form being edited
    window.addEventListener('beforeunload', (e) => {
        // If form is dirty (we could track dirty state more granulary, 
        // but for now user explicitly saves to DB. 
        // We can just rely on standard behavior or keep hasUnsavedChanges if we want to track 'session' changes.
        // Actually, with Cloud sync, checking if 'unsaved' is tricky. 
        // Let's protect ONLY if user is currently editing a form.
        if (AppState.view === 'form' && (Elements.nameInput.value || Elements.defInput.value)) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // Import/Export
    if (Elements.importBtn && Elements.csvInput) {
        Elements.importBtn.addEventListener('click', () => Elements.csvInput.click());
        Elements.csvInput.addEventListener('change', handleCSVImport);
    }
    if (Elements.exportBtn) {
        Elements.exportBtn.addEventListener('click', handleCSVExport);
    }
}

// --- Logic functions ---

function startCreate() {
    AppState.view = 'form';
    AppState.isEditing = false;
    AppState.originalName = null;

    if (Elements.form) Elements.form.reset();
    if (Elements.formTitle) Elements.formTitle.textContent = "Új fogalom hozzáadása";
    if (Elements.deleteBtn) Elements.deleteBtn.hidden = true; // No delete in create mode

    updateView();
    renderSidebar();
}

function startEdit() {
    const concept = AppState.concepts.find(c => c.name === AppState.selectedConceptId);
    if (!concept) return;

    AppState.view = 'form';
    AppState.isEditing = true;
    AppState.originalName = concept.name;

    // Pre-fill form
    Elements.nameInput.value = concept.name;
    Elements.defInput.value = concept.definition;
    Elements.charInput.value = concept.characteristics;
    Elements.exInput.value = concept.examples;
    Elements.nonExInput.value = concept.nonExamples;

    if (Elements.deleteBtn) Elements.deleteBtn.hidden = false; // Show delete
    if (Elements.formTitle) Elements.formTitle.textContent = "Fogalom szerkesztése";

    updateView();
}

async function handleDelete() {
    if (!AppState.user || !AppState.isEditing || !AppState.originalName) return;

    if (!confirm(`Biztosan törölni szeretné a(z) "${AppState.originalName}" fogalmat? A művelet nem visszavonható.`)) return;

    try {
        const concept = AppState.concepts.find(c => c.name === AppState.originalName);
        if (concept) {
            const userConceptsRef = collection(db, 'users', AppState.user.uid, 'concepts');
            await deleteDoc(doc(userConceptsRef, concept.id));

            // Reset UI
            AppState.view = 'empty';
            AppState.selectedConceptId = null;
            AppState.isEditing = false;
            AppState.originalName = null;
            updateView();
        }
    } catch (err) {
        console.error("Delete error:", err);
        alert("Hiba a törlés során: " + err.message);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    if (!AppState.user) return;

    const newConcept = {
        name: Elements.nameInput.value.trim(),
        definition: Elements.defInput.value.trim(),
        characteristics: Elements.charInput.value.trim(),
        examples: Elements.exInput.value.trim(),
        nonExamples: Elements.nonExInput.value.trim(),
        updatedAt: new Date()
    };

    const userConceptsRef = collection(db, 'users', AppState.user.uid, 'concepts');

    try {
        if (AppState.isEditing) {
            // EDIT MODE
            const originalDoc = AppState.concepts.find(c => c.name === AppState.originalName);
            if (!originalDoc) {
                alert("Hiba: Nem található az eredeti dokumentum.");
                return;
            }

            // Rename check
            if (newConcept.name !== AppState.originalName) {
                const collision = AppState.concepts.find(c => c.name.toLowerCase() === newConcept.name.toLowerCase());
                if (collision) {
                    if (!confirm(`A(z) "${newConcept.name}" nevű fogalom már létezik. Felülírja?`)) return;
                    await deleteDoc(doc(userConceptsRef, collision.id));
                }
            }
            await updateDoc(doc(userConceptsRef, originalDoc.id), newConcept);

        } else {
            // CREATE MODE
            const collision = AppState.concepts.find(c => c.name.toLowerCase() === newConcept.name.toLowerCase());
            if (collision) {
                if (!confirm(`A(z) "${newConcept.name}" nevű fogalom már létezik. Felülírja?`)) return;
                await updateDoc(doc(userConceptsRef, collision.id), newConcept);
            } else {
                newConcept.createdAt = new Date();
                await addDoc(userConceptsRef, newConcept);
            }
        }

        // Reset View
        AppState.selectedConceptId = newConcept.name;
        AppState.view = 'detail';
        AppState.isEditing = false;
        AppState.originalName = null;
        updateView();

    } catch (err) {
        console.error("Save error:", err);
        alert("Hiba a mentés során: " + err.message);
    }
}

// --- Import/Export (Cloud Version) ---
function handleCSVImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        confirmAndUploadCSV(event.target.result);
    };
    reader.readAsText(file, 'UTF-8');
    Elements.csvInput.value = ''; // Reset
}

async function confirmAndUploadCSV(csvText) {
    if (!AppState.user) return;

    if (!confirm("Az importálás feltölti az adatokat a felhőbe. A már létező azonos nevű fogalmakat kihagyja. Folytatja?")) return;

    const list = parseCSV(csvText);
    if (list.length === 0) {
        alert("Nem találtam adatokat a fájlban.");
        return;
    }

    const userConceptsRef = collection(db, 'users', AppState.user.uid, 'concepts');
    let addedCount = 0;
    let skippedCount = 0;

    // Batching (optional but good, though Firestore batch limit is 500. We'll do serial for simplicity to check duplicates easily against local state)
    // Actually we can check local AppState.concepts for duplicates instantly before firing network requests.

    for (const concept of list) {
        const exists = AppState.concepts.find(c => c.name.toLowerCase() === concept.name.toLowerCase());
        if (!exists) {
            try {
                await addDoc(userConceptsRef, { ...concept, createdAt: new Date() });
                addedCount++;
            } catch (e) {
                console.error("Upload error for", concept.name, e);
            }
        } else {
            skippedCount++;
        }
    }

    alert(`Feltöltés kész!\nSikeresen hozzáadva: ${addedCount}\nKihagyva (már létezett): ${skippedCount}`);
}

function parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    if (lines.length === 0) return [];

    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';
    const startIndex = firstLine.toLowerCase().includes('név') ? 1 : 0;
    const results = [];

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = parseLine(line, delimiter);

        if (parts.length >= 2) {
            results.push({
                name: parts[0] ? parts[0].trim() : "Névtelen",
                definition: parts[1] ? parts[1].trim() : "",
                characteristics: parts[2] ? parts[2].trim() : "",
                examples: parts[3] ? parts[3].trim() : "",
                nonExamples: parts[4] ? parts[4].trim() : ""
            });
        }
    }
    return results;
}

function parseLine(text, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === delimiter) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
    }
    result.push(current);
    return result;
}

function handleCSVExport() {
    // Export data from loaded State (which is synced from Cloud)
    if (AppState.concepts.length === 0) {
        alert("Nincs mit exportálni.");
        return;
    }

    let csvContent = "\uFEFF";
    csvContent += "Név;Meghatározás;Jellemzők;Példák;Ellenpéldák\n";

    AppState.concepts.forEach(c => {
        const row = [
            c.name,
            c.definition,
            c.characteristics,
            c.examples,
            c.nonExamples
        ].map(field => {
            if (field.includes(';') || field.includes('\n')) {
                return `"${field.replace(/"/g, '""')}"`;
            }
            return field || "";
        }).join(';');

        csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "freyer_konyvtar_felho.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// --- Rendering ---
// (Unchanged logic, just different data source which is managed by state)

function renderSidebar(filterText = '') {
    Elements.conceptList.innerHTML = '';
    const filter = filterText.toLowerCase();

    // Sort logic handled locally for display
    const sorted = [...AppState.concepts].sort((a, b) => a.name.localeCompare(b.name, 'hu'));

    sorted.forEach(concept => {
        if (concept.name.toLowerCase().includes(filter)) {
            const li = document.createElement('li');
            li.className = 'concept-item';
            li.textContent = concept.name;

            if (concept.name === AppState.selectedConceptId) {
                li.classList.add('active');
            }

            li.addEventListener('click', () => {
                AppState.selectedConceptId = concept.name;
                AppState.view = 'detail';
                AppState.isEditing = false;
                updateView();
                renderSidebar(filterText);
            });

            Elements.conceptList.appendChild(li);
        }
    });
}

function updateView() {
    hideElement(Elements.emptyState);
    hideElement(Elements.frayerView);
    hideElement(Elements.conceptForm);

    const mainContent = document.querySelector('.main-content');
    let isDetailMode = false;

    if (AppState.view === 'empty') {
        showElement(Elements.emptyState);
        isDetailMode = false;
    } else if (AppState.view === 'form') {
        showElement(Elements.conceptForm);
        isDetailMode = true;
    } else if (AppState.view === 'detail') {
        const concept = AppState.concepts.find(c => c.name === AppState.selectedConceptId);
        if (concept) {
            Elements.viewName.textContent = concept.name;
            Elements.viewDefinition.textContent = concept.definition;
            Elements.viewCharacteristics.textContent = concept.characteristics;
            Elements.viewExamples.textContent = concept.examples;
            Elements.viewNonExamples.textContent = concept.nonExamples;
            showElement(Elements.frayerView);
            isDetailMode = true;
        } else {
            AppState.view = 'empty';
            showElement(Elements.emptyState);
            isDetailMode = false;
        }
    }

    if (isDetailMode) {
        mainContent.classList.add('mobile-detail-active');
        if (Elements.backBtn) showElement(Elements.backBtn);
    } else {
        mainContent.classList.remove('mobile-detail-active');
        if (Elements.backBtn) hideElement(Elements.backBtn);
    }
}

function hideElement(el) {
    if (el) {
        el.hidden = true;
        el.style.display = 'none';
    }
}

function showElement(el) {
    if (el) {
        el.hidden = false;
        el.style.display = ''; // Revert to stylesheet default (flex/block/grid)
    }
}

// Start
init();

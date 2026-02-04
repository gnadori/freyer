/**
 * Freyer Library - Main Script
 * Handles state management, UI rendering, and user interactions.
 */

// --- State Management ---
const AppState = {
    concepts: [],
    selectedConceptId: null, // We'll use the Name as ID for simplicity
    view: 'empty', // 'empty', 'detail', 'form'
    isEditing: false, // Track if we are editing an existing concept
    originalName: null // Track original name during edit to handle renames
};

// --- DOM Elements ---
const Elements = {
    csvInput: document.getElementById('csvInput'),
    importBtn: document.getElementById('importBtn'),
    exportBtn: document.getElementById('exportBtn'),
    addBtn: document.getElementById('addBtn'),

    searchInput: document.getElementById('searchInput'),
    conceptList: document.getElementById('conceptList'),

    contentPanel: document.getElementById('contentPanel'),
    emptyState: document.getElementById('emptyState'),
    frayerView: document.getElementById('frayerView'),

    // Edit Button (New)
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
    formTitle: document.querySelector('#conceptForm h2'), // To change title to "Szerkesztés"
    nameInput: document.getElementById('nameInput'),
    defInput: document.getElementById('defInput'),
    charInput: document.getElementById('charInput'),
    exInput: document.getElementById('exInput'),
    nonExInput: document.getElementById('nonExInput'),
    cancelBtn: document.getElementById('cancelBtn')
};

// --- Initialization ---
function init() {
    try {
        console.log('App initializing...');
        setupEventListeners();
        renderSidebar();
        updateView();
        console.log('App initialized successfully.');
    } catch (err) {
        console.error('Initialization error:', err);
        alert('Hiba történt az alkalmazás indításakor: ' + err.message);
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    Elements.backBtn = document.getElementById('backBtn');

    // Check elements
    if (!Elements.backBtn) console.error('Back button not found');
    if (!Elements.csvInput) console.error('CSV Input not found');

    // Navigation: Add (New)
    if (Elements.addBtn) {
        Elements.addBtn.addEventListener('click', () => {
            console.log('Add button clicked');
            startCreate();
        });
    }

    // Navigation: Edit
    if (Elements.editBtn) {
        Elements.editBtn.addEventListener('click', () => {
            console.log('Edit button clicked');
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

});

if (Elements.cancelBtn) {
    Elements.cancelBtn.addEventListener('click', () => {
        // If we were editing, go back to detail. If new, go back to empty/list
        if (AppState.originalName) {
            // Cancel edit -> go back to viewing that concept
            AppState.selectedConceptId = AppState.originalName;
            AppState.view = 'detail';
        } else {
            // Cancel create -> go back to what we had (or empty)
            AppState.view = AppState.selectedConceptId ? 'detail' : 'empty';
        }
        AppState.isEditing = false;
        AppState.originalName = null;
        updateView();
    });
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

    updateView();
    renderSidebar(); // clear highlight
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

    if (Elements.formTitle) Elements.formTitle.textContent = "Fogalom szerkesztése";

    updateView();
}

function handleFormSubmit(e) {
    e.preventDefault();

    const newConcept = {
        name: Elements.nameInput.value.trim(),
        definition: Elements.defInput.value.trim(),
        characteristics: Elements.charInput.value.trim(),
        examples: Elements.exInput.value.trim(),
        nonExamples: Elements.nonExInput.value.trim()
    };

    // If editing and name changed, check collision
    const nameChanged = AppState.isEditing && (newConcept.name.toLowerCase() !== AppState.originalName.toLowerCase());

    // Check if distinct (ignoring self if editing)
    const existingIndex = AppState.concepts.findIndex(c => c.name.toLowerCase() === newConcept.name.toLowerCase());

    if (existingIndex >= 0) {
        // Collision found
        const isSelf = AppState.isEditing && (AppState.concepts[existingIndex].name.toLowerCase() === AppState.originalName.toLowerCase());

        if (!isSelf) {
            // Collides with ANOTHER concept
            if (!confirm(`A(z) "${newConcept.name}" nevű fogalom már létezik. Felülírja?`)) {
                return;
            }
            // Overwrite strategy: remove the old one (existingIndex) and we'll push/update later?
            // Actually simplest is: if collision, we update the existing one.
            // If we were editing A and renamed to B (which exists), we essentially merge A into B? 
            // Or just overwrite B with A's new data.
            // And we must remove A.
        }
    }

    if (AppState.isEditing) {
        // Find the original and update it
        // Or simpler: Remove original, then push new (handling collisions implies overwrite)

        // 1. Remove original
        const originalIndex = AppState.concepts.findIndex(c => c.name === AppState.originalName);
        if (originalIndex !== -1) {
            AppState.concepts.splice(originalIndex, 1);
        }

        // 2. Remove any collision target (if we renamed to an existing name)
        const collisionIndex = AppState.concepts.findIndex(c => c.name.toLowerCase() === newConcept.name.toLowerCase());
        if (collisionIndex !== -1) {
            AppState.concepts.splice(collisionIndex, 1);
        }

        // 3. Add new
        AppState.concepts.push(newConcept);

    } else {
        // New Create
        if (existingIndex >= 0) {
            // Overwrite existing
            AppState.concepts[existingIndex] = newConcept;
        } else {
            AppState.concepts.push(newConcept);
        }
    }

    // Sort
    sortConcepts();

    // Select and View
    AppState.selectedConceptId = newConcept.name;
    AppState.view = 'detail';
    AppState.isEditing = false;
    AppState.originalName = null;

    renderSidebar();
    updateView();
}

function sortConcepts() {
    AppState.concepts.sort((a, b) => a.name.localeCompare(b.name, 'hu'));
}

// --- Import/Export ---
function handleCSVImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        const text = event.target.result;
        parseCSV(text);
    };
    reader.readAsText(file, 'UTF-8');
    Elements.csvInput.value = ''; // Reset
}

function parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    if (lines.length === 0) return;

    // Detect delimiter from the first line (header)
    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';

    let count = 0;
    // Skip header if likely present
    const startIndex = firstLine.toLowerCase().includes('név') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple manual parser logic reused
        const parts = parseLine(line, delimiter);

        if (parts.length >= 2) {
            const concept = {
                name: parts[0] ? parts[0].trim() : "Névtelen",
                definition: parts[1] ? parts[1].trim() : "",
                characteristics: parts[2] ? parts[2].trim() : "",
                examples: parts[3] ? parts[3].trim() : "",
                nonExamples: parts[4] ? parts[4].trim() : ""
            };

            const existing = AppState.concepts.find(c => c.name.toLowerCase() === concept.name.toLowerCase());
            if (!existing) {
                AppState.concepts.push(concept);
                count++;
            }
        }
    }

    if (count > 0) {
        sortConcepts();
        renderSidebar();
        alert(`${count} fogalom sikeresen importálva.`);
    } else {
        alert("Nem sikerült új fogalmakat beolvasni.");
    }
}

// Helper to parse a single CSV line
function parseLine(text, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    // Double quote escape
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
    if (AppState.concepts.length === 0) {
        alert("Nincs mit exportálni.");
        return;
    }

    // BOM for Excel UTF-8 compatibility
    let csvContent = "\uFEFF";
    csvContent += "Név;Meghatározás;Jellemzők;Példák;Ellenpéldák\n";

    AppState.concepts.forEach(c => {
        // Escape semicolons and newlines in fields
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
            return field;
        }).join(';');

        csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "freyer_konyvtar.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Rendering ---
function renderSidebar(filterText = '') {
    Elements.conceptList.innerHTML = '';
    const filter = filterText.toLowerCase();

    AppState.concepts.forEach(concept => {
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
                renderSidebar(filterText); // Re-render to update active state
            });

            Elements.conceptList.appendChild(li);
        }
    });
}

function updateView() {
    // Explicitly hide using style to override any CSS specificity issues
    hideElement(Elements.emptyState);
    hideElement(Elements.frayerView);
    hideElement(Elements.conceptForm);

    const mainContent = document.querySelector('.main-content');

    // Logic for Mobile Master-Detail
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
            // Plain text viewing
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

    // Toggle Mobile CSS Classes
    if (isDetailMode) {
        mainContent.classList.add('mobile-detail-active');
        if (Elements.backBtn) showElement(Elements.backBtn);
    } else {
        mainContent.classList.remove('mobile-detail-active');
        if (Elements.backBtn) hideElement(Elements.backBtn);
    }
}

// --- Helpers ---
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



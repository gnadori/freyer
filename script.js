/**
 * Freyer Library - Main Script
 * Handles state management, UI rendering, and user interactions.
 */

// --- State Management ---
const AppState = {
    concepts: [],
    selectedConceptId: null, // We'll use the Name as ID for simplicity, or generate UUIDs
    view: 'empty' // 'empty', 'detail', 'form'
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
    conceptForm: document.getElementById('conceptForm'),

    // View Fields
    viewName: document.getElementById('viewName'),
    viewDefinition: document.getElementById('viewDefinition'),
    viewCharacteristics: document.getElementById('viewCharacteristics'),
    viewExamples: document.getElementById('viewExamples'),
    viewNonExamples: document.getElementById('viewNonExamples'),

    // Form
    form: document.getElementById('form'),
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

    // Navigation
    if (Elements.addBtn) {
        Elements.addBtn.addEventListener('click', () => {
            console.log('Add button clicked');
            try {
                AppState.view = 'form';
                AppState.selectedConceptId = null;
                if (Elements.form) Elements.form.reset();
                updateView();
                renderSidebar(); // to clear selection highlight
                console.log('View switched to form');
            } catch (err) {
                console.error('Error handling add button:', err);
            }
        });
    } else {
        console.error('Add button element not found!');
    }

    if (Elements.backBtn) {
        Elements.backBtn.addEventListener('click', () => {
            AppState.view = 'empty'; // "empty" acts as "list" on mobile
            AppState.selectedConceptId = null;
            updateView();
            renderSidebar();
        });
    }

    Elements.cancelBtn.addEventListener('click', () => {
        // If we were editing, go back to detail. If new, go back to empty/list
        AppState.view = AppState.selectedConceptId ? 'detail' : 'empty';
        updateView();
    });

    // Form Submission
    Elements.form.addEventListener('submit', handleFormSubmit);

    // Search
    Elements.searchInput.addEventListener('input', (e) => {
        renderSidebar(e.target.value);
    });

    // Import/Export
    Elements.importBtn.addEventListener('click', () => Elements.csvInput.click());
    Elements.csvInput.addEventListener('change', handleCSVImport);
    Elements.exportBtn.addEventListener('click', handleCSVExport);
}

// --- Logic functions ---

function handleFormSubmit(e) {
    e.preventDefault();

    const newConcept = {
        name: Elements.nameInput.value.trim(),
        definition: Elements.defInput.value.trim(),
        characteristics: Elements.charInput.value.trim(),
        examples: Elements.exInput.value.trim(),
        nonExamples: Elements.nonExInput.value.trim()
    };

    // Check if distinct
    const existingIndex = AppState.concepts.findIndex(c => c.name.toLowerCase() === newConcept.name.toLowerCase());
    if (existingIndex >= 0) {
        if (!confirm(`A(z) "${newConcept.name}" nevű fogalom már létezik. Felülírja?`)) {
            return;
        }
        AppState.concepts[existingIndex] = newConcept;
    } else {
        AppState.concepts.push(newConcept);
    }

    // Sort
    sortConcepts();

    // Select and View
    AppState.selectedConceptId = newConcept.name;
    AppState.view = 'detail';

    renderSidebar();
    updateView();
}

function sortConcepts() {
    AppState.concepts.sort((a, b) => a.name.localeCompare(b.name, 'hu'));
}

// --- Import/Export (Placeholder for next step) ---
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

        // Robust CSV split that handles quoted fields containing the delimiter
        // Match: Quoted string OR non-delimiter characters
        // Note: This regex is a simplified standard implementation
        const regex = new RegExp(`(?:^|${delimiter})(\"(?:[^\"]|\"\")*\"|[^${delimiter}]*)`, 'g');

        let parts = [];
        let match;
        while (match = regex.exec(line)) {
            let val = match[1];
            // Remove leading delimiter from the match group if it wasn't at the start (handled by loop logic usually but regex above captures it)
            // Wait, standard approach:
            if (val.startsWith(delimiter)) {
                val = val.substring(1);
            }

            // The regex above captures the value including the leading delimiter if present in the group logic?
            // Actually, the regex `(?:^|${delimiter})` is a non-capturing group for the start.
            // The capturing group `(\"...\")` is index 1.

            // Let's use a cleaner manual parser for stability with edge cases
            parts.push(val);
        }

        // Alternative: Simple State Machine Parser for better reliability than regex
        parts = parseLine(line, delimiter);

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
            // If field contains ; or \n, wrap in quotes (simplified)
            // Ideally we replace " with ""
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
                updateView();
                renderSidebar(filterText); // Re-render to update active state
            });

            Elements.conceptList.appendChild(li);
        }
    });
}

function updateView() {
    // Hide all panels first
    Elements.emptyState.hidden = true;
    Elements.frayerView.hidden = true;
    Elements.conceptForm.hidden = true;

    const mainContent = document.querySelector('.main-content');
    const isMobile = window.innerWidth <= 768; // Simple check, though CSS is source of truth

    // Logic for Mobile Master-Detail
    // If view is 'detail' or 'form', we are in "Detail Mode" (show content, hide sidebar)
    // If view is 'empty', we are in "List Mode" on mobile (show sidebar, hide content)

    let isDetailMode = false;

    if (AppState.view === 'empty') {
        Elements.emptyState.hidden = false;
        isDetailMode = false;
    } else if (AppState.view === 'form') {
        Elements.conceptForm.hidden = false;
        isDetailMode = true;
    } else if (AppState.view === 'detail') {
        const concept = AppState.concepts.find(c => c.name === AppState.selectedConceptId);
        if (concept) {
            Elements.viewName.textContent = concept.name;
            Elements.viewDefinition.textContent = concept.definition;
            Elements.viewCharacteristics.textContent = concept.characteristics;
            Elements.viewExamples.textContent = concept.examples;
            Elements.viewNonExamples.textContent = concept.nonExamples;
            Elements.frayerView.hidden = false;
            isDetailMode = true;
        } else {
            AppState.view = 'empty';
            Elements.emptyState.hidden = false;
            isDetailMode = false;
        }
    }

    // Toggle Mobile CSS Classes
    if (isDetailMode) {
        mainContent.classList.add('mobile-detail-active');
        // Show back button only on mobile (effectively handled by CSS usually, but we have a hidden attribute)
        if (Elements.backBtn) Elements.backBtn.hidden = false; // logic simplified: show it if in detail mode. CSS can hide it on desktop.
    } else {
        mainContent.classList.remove('mobile-detail-active');
        if (Elements.backBtn) Elements.backBtn.hidden = true;
    }

    // Desktop override: Back button should probably strictly be hidden on desktop via CSS 
    // but the [hidden] attribute overrides CSS display:none usually unless !important.
    // We added [hidden] { display: none !important } in CSS.
    // So to show it, we remove hidden. 
    // To ensure it's hidden on desktop even if we remove [hidden], we need CSS:
    // @media (min-width: 769px) { #backBtn { display: none !important; } }
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

// ── Shared Config & Utility Manager ──────────────────────────────────────────
// Centralized configuration and functions for Maintenance SRAB

// 1. Centralized API Config (Google Apps Script Web App URLs)
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzYPLqS7Xaiyc9Ev5GoMZoOEkndOVXtASyrsqu2n9GvLyusKXa0pKdoxb4FO6vrAUYgkw/exec";
const SPARE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx-s4hRzbMOI54WXJEh1KAJR547qVVF2OWcR0uDFtOQTTJVbHdGZMTgS7FS6Pm3Jmjb/exec";

// 2. Date & Time Parsing & Formatting Helpers
function formatDMY(dateStr) {
    if (!dateStr) return "-";
    const str = String(dateStr).replace(/^'/, '');
    
    // 1. ISO YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }

    // 2. Strict DD/MM/YYYY (handles save format with optional time/seconds)
    const strictDmyMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(.*)$/);
    if (strictDmyMatch) {
        return `${strictDmyMatch[1]}/${strictDmyMatch[2]}/${strictDmyMatch[3]}${strictDmyMatch[4]}`;
    }
    
    // 3. Try Date object (handles legacy M/D/Y data without leading zeros)
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        }
    } catch (e) {}

    // 4. Fallback explicitly to D/M/Y if Date parsing failed (e.g. 30/12/2026)
    const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dmyMatch) {
        let d = dmyMatch[1].padStart(2, '0');
        let m = dmyMatch[2].padStart(2, '0');
        let y = dmyMatch[3];
        if (y.length === 2) y = "20" + y;
        return `${d}/${m}/${y}`;
    }

    return dateStr;
}

function formatTimeOnly(timeStr) {
    if (!timeStr || timeStr === "-") return "-";
    const str = String(timeStr);
    
    // If it's a full ISO string or contains date info, use Date object for local time
    if (str.includes('T') || str.includes('-')) {
        try {
            const d = new Date(str);
            if (!isNaN(d.getTime())) {
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                return `${hours}:${minutes}`;
            }
        } catch (e) {}
    }
    
    // Fallback to simple regex for HH:mm
    const simpleTimeMatch = str.match(/^(\d{1,2}:\d{2})/);
    if (simpleTimeMatch) return simpleTimeMatch[1];
    
    return timeStr;
}

function extractDateOnly(dateStr) {
    if (!dateStr) return "";
    const str = String(dateStr).trim();
    
    // Match dd/MM/yyyy
    const match = str.match(/^'?(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
        return `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]}`;
    }
    
    // ISO YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }
    
    return dateStr;
}

function getBreakdownDateTime(record) {
    if (!record.time) return "-";
    const timeStr = String(record.time);
    
    // If it already contains a date (new entry)
    if (timeStr.includes('/')) {
        return timeStr.startsWith("'") ? timeStr.slice(1) : timeStr;
    }
    
    // Legacy fallback: combine date part and time part
    const dOnly = extractDateOnly(record.date);
    const tOnly = formatTimeOnly(record.time);
    return `${dOnly} ${tOnly}`;
}

function getRecordDateTime(record) {
    if (!record.date) return "-";
    const str = String(record.date);
    return str.startsWith("'") ? str.slice(1) : str;
}

// 3. Robust Time Input Validation & Formatter (Cursor-position safe)
function setupTimeInput(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function(e) {
        const originalValue = e.target.value;
        const originalCursor = e.target.selectionStart;
        
        let digits = originalValue.replace(/\D/g, '');
        let formatted = '';

        if (digits.length > 2) {
            let hh = digits.slice(0, 2);
            let mm = digits.slice(2, 4);
            if (parseInt(hh) > 23) hh = '23';
            if (parseInt(mm) > 59) mm = '59';
            formatted = hh + ":" + mm;
        } else if (digits.length > 0) {
            let hh = digits;
            if (parseInt(hh) > 23) hh = '23';
            formatted = hh;
        }

        if (originalValue !== formatted) {
            e.target.value = formatted;
            // Adjust cursor position so editing doesn't jump
            let newCursor = originalCursor;
            if (formatted.length > originalValue.length && originalCursor === 3) {
                newCursor = 4;
            } else if (formatted.length < originalValue.length && originalCursor === 3) {
                newCursor = 2;
            }
            e.target.setSelectionRange(newCursor, newCursor);
        }
    });
}

// 4. Centralized Data Syncing & Cache Operations
async function fetchBreakdowns() {
    const response = await fetch(SCRIPT_URL);
    const googleData = await response.json();
    
    if (googleData && Array.isArray(googleData)) {
        return googleData
            .map((row, originalIndex) => ({
                date: row[0],
                line: row[1],
                machineId: row[2],
                caseCount: 1,
                time: row[3],
                finishDate: row[4],
                finishTime: row[5],
                duration: row[6],
                department: row[7],
                factory: row[8],
                problem: row[9],
                solution: row[10],
                sparePart: row[11],
                sevenMean: row[12],
                sheetName: row[13] || "",
                sheetRow: row[14] || (originalIndex + 1),
                id: originalIndex
            }))
            .filter((r, idx) => {
                const isHeader = String(r.date).includes("วันที่") || String(r.machineId).includes("เครื่องจักร");
                return idx > 0 && r.date && r.machineId && !isHeader;
            });
    }
    throw new Error("Invalid response received from Google Sheets API");
}

async function fetchAndCacheBreakdowns() {
    const data = await fetchBreakdowns();
    localStorage.setItem("breakdowns", JSON.stringify(data));
    return data;
}

// 5. Expose properties on window global object (supporting file:// direct access)
window.SCRIPT_URL = SCRIPT_URL;
window.SPARE_SCRIPT_URL = SPARE_SCRIPT_URL;
window.formatDMY = formatDMY;
window.formatTimeOnly = formatTimeOnly;
window.extractDateOnly = extractDateOnly;
window.getBreakdownDateTime = getBreakdownDateTime;
window.getRecordDateTime = getRecordDateTime;
window.setupTimeInput = setupTimeInput;
window.fetchBreakdowns = fetchBreakdowns;
window.fetchAndCacheBreakdowns = fetchAndCacheBreakdowns;

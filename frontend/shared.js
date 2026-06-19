// ── Shared Config & Utility Manager ──────────────────────────────────────────
// Centralized configuration and functions for Maintenance SRAB

// 1. Centralized API Config (Google Apps Script Web App URLs)
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzYPLqS7Xaiyc9Ev5GoMZoOEkndOVXtASyrsqu2n9GvLyusKXa0pKdoxb4FO6vrAUYgkw/exec";
const SPARE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxk2_S7DXafO7_wZWvakzbwi68X9Ph5Aa4I5wgArJ9_gg2OMcZ2NUB00Dzf9ftLcv3A/exec";

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

// 5. Custom Password Prompt Modal
function showPasswordPrompt(message) {
    return new Promise((resolve) => {
        // Create modal container elements
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
        overlay.style.zIndex = '10000';
        overlay.style.backdropFilter = 'blur(10px)';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.padding = '20px';
        overlay.style.boxSizing = 'border-box';
        overlay.style.fontFamily = "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif";

        const card = document.createElement('div');
        card.style.background = '#181d28';
        card.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        card.style.borderRadius = '16px';
        card.style.padding = '24px';
        card.style.width = '100%';
        card.style.maxWidth = '400px';
        card.style.boxShadow = '0 24px 48px rgba(0, 0, 0, 0.5)';
        card.style.color = '#ffffff';
        card.style.boxSizing = 'border-box';
        card.style.transform = 'translateY(20px)';
        card.style.opacity = '0';
        card.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';

        // Use theme styles if light mode is active
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        if (isLight) {
            card.style.background = '#ffffff';
            card.style.color = '#1a1a1a';
            card.style.border = '1px solid rgba(0, 0, 0, 0.1)';
            card.style.boxShadow = '0 24px 48px rgba(0, 0, 0, 0.12)';
        }

        const msgDiv = document.createElement('div');
        msgDiv.textContent = message;
        msgDiv.style.marginBottom = '16px';
        msgDiv.style.fontSize = '15px';
        msgDiv.style.fontWeight = '600';
        msgDiv.style.lineHeight = '1.5';

        // Container for password input and icon/checkbox
        const inputWrapper = document.createElement('div');
        inputWrapper.style.position = 'relative';
        inputWrapper.style.marginBottom = '24px';

        const input = document.createElement('input');
        input.type = 'password';
        input.placeholder = 'กรอกรหัสผ่าน...';
        input.style.width = '100%';
        input.style.padding = '12px 42px 12px 14px';
        input.style.boxSizing = 'border-box';
        input.style.borderRadius = '10px';
        input.style.border = isLight ? '1px solid rgba(0, 0, 0, 0.15)' : '1px solid rgba(255, 255, 255, 0.12)';
        input.style.background = isLight ? '#f3f4f6' : 'rgba(255, 255, 255, 0.03)';
        input.style.color = isLight ? '#000000' : '#ffffff';
        input.style.fontSize = '16px';
        input.style.outline = 'none';
        input.style.transition = 'all 0.2s';
        
        input.addEventListener('focus', () => {
            input.style.borderColor = '#00cbd6';
            input.style.boxShadow = '0 0 0 3px rgba(0, 203, 214, 0.15)';
        });
        input.addEventListener('blur', () => {
            input.style.borderColor = isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.12)';
            input.style.boxShadow = 'none';
        });

        // Show/hide eye button
        const eyeBtn = document.createElement('button');
        eyeBtn.type = 'button';
        eyeBtn.style.position = 'absolute';
        eyeBtn.style.right = '12px';
        eyeBtn.style.top = '50%';
        eyeBtn.style.transform = 'translateY(-50%)';
        eyeBtn.style.background = 'none';
        eyeBtn.style.border = 'none';
        eyeBtn.style.cursor = 'pointer';
        eyeBtn.style.padding = '4px';
        eyeBtn.style.display = 'flex';
        eyeBtn.style.alignItems = 'center';
        eyeBtn.style.justifyContent = 'center';
        eyeBtn.style.color = isLight ? '#6b7280' : '#9ca3af';
        eyeBtn.style.transition = 'color 0.2s';

        const showEyeSVG = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>
        `;
        const hideEyeSVG = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
        `;
        
        eyeBtn.innerHTML = showEyeSVG;
        eyeBtn.addEventListener('click', () => {
            if (input.type === 'password') {
                input.type = 'text';
                eyeBtn.innerHTML = hideEyeSVG;
            } else {
                input.type = 'password';
                eyeBtn.innerHTML = showEyeSVG;
            }
            input.focus();
        });

        inputWrapper.appendChild(input);
        inputWrapper.appendChild(eyeBtn);

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.justifyContent = 'flex-end';
        actions.style.gap = '12px';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.padding = '10px 20px';
        cancelBtn.style.borderRadius = '10px';
        cancelBtn.style.border = isLight ? '1px solid rgba(0, 0, 0, 0.12)' : '1px solid rgba(255, 255, 255, 0.08)';
        cancelBtn.style.background = isLight ? '#e5e7eb' : 'rgba(255, 255, 255, 0.05)';
        cancelBtn.style.color = isLight ? '#1f2937' : '#e5e7eb';
        cancelBtn.style.fontWeight = '600';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.style.fontSize = '14px';
        cancelBtn.style.transition = 'all 0.2s';
        cancelBtn.addEventListener('mouseover', () => {
            cancelBtn.style.background = isLight ? '#d1d5db' : 'rgba(255, 255, 255, 0.1)';
        });
        cancelBtn.addEventListener('mouseout', () => {
            cancelBtn.style.background = isLight ? '#e5e7eb' : 'rgba(255, 255, 255, 0.05)';
        });

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.style.padding = '10px 24px';
        okBtn.style.borderRadius = '10px';
        okBtn.style.border = 'none';
        okBtn.style.background = '#00cbd6';
        okBtn.style.color = '#000000';
        okBtn.style.fontWeight = '700';
        okBtn.style.cursor = 'pointer';
        okBtn.style.fontSize = '14px';
        okBtn.style.transition = 'all 0.2s';
        okBtn.addEventListener('mouseover', () => {
            okBtn.style.filter = 'brightness(1.1)';
            okBtn.style.boxShadow = '0 0 12px rgba(0, 203, 214, 0.4)';
        });
        okBtn.addEventListener('mouseout', () => {
            okBtn.style.filter = 'none';
            okBtn.style.boxShadow = 'none';
        });

        actions.appendChild(cancelBtn);
        actions.appendChild(okBtn);

        card.appendChild(msgDiv);
        card.appendChild(inputWrapper);
        card.appendChild(actions);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // Animate modal pop
        requestAnimationFrame(() => {
            card.style.transform = 'translateY(0)';
            card.style.opacity = '1';
        });

        // Autofocus input
        setTimeout(() => {
            input.focus();
        }, 50);

        // Close function helper
        function closePrompt(value) {
            card.style.transform = 'translateY(20px)';
            card.style.opacity = '0';
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.2s';
            
            setTimeout(() => {
                if (overlay.parentNode) {
                    document.body.removeChild(overlay);
                }
                document.removeEventListener('keydown', handleKeydown);
                resolve(value);
            }, 200);
        }

        function handleKeydown(e) {
            if (e.key === 'Escape') {
                closePrompt(null);
            } else if (e.key === 'Enter') {
                closePrompt(input.value);
            }
        }

        // Event listeners
        okBtn.addEventListener('click', () => closePrompt(input.value));
        cancelBtn.addEventListener('click', () => closePrompt(null));
        document.addEventListener('keydown', handleKeydown);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closePrompt(null);
            }
        });
    });
}

// 6. Custom Alert Modal
window.alert = function(message) {
    return new Promise((resolve) => {
        // Create modal container elements
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
        overlay.style.zIndex = '10001'; // Slightly higher than password prompt
        overlay.style.backdropFilter = 'blur(10px)';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.padding = '20px';
        overlay.style.boxSizing = 'border-box';
        overlay.style.fontFamily = "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif";

        const card = document.createElement('div');
        card.style.background = '#181d28';
        card.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        card.style.borderRadius = '16px';
        card.style.padding = '28px 24px 24px 24px';
        card.style.width = '100%';
        card.style.maxWidth = '360px';
        card.style.boxShadow = '0 24px 48px rgba(0, 0, 0, 0.5)';
        card.style.color = '#ffffff';
        card.style.boxSizing = 'border-box';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'center';
        card.style.textAlign = 'center';
        card.style.transform = 'translateY(20px)';
        card.style.opacity = '0';
        card.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';

        // Use theme styles if light mode is active
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        if (isLight) {
            card.style.background = '#ffffff';
            card.style.color = '#1a1a1a';
            card.style.border = '1px solid rgba(0, 0, 0, 0.1)';
            card.style.boxShadow = '0 24px 48px rgba(0, 0, 0, 0.12)';
        }

        // Detect message type to choose icon
        const msgLower = String(message).toLowerCase();
        let iconHTML = '';
        if (msgLower.includes('สำเร็จ') || msgLower.includes('เรียบร้อย') || msgLower.includes('success') || msgLower.includes('บันทึก')) {
            // Success
            iconHTML = `
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#2ed573" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 18px; filter: drop-shadow(0 0 8px rgba(46, 213, 115, 0.3));">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
            `;
        } else if (msgLower.includes('ผิดพลาด') || msgLower.includes('ไม่ได้') || msgLower.includes('error') || msgLower.includes('ล้มเหลว') || msgLower.includes('ไม่ถูกต้อง')) {
            // Error / Warning
            iconHTML = `
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#ff4757" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 18px; filter: drop-shadow(0 0 8px rgba(255, 71, 87, 0.3));">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
            `;
        } else {
            // Info
            iconHTML = `
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#00cbd6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 18px; filter: drop-shadow(0 0 8px rgba(0, 203, 214, 0.3));">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
            `;
        }

        const iconContainer = document.createElement('div');
        iconContainer.innerHTML = iconHTML;

        const msgDiv = document.createElement('div');
        msgDiv.innerHTML = String(message).replace(/\n/g, '<br>');
        msgDiv.style.marginBottom = '24px';
        msgDiv.style.fontSize = '16px';
        msgDiv.style.fontWeight = '600';
        msgDiv.style.lineHeight = '1.6';
        msgDiv.style.color = isLight ? '#374151' : '#e5e7eb';

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.style.padding = '10px 32px';
        okBtn.style.borderRadius = '10px';
        okBtn.style.border = 'none';
        okBtn.style.background = '#00cbd6';
        okBtn.style.color = '#000000';
        okBtn.style.fontWeight = '700';
        okBtn.style.cursor = 'pointer';
        okBtn.style.fontSize = '14px';
        okBtn.style.transition = 'all 0.2s';
        okBtn.style.width = '100%';
        okBtn.style.boxSizing = 'border-box';
        
        okBtn.addEventListener('mouseover', () => {
            okBtn.style.filter = 'brightness(1.1)';
            okBtn.style.boxShadow = '0 0 12px rgba(0, 203, 214, 0.4)';
        });
        okBtn.addEventListener('mouseout', () => {
            okBtn.style.filter = 'none';
            okBtn.style.boxShadow = 'none';
        });

        card.appendChild(iconContainer);
        card.appendChild(msgDiv);
        card.appendChild(okBtn);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // Animate modal pop
        requestAnimationFrame(() => {
            card.style.transform = 'translateY(0)';
            card.style.opacity = '1';
        });

        // Focus the OK button
        setTimeout(() => {
            okBtn.focus();
        }, 50);

        // Close helper
        function closeAlert() {
            card.style.transform = 'translateY(20px)';
            card.style.opacity = '0';
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.2s';
            
            setTimeout(() => {
                if (overlay.parentNode) {
                    document.body.removeChild(overlay);
                }
                document.removeEventListener('keydown', handleKeydown);
                resolve();
            }, 200);
        }

        function handleKeydown(e) {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                closeAlert();
            }
        }

        // Event listeners
        okBtn.addEventListener('click', closeAlert);
        document.addEventListener('keydown', handleKeydown);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeAlert();
            }
        });
    });
};

// 7. Custom Confirm Modal
function showConfirmPrompt(message) {
    return new Promise((resolve) => {
        // Create modal container elements
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
        overlay.style.zIndex = '10002'; // Higher than alert
        overlay.style.backdropFilter = 'blur(10px)';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.padding = '20px';
        overlay.style.boxSizing = 'border-box';
        overlay.style.fontFamily = "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif";

        const card = document.createElement('div');
        card.style.background = '#181d28';
        card.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        card.style.borderRadius = '16px';
        card.style.padding = '24px';
        card.style.width = '100%';
        card.style.maxWidth = '400px';
        card.style.boxShadow = '0 24px 48px rgba(0, 0, 0, 0.5)';
        card.style.color = '#ffffff';
        card.style.boxSizing = 'border-box';
        card.style.transform = 'translateY(20px)';
        card.style.opacity = '0';
        card.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';

        // Use theme styles if light mode is active
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        if (isLight) {
            card.style.background = '#ffffff';
            card.style.color = '#1a1a1a';
            card.style.border = '1px solid rgba(0, 0, 0, 0.1)';
            card.style.boxShadow = '0 24px 48px rgba(0, 0, 0, 0.12)';
        }

        const msgDiv = document.createElement('div');
        msgDiv.textContent = message;
        msgDiv.style.marginBottom = '24px';
        msgDiv.style.fontSize = '15px';
        msgDiv.style.fontWeight = '600';
        msgDiv.style.lineHeight = '1.6';
        msgDiv.style.textAlign = 'left';

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.justifyContent = 'flex-end';
        actions.style.gap = '12px';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.padding = '10px 20px';
        cancelBtn.style.borderRadius = '10px';
        cancelBtn.style.border = isLight ? '1px solid rgba(0, 0, 0, 0.12)' : '1px solid rgba(255, 255, 255, 0.08)';
        cancelBtn.style.background = isLight ? '#e5e7eb' : 'rgba(255, 255, 255, 0.05)';
        cancelBtn.style.color = isLight ? '#1f2937' : '#e5e7eb';
        cancelBtn.style.fontWeight = '600';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.style.fontSize = '14px';
        cancelBtn.style.transition = 'all 0.2s';
        cancelBtn.addEventListener('mouseover', () => {
            cancelBtn.style.background = isLight ? '#d1d5db' : 'rgba(255, 255, 255, 0.1)';
        });
        cancelBtn.addEventListener('mouseout', () => {
            cancelBtn.style.background = isLight ? '#e5e7eb' : 'rgba(255, 255, 255, 0.05)';
        });

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.style.padding = '10px 24px';
        okBtn.style.borderRadius = '10px';
        okBtn.style.border = 'none';
        okBtn.style.background = '#00cbd6';
        okBtn.style.color = '#000000';
        okBtn.style.fontWeight = '700';
        okBtn.style.cursor = 'pointer';
        okBtn.style.fontSize = '14px';
        okBtn.style.transition = 'all 0.2s';
        okBtn.addEventListener('mouseover', () => {
            okBtn.style.filter = 'brightness(1.1)';
            okBtn.style.boxShadow = '0 0 12px rgba(0, 203, 214, 0.4)';
        });
        okBtn.addEventListener('mouseout', () => {
            okBtn.style.filter = 'none';
            okBtn.style.boxShadow = 'none';
        });

        actions.appendChild(cancelBtn);
        actions.appendChild(okBtn);

        card.appendChild(msgDiv);
        card.appendChild(actions);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // Animate modal pop
        requestAnimationFrame(() => {
            card.style.transform = 'translateY(0)';
            card.style.opacity = '1';
        });

        // Focus OK button by default
        setTimeout(() => {
            okBtn.focus();
        }, 50);

        // Close function helper
        function closeConfirm(value) {
            card.style.transform = 'translateY(20px)';
            card.style.opacity = '0';
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.2s';
            
            setTimeout(() => {
                if (overlay.parentNode) {
                    document.body.removeChild(overlay);
                }
                document.removeEventListener('keydown', handleKeydown);
                resolve(value);
            }, 200);
        }

        function handleKeydown(e) {
            if (e.key === 'Escape') {
                closeConfirm(false);
            } else if (e.key === 'Enter') {
                closeConfirm(true);
            }
        }

        // Event listeners
        okBtn.addEventListener('click', () => closeConfirm(true));
        cancelBtn.addEventListener('click', () => closeConfirm(false));
        document.addEventListener('keydown', handleKeydown);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeConfirm(false);
            }
        });
    });
}

// 8. Expose properties on window global object (supporting file:// direct access)
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
window.customPasswordPrompt = showPasswordPrompt;
window.customConfirm = showConfirmPrompt;

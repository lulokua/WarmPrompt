// ============================================
// POPUP.JS - Square gift popups for reveal flow
// ============================================

const popupState = {
    isPlaying: false,
    timeouts: [],
    zIndex: 10000
};

const POPUP_INTERVAL_MS = 600;
const POPUP_LIFETIME_MS = 15000;

function startSquarePopups() {
    if (popupState.isPlaying) return;
    const messages = getPopupMessages();
    if (!messages.length) return;
    popupState.isPlaying = true;

    // 显示提交按钮（用户已完成预览流程）- 固定在右下角
    const submitBtnContainer = document.querySelector('.final-action-buttons');
    if (submitBtnContainer) {
        submitBtnContainer.classList.add('show');
    }

    showNextPopup(messages, 0, POPUP_INTERVAL_MS);
}

function stopSquarePopups() {
    popupState.isPlaying = false;
    popupState.timeouts.forEach((t) => clearTimeout(t));
    popupState.timeouts.length = 0;
    document.querySelectorAll('.popup').forEach((popup) => popup.remove());
}

function showNextPopup(messages, index, speed) {
    if (!popupState.isPlaying) return;
    const nextIndex = index >= messages.length ? 0 : index;
    createPopup(messages[nextIndex]);

    const timeout = setTimeout(() => {
        showNextPopup(messages, nextIndex + 1, speed);
    }, speed);
    popupState.timeouts.push(timeout);
}

function getPopupMessages() {
    if (userData && userData.msgMode === 'custom') {
        const customLines = String(userData.message || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        if (customLines.length) return customLines.slice(0, 200);
    }

    if (typeof officialQuotes !== 'undefined' && Array.isArray(officialQuotes) && officialQuotes.length) {
        return officialQuotes.slice(0, 200);
    }

    if (userData && typeof userData.message === 'string') {
        const fallback = userData.message
            .split(/\s{2,}/)
            .map((line) => line.trim())
            .filter(Boolean);
        if (fallback.length) return fallback.slice(0, 200);
    }

    return [];
}

function createPopup(message) {
    const popup = document.createElement('div');
    popup.className = 'popup popup-square';

    const theme = getPopupTheme();
    popup.style.setProperty('--popup-bg', theme.background);
    popup.style.setProperty('--popup-text', theme.textColor);
    popup.style.setProperty('--popup-border', theme.borderColor);
    popup.style.setProperty('--popup-tag-bg', theme.tagBackground);
    popup.style.setProperty('--popup-blur', `${theme.blur}px`);

    const friendName = (userData && userData.friendName) || 'Friend';
    const nameTag = document.createElement('div');
    nameTag.className = 'popup-name-tag';
    nameTag.textContent = friendName;

    const text = document.createElement('div');
    text.className = 'popup-text';
    text.textContent = String(message || '').trim();

    popup.append(nameTag, text);

    popup.style.position = 'fixed';
    popup.style.zIndex = popupState.zIndex++;
    popup.style.visibility = 'hidden';
    document.body.appendChild(popup);

    const rect = popup.getBoundingClientRect();
    const maxX = Math.max(0, window.innerWidth - rect.width);
    const maxY = Math.max(0, window.innerHeight - rect.height);
    const x = Math.random() * maxX;
    const y = Math.random() * maxY;

    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    popup.style.visibility = 'visible';

    requestAnimationFrame(() => popup.classList.add('show'));

    const handlePopupClose = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        popup.style.opacity = '0';
        popup.style.transform = 'translateY(10px) scale(0.95)';
        setTimeout(() => popup.remove(), 600);
    };

    popup.addEventListener('touchstart', handlePopupClose, { passive: false });
    popup.addEventListener('click', handlePopupClose, { passive: false });

    setTimeout(() => {
        popup.style.opacity = '0';
        popup.style.transform = 'translateY(10px) scale(0.95)';
        setTimeout(() => popup.remove(), 600);
    }, POPUP_LIFETIME_MS);
}

function getPopupTheme() {
    const baseHex = isValidHex(userData && userData.color) ? userData.color : '#4facfe';
    const blur = getPopupBlur();
    const alpha = getPopupOpacity(blur);
    const rgb = hexToRgb(baseHex);
    const isLight = getLuminance(baseHex) > 0.6;

    return {
        background: `rgba(${rgb}, ${alpha})`,
        textColor: isLight ? '#111111' : '#ffffff',
        borderColor: isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.22)',
        tagBackground: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.18)',
        blur
    };
}

function getPopupBlur() {
    const raw = Number(userData && userData.blur);
    if (!Number.isFinite(raw)) return 12;
    return Math.min(30, Math.max(0, raw));
}

function getPopupOpacity(blur) {
    const normalized = Math.min(30, Math.max(0, blur));
    return 0.12 + (normalized / 30) * 0.18;
}

function isValidHex(value) {
    return typeof value === 'string' && /^#([0-9a-fA-F]{6})$/.test(value);
}

function hexToRgb(hex) {
    const normalized = hex.replace('#', '');
    const r = parseInt(normalized.substring(0, 2), 16);
    const g = parseInt(normalized.substring(2, 4), 16);
    const b = parseInt(normalized.substring(4, 6), 16);
    return `${r}, ${g}, ${b}`;
}

function getLuminance(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const R = toLinear(r);
    const G = toLinear(g);
    const B = toLinear(b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        stopSquarePopups();
    }
});

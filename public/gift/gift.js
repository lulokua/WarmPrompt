// ============================================
// GIFT.JS - 分享端礼物展示逻辑
// ============================================

// --- Global State ---
let giftData = null;

// --- DOM Elements ---
const loadingScreen = document.getElementById('loadingScreen');
const errorScreen = document.getElementById('errorScreen');
const errorMessage = document.getElementById('errorMessage');
const bgVideoLayer = document.getElementById('bgVideoLayer');

const finalPreviewOverlay = document.getElementById('finalPreviewOverlay');
const finalTimeGreeting = document.getElementById('finalTimeGreeting');
const finalRecipientName = document.getElementById('finalRecipientName');
const finalGiftIcons = document.getElementById('finalGiftIcons');
const finalGiftMessage = document.getElementById('finalGiftMessage');
const finalSwipeHint = document.getElementById('finalSwipeHint');

const giftRevealContainer = document.getElementById('giftRevealContainer');
const revealAlbumArt = document.getElementById('revealAlbumArt');
const revealTitle = document.getElementById('revealTitle');
const revealArtist = document.getElementById('revealArtist');
const revealCurrentTime = document.getElementById('revealCurrentTime');
const revealTotalTime = document.getElementById('revealTotalTime');
const revealProgressBar = document.getElementById('revealProgressBar');
const revealPlayBtn = document.getElementById('revealPlayBtn');
const revealNextText = document.getElementById('revealNextText');

const letterOverlay = document.getElementById('letterOverlay');
const letterRecipient = document.getElementById('letterRecipient');
const letterSender = document.getElementById('letterSender');
const letterBodyText = document.getElementById('letterBodyText');

const musicAudio = document.getElementById('musicAudio');

// --- Color Schemes ---
const colorSchemes = {
    '#4facfe': { accent1: '#4facfe', accent2: '#00f2fe', accent3: '#4facfe' },
    '#ff0099': { accent1: '#ff0099', accent2: '#493240', accent3: '#ff0099' },
    '#f9d423': { accent1: '#f9d423', accent2: '#ff4e50', accent3: '#f9d423' },
    '#00b09b': { accent1: '#00b09b', accent2: '#96c93d', accent3: '#00b09b' },
    '#ffffff': { accent1: '#8e9eab', accent2: '#eef2f3', accent3: '#8e9eab' },
    '#ff416c': { accent1: '#ff416c', accent2: '#ff4b2b', accent3: '#ff416c' },
    '#8e2de2': { accent1: '#8e2de2', accent2: '#4a00e0', accent3: '#8e2de2' },
    '#f37335': { accent1: '#f37335', accent2: '#fdc830', accent3: '#f37335' },
    '#30cfd0': { accent1: '#30cfd0', accent2: '#330867', accent3: '#30cfd0' },
    '#667eea': { accent1: '#667eea', accent2: '#764ba2', accent3: '#667eea' },
    '#a8edea': { accent1: '#a8edea', accent2: '#fed6e3', accent3: '#a8edea' },
    '#fed6e3': { accent1: '#fed6e3', accent2: '#a8edea', accent3: '#fed6e3' }
};

// --- Helper Functions ---
function getTimeGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return '早上好';
    if (hour >= 12 && hour < 18) return '下午好';
    return '晚上好';
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function resetVideoElement(videoEl) {
    if (!videoEl) return;
    videoEl.pause();
    videoEl.removeAttribute('src');
    videoEl.load();
    videoEl.onerror = null;
}

function tryPlayVideoElement(videoEl) {
    if (!videoEl) return;
    const playPromise = videoEl.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => { });
    }
}

function applyColorScheme(color) {
    const scheme = colorSchemes[color] || colorSchemes['#4facfe'];
    document.documentElement.style.setProperty('--accent-1', scheme.accent1);
    document.documentElement.style.setProperty('--accent-2', scheme.accent2);
    document.documentElement.style.setProperty('--accent-3', scheme.accent3);
}

function applyBackground(gift) {
    console.log('[Gift] applyBackground:', gift.bgType, gift.bgUrl);

    // 重置所有背景状态
    document.body.classList.remove('light-theme');
    document.body.style.backgroundImage = 'none';
    bgVideoLayer.style.display = 'none';
    resetVideoElement(bgVideoLayer);

    if (gift.bgType === 'white') {
        // 白色背景
        document.body.classList.add('light-theme');
    } else if (gift.bgType === 'default' || !gift.bgUrl) {
        // 默认深色背景（不需要特别处理，CSS 有默认样式）
    } else if (gift.bgType === 'video' && gift.bgUrl) {
        // 视频背景
        bgVideoLayer.onerror = () => {
            resetVideoElement(bgVideoLayer);
            bgVideoLayer.style.display = 'none';
        };
        bgVideoLayer.src = gift.bgUrl;
        bgVideoLayer.style.display = 'block';
        bgVideoLayer.load();
        tryPlayVideoElement(bgVideoLayer);
    } else if (gift.bgType === 'image' && gift.bgUrl) {
        // 图片背景
        document.body.style.backgroundImage = `url(${gift.bgUrl})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
    }
}

// --- Load Gift Data ---
async function loadGift() {
    const pathParts = window.location.pathname.split('/');
    const giftCode = pathParts[pathParts.length - 1];

    if (!giftCode || giftCode === 'gift') {
        showError('无效的礼物链接');
        return;
    }

    try {
        const response = await fetch(`/api/gift/${giftCode}`);
        const result = await response.json();

        if (result.code !== 200 || !result.data) {
            throw new Error(result.error || '礼物加载失败');
        }

        giftData = result.data;
        console.log('[Gift] Loaded gift data:', giftData);

        // Apply styles
        applyColorScheme(giftData.boxColor);
        applyBackground(giftData);

        // Fill initial card
        fillInitialCard();

        // Hide loading, show card
        loadingScreen.classList.add('hidden');
        finalPreviewOverlay.classList.add('active');

        // Enable swipe
        enableSwipeToOpen(finalPreviewOverlay);

    } catch (error) {
        console.error('加载礼物失败:', error);
        showError(error.message || '该礼物可能已过期或链接无效');
    }
}

function showError(message) {
    loadingScreen.classList.add('hidden');
    errorMessage.textContent = message;
    errorScreen.classList.add('active');
}

function fillInitialCard() {
    finalTimeGreeting.textContent = getTimeGreeting();
    finalRecipientName.textContent = giftData.recipientName || '朋友';

    let giftCount = 2;
    if (giftData.hasLetter) giftCount = 3;

    const sender = giftData.senderName || '神秘人';
    finalGiftMessage.innerHTML = `
        你的朋友 <span class="highlight-text">${sender}</span> 给你准备了
        <span class="gift-count-badge">${giftCount}</span> 个礼物
    `;

    let iconsHtml = `
        <div class="gift-icon" title="专属音乐">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>
            </svg>
        </div>
        <div class="gift-icon" title="心意礼盒">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="12" y1="3" x2="12" y2="21"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
            </svg>
        </div>
    `;

    if (giftData.hasLetter) {
        iconsHtml += `
            <div class="gift-icon" title="一封信">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
            </div>
        `;
    }
    finalGiftIcons.innerHTML = iconsHtml;
}

// --- Swipe: Initial Card -> Music Player ---
function enableSwipeToOpen(overlayElement) {
    let startY = 0, currentY = 0, isDragging = false;
    const card = overlayElement.querySelector('.final-card');
    const swipeHint = overlayElement.querySelector('.swipe-hint-container');

    const handleStart = (y) => {
        startY = y;
        isDragging = true;
        card.style.transition = 'none';
    };

    const handleMove = (y) => {
        if (!isDragging) return;
        currentY = y;
        const diff = startY - currentY;

        if (diff > 0) {
            const moveY = -diff;
            card.style.transform = `translateY(${moveY}px) scale(${1 - diff / 3000})`;
            if (swipeHint) swipeHint.style.opacity = Math.max(0, 1 - diff / 200);
        }
    };

    const handleEnd = () => {
        if (!isDragging) return;
        isDragging = false;

        const diff = startY - currentY;
        card.style.transition = 'all 0.6s cubic-bezier(0.22, 1, 0.36, 1)';

        if (diff > 100) {
            card.style.transform = `translateY(-100vh) scale(0.8)`;
            card.style.opacity = '0';
            setTimeout(() => {
                overlayElement.classList.remove('active');
                initRevealPage();
            }, 300);
        } else {
            card.style.transform = '';
            if (swipeHint) swipeHint.style.opacity = '';
        }
    };

    overlayElement.addEventListener('touchstart', (e) => handleStart(e.touches[0].clientY), { passive: false });
    overlayElement.addEventListener('touchmove', (e) => {
        if (isDragging) e.preventDefault();
        handleMove(e.touches[0].clientY);
    }, { passive: false });
    overlayElement.addEventListener('touchend', handleEnd);

    overlayElement.addEventListener('mousedown', (e) => handleStart(e.clientY));
    window.addEventListener('mousemove', (e) => {
        if (isDragging) { e.preventDefault(); handleMove(e.clientY); }
    });
    window.addEventListener('mouseup', handleEnd);
}

// --- Music Reveal Page ---
function initRevealPage() {
    // Fill music data - 从嵌套的 music 对象中获取
    if (giftData) {
        const music = giftData.music || {};
        revealTitle.textContent = music.title || giftData.musicTitle || 'Unknown Track';
        revealArtist.textContent = music.artist || giftData.musicArtist || 'Unknown Artist';
        revealAlbumArt.src = music.coverUrl || giftData.musicCoverUrl || '/For_Others/photo/default-record.png';

        const playUrl = music.playUrl || giftData.musicPlayUrl;
        if (playUrl) {
            musicAudio.src = playUrl;
        }
    }

    // Setup audio
    if (musicAudio.src) {
        musicAudio.onloadedmetadata = () => {
            revealTotalTime.textContent = formatTime(musicAudio.duration);
        };

        musicAudio.ontimeupdate = () => {
            if (!isNaN(musicAudio.duration)) {
                const percent = (musicAudio.currentTime / musicAudio.duration) * 100;
                revealProgressBar.style.width = percent + '%';
                revealCurrentTime.textContent = formatTime(musicAudio.currentTime);
            }
        };

        // Set start time if highlight mode
        if (giftData.playbackMode === 'highlight' && giftData.startTime > 0) {
            musicAudio.currentTime = giftData.startTime;
        }

        // Auto play
        musicAudio.volume = 1.0;
        const playPromise = musicAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                updatePlayBtnState(true);
            }).catch(error => {
                console.log('Autoplay prevented:', error);
                updatePlayBtnState(false);
            });
        }

        revealPlayBtn.onclick = () => {
            if (musicAudio.paused) {
                musicAudio.play();
                updatePlayBtnState(true);
            } else {
                musicAudio.pause();
                updatePlayBtnState(false);
            }
        };
    }

    // Set next hint text
    const nextText = giftData.hasLetter ? '向上滑动打开信件' : '向上滑动查看祝福';
    if (revealNextText) revealNextText.textContent = nextText;

    // Enable swipe
    enableSwipeToNext(giftRevealContainer);

    // Show
    giftRevealContainer.classList.add('active');
}

function updatePlayBtnState(isPlaying) {
    if (isPlaying) {
        giftRevealContainer.classList.add('playing');
        revealPlayBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
            </svg>`;
    } else {
        giftRevealContainer.classList.remove('playing');
        revealPlayBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
            </svg>`;
    }
}

// --- Swipe: Music -> Letter/Popups ---
function enableSwipeToNext(container) {
    let startY = 0, isDragging = false;
    const card = container.querySelector('.music-immersive-card');
    const swipeHint = container.querySelector('.swipe-hint-container');

    const handleStart = (y) => {
        startY = y;
        isDragging = true;
        if (card) card.style.transition = 'none';
    };

    const handleMove = (y, e) => {
        if (!isDragging) return;
        const diff = startY - y;
        if (e && e.cancelable) e.preventDefault();

        if (diff > 0) {
            if (card) card.style.transform = `translateY(${-diff / 3}px) scale(${1 - diff / 5000})`;
            if (swipeHint) swipeHint.style.opacity = Math.max(0, 1 - diff / 200);
        }
    };

    const handleEnd = (y) => {
        if (!isDragging) return;
        isDragging = false;

        const diff = startY - y;
        if (card) card.style.transition = 'all 0.6s cubic-bezier(0.22, 1, 0.36, 1)';

        if (diff > 80) {
            if (card) {
                card.style.transform = `translateY(-100vh) scale(0.8)`;
                card.style.opacity = '0';
            }
            if (swipeHint) swipeHint.style.opacity = '0';

            setTimeout(() => {
                container.classList.remove('active');
                if (giftData.hasLetter) {
                    showLetterOverlay();
                } else {
                    startSquarePopups();
                }
            }, 300);
        } else {
            if (card) card.style.transform = '';
            if (swipeHint) swipeHint.style.opacity = '';
        }
    };

    if (container) container.style.touchAction = 'none';

    container.addEventListener('touchstart', (e) => handleStart(e.touches[0].clientY), { passive: false });
    container.addEventListener('touchmove', (e) => handleMove(e.touches[0].clientY, e), { passive: false });
    container.addEventListener('touchend', (e) => handleEnd(e.changedTouches[0].clientY));

    container.addEventListener('mousedown', (e) => handleStart(e.clientY));
    window.addEventListener('mousemove', (e) => { if (isDragging) handleMove(e.clientY, e); });
    window.addEventListener('mouseup', (e) => { if (isDragging) handleEnd(e.clientY); });
}

// --- Letter Overlay ---
function showLetterOverlay() {
    letterRecipient.textContent = giftData.recipientName || '朋友';
    letterSender.textContent = giftData.senderName || '我';
    letterBodyText.innerText = giftData.letterContent || '这里似乎没有写什么...';

    letterOverlay.classList.add('active');
    enableSwipeToCloseLetter(letterOverlay);
}

function enableSwipeToCloseLetter(container) {
    let startY = 0, isDragging = false;
    let isScrollingLetterBody = false;
    const card = container.querySelector('.letter-card');
    const swipeHint = container.querySelector('.swipe-hint-container');
    const letterBody = container.querySelector('.letter-body');

    // 设置 touch-action 以支持自定义手势
    if (container) container.style.touchAction = 'none';
    // 但是信件内容区域需要允许垂直滚动
    if (letterBody) letterBody.style.touchAction = 'pan-y';

    const isInsideLetterBody = (target) => {
        return letterBody && (target === letterBody || letterBody.contains(target));
    };

    const canLetterBodyScroll = (direction) => {
        if (!letterBody) return false;
        if (direction === 'up') {
            // 向上滑动 = 内容向下滚动，检查是否还能往下滚
            return letterBody.scrollTop < (letterBody.scrollHeight - letterBody.clientHeight);
        } else {
            // 向下滑动 = 内容向上滚动，检查是否还能往上滚
            return letterBody.scrollTop > 0;
        }
    };

    const handleStart = (y, e) => {
        startY = y;
        isDragging = true;
        isScrollingLetterBody = false;

        // 检查触摸是否在信件内容区域内
        if (e && e.target && isInsideLetterBody(e.target)) {
            // 如果信件内容可滚动，则标记为滚动模式
            if (letterBody && letterBody.scrollHeight > letterBody.clientHeight) {
                isScrollingLetterBody = true;
            }
        }

        if (card && !isScrollingLetterBody) card.style.transition = 'none';
    };

    const handleMove = (y, e) => {
        if (!isDragging) return;
        const diff = startY - y;

        // 如果在信件内容区域滚动
        if (isScrollingLetterBody) {
            // 如果向上滑动（diff > 0）且内容还能向下滚动，让它自然滚动
            if (diff > 0 && canLetterBodyScroll('up')) {
                return; // 让浏览器处理滚动
            }
            // 如果向下滑动（diff < 0）且内容还能向上滚动，让它自然滚动
            if (diff < 0 && canLetterBodyScroll('down')) {
                return; // 让浏览器处理滚动
            }
            // 如果到达边界，切换到卡片滑动模式但不做任何转换（防止意外关闭）
            return;
        }

        // 卡片滑动模式：阻止默认行为
        if (diff > 10 && e && e.cancelable) e.preventDefault();

        if (diff > 0) {
            if (card) card.style.transform = `translateY(${-diff / 3}px) scale(${1 - diff / 5000}) rotateX(${diff / 50}deg)`;
            if (swipeHint) swipeHint.style.opacity = Math.max(0, 1 - diff / 200);
        }
    };

    const handleEnd = (y) => {
        if (!isDragging) return;
        isDragging = false;

        // 如果是信件内容滚动模式，不处理卡片关闭
        if (isScrollingLetterBody) {
            isScrollingLetterBody = false;
            return;
        }

        const diff = startY - y;
        if (card) card.style.transition = 'all 0.8s cubic-bezier(0.22, 1, 0.36, 1)';

        if (diff > 100) {
            if (card) {
                card.style.transform = `translateY(-120vh) rotateX(20deg)`;
                card.style.opacity = '0';
            }
            container.style.pointerEvents = 'none';

            setTimeout(() => {
                container.classList.remove('active');
                startSquarePopups();
            }, 500);
        } else {
            if (card) card.style.transform = '';
            if (swipeHint) swipeHint.style.opacity = '';
        }
    };

    // 使用 addEventListener 避免覆盖其他事件处理器
    container.addEventListener('touchstart', (e) => handleStart(e.touches[0].clientY, e), { passive: false });
    container.addEventListener('touchmove', (e) => {
        if (isDragging && !isScrollingLetterBody) {
            handleMove(e.touches[0].clientY, e);
        } else if (isScrollingLetterBody) {
            handleMove(e.touches[0].clientY, e);
        }
    }, { passive: false });
    container.addEventListener('touchend', (e) => handleEnd(e.changedTouches[0].clientY));

    container.addEventListener('mousedown', (e) => handleStart(e.clientY, e));
    window.addEventListener('mousemove', (e) => { if (isDragging) handleMove(e.clientY, e); });
    window.addEventListener('mouseup', (e) => { if (isDragging) handleEnd(e.clientY); });
}

// --- Square Popups ---
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

    showNextPopup(messages, 0, POPUP_INTERVAL_MS);
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
    if (giftData && giftData.messageMode === 'custom') {
        const customLines = String(giftData.messageContent || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        if (customLines.length) return customLines.slice(0, 200);
    }

    // Default official quotes
    const officialQuotes = [
        "生活原本沉闷，但跑起来就有风。",
        "愿你眼中总有光芒，愿你活成你想要的模样。",
        "星光不问赶路人，时光不负有心人。",
        "你是我的今天，以及所有的明天。",
        "愿我们都能够，成为那个更好的自己。",
        "人生如逆旅，我亦是行人。",
        "世界很大，幸福很小，愿你被温柔以待。",
        "熬过无人问津的日子才有诗和远方。",
        "愿你此生尽兴，赤诚善良。",
        "保持热爱，奔赴山海。"
    ];

    return officialQuotes;
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

    const friendName = (giftData && giftData.senderName) || 'Friend';
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
    const baseHex = isValidHex(giftData && giftData.boxColor) ? giftData.boxColor : '#4facfe';
    const blur = giftData && giftData.blurLevel ? Math.min(30, Math.max(0, Number(giftData.blurLevel))) : 12;
    const alpha = 0.12 + (blur / 30) * 0.18;
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

// --- Initialize ---
loadGift();

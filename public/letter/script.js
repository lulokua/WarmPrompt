// Intro Animation
const INTRO_MAX_WAIT = 600;
let introDismissed = false;

function revealInitialStep() {
    const progress = document.querySelector('.progress-container');
    if (progress) {
        progress.style.opacity = '1';
        progress.style.transform = 'translateY(0)';
    }
    const username = document.getElementById('username');
    if (username) username.focus();
}

function dismissIntro(immediate = false) {
    if (introDismissed) return;
    introDismissed = true;

    const intro = document.getElementById('intro');
    if (intro) {
        if (immediate) {
            intro.style.transition = 'none';
            intro.style.opacity = '0';
            intro.style.display = 'none';
        } else {
            intro.style.opacity = '0';
            setTimeout(() => {
                if (intro) intro.style.display = 'none';
            }, 120);
        }
    }

    revealInitialStep();
}

document.addEventListener('DOMContentLoaded', () => dismissIntro(true));
window.addEventListener('load', () => dismissIntro(true));
setTimeout(() => dismissIntro(true), INTRO_MAX_WAIT);

const OFFICIAL_LETTER = `愿你在接下来的日子里，能被温柔以待。
不管生活是晴朗还是多云，都希望你能记得照顾好自己。累的时候允许自己停一停，迷茫的时候也不必着急给出答案。人生不是一场竞速，而是一段慢慢走、慢慢体会的旅程。

希望你每天醒来时，心里都有一点点期待；夜晚入睡时，能带着安心与平静。愿你遇见的人，能带来善意；经历的事，最终都会成为成长。就算偶尔不开心，也要相信，你值得被理解、被珍惜。

愿你所走的路，脚步坚定；所怀的心愿，终有回应。未来的每一天，都比昨天更靠近幸福`;

let finalMessageCache = "";
let finalUserName = "";
let finalFriendName = "";
let selectedContentType = "";
let selectedTypingSpeed = "normal";
let selectedMediaType = "none";
let selectedMediaUrl = "";
let selectedMediaName = "";
let selectedMediaFile = null;
let uploadedMediaInfo = null;
let mediaObjectUrl = "";

const MAX_CONTENT_CHARS = 20000;
const MAX_CONTENT_LINES = MAX_CONTENT_CHARS;
const MAX_CHARS_PER_LINE = 0;
const TYPING_SPEED_KEY = "typingSpeed";
const MEDIA_UPLOAD_ENDPOINT = String(window.WARM_MEDIA_UPLOAD_ENDPOINT || "/api/media/upload").trim();
const LETTER_SUBMIT_ENDPOINT = "/api/letter/submit";
const MAX_IMAGE_BYTES = 500 * 1024 * 1024;
const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;
const IMAGE_TOO_LARGE_MESSAGE = "你的这个图片已经超过大小 500 MB";
const VIDEO_TOO_LARGE_MESSAGE = "视频已经超过 1 GB";
const TYPING_SPEED_MAP = {
    slow: { multiplier: 1.35 },
    normal: { multiplier: 1 },
    fast: { multiplier: 0.7 }
};
const LETTER_MEDIA_URL_KEY = "letterMediaUrl";
const LETTER_MEDIA_TYPE_KEY = "letterMediaType";
const LETTER_MEDIA_NAME_KEY = "letterMediaName";
const MEDIA_PEEK_DELAY = 3000;
const MEDIA_FOCUS_DELAY = 3000;
const ACCOUNT_BENEFITS_ENDPOINT = "/api/account/benefits";
const accountGreeting = document.getElementById("account-greeting");
let mediaRevealTimer = null;
let mediaFocusTimer = null;
let resultOriginStepId = "step-9";
let resultHiddenStepId = "";

// Handle Enter Key
document.querySelectorAll('#username, #friendname').forEach(input => {
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const step = this.id === 'username' ? 1 : 2;
            nextStep(step);
        }
    });

    input.addEventListener('input', function() {
        const currentLength = this.value.length;
        const maxLength = this.getAttribute('maxlength');
        const countDisplay = this.parentElement.querySelector('.char-count');
        if (countDisplay) {
            countDisplay.textContent = `${currentLength}/${maxLength}`;
        }
    });
});

function setActiveDot(index) {
    const dots = document.querySelectorAll('.progress-dot');
    dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === index);
    });
}

function transitionSteps(fromId, toId, dotIndex, onShow) {
    const from = document.getElementById(fromId);
    const to = document.getElementById(toId);

    if (from) {
        from.classList.remove('active');
        from.classList.add('exit-up');
    }

    setTimeout(() => {
        if (to) {
            to.classList.remove('exit-up');
            to.classList.add('active');
        }
        if (typeof onShow === 'function') {
            onShow();
        }
    }, 100);

    if (typeof dotIndex === 'number') {
        setActiveDot(dotIndex);
    }
}

function nextStep(currentStep) {
    if (currentStep === 1) {
        const usernameInput = document.getElementById('username');
        const name = usernameInput.value.trim();

        if (!name) {
            shakeInput(usernameInput);
            return;
        }

        const friendInput = document.getElementById('friendname');
        transitionSteps('step-1', 'step-2', 1, () => {
            if (friendInput) friendInput.focus();
        });
    }
    else if (currentStep === 2) {
        const friendInput = document.getElementById('friendname');
        const friend = friendInput.value.trim();

        if (!friend) {
            shakeInput(friendInput);
            return;
        }

        finalUserName = document.getElementById('username').value.trim();
        finalFriendName = friend;

        transitionSteps('step-2', 'step-3', 2, () => {
            refreshQqMusicAccess();
        });
    }
}

function shakeInput(input) {
    if (!input) return;
    input.parentElement.animate([
        { transform: 'translateX(0)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(0)' }
    ], {
        duration: 300,
        iterations: 1
    });
    input.focus();
}

const typingTimers = new WeakMap();

function stopTyping(element) {
    if (!element) return;
    const timer = typingTimers.get(element);
    if (timer) {
        clearTimeout(timer);
        typingTimers.delete(element);
    }
    element.classList.remove("is-typing");
}

function getTypingSpeed(text) {
    const length = text.length;
    let baseSpeed = 75;
    if (length > 800) baseSpeed = 36;
    else if (length > 400) baseSpeed = 48;
    else if (length > 160) baseSpeed = 60;

    const speedConfig = TYPING_SPEED_MAP[selectedTypingSpeed];
    const multiplier = speedConfig ? speedConfig.multiplier : 1;
    return Math.max(16, Math.round(baseSpeed * multiplier));
}

function typeMessage(element, message, autoScroll = false) {
    if (!element) return Promise.resolve();
    stopTyping(element);

    const content = message || "";
    const speed = getTypingSpeed(content);
    let index = 0;

    element.textContent = "";
    element.scrollTop = 0;

    if (!content) {
        element.classList.remove("is-typing");
        return Promise.resolve();
    }

    element.classList.add("is-typing");

    return new Promise(resolve => {
        const tick = () => {
            index += 1;
            element.textContent = content.slice(0, index);
            if (autoScroll) {
                element.scrollTop = element.scrollHeight;
            }
            if (index < content.length) {
                const timerId = setTimeout(tick, speed);
                typingTimers.set(element, timerId);
            } else {
                element.classList.remove("is-typing");
                typingTimers.delete(element);
                resolve();
            }
        };

        tick();
    });
}

function showResult(message) {
    const result = document.getElementById('step-result');
    const progress = document.getElementById('progress');
    const activeStep = document.querySelector('.step.active');

    resultHiddenStepId = activeStep ? activeStep.id : "";
    if (activeStep && activeStep.id === "step-preview") {
        resultOriginStepId = previewOriginStepId || "step-9";
    } else {
        resultOriginStepId = activeStep ? activeStep.id : "step-9";
    }

    if (activeStep && activeStep.id !== 'step-result') {
        activeStep.classList.remove('active');
        activeStep.classList.add('exit-up');
    }

    if (progress) progress.style.opacity = '0';
    resetMediaStack();

    const displayUser = document.getElementById('display-user');
    const displayFriend = document.getElementById('display-friend');
    const displayMessage = document.getElementById('display-message');
    const userName = finalUserName || (document.getElementById('username').value || '').trim();
    const friendName = finalFriendName || (document.getElementById('friendname').value || '').trim();

    if (displayUser) {
        stopTyping(displayUser);
        displayUser.textContent = "";
    }
    if (displayFriend) {
        stopTyping(displayFriend);
        displayFriend.textContent = "";
    }
    if (displayMessage) {
        stopTyping(displayMessage);
        displayMessage.textContent = "";
    }

    setTimeout(() => {
        if (activeStep && activeStep.id !== 'step-result') {
            activeStep.style.display = 'none';
        }
        if (result) {
            result.classList.remove('exit-up');
            result.classList.add('active');
        }
        const runTyping = async () => {
            if (displayUser) await typeMessage(displayUser, userName);
            if (displayMessage) await typeMessage(displayMessage, message, true);
            if (displayFriend) await typeMessage(displayFriend, friendName);
        };
        runTyping().then(() => {
            queueMediaReveal();
        });
        startMusicPlayback();
    }, 400);
}

const resultView = document.getElementById("step-result");
const mediaCard = document.getElementById("media-card");
const mediaFrame = document.getElementById("media-frame");
const resultToggleButton = document.getElementById("result-toggle-button");
const resultBackButton = document.getElementById("result-back-button");

function inferMediaType(url) {
    if (!url) return "image";
    const cleanUrl = url.split("?")[0].split("#")[0];
    const ext = cleanUrl.split(".").pop().toLowerCase();
    if (["mp4", "webm", "ogg"].includes(ext)) return "video";
    return "image";
}

function resetMediaStack() {
    if (mediaRevealTimer) {
        clearTimeout(mediaRevealTimer);
        mediaRevealTimer = null;
    }
    if (mediaFocusTimer) {
        clearTimeout(mediaFocusTimer);
        mediaFocusTimer = null;
    }
    if (resultView) {
        resultView.classList.remove(
            "has-media",
            "media-peek",
            "media-focus",
            "media-toggle-ready",
            "show-media",
            "show-letter"
        );
    }
    if (mediaCard) {
        mediaCard.setAttribute("aria-hidden", "true");
    }
    if (mediaFrame) {
        mediaFrame.innerHTML = "";
        delete mediaFrame.dataset.mediaUrl;
        delete mediaFrame.dataset.mediaType;
    }
    if (resultToggleButton) {
        resultToggleButton.setAttribute("aria-pressed", "false");
        resultToggleButton.textContent = "查看图片";
    }
}

function buildMediaCard(media) {
    if (!mediaCard || !mediaFrame || !media || !media.url) return false;

    const currentUrl = mediaFrame.dataset.mediaUrl || "";
    const currentType = mediaFrame.dataset.mediaType || "";
    if (currentUrl === media.url && currentType === media.type && mediaFrame.firstElementChild) {
        const existing = mediaFrame.firstElementChild;
        if (existing.tagName === "VIDEO") {
            existing.play().catch(() => {});
        }
        return true;
    }

    mediaFrame.innerHTML = "";
    mediaFrame.dataset.mediaUrl = media.url;
    mediaFrame.dataset.mediaType = media.type;
    if (media.type === "video") {
        const video = document.createElement("video");
        video.src = media.url;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute("playsinline", "");
        video.setAttribute("preload", "auto");
        mediaFrame.appendChild(video);
        video.play().catch(() => {});
    } else {
        const img = document.createElement("img");
        img.src = media.url;
        img.alt = "媒体预览";
        mediaFrame.appendChild(img);
    }

    return true;
}

function setResultViewMode(mode) {
    if (!resultView) return;
    const showMedia = mode === "media";
    resultView.classList.toggle("show-media", showMedia);
    resultView.classList.toggle("show-letter", !showMedia);
    if (mediaCard) {
        mediaCard.setAttribute("aria-hidden", showMedia ? "false" : "true");
    }
    if (resultToggleButton) {
        resultToggleButton.setAttribute("aria-pressed", showMedia ? "true" : "false");
        resultToggleButton.textContent = showMedia ? "查看信件" : "查看图片";
    }
}

function queueMediaReveal() {
    const media = getStoredLetterMedia();
    if (!media || !resultView) return;
    if (!buildMediaCard(media)) return;

    resultView.classList.add("has-media");
    mediaRevealTimer = setTimeout(() => {
        resultView.classList.add("media-peek");
        if (mediaCard) {
            mediaCard.setAttribute("aria-hidden", "false");
        }
    }, MEDIA_PEEK_DELAY);
    mediaFocusTimer = setTimeout(() => {
        resultView.classList.add("media-focus", "media-toggle-ready");
        resultView.classList.remove("media-peek");
        setResultViewMode("media");
    }, MEDIA_PEEK_DELAY + MEDIA_FOCUS_DELAY);
}

if (resultToggleButton) {
    resultToggleButton.addEventListener("click", () => {
        if (!resultView) return;
        const isMedia = resultView.classList.contains("show-media");
        setResultViewMode(isMedia ? "letter" : "media");
    });
}

if (resultBackButton) {
    resultBackButton.addEventListener("click", () => {
        const progress = document.getElementById("progress");
        if (progress) {
            progress.style.opacity = "1";
            progress.style.transform = "translateY(0)";
        }

        const targetId = resultOriginStepId === "step-preview"
            ? (previewOriginStepId || "step-9")
            : (resultOriginStepId || "step-9");
        const targetStep = document.getElementById(targetId);
        if (targetStep) {
            targetStep.style.display = "";
        }
        if (resultHiddenStepId && resultHiddenStepId !== targetId) {
            const hiddenStep = document.getElementById(resultHiddenStepId);
            if (hiddenStep) hiddenStep.style.display = "";
        }

        stopTyping(document.getElementById("display-user"));
        stopTyping(document.getElementById("display-message"));
        stopTyping(document.getElementById("display-friend"));
        resetMediaStack();

        transitionSteps("step-result", targetId, getDotIndexForStep(targetId));
    });
}

// --- Step 3: Music Selection ---
const musicSourceOptions = document.getElementById("music-source-options");
const musicSearchSection = document.getElementById("music-search-section");
const musicSearchInput = document.getElementById("music-search-input");
const musicSearchBtn = document.getElementById("music-search-btn");
const musicSearchResults = document.getElementById("music-search-results");
const selectedMusicPreview = document.getElementById("selected-music-preview");
const musicBackButton = document.getElementById("music-back-button");
const musicContinueButton = document.getElementById("music-continue-button");

let currentMusicSource = "none";
let selectedMusic = null;
let musicAudio = null;
let isPlaying = false;
const QQ_MUSIC_AUTH_ENDPOINT = "/api/account/qqmusic/verify";
const qqMusicButton = musicSourceOptions
    ? musicSourceOptions.querySelector('[data-source="qq"]')
    : null;
const qqMusicTag = qqMusicButton ? qqMusicButton.querySelector(".vip-tag") : null;
const qqMusicTagDefault = "VIP专用";
const neteaseVipButton = musicSourceOptions
    ? musicSourceOptions.querySelector('[data-source="netease-login"]')
    : null;
const neteaseVipTag = neteaseVipButton ? neteaseVipButton.querySelector(".vip-tag") : null;
const neteaseVipTagDefault = "登录后才可以使用";
const neteaseVipMaintenanceTag = "正在维护";

function showToast(message, type = "warning") {
    const existingToast = document.querySelector(".input-toast");
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement("div");
    toast.className = `input-toast input-toast-${type}`;
    toast.innerHTML = `
        <svg class="toast-icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
            <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm-32 232c0-4.4 3.6-8 8-8h48c4.4 0 8 3.6 8 8v272c0 4.4-3.6 8-8 8h-48c-4.4 0-8-3.6-8-8V296zm32 440c-26.5 0-48-21.5-48-48s21.5-48 48-48 48 21.5 48 48-21.5 48-48 48z" fill="currentColor"/>
        </svg>
        <span class="toast-message">${message}</span>
    `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("toast-show");
    });

    setTimeout(() => {
        toast.classList.remove("toast-show");
        toast.classList.add("toast-hide");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function setQqMusicAccess(isAllowed) {
    if (!qqMusicButton) return;
    qqMusicButton.disabled = !isAllowed;
    qqMusicButton.classList.toggle("is-disabled", !isAllowed);
    qqMusicButton.setAttribute("aria-disabled", isAllowed ? "false" : "true");
    if (qqMusicTag) {
        qqMusicTag.textContent = isAllowed ? qqMusicTagDefault : "登录后才可以使用";
    }
    if (!isAllowed && currentMusicSource === "qq") {
        currentMusicSource = "none";
        const sourceBtns = musicSourceOptions
            ? musicSourceOptions.querySelectorAll(".music-source-btn")
            : [];
        sourceBtns.forEach(btn => btn.classList.remove("selected"));
        const noneButton = musicSourceOptions
            ? musicSourceOptions.querySelector('[data-source="none"]')
            : null;
        if (noneButton) {
            noneButton.classList.add("selected");
        }
        stopMusicPreview();
        selectedMusic = null;
        if (selectedMusicPreview) selectedMusicPreview.style.display = "none";
        if (musicSearchResults) musicSearchResults.innerHTML = "";
        if (musicSearchInput) musicSearchInput.value = "";
        if (musicSearchSection) musicSearchSection.style.display = "none";
        try {
            sessionStorage.removeItem("musicData");
            sessionStorage.setItem("musicSource", "none");
        } catch (error) {
        }
    }
}

function setNeteaseVipStatus(isLoggedIn) {
    if (!neteaseVipButton) return;
    neteaseVipButton.disabled = true;
    neteaseVipButton.classList.add("is-disabled");
    neteaseVipButton.setAttribute("aria-disabled", "true");
    if (neteaseVipTag) {
        neteaseVipTag.textContent = isLoggedIn ? neteaseVipMaintenanceTag : neteaseVipTagDefault;
    }
    if (currentMusicSource === "netease-login") {
        currentMusicSource = "none";
        const sourceBtns = musicSourceOptions
            ? musicSourceOptions.querySelectorAll(".music-source-btn")
            : [];
        sourceBtns.forEach(btn => btn.classList.remove("selected"));
        const noneButton = musicSourceOptions
            ? musicSourceOptions.querySelector('[data-source="none"]')
            : null;
        if (noneButton) {
            noneButton.classList.add("selected");
        }
        stopMusicPreview();
        selectedMusic = null;
        if (selectedMusicPreview) selectedMusicPreview.style.display = "none";
        if (musicSearchResults) musicSearchResults.innerHTML = "";
        if (musicSearchInput) musicSearchInput.value = "";
        if (musicSearchSection) musicSearchSection.style.display = "none";
        try {
            sessionStorage.removeItem("musicData");
            sessionStorage.setItem("musicSource", "none");
        } catch (error) {
        }
    }
}

async function refreshQqMusicAccess() {
    if (!qqMusicButton && !neteaseVipButton) return;
    try {
        const response = await fetch(QQ_MUSIC_AUTH_ENDPOINT, {
            method: "GET",
            credentials: "same-origin"
        });
        const result = await response.json();
        const isLoggedIn = Boolean(result && result.valid);
        setQqMusicAccess(isLoggedIn);
        setNeteaseVipStatus(isLoggedIn);
    } catch (error) {
        setQqMusicAccess(false);
        setNeteaseVipStatus(false);
    }
}

setQqMusicAccess(false);
setNeteaseVipStatus(false);

if (musicSourceOptions) {
    const sourceBtns = musicSourceOptions.querySelectorAll(".music-source-btn");

    sourceBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const source = btn.dataset.source;
            currentMusicSource = source;

            sourceBtns.forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");

            stopMusicPreview();
            selectedMusic = null;
            if (selectedMusicPreview) selectedMusicPreview.style.display = "none";
            if (musicSearchResults) musicSearchResults.innerHTML = "";
            if (musicSearchInput) musicSearchInput.value = "";

            if (source === "none") {
                if (musicSearchSection) musicSearchSection.style.display = "none";
                try {
                    sessionStorage.removeItem("musicData");
                } catch (error) {
                }
            } else if (musicSearchSection) {
                musicSearchSection.style.display = "block";
                if (musicSearchInput) {
                    setTimeout(() => musicSearchInput.focus(), 300);
                }
            }

            if (navigator.vibrate) {
                navigator.vibrate(10);
            }
        });
    });
}

if (musicSearchBtn) {
    musicSearchBtn.addEventListener("click", performMusicSearch);
}

if (musicSearchInput) {
    musicSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            performMusicSearch();
        }
    });
}

const QQMUSIC_API_BASE = "/api/qqmusic";
const NETEASE_API_BASE = "/api/netease";

async function getQQMusicURL(songmid, quality = "128") {
    try {
        const response = await fetch(`${QQMUSIC_API_BASE}/play`, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                songmid: songmid,
                shareUrl: `https://y.qq.com/n/ryqq/songDetail/${songmid}`
            })
        });
        const result = await response.json();
        if (result.code === 403) {
            showToast("登录后才可以使用QQ音乐", "warning");
            setQqMusicAccess(false);
            return null;
        }
        if (result.code === 200 && result.data && result.data.playUrl) {
            return result.data.playUrl;
        }
        return null;
    } catch (err) {
        return null;
    }
}

async function searchQQMusicWithKeyword(keyword) {
    try {
        const response = await fetch(`${QQMUSIC_API_BASE}/search`, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                query: keyword
            })
        });
        const result = await response.json();
        if (result.code === 403) {
            showToast("登录后才可以使用QQ音乐", "warning");
            setQqMusicAccess(false);
            return null;
        }

        if (result.code === 429) {
            showToast(result.error || "请求过于频繁，请稍后再试", "warning");
            return null;
        }

        if (result.code === 200 && result.data) {
            return {
                list: result.data.map(song => ({
                    name: song.title,
                    mid: song.songmid,
                    singer: [{ name: song.artist }],
                    album: { mid: song.albummid },
                    pay: { pay_play: 0 }
                }))
            };
        }
        return null;
    } catch (err) {
        return null;
    }
}

function getQQAlbumCoverImage(albummid) {
    return `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg`;
}

async function checkQQMusicBlocked() {
    try {
        const response = await fetch(`${QQMUSIC_API_BASE}/blocked`, {
            credentials: "same-origin"
        });
        const result = await response.json();
        if (result.blocked && result.remainingMinutes > 0) {
            showToast(`IP 被暂时封禁，请 ${result.remainingMinutes} 分钟后再试`, "warning");
            return true;
        }
        return false;
    } catch (err) {
        return false;
    }
}

async function searchNeteaseMusicWithKeyword(keyword, page = 1) {
    try {
        const response = await fetch(`${NETEASE_API_BASE}/search`, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                query: keyword,
                page: page
            })
        });
        const result = await response.json();

        if (result.code === 429) {
            showToast(result.error || "请求过于频繁，请稍后再试", "warning");
            return null;
        }

        if (result.code === 200 && result.data) {
            return {
                list: result.data.map(song => ({
                    name: song.title,
                    mid: song.songmid || song.songid,
                    artist: song.artist,
                    cover: song.cover,
                    url: song.url
                }))
            };
        }
        return null;
    } catch (err) {
        return null;
    }
}

async function getNeteasePlayURL(songid) {
    try {
        const response = await fetch(`${NETEASE_API_BASE}/play`, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                songid: songid
            })
        });
        const result = await response.json();
        if (result.code === 200 && result.data && result.data.playUrl) {
            return result.data.playUrl;
        }
        return null;
    } catch (err) {
        return null;
    }
}

async function checkNeteaseBlocked() {
    try {
        const response = await fetch(`${NETEASE_API_BASE}/blocked`, {
            credentials: "same-origin"
        });
        const result = await response.json();
        if (result.blocked && result.remainingMinutes > 0) {
            showToast(`IP 被暂时封禁，请 ${result.remainingMinutes} 分钟后再试`, "warning");
            return true;
        }
        return false;
    } catch (err) {
        return false;
    }
}

async function performMusicSearch() {
    const query = musicSearchInput ? musicSearchInput.value.trim() : "";
    if (!query) {
        showToast("请输入歌曲名称", "warning");
        return;
    }

    if (musicSearchResults) {
        musicSearchResults.innerHTML = '<div class="search-loading">搜索中...</div>';
    }

    try {
        if (currentMusicSource === "qq") {
            await searchQQMusic(query);
        } else if (currentMusicSource === "netease") {
            await searchNeteaseMusic(query);
        }
    } catch (error) {
        if (musicSearchResults) {
            musicSearchResults.innerHTML = '<div class="search-error">搜索失败，请稍后重试</div>';
        }
    }
}

async function searchQQMusic(query) {
    try {
        const blocked = await checkQQMusicBlocked();
        if (blocked) {
            if (musicSearchResults) {
                musicSearchResults.innerHTML = '<div class="search-error">请求被限流，请稍后再试</div>';
            }
            return;
        }

        const result = await searchQQMusicWithKeyword(query);

        if (result && result.list && result.list.length > 0) {
            const songs = result.list.map(song => ({
                songname: song.name,
                name: song.singer.map(s => s.name).join(" / "),
                mid: song.mid,
                albummid: song.album.mid,
                cover: getQQAlbumCoverImage(song.album.mid),
                pay: song.pay.pay_play === 1 ? "收费" : "免费"
            }));
            renderMusicResults(songs, "qq");
        } else if (musicSearchResults) {
            musicSearchResults.innerHTML = '<div class="search-empty">未找到相关歌曲</div>';
        }
    } catch (error) {
        if (musicSearchResults) {
            musicSearchResults.innerHTML = '<div class="search-error">搜索失败，请检查网络连接</div>';
        }
    }
}

async function searchNeteaseMusic(query) {
    try {
        const blocked = await checkNeteaseBlocked();
        if (blocked) {
            if (musicSearchResults) {
                musicSearchResults.innerHTML = '<div class="search-error">请求被限流，请稍后再试</div>';
            }
            return;
        }

        const result = await searchNeteaseMusicWithKeyword(query, 1);

        if (result && result.list && result.list.length > 0) {
            const songs = result.list.map(song => ({
                songname: song.name,
                name: song.artist,
                mid: song.mid,
                cover: song.cover || "",
                url: song.url || "",
                pay: "免费"
            }));
            renderMusicResults(songs, "netease");
        } else if (musicSearchResults) {
            musicSearchResults.innerHTML = '<div class="search-empty">未找到相关歌曲</div>';
        }
    } catch (error) {
        if (musicSearchResults) {
            musicSearchResults.innerHTML = '<div class="search-error">搜索失败，请检查网络连接</div>';
        }
    }
}

function renderMusicResults(results, source) {
    if (!musicSearchResults) return;

    if (!results || results.length === 0) {
        musicSearchResults.innerHTML = '<div class="search-empty">未找到相关歌曲</div>';
        return;
    }

    musicSearchResults.innerHTML = results.map((song, index) => `
        <div class="music-result-item" data-index="${index}">
            <img class="result-cover" src="${song.cover || ""}" alt="封面" onerror="this.style.display='none'">
            <div class="result-info">
                <div class="result-title">${song.songname || "未知歌曲"}</div>
                <div class="result-artist">${song.name || "未知歌手"}</div>
            </div>
            <div class="result-badge ${song.pay === "收费" ? "pay" : "free"}">${song.pay === "收费" ? "VIP" : "免费"}</div>
        </div>
    `).join("");

    const items = musicSearchResults.querySelectorAll(".music-result-item");
    items.forEach((item, index) => {
        item.addEventListener("click", () => {
            selectMusic(results[index], source);
        });
    });
}

function selectMusic(song, source) {
    selectedMusic = {
        source: source,
        songname: song.songname,
        artist: song.name,
        cover: song.cover,
        mid: song.mid,
        albummid: song.albummid,
        src: song.url || null
    };

    const previewCover = document.getElementById("preview-cover");
    const previewTitle = document.getElementById("preview-title");
    const previewArtist = document.getElementById("preview-artist");

    if (previewCover) previewCover.src = song.cover || "";
    if (previewTitle) previewTitle.textContent = song.songname || "未知歌曲";
    if (previewArtist) previewArtist.textContent = song.name || "未知歌手";

    if (selectedMusicPreview) {
        selectedMusicPreview.style.display = "flex";
    }

    if (musicSearchResults) {
        musicSearchResults.innerHTML = "";
    }

    try {
        sessionStorage.setItem("musicData", JSON.stringify(selectedMusic));
    } catch (e) {
    }

    if (navigator.vibrate) {
        navigator.vibrate(10);
    }
}

const previewPlayBtn = document.getElementById("preview-play-btn");
if (previewPlayBtn) {
    previewPlayBtn.addEventListener("click", toggleMusicPreview);
}

async function toggleMusicPreview() {
    if (!selectedMusic || !selectedMusic.mid) {
        showToast("该歌曲暂时无法播放", "warning");
        return;
    }

    musicAudio = document.getElementById("music-audio");
    if (!musicAudio) return;

    const playIcon = document.querySelector("#preview-play-btn .play-icon");
    const pauseIcon = document.querySelector("#preview-play-btn .pause-icon");
    const playBtn = document.getElementById("preview-play-btn");

    if (isPlaying) {
        musicAudio.pause();
        isPlaying = false;
        if (playIcon) playIcon.style.display = "block";
        if (pauseIcon) pauseIcon.style.display = "none";
        return;
    }

    if (!selectedMusic.src) {
        if (playBtn) playBtn.disabled = true;
        showToast("正在获取播放链接...", "warning");

        try {
            let url = null;

            if (selectedMusic.source === "qq") {
                url = await getQQMusicURL(selectedMusic.mid, "128");
            } else if (selectedMusic.source === "netease") {
                url = await getNeteasePlayURL(selectedMusic.mid);
            }

            if (url && url.length > 10) {
                selectedMusic.src = url;
                sessionStorage.setItem("musicData", JSON.stringify(selectedMusic));
            } else {
                showToast("该歌曲可能需要VIP权限", "warning");
                if (playBtn) playBtn.disabled = false;
                return;
            }
        } catch (err) {
            showToast("获取播放链接失败", "warning");
            if (playBtn) playBtn.disabled = false;
            return;
        }
        if (playBtn) playBtn.disabled = false;
    }

    musicAudio.src = selectedMusic.src;
    musicAudio.play().then(() => {
        isPlaying = true;
        if (playIcon) playIcon.style.display = "none";
        if (pauseIcon) pauseIcon.style.display = "block";
    }).catch(() => {
        showToast("播放失败，请尝试其他歌曲", "warning");
    });
}

function stopMusicPreview() {
    musicAudio = document.getElementById("music-audio");
    if (musicAudio) {
        musicAudio.pause();
        musicAudio.src = "";
    }
    isPlaying = false;

    const playIcon = document.querySelector("#preview-play-btn .play-icon");
    const pauseIcon = document.querySelector("#preview-play-btn .pause-icon");
    if (playIcon) playIcon.style.display = "block";
    if (pauseIcon) pauseIcon.style.display = "none";
}

const removeMusicBtn = document.getElementById("remove-music-btn");
if (removeMusicBtn) {
    removeMusicBtn.addEventListener("click", () => {
        stopMusicPreview();
        selectedMusic = null;
        if (selectedMusicPreview) selectedMusicPreview.style.display = "none";
        try {
            sessionStorage.removeItem("musicData");
        } catch (error) {
        }
    });
}

if (musicBackButton) {
    musicBackButton.addEventListener("click", () => {
        stopMusicPreview();
        transitionSteps('step-3', 'step-2', 1, () => {
            const friendInput = document.getElementById('friendname');
            if (friendInput) friendInput.focus();
        });
    });
}

if (musicContinueButton) {
    musicContinueButton.addEventListener("click", () => {
        stopMusicPreview();

        if (currentMusicSource === "none") {
            try {
                sessionStorage.removeItem("musicData");
                sessionStorage.setItem("musicSource", "none");
            } catch (error) {
            }
            transitionSteps('step-3', 'step-6', 5, () => {
                if (!selectedContentType) {
                    selectContentType("official");
                }
            });
            return;
        }

        if (!selectedMusic) {
            showToast("请选择一首歌曲或选择不使用音乐", "warning");
            return;
        }

        try {
            sessionStorage.setItem("musicSource", currentMusicSource);
        } catch (error) {
        }

        transitionSteps('step-3', 'step-4', 3, () => {
            stopSnippetPreview();
        });
    });
}

// --- Step 4: Playback Mode ---
const playbackModeOptions = document.getElementById("playback-mode-options");
const playbackBackButton = document.getElementById("playback-back-button");
const playbackContinueButton = document.getElementById("playback-continue-button");
const playbackSnippetControls = document.getElementById("playback-snippet-controls");
const snippetSlider = document.getElementById("snippet-slider");
const snippetTimeDisplay = document.getElementById("snippet-time-display");
const snippetPreviewBtn = document.getElementById("snippet-preview-btn");
const timeBackButton = document.getElementById("time-back-button");
const timeContinueButton = document.getElementById("time-continue-button");
const playbackFullInfo = document.getElementById("playback-full-info");

let currentPlaybackMode = "full";
let snippetStartTime = 0;
let snippetAudio = null;
let snippetDuration = 0;
let isDraggingSnippet = false;

const snippetPlayLabel = `
    <span class="button-icon">
        <svg class="icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
            <path d="M715.8 493.5L335 165.1c-14.2-12.2-35-1.2-35 18.5v656.8c0 19.7 20.8 30.7 35 18.5l380.8-328.4c10.9-9.4 10.9-27.6 0-37z" fill="currentColor"/>
        </svg>
    </span>
    试听开始时间
`;

const snippetPauseLabel = `
    <span class="button-icon">
        <svg class="icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
            <path d="M304 176h80v672h-80zM640 176h80v672h-80z" fill="currentColor"/>
        </svg>
    </span>
    暂停试听
`;

function setSnippetButtonLabel(isPlaying) {
    if (snippetPreviewBtn) {
        snippetPreviewBtn.innerHTML = isPlaying ? snippetPauseLabel : snippetPlayLabel;
    }
}

function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`;
}

async function initSnippetAudio() {
    if (!selectedMusic) {
        try {
            const stored = sessionStorage.getItem("musicData");
            if (stored) selectedMusic = JSON.parse(stored);
        } catch (e) { }
    }

    if (!selectedMusic) return;

    let src = selectedMusic.src;
    if (!src && selectedMusic.mid) {
        try {
            if (selectedMusic.source === "qq") {
                src = await getQQMusicURL(selectedMusic.mid, "128");
            } else if (selectedMusic.source === "netease") {
                src = await getNeteasePlayURL(selectedMusic.mid);
            }
        } catch (e) { }
    }

    if (!src) return;

    if (!snippetAudio) {
        snippetAudio = new Audio();
        snippetAudio.addEventListener("loadedmetadata", () => {
            snippetDuration = snippetAudio.duration;
            if (snippetSlider) {
                snippetSlider.max = Math.floor(snippetDuration);
                if (snippetDuration > 10) snippetSlider.max = Math.floor(snippetDuration - 5);
            }
        });

        snippetAudio.addEventListener("timeupdate", () => {
            if (!isDraggingSnippet && snippetSlider && !snippetAudio.paused) {
                const currentTime = Math.floor(snippetAudio.currentTime);
                if (currentTime <= snippetSlider.max) {
                    snippetSlider.value = currentTime;
                    snippetStartTime = currentTime;
                    if (snippetTimeDisplay) {
                        snippetTimeDisplay.textContent = formatTime(currentTime);
                    }
                }
            }
        });

        snippetAudio.addEventListener("ended", () => {
            setSnippetButtonLabel(false);
        });

        snippetAudio.src = src;
    } else if (snippetAudio.src !== src) {
        snippetAudio.src = src;
    }
}

function updatePlaybackTimeUI() {
    if (currentPlaybackMode === "snippet") {
        if (playbackFullInfo) playbackFullInfo.style.display = "none";
        if (playbackSnippetControls) playbackSnippetControls.style.display = "block";
        initSnippetAudio();
        if (snippetSlider) {
            snippetSlider.value = snippetStartTime;
        }
        if (snippetTimeDisplay) {
            snippetTimeDisplay.textContent = formatTime(snippetStartTime);
        }
    } else {
        if (playbackSnippetControls) playbackSnippetControls.style.display = "none";
        if (playbackFullInfo) playbackFullInfo.style.display = "block";
        stopSnippetPreview();
    }
}

if (playbackModeOptions) {
    const modeBtns = playbackModeOptions.querySelectorAll(".music-source-btn");

    modeBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const mode = btn.dataset.mode;
            currentPlaybackMode = mode;

            modeBtns.forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");

            updatePlaybackTimeUI();

            if (navigator.vibrate) {
                navigator.vibrate(10);
            }
        });
    });
}

if (snippetSlider) {
    snippetSlider.addEventListener("mousedown", () => isDraggingSnippet = true);
    snippetSlider.addEventListener("mouseup", () => isDraggingSnippet = false);
    snippetSlider.addEventListener("touchstart", () => isDraggingSnippet = true);
    snippetSlider.addEventListener("touchend", () => isDraggingSnippet = false);

    snippetSlider.addEventListener("input", (e) => {
        snippetStartTime = parseInt(e.target.value, 10);
        if (snippetTimeDisplay) {
            snippetTimeDisplay.textContent = formatTime(snippetStartTime);
        }
        if (snippetAudio) {
            snippetAudio.currentTime = snippetStartTime;
        }
    });
}

if (snippetPreviewBtn) {
    snippetPreviewBtn.addEventListener("click", () => {
        if (!snippetAudio) return;

        if (snippetAudio.paused) {
            snippetAudio.currentTime = snippetStartTime;
            snippetAudio.play();
            setSnippetButtonLabel(true);
        } else {
            snippetAudio.pause();
            setSnippetButtonLabel(false);
        }
    });
}

function stopSnippetPreview() {
    if (snippetAudio) {
        snippetAudio.pause();
    }
    setSnippetButtonLabel(false);
}

function persistPlaybackSettings() {
    try {
        sessionStorage.setItem("playbackMode", currentPlaybackMode);
        if (currentPlaybackMode === "snippet") {
            sessionStorage.setItem("snippetStartTime", snippetStartTime);
        } else {
            sessionStorage.removeItem("snippetStartTime");
        }
    } catch (e) { }
}

if (playbackBackButton) {
    playbackBackButton.addEventListener("click", () => {
        stopSnippetPreview();
        transitionSteps("step-4", "step-3", 2);
    });
}

if (playbackContinueButton) {
    playbackContinueButton.addEventListener("click", () => {
        stopSnippetPreview();
        if (currentPlaybackMode === "full") {
            persistPlaybackSettings();
            transitionSteps("step-4", "step-6", 5, () => {
                if (!selectedContentType) {
                    selectContentType("official");
                }
            });
            return;
        }

        transitionSteps("step-4", "step-5", 4, () => {
            updatePlaybackTimeUI();
        });
    });
}

if (timeBackButton) {
    timeBackButton.addEventListener("click", () => {
        stopSnippetPreview();
        transitionSteps("step-5", "step-4", 3);
    });
}

if (timeContinueButton) {
    timeContinueButton.addEventListener("click", () => {
        stopSnippetPreview();
        persistPlaybackSettings();

        transitionSteps("step-5", "step-6", 5, () => {
            if (!selectedContentType) {
                selectContentType("official");
            }
        });
    });
}

// --- Step 6: Content Selection ---
const contentOptions = document.getElementById("content-options");
const customContentSection = document.getElementById("custom-content-section");
const customContentText = document.getElementById("custom-content-text");
const officialContentPreview = document.getElementById("official-content-preview");
const contentBackButton = document.getElementById("content-back-button");
const contentContinueButton = document.getElementById("content-continue-button");
const onlinePreviewButton = document.getElementById("online-preview-button");
const fontOptions = document.getElementById("font-options");
const fontBackButton = document.getElementById("font-back-button");
const fontContinueButton = document.getElementById("font-continue-button");
const typingSpeedOptions = document.getElementById("typing-speed-options");
const typingSpeedBackButton = document.getElementById("typing-speed-back-button");
const typingSpeedContinueButton = document.getElementById("typing-speed-continue-button");
const mediaOptions = document.getElementById("media-options");
const mediaImageInput = document.getElementById("media-image-input");
const mediaVideoInput = document.getElementById("media-video-input");
const mediaPreview = document.getElementById("media-preview");
const mediaPreviewFrame = document.getElementById("media-preview-frame");
const mediaPreviewName = document.getElementById("media-preview-name");
const mediaRemoveButton = document.getElementById("media-remove-button");
const mediaBackButton = document.getElementById("media-back-button");
const mediaContinueButton = document.getElementById("media-continue-button");
const previewStep = document.getElementById("step-preview");
const previewUserName = document.getElementById("preview-user-name");
const previewFriendName = document.getElementById("preview-friend-name");
const holdOpenButton = document.getElementById("hold-open-button");
const holdHint = document.getElementById("hold-hint");
const previewBackButton = document.getElementById("preview-back-button");

const HOLD_DURATION = 1200;
let holdAnimationFrame = null;
let holdStartTime = 0;
let holdCompleted = false;
let selectedFontType = "";
let previewOriginStepId = "step-9";
let letterSubmitInProgress = false;

const LETTER_FONT_MAP = {
    hand: {
        family: "\"Zhi Mang Xing\", \"Noto Serif SC\", \"Cormorant Garamond\", serif",
        weight: "400"
    },
    mi: {
        family: "\"MiSans\", \"Noto Sans SC\", sans-serif",
        weight: "700"
    }
};

function validateCustomContent(text) {
    const rawText = String(text || "");
    let hasExcess = false;

    if (rawText.length > MAX_CONTENT_CHARS) {
        hasExcess = true;
    }

    const trimmedText = hasExcess ? rawText.slice(0, MAX_CONTENT_CHARS) : rawText;

    return {
        text: trimmedText,
        hasExcess,
        lineCount: trimmedText.split("\n").length
    };
}

if (customContentText) {
    customContentText.addEventListener("input", () => {
        const result = validateCustomContent(customContentText.value);
        if (result.hasExcess) {
            customContentText.value = result.text;
            showToast(`最多 ${MAX_CONTENT_CHARS} 字`, "warning");
        }
    });
}

if (contentOptions) {
    const typeBtns = contentOptions.querySelectorAll(".music-source-btn");
    typeBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const type = btn.dataset.type;
            selectContentType(type);
        });
    });
}

if (fontOptions) {
    const fontBtns = fontOptions.querySelectorAll(".music-source-btn");
    fontBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const fontType = btn.dataset.font;
            applyLetterFont(fontType);
        });
    });
}

if (typingSpeedOptions) {
    const speedBtns = typingSpeedOptions.querySelectorAll(".music-source-btn");
    speedBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const speed = btn.dataset.speed;
            applyTypingSpeed(speed);
            if (navigator.vibrate) navigator.vibrate(10);
        });
    });
}

if (mediaOptions) {
    const mediaButtons = mediaOptions.querySelectorAll(".music-source-btn");
    mediaButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const mediaType = btn.dataset.media;
            if (mediaType === "none") {
                applyMediaSelection({ type: "none" });
                if (navigator.vibrate) navigator.vibrate(10);
                return;
            }

            if (mediaType === "image" && mediaImageInput) {
                mediaImageInput.click();
            }
            if (mediaType === "video" && mediaVideoInput) {
                mediaVideoInput.click();
            }
        });
    });
}

if (mediaImageInput) {
    mediaImageInput.addEventListener("change", () => {
        const file = mediaImageInput.files && mediaImageInput.files[0];
        if (file) handleMediaFile(file, "image");
        mediaImageInput.value = "";
    });
}

if (mediaVideoInput) {
    mediaVideoInput.addEventListener("change", () => {
        const file = mediaVideoInput.files && mediaVideoInput.files[0];
        if (file) handleMediaFile(file, "video");
        mediaVideoInput.value = "";
    });
}

if (mediaRemoveButton) {
    mediaRemoveButton.addEventListener("click", () => {
        applyMediaSelection({ type: "none" });
    });
}

function selectContentType(type) {
    selectedContentType = type;
    if (!contentOptions) return;

    try { sessionStorage.setItem("contentType", selectedContentType); } catch (e) { }

    const typeBtns = contentOptions.querySelectorAll(".music-source-btn");
    typeBtns.forEach(btn => {
        btn.classList.toggle("selected", btn.dataset.type === type);
    });

    if (type === "custom") {
        if (customContentSection) customContentSection.style.display = "block";
        if (officialContentPreview) officialContentPreview.style.display = "none";
        if (customContentText) setTimeout(() => customContentText.focus(), 100);
    } else {
        if (customContentSection) customContentSection.style.display = "none";
        if (officialContentPreview) {
            officialContentPreview.style.display = "block";
            const p = officialContentPreview.querySelector(".preview-text");
            if (p) p.textContent = OFFICIAL_LETTER;
        }
    }

    if (navigator.vibrate) navigator.vibrate(10);
}

function buildFinalContent() {
    if (selectedContentType === "custom") {
        const text = customContentText ? customContentText.value.trim() : "";
        if (!text) {
            showToast("请写下你想说的话哦", "warning");
            if (customContentText) shakeInput(customContentText);
            return "";
        }
        const validation = validateCustomContent(text);
        return validation.text;
    }

    if (selectedContentType === "official") {
        return OFFICIAL_LETTER;
    }

    showToast("请先选择内容类型", "warning");
    return "";
}

function getStoredFontType() {
    try { return sessionStorage.getItem("letterFont"); } catch (e) { return null; }
}

function applyLetterFont(fontType) {
    const config = LETTER_FONT_MAP[fontType];
    if (!config) return;

    selectedFontType = fontType;
    document.documentElement.style.setProperty("--letter-font", config.family);
    document.documentElement.style.setProperty("--letter-font-weight", config.weight);

    if (fontOptions) {
        const fontButtons = fontOptions.querySelectorAll(".music-source-btn");
        fontButtons.forEach(btn => {
            btn.classList.toggle("selected", btn.dataset.font === fontType);
        });
    }

    try { sessionStorage.setItem("letterFont", fontType); } catch (e) { }
}

function getStoredTypingSpeed() {
    try { return sessionStorage.getItem(TYPING_SPEED_KEY); } catch (e) { return null; }
}

function applyTypingSpeed(speed) {
    const config = TYPING_SPEED_MAP[speed];
    if (!config) return;

    selectedTypingSpeed = speed;

    if (typingSpeedOptions) {
        const speedButtons = typingSpeedOptions.querySelectorAll(".music-source-btn");
        speedButtons.forEach(btn => {
            btn.classList.toggle("selected", btn.dataset.speed === speed);
        });
    }

    try { sessionStorage.setItem(TYPING_SPEED_KEY, speed); } catch (e) { }
}

function getStoredLetterMedia() {
    try {
        const url = sessionStorage.getItem(LETTER_MEDIA_URL_KEY);
        if (!url) return null;
        const type = sessionStorage.getItem(LETTER_MEDIA_TYPE_KEY) || inferMediaType(url);
        const name = sessionStorage.getItem(LETTER_MEDIA_NAME_KEY) || "";
        return { url, type, name };
    } catch (e) {
        return null;
    }
}

function setMediaOptionActive(type) {
    if (!mediaOptions) return;
    const mediaButtons = mediaOptions.querySelectorAll(".music-source-btn");
    mediaButtons.forEach(btn => {
        btn.classList.toggle("selected", btn.dataset.media === type);
    });
}

function clearMediaPreview() {
    if (mediaPreviewFrame) mediaPreviewFrame.innerHTML = "";
    if (mediaPreviewFrame) {
        delete mediaPreviewFrame.dataset.mediaUrl;
        delete mediaPreviewFrame.dataset.mediaType;
    }
    if (mediaPreviewName) mediaPreviewName.textContent = "已选择媒体";
    if (mediaPreview) mediaPreview.style.display = "none";
}

function updateMediaPreview(media) {
    if (!mediaPreview || !mediaPreviewFrame) return;
    if (!media || !media.url || media.type === "none") {
        clearMediaPreview();
        return;
    }

    const currentUrl = mediaPreviewFrame.dataset.mediaUrl || "";
    const currentType = mediaPreviewFrame.dataset.mediaType || "";
    if (currentUrl === media.url && currentType === media.type && mediaPreviewFrame.firstElementChild) {
        const existing = mediaPreviewFrame.firstElementChild;
        if (existing.tagName === "VIDEO") {
            existing.play().catch(() => {});
        }
        if (mediaPreviewName) {
            const fallback = media.type === "video" ? "已选择视频" : "已选择图片";
            mediaPreviewName.textContent = media.name || fallback;
        }
        mediaPreview.style.display = "flex";
        return;
    }

    mediaPreviewFrame.innerHTML = "";
    mediaPreviewFrame.dataset.mediaUrl = media.url;
    mediaPreviewFrame.dataset.mediaType = media.type;
    if (media.type === "video") {
        const video = document.createElement("video");
        video.src = media.url;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute("playsinline", "");
        video.setAttribute("preload", "auto");
        mediaPreviewFrame.appendChild(video);
        video.play().catch(() => {});
    } else {
        const img = document.createElement("img");
        img.src = media.url;
        img.alt = "媒体预览";
        mediaPreviewFrame.appendChild(img);
    }

    if (mediaPreviewName) {
        const fallback = media.type === "video" ? "已选择视频" : "已选择图片";
        mediaPreviewName.textContent = media.name || fallback;
    }
    mediaPreview.style.display = "flex";
}

function persistMediaSelection() {
    try {
        if (selectedMediaType === "none" || !selectedMediaUrl) {
            sessionStorage.removeItem(LETTER_MEDIA_URL_KEY);
            sessionStorage.removeItem(LETTER_MEDIA_TYPE_KEY);
            sessionStorage.removeItem(LETTER_MEDIA_NAME_KEY);
            return;
        }
        sessionStorage.setItem(LETTER_MEDIA_URL_KEY, selectedMediaUrl);
        sessionStorage.setItem(LETTER_MEDIA_TYPE_KEY, selectedMediaType);
        if (selectedMediaName) {
            sessionStorage.setItem(LETTER_MEDIA_NAME_KEY, selectedMediaName);
        }
    } catch (e) { }
}

function applyMediaSelection(media) {
    const nextType = media && media.type ? media.type : "none";
    const nextUrl = media && media.url ? media.url : "";
    const nextName = media && media.name ? media.name : "";

    selectedMediaType = nextType;
    selectedMediaUrl = nextUrl;
    selectedMediaName = nextName;
    uploadedMediaInfo = null;

    if (nextType === "none" || !nextUrl) {
        if (mediaObjectUrl) {
            URL.revokeObjectURL(mediaObjectUrl);
            mediaObjectUrl = "";
        }
        selectedMediaFile = null;
        setMediaOptionActive("none");
        clearMediaPreview();
        persistMediaSelection();
        return;
    }

    setMediaOptionActive(nextType);
    updateMediaPreview({ type: nextType, url: nextUrl, name: nextName });
    persistMediaSelection();
}

function handleMediaFile(file, type) {
    if (!file || !type) return;
    const sizeLimit = type === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > sizeLimit) {
        showToast(type === "video" ? VIDEO_TOO_LARGE_MESSAGE : IMAGE_TOO_LARGE_MESSAGE, "warning");
        return;
    }
    if (mediaObjectUrl) {
        URL.revokeObjectURL(mediaObjectUrl);
        mediaObjectUrl = "";
    }
    selectedMediaFile = file;
    uploadedMediaInfo = null;
    const objectUrl = URL.createObjectURL(file);
    mediaObjectUrl = objectUrl;
    applyMediaSelection({ type, url: objectUrl, name: file.name });
    if (navigator.vibrate) navigator.vibrate(10);
}

function showFontStep() {
    const finalContent = persistFinalContent();
    if (!finalContent) return;

    if (!selectedFontType) {
        applyLetterFont(getStoredFontType() || "mi");
    }

    transitionSteps("step-6", "step-7", 6, () => {
        if (fontContinueButton) fontContinueButton.focus();
    });
}

function showTypingSpeedStep() {
    const finalContent = persistFinalContent();
    if (!finalContent) return;

    if (!selectedTypingSpeed) {
        applyTypingSpeed(getStoredTypingSpeed() || "normal");
    }

    transitionSteps("step-7", "step-8", 7, () => {
        if (typingSpeedContinueButton) typingSpeedContinueButton.focus();
    });
}

function showMediaStep() {
    const finalContent = persistFinalContent();
    if (!finalContent) return;

    const storedMedia = getStoredLetterMedia();
    applyMediaSelection(storedMedia || { type: "none" });

    transitionSteps("step-8", "step-9", 8, () => {
        if (mediaContinueButton) mediaContinueButton.focus();
    });
}

applyLetterFont(getStoredFontType() || "mi");
applyTypingSpeed(getStoredTypingSpeed() || "normal");
applyMediaSelection(getStoredLetterMedia() || { type: "none" });

function persistFinalContent() {
    const finalContent = buildFinalContent();
    if (!finalContent) return "";

    finalMessageCache = finalContent;
    try {
        sessionStorage.setItem("cardContent", finalContent);
    } catch (e) { }

    return finalContent;
}

function getStoredMusicData() {
    if (selectedMusic) return selectedMusic;
    try {
        const raw = sessionStorage.getItem("musicData");
        if (raw) return JSON.parse(raw);
    } catch (error) {
    }
    return null;
}

async function resolveMusicUrl(musicData) {
    if (!musicData) return "";
    if (musicData.src) return musicData.src;
    if (!musicData.mid) return "";

    if (musicData.source === "qq") {
        return (await getQQMusicURL(musicData.mid, "128")) || "";
    }
    if (musicData.source === "netease") {
        return (await getNeteasePlayURL(musicData.mid)) || "";
    }
    return "";
}

async function uploadLetterMedia() {
    if (selectedMediaType === "none") {
        return { url: "", mediaType: "none", name: "", bytes: 0 };
    }

    if (uploadedMediaInfo && uploadedMediaInfo.url) {
        return uploadedMediaInfo;
    }

    if (!MEDIA_UPLOAD_ENDPOINT) {
        throw new Error("MEDIA_SERVER_NOT_CONFIGURED");
    }

    if (!selectedMediaFile) {
        throw new Error("MEDIA_FILE_MISSING");
    }

    const mediaType = selectedMediaType === "video" ? "video" : "image";
    const filename = selectedMediaFile.name
        || (mediaType === "video" ? "letter-video.mp4" : "letter-image.jpg");
    const formData = new FormData();
    formData.append("file", selectedMediaFile, filename);

    const response = await fetch(MEDIA_UPLOAD_ENDPOINT, {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "X-Media-Type": mediaType
        },
        body: formData
    });

    const result = await response.json();
    if (!result || !result.success || !result.data || !result.data.url) {
        throw new Error(result && result.message ? result.message : "UPLOAD_FAILED");
    }

    uploadedMediaInfo = {
        url: result.data.url,
        mediaType: result.data.mediaType || mediaType,
        name: selectedMediaFile.name || "",
        bytes: selectedMediaFile.size || 0
    };

    return uploadedMediaInfo;
}

async function buildLetterPayload() {
    const recipientName = finalUserName || (document.getElementById("username").value || "").trim();
    const senderName = finalFriendName || (document.getElementById("friendname").value || "").trim();

    if (!recipientName || !senderName) {
        showToast("请填写收信人和署名", "warning");
        return null;
    }

    const cardContent = persistFinalContent();
    if (!cardContent) {
        return null;
    }

    if (cardContent.length > MAX_CONTENT_CHARS) {
        showToast(`最多 ${MAX_CONTENT_CHARS} 字`, "warning");
        return null;
    }

    const contentType = selectedContentType || sessionStorage.getItem("contentType") || "custom";
    const fontType = selectedFontType || getStoredFontType() || "mi";
    const typingSpeed = selectedTypingSpeed || getStoredTypingSpeed() || "normal";

    let mediaType = "none";
    let mediaUrl = "";
    let mediaName = "";
    let mediaBytes = 0;

    if (selectedMediaType !== "none") {
        if (!selectedMediaFile) {
            showToast("请重新选择图片或视频", "warning");
            return null;
        }
        const uploadInfo = await uploadLetterMedia();
        mediaType = uploadInfo.mediaType || selectedMediaType || "none";
        mediaUrl = uploadInfo.url || "";
        mediaName = uploadInfo.name || "";
        mediaBytes = uploadInfo.bytes || 0;
        if (!mediaUrl) {
            showToast("上传失败", "warning");
            return null;
        }
    }

    const musicSource = sessionStorage.getItem("musicSource") || currentMusicSource || "none";
    let musicData = null;
    let musicUrl = "";
    if (musicSource !== "none") {
        musicData = getStoredMusicData();
        if (!musicData) {
            showToast("请先选择音乐", "warning");
            return null;
        }

        musicUrl = await resolveMusicUrl(musicData);
        if (!musicUrl) {
            const source = musicData.source || musicSource;
            const message = source === "qq"
                ? "QQ音乐需要登录后才能分享播放，请先登录并重新选择歌曲"
                : "无法获取播放链接，请重新选择歌曲";
            showToast(message, "warning");
            return null;
        }

        musicData = { ...musicData, src: musicUrl };
    }

    const playbackMode = sessionStorage.getItem("playbackMode")
        || (typeof currentPlaybackMode !== "undefined" ? currentPlaybackMode : "full");
    const snippetStartTime = parseInt(sessionStorage.getItem("snippetStartTime") || "0", 10);

    return {
        recipientName,
        senderName,
        cardContent,
        contentType,
        fontType,
        typingSpeed,
        mediaType,
        mediaUrl,
        mediaName,
        mediaBytes,
        musicSource,
        musicUrl,
        musicData,
        playbackMode,
        snippetStartTime: Number.isFinite(snippetStartTime) ? snippetStartTime : 0
    };
}

function showShareResult(shareUrl) {
    if (!shareUrl) return;
    const existing = document.querySelector(".share-result");
    if (existing) existing.remove();

    const container = document.createElement("div");
    container.className = "share-result";

    const title = document.createElement("div");
    title.className = "share-result-title";
    title.textContent = "分享链接已生成";

    const input = document.createElement("input");
    input.className = "share-result-input";
    input.type = "text";
    input.readOnly = true;
    input.value = shareUrl;

    const actions = document.createElement("div");
    actions.className = "share-result-actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "share-result-btn";
    copyBtn.textContent = "复制";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "share-result-btn";
    openBtn.textContent = "打开";

    copyBtn.addEventListener("click", async () => {
        let copied = false;
        try {
            await navigator.clipboard.writeText(shareUrl);
            copied = true;
        } catch (error) {
            if (input) {
                input.focus();
                input.select();
                copied = document.execCommand("copy");
            }
        }
        copyBtn.textContent = copied ? "已复制" : "复制";
        setTimeout(() => {
            copyBtn.textContent = "复制";
        }, 2000);
    });

    openBtn.addEventListener("click", () => {
        window.open(shareUrl, "_blank", "noopener");
    });

    actions.appendChild(copyBtn);
    actions.appendChild(openBtn);

    container.appendChild(title);
    container.appendChild(input);
    container.appendChild(actions);

    document.body.appendChild(container);
}

async function submitLetter(submitButton) {
    if (letterSubmitInProgress) return;

    letterSubmitInProgress = true;
    const originalContent = submitButton ? submitButton.innerHTML : "";
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = "提交中...";
    }

    try {
        const payload = await buildLetterPayload();
        if (!payload) {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = originalContent;
            }
            return;
        }

        const response = await fetch(LETTER_SUBMIT_ENDPOINT, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok || !result || !result.success) {
            throw new Error(result && result.message ? result.message : "SUBMIT_FAILED");
        }

        showShareResult(result.data.shareUrl);
    } catch (error) {
        const message = error && error.message === "MEDIA_SERVER_NOT_CONFIGURED"
            ? "媒体服务器未配置"
            : error && error.message === "MEDIA_FILE_MISSING"
                ? "请重新选择图片或视频"
                : error && error.message === "UPLOAD_FAILED"
                    ? "上传失败"
                    : error && error.message
                        ? error.message
                        : "提交失败";
        showToast(message, "warning");
    } finally {
        letterSubmitInProgress = false;
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = originalContent;
        }
    }
}

function updatePreviewNames() {
    const userName = finalUserName || (document.getElementById("username").value || "").trim();
    const friendName = finalFriendName || (document.getElementById("friendname").value || "").trim();

    if (previewUserName) previewUserName.textContent = userName || "你";
    if (previewFriendName) previewFriendName.textContent = friendName || "TA";
}

function resetHoldState() {
    if (!holdOpenButton) return;
    holdCompleted = false;

    if (holdAnimationFrame) {
        cancelAnimationFrame(holdAnimationFrame);
        holdAnimationFrame = null;
    }

    holdOpenButton.classList.remove("is-holding", "is-complete");
    holdOpenButton.style.setProperty("--hold-progress", "0deg");
    if (holdHint) holdHint.textContent = "长按指纹开启";
}

function updateHoldProgress(now) {
    if (!holdOpenButton) return;
    const elapsed = now - holdStartTime;
    const progress = Math.min(elapsed / HOLD_DURATION, 1);

    holdOpenButton.style.setProperty("--hold-progress", `${progress * 360}deg`);

    if (progress >= 1) {
        completeHoldToOpen();
        return;
    }

    holdAnimationFrame = requestAnimationFrame(updateHoldProgress);
}

function startHoldToOpen() {
    if (!holdOpenButton || holdCompleted || holdAnimationFrame) return;

    holdStartTime = performance.now();
    holdOpenButton.classList.add("is-holding");
    if (holdHint) holdHint.textContent = "继续按住打开";
    if (navigator.vibrate) navigator.vibrate(15);

    holdAnimationFrame = requestAnimationFrame(updateHoldProgress);
}

function stopHoldToOpen() {
    if (!holdOpenButton || holdCompleted) return;

    if (holdAnimationFrame) {
        cancelAnimationFrame(holdAnimationFrame);
        holdAnimationFrame = null;
    }

    holdOpenButton.classList.remove("is-holding");
    holdOpenButton.style.setProperty("--hold-progress", "0deg");
    if (holdHint) holdHint.textContent = "长按指纹开启";
}

function completeHoldToOpen() {
    if (!holdOpenButton || holdCompleted) return;
    holdCompleted = true;

    if (holdAnimationFrame) {
        cancelAnimationFrame(holdAnimationFrame);
        holdAnimationFrame = null;
    }

    holdOpenButton.classList.remove("is-holding");
    holdOpenButton.classList.add("is-complete");
    holdOpenButton.style.setProperty("--hold-progress", "360deg");
    if (holdHint) holdHint.textContent = "已解锁";
    if (navigator.vibrate) navigator.vibrate([30, 40, 30]);

    setTimeout(() => {
        showResult(finalMessageCache);
    }, 200);
}

function showPreviewStep() {
    const finalContent = persistFinalContent();
    if (!finalContent || !previewStep) return;

    updatePreviewNames();
    resetHoldState();
    const activeStep = document.querySelector(".step.active");
    const fromId = activeStep ? activeStep.id : "step-6";
    previewOriginStepId = fromId;
    const dotIndex = getDotIndexForStep(fromId);
    transitionSteps(fromId, "step-preview", dotIndex, () => {
        if (holdOpenButton) holdOpenButton.focus();
    });
}

function getDotIndexForStep(stepId) {
    let dotIndex = 0;
    if (stepId) {
        const match = stepId.match(/step-(\d+)/);
        if (match) {
            const stepNumber = parseInt(match[1], 10);
            if (!Number.isNaN(stepNumber)) {
                const totalDots = document.querySelectorAll(".progress-dot").length;
                dotIndex = Math.min(stepNumber - 1, Math.max(totalDots - 1, 0));
            }
        }
    }
    return dotIndex;
}

if (contentBackButton) {
    contentBackButton.addEventListener("click", () => {
        const musicSource = sessionStorage.getItem("musicSource") || currentMusicSource;
        if (musicSource === "none") {
            transitionSteps("step-6", "step-3", 2);
            return;
        }

        const playbackMode = sessionStorage.getItem("playbackMode") || currentPlaybackMode;
        if (playbackMode === "snippet") {
            transitionSteps("step-6", "step-5", 4, () => {
                updatePlaybackTimeUI();
            });
        } else {
            transitionSteps("step-6", "step-4", 3);
        }
    });
}

function finalizeContentAndShow() {
    const finalContent = persistFinalContent();
    if (!finalContent) return;

    showResult(finalContent);
}

if (contentContinueButton) {
    contentContinueButton.addEventListener("click", () => showFontStep());
}

if (onlinePreviewButton) {
    onlinePreviewButton.addEventListener("click", () => showPreviewStep());
}

if (fontBackButton) {
    fontBackButton.addEventListener("click", () => {
        transitionSteps("step-7", "step-6", 5);
    });
}

if (fontContinueButton) {
    fontContinueButton.addEventListener("click", () => {
        if (!selectedFontType) {
            showToast("请选择字体", "warning");
            return;
        }
        showTypingSpeedStep();
    });
}

if (typingSpeedBackButton) {
    typingSpeedBackButton.addEventListener("click", () => {
        transitionSteps("step-8", "step-7", 6);
    });
}

if (typingSpeedContinueButton) {
    typingSpeedContinueButton.addEventListener("click", () => {
        if (!selectedTypingSpeed) {
            showToast("请选择打字速度", "warning");
            return;
        }
        showMediaStep();
    });
}

if (mediaBackButton) {
    mediaBackButton.addEventListener("click", () => {
        transitionSteps("step-9", "step-8", 7);
    });
}

if (mediaContinueButton) {
    mediaContinueButton.addEventListener("click", () => {
        submitLetter(mediaContinueButton);
    });
}

if (holdOpenButton) {
    holdOpenButton.addEventListener("pointerdown", (event) => {
        if (event.button && event.button !== 0) return;
        event.preventDefault();
        holdOpenButton.setPointerCapture(event.pointerId);
        startHoldToOpen();
    });

    holdOpenButton.addEventListener("pointerup", (event) => {
        if (holdOpenButton.hasPointerCapture(event.pointerId)) {
            holdOpenButton.releasePointerCapture(event.pointerId);
        }
        stopHoldToOpen();
    });

    holdOpenButton.addEventListener("pointerleave", stopHoldToOpen);
    holdOpenButton.addEventListener("pointercancel", stopHoldToOpen);

    holdOpenButton.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            startHoldToOpen();
        }
    });

    holdOpenButton.addEventListener("keyup", (event) => {
        if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            stopHoldToOpen();
        }
    });
}

if (previewBackButton) {
    previewBackButton.addEventListener("click", () => {
        resetHoldState();
        transitionSteps("step-preview", previewOriginStepId || "step-9", getDotIndexForStep(previewOriginStepId || "step-9"));
    });
}

function startMusicPlayback() {
    stopMusicPreview();
    stopSnippetPreview();

    const musicSource = sessionStorage.getItem("musicSource");
    if (musicSource === "none") return;

    if (!selectedMusic) {
        try {
            selectedMusic = JSON.parse(sessionStorage.getItem("musicData"));
        } catch (e) { }
    }
    if (!selectedMusic) return;

    let mode = currentPlaybackMode || sessionStorage.getItem("playbackMode") || "full";

    if (mode === "snippet") {
        const storedStartTime = sessionStorage.getItem("snippetStartTime");
        if (storedStartTime) snippetStartTime = parseInt(storedStartTime, 10) || 0;

        initSnippetAudio().then(() => {
            if (snippetAudio) {
                snippetAudio.currentTime = snippetStartTime;
                snippetAudio.loop = true;
                snippetAudio.play().catch(() => {});
            }
        });
        return;
    }

    if (!musicAudio) {
        musicAudio = new Audio();
    }

    const playFull = async () => {
        if (!selectedMusic.src) {
            if (selectedMusic.source === "qq") {
                selectedMusic.src = await getQQMusicURL(selectedMusic.mid, "128");
            } else if (selectedMusic.source === "netease") {
                selectedMusic.src = await getNeteasePlayURL(selectedMusic.mid);
            }
        }
        if (selectedMusic.src) {
            musicAudio.src = selectedMusic.src;
            musicAudio.loop = true;
            musicAudio.play().catch(() => {});
        }
    };

    playFull();
}

// --- Sidebar & Theme Logic ---

const settingsToggle = document.getElementById("settings-toggle");
const settingsPanel = document.getElementById("settings-panel");
const settingsOverlay = document.getElementById("settings-overlay");
const settingsClose = document.getElementById("settings-close");
const themeToggle = document.getElementById("theme-toggle");
const themeThumb = document.getElementById("theme-thumb");
const themeLabel = document.getElementById("theme-label");

const PANEL_OPEN_CLASS = "is-open";
const OVERLAY_VISIBLE_CLASS = "is-visible";
const THUMB_ON_CLASS = "is-on";
const THEME_KEY = "theme";

// Panel Functions
function setPanelState(isOpen) {
    if (!settingsPanel || !settingsOverlay || !settingsToggle) return;

    if (!isOpen && settingsPanel.contains(document.activeElement)) {
        settingsToggle.focus();
    }

    settingsToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");

    if (isOpen) {
        settingsPanel.removeAttribute("inert");
        settingsPanel.removeAttribute("aria-hidden");
    } else {
        settingsPanel.setAttribute("inert", "");
        settingsPanel.setAttribute("aria-hidden", "true");
    }

    settingsOverlay.setAttribute("aria-hidden", isOpen ? "false" : "true");
    settingsPanel.classList.toggle(PANEL_OPEN_CLASS, isOpen);
    settingsOverlay.classList.toggle(OVERLAY_VISIBLE_CLASS, isOpen);
}

function closeSettings() {
    setPanelState(false);
}

if (settingsToggle) {
    settingsToggle.addEventListener("click", () => {
        const isOpen = settingsPanel.classList.contains(PANEL_OPEN_CLASS);
        setPanelState(!isOpen);
    });
}

if (settingsOverlay) settingsOverlay.addEventListener("click", closeSettings);
if (settingsClose) settingsClose.addEventListener("click", closeSettings);

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSettings();
});

// Theme Functions
function getStoredTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
}

function getPreferredTheme() {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
    }
    return "light";
}

function applyTheme(theme) {
    const isDark = theme === "dark";
    document.documentElement.classList.toggle("dark", isDark);

    if (themeToggle) themeToggle.setAttribute("aria-pressed", isDark ? "true" : "false");
    if (themeLabel) themeLabel.textContent = isDark ? "深色模式" : "浅色模式";
    if (themeThumb) themeThumb.classList.toggle(THUMB_ON_CLASS, isDark);
}

function persistTheme(theme) {
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
}

// Init Theme
const initialTheme = getStoredTheme() || getPreferredTheme();
applyTheme(initialTheme);

if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        const isDark = document.documentElement.classList.contains("dark");
        const nextTheme = isDark ? "light" : "dark";
        applyTheme(nextTheme);
        persistTheme(nextTheme);
    });
}

const ACCOUNT_LEVEL_MAP = {
    trial: "体验卡",
    air: "VIP",
    standard: "标准版",
    pro: "PRO",
    api: "API",
    vip: "VIP"
};

function getTimeGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "早上好";
    if (hour >= 12 && hour < 18) return "中午好";
    return "晚上好";
}

function resolveAccountLabel(data) {
    if (!data) return "";
    const type = String(data.type || "").toLowerCase();
    if (ACCOUNT_LEVEL_MAP[type]) return ACCOUNT_LEVEL_MAP[type];

    const label = String(data.levelLabel || "").trim();
    if (label) {
        const upper = label.toUpperCase();
        if (upper.includes("VIP")) return "VIP";
        if (upper.includes("PRO")) return "PRO";
        if (upper.includes("API")) return "API";
        if (label.includes("标准")) return "标准版";
        return label;
    }

    return type ? type.toUpperCase() : "";
}

function setAccountGreeting(label) {
    if (!accountGreeting) return;
    if (!label) {
        accountGreeting.classList.remove("is-visible");
        accountGreeting.textContent = "";
        return;
    }
    const greeting = getTimeGreeting();
    accountGreeting.textContent = `${greeting}，珍贵的${label}用户`;
    accountGreeting.classList.add("is-visible");
}

async function initAccountGreeting() {
    if (!accountGreeting) return;
    setAccountGreeting("");

    try {
        const response = await fetch(ACCOUNT_BENEFITS_ENDPOINT, {
            method: "GET",
            credentials: "same-origin"
        });
        const result = await response.json();
        if (response.ok && result && result.success && result.data) {
            setAccountGreeting(resolveAccountLabel(result.data));
            return;
        }
    } catch (error) {
    }

    setAccountGreeting("");
}

if (accountGreeting) {
    initAccountGreeting();
}

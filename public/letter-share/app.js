const statusEl = document.getElementById("share-status");
const progressEl = document.getElementById("progress");
const previewStep = document.getElementById("step-preview");
const resultView = document.getElementById("step-result");

const displayUser = document.getElementById("display-user");
const displayFriend = document.getElementById("display-friend");
const displayMessage = document.getElementById("display-message");

const mediaCard = document.getElementById("media-card");
const mediaFrame = document.getElementById("media-frame");
const toggleButton = document.getElementById("result-toggle-button");
const toggleContainer = document.getElementById("result-toggle");

const previewUserName = document.getElementById("preview-user-name");
const previewFriendName = document.getElementById("preview-friend-name");
const previewBackButton = document.getElementById("preview-back-button");
const resultBackButton = document.getElementById("result-back-button");

const holdOpenButton = document.getElementById("hold-open-button");
const holdHint = document.getElementById("hold-hint");

const API_ENDPOINT = "/api/letter/share";

const TYPING_SPEED_MAP = {
    slow: { multiplier: 1.35 },
    normal: { multiplier: 1 },
    fast: { multiplier: 0.7 }
};

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

const HOLD_DURATION = 1200;
const MEDIA_PEEK_DELAY = 3000;
const MEDIA_FOCUS_DELAY = 3000;

let selectedTypingSpeed = "normal";
let toggleMediaLabel = "查看图片";
let pendingLetterData = null;
let currentLetterData = null;
let currentMedia = null;
let musicAudio = null;

let mediaRevealTimer = null;
let mediaFocusTimer = null;
let holdAnimationFrame = null;
let holdStartTime = 0;
let holdCompleted = false;

const typingTimers = new WeakMap();

function setStatus(message, hide = false) {
    if (!statusEl) return;
    if (hide) {
        statusEl.classList.add("is-hidden");
        return;
    }
    statusEl.textContent = message;
    statusEl.classList.remove("is-hidden");
}

function showProgress() {
    if (!progressEl) return;
    progressEl.style.opacity = "1";
    progressEl.style.transform = "translateY(0)";
}

function hideProgress() {
    if (!progressEl) return;
    progressEl.style.opacity = "0";
}

function setActiveDot(index) {
    const dots = document.querySelectorAll(".progress-dot");
    dots.forEach((dot, idx) => {
        dot.classList.toggle("active", idx === index);
    });
}

function activateFinalDot() {
    const dots = document.querySelectorAll(".progress-dot");
    if (dots.length === 0) return;
    setActiveDot(dots.length - 1);
}

function transitionSteps(fromId, toId, dotIndex, onShow) {
    const from = document.getElementById(fromId);
    const to = document.getElementById(toId);

    if (from) {
        from.classList.remove("active");
        from.classList.add("exit-up");
    }

    setTimeout(() => {
        if (to) {
            to.classList.remove("exit-up");
            to.classList.add("active");
        }
        if (typeof onShow === "function") {
            onShow();
        }
    }, 100);

    if (typeof dotIndex === "number") {
        setActiveDot(dotIndex);
    }
}

function setPreviewNames(data) {
    const recipientName = data.recipientName || "你";
    const senderName = data.senderName || "TA";
    if (previewUserName) previewUserName.textContent = recipientName;
    if (previewFriendName) previewFriendName.textContent = senderName;
}

function applyLetterFont(fontType) {
    const config = LETTER_FONT_MAP[fontType];
    if (!config) return;
    document.documentElement.style.setProperty("--letter-font", config.family);
    document.documentElement.style.setProperty("--letter-font-weight", config.weight);
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
        if (pendingLetterData) {
            showResult(pendingLetterData);
        }
    }, 200);
}

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

    const speedConfig = TYPING_SPEED_MAP[selectedTypingSpeed] || TYPING_SPEED_MAP.normal;
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

function inferMediaType(url) {
    if (!url) return "image";
    const cleanUrl = url.split("?")[0].split("#")[0];
    const ext = cleanUrl.split(".").pop().toLowerCase();
    if (["mp4", "webm", "mov", "ogg"].includes(ext)) return "video";
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
    if (toggleButton) {
        toggleButton.setAttribute("aria-pressed", "false");
        toggleButton.textContent = "查看图片";
    }
    if (toggleContainer) {
        toggleContainer.style.display = "none";
    }
}

function resolveMedia(data) {
    const mediaUrl = data.mediaUrl || "";
    if (!mediaUrl || data.mediaType === "none") {
        currentMedia = null;
        toggleMediaLabel = "查看图片";
        return false;
    }

    const mediaType = data.mediaType || inferMediaType(mediaUrl);
    toggleMediaLabel = mediaType === "video" ? "查看视频" : "查看图片";
    currentMedia = { type: mediaType, url: mediaUrl };
    return true;
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
    if (toggleButton) {
        toggleButton.setAttribute("aria-pressed", showMedia ? "true" : "false");
        toggleButton.textContent = showMedia ? "查看信件" : toggleMediaLabel;
    }
}

function queueMediaReveal() {
    if (!currentMedia || !resultView) return;
    if (!buildMediaCard(currentMedia)) return;

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

function startMusicPlayback(data) {
    const musicUrl = data.musicUrl || (data.musicData && data.musicData.src) || "";
    if (!musicUrl) return;

    const startTime = data.playbackMode === "snippet"
        ? Number(data.snippetStartTime) || 0
        : 0;

    if (!musicAudio) {
        musicAudio = new Audio();
    }

    musicAudio.src = musicUrl;
    musicAudio.loop = true;

    musicAudio.addEventListener("loadedmetadata", () => {
        if (startTime > 0) {
            try {
                musicAudio.currentTime = startTime;
            } catch (error) {
                return;
            }
        }
    }, { once: true });

    musicAudio.play().catch(() => {});

    document.addEventListener("click", () => {
        if (musicAudio && musicAudio.paused) {
            if (startTime > 0) {
                try {
                    musicAudio.currentTime = startTime;
                } catch (error) {
                    return;
                }
            }
            musicAudio.play().catch(() => {});
        }
    }, { once: true });
}

function showPreview(data) {
    pendingLetterData = data;
    currentLetterData = data;

    selectedTypingSpeed = data.typingSpeed || "normal";
    applyLetterFont(data.fontType || "mi");
    setPreviewNames(data);
    resetHoldState();
    resetMediaStack();

    activateFinalDot();
    showProgress();

    if (previewStep) {
        previewStep.style.display = "flex";
        previewStep.classList.remove("exit-up");
        previewStep.classList.add("active");
    }

    if (resultView) {
        resultView.classList.remove("active");
        resultView.style.display = "none";
    }

    if (holdOpenButton) holdOpenButton.focus();
}

function showResult(data) {
    currentLetterData = data;

    const recipientName = data.recipientName || "你";
    const senderName = data.senderName || "TA";
    const message = data.cardContent || "";

    selectedTypingSpeed = data.typingSpeed || "normal";
    applyLetterFont(data.fontType || "mi");

    const hasMedia = resolveMedia(data);

    hideProgress();
    resetMediaStack();
    if (hasMedia && toggleContainer) {
        toggleContainer.style.display = "flex";
    }
    setResultViewMode("letter");

    const activeStep = document.querySelector(".step.active");
    if (activeStep && activeStep.id !== "step-result") {
        activeStep.classList.remove("active");
        activeStep.classList.add("exit-up");
    }

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
        if (activeStep && activeStep.id !== "step-result") {
            activeStep.style.display = "none";
        }
        if (resultView) {
            resultView.style.display = "flex";
            resultView.classList.remove("exit-up");
            resultView.classList.add("active");
        }

        const runTyping = async () => {
            if (displayUser) await typeMessage(displayUser, recipientName);
            if (displayMessage) await typeMessage(displayMessage, message, true);
            if (displayFriend) await typeMessage(displayFriend, senderName);
        };

        runTyping().then(() => {
            queueMediaReveal();
        });

        startMusicPlayback(currentLetterData);
    }, 400);
}

function goToPreview() {
    activateFinalDot();
    showProgress();
    resetMediaStack();
    resetHoldState();

    if (previewStep) {
        previewStep.style.display = "flex";
    }
    if (resultView) {
        resultView.style.display = "flex";
    }

    const dots = document.querySelectorAll(".progress-dot");
    const dotIndex = dots.length > 0 ? dots.length - 1 : 0;

    transitionSteps("step-result", "step-preview", dotIndex, () => {
        if (holdOpenButton) holdOpenButton.focus();
    });

    setTimeout(() => {
        if (resultView) {
            resultView.style.display = "none";
            resultView.classList.remove("exit-up");
        }
    }, 400);
}

if (toggleButton) {
    toggleButton.addEventListener("click", () => {
        if (!resultView) return;
        const isMedia = resultView.classList.contains("show-media");
        setResultViewMode(isMedia ? "letter" : "media");
    });
}

if (previewBackButton) {
    previewBackButton.addEventListener("click", () => {
        if (window.history.length > 1) {
            window.history.back();
            return;
        }
        window.location.href = "/letter/";
    });
}

if (resultBackButton) {
    resultBackButton.addEventListener("click", () => {
        goToPreview();
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

async function loadLetter() {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
        setStatus("Missing token.");
        return;
    }

    setStatus("Loading...");

    try {
        const response = await fetch(`${API_ENDPOINT}?token=${encodeURIComponent(token)}`);
        const result = await response.json();
        if (!response.ok || !result || !result.success) {
            setStatus("链接失效！！！");
            return;
        }

        setStatus("", true);
        showPreview(result.data);
    } catch (error) {
        setStatus("Unable to load share.");
    }
}

window.addEventListener("load", loadLetter);

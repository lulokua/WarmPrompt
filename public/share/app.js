const overlay = document.getElementById("gift-overlay");
const statusEl = document.getElementById("share-status");

const API_ENDPOINT = "/api/gift/share";

let pendingGiftData = null;

function getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "上午好";
    if (hour >= 12 && hour < 18) return "下午好";
    return "晚上好";
}

function showWelcomeOverlay(data) {
    const recipientName = data.recipientName || "朋友";
    const senderName = data.senderName || "Ta";
    const greeting = getGreeting();

    const welcomeDiv = document.createElement("div");
    welcomeDiv.className = "welcome-overlay";
    welcomeDiv.id = "welcome-overlay";
    welcomeDiv.innerHTML = `
        <div class="welcome-card">
            <div class="welcome-icon">
                <span class="icon-emoji">🎁</span>
            </div>
            <div class="welcome-header">
                <h2 class="welcome-greeting">${recipientName}，${greeting}</h2>
            </div>
            <div class="welcome-body">
                <p class="welcome-text">
                    <span class="sender-name">${senderName}</span> 给你定制了一份独属于你的礼物
                </p>
                <p class="welcome-subtext">是否打开？</p>
            </div>
            <button class="welcome-btn" id="open-gift-btn">
                <span>打开礼物</span>
            </button>
        </div>
    `;

    document.body.appendChild(welcomeDiv);

    document.getElementById("open-gift-btn").addEventListener("click", () => {
        welcomeDiv.classList.add("fade-out");
        setTimeout(() => {
            welcomeDiv.remove();
            if (pendingGiftData) {
                renderGift(pendingGiftData);
            }
        }, 400);
    });
}

const COLOR_MAP = {
    "red": "#ef4444",
    "orange": "#f97316",
    "amber": "#f59e0b",
    "yellow": "#eab308",
    "lime": "#84cc16",
    "green": "#22c55e",
    "emerald": "#10b981",
    "teal": "#14b8a6",
    "cyan": "#06b6d4",
    "sky": "#0ea5e9",
    "blue": "#3b82f6",
    "indigo": "#6366f1",
    "violet": "#8b5cf6",
    "purple": "#a855f7",
    "fuchsia": "#d946ef",
    "pink": "#ec4899",
    "rose": "#f43f5e",
    "slate": "#64748b",
    "stone": "#78716c",
    "neutral": "#737373"
};

const COLORFUL_PALETTE = [
    "#f87171",
    "#fb923c",
    "#fbbf24",
    "#facc15",
    "#a3e635",
    "#4ade80",
    "#34d399",
    "#2dd4bf",
    "#22d3ee",
    "#38bdf8",
    "#60a5fa",
    "#818cf8",
    "#a78bfa",
    "#c084fc",
    "#e879f9",
    "#f472b6",
    "#fb7185"
];

let musicAudio = null;

function setStatus(message, hide = false) {
    if (!statusEl) return;
    if (hide) {
        statusEl.classList.add("is-hidden");
        return;
    }
    statusEl.textContent = message;
    statusEl.classList.remove("is-hidden");
}

function hexToRgb(hex) {
    if (!hex) return null;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function normalizeFrameStyle(style) {
    return style === "inside" ? "inside" : "name-top";
}

function splitContent(rawContent) {
    let contentParts = String(rawContent || "").split(/[\n\s]+/);
    contentParts = contentParts.filter((p) => p.trim().length > 0);

    if (contentParts.length === 0) {
        return ["Wishing you a wonderful day", "Take care"];
    }

    if (contentParts.length < 5) {
        const fillers = [
            "Keep going",
            "You got this",
            "Stay strong",
            "Smile today",
            "Believe",
            "Good things ahead",
            "Stay warm"
        ];
        const needed = 8 - contentParts.length;
        for (let i = 0; i < needed; i += 1) {
            contentParts.push(fillers[i % fillers.length]);
        }
    }

    return contentParts;
}

function isVideoMedia(mediaType, url) {
    if (mediaType === "video") return true;
    if (!url) return false;
    return /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
}

function renderBackground(data) {
    if (!overlay) return;
    overlay.className = "gift-overlay";

    const bgType = data.pageBackground || "white";
    const mediaUrl = data.backgroundMediaUrl;
    const mediaType = data.backgroundMediaType;

    if (bgType === "custom" && mediaUrl) {
        const mediaEl = isVideoMedia(mediaType, mediaUrl)
            ? document.createElement("video")
            : document.createElement("img");

        mediaEl.src = mediaUrl;
        mediaEl.className = "gift-background-media";

        if (mediaEl.tagName.toLowerCase() === "video") {
            mediaEl.autoplay = true;
            mediaEl.loop = true;
            mediaEl.muted = true;
            mediaEl.playsInline = true;
        }

        overlay.appendChild(mediaEl);
        overlay.style.background = "transparent";
        return;
    }

    overlay.style.background = "#ffffff";
}

function renderBubbles(data) {
    if (!overlay) return;
    const recipientName = data.recipientName || "Friend";
    const contentParts = splitContent(data.cardContent || "");
    const frameStyle = normalizeFrameStyle(data.frameStyle);

    const frameColorName = data.frameColor || "colorful";
    const glassValue = Number.isFinite(Number(data.glassOpacity)) ? Number(data.glassOpacity) : 50;
    const opacity = 0.2 + (glassValue / 100) * 0.8;
    const blur = 20 * (1 - glassValue / 100);

    let hexColor = "#ffffff";
    if (frameColorName !== "colorful" && COLOR_MAP[frameColorName]) {
        hexColor = COLOR_MAP[frameColorName];
    }

    let rgb = null;
    if (frameColorName !== "colorful") {
        rgb = hexToRgb(hexColor);
    }

    const singleColorBgStyle = rgb
        ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`
        : `rgba(255, 255, 255, ${opacity})`;

    const backdropFilterStyle = `blur(${blur}px)`;

    const containerW = window.innerWidth;
    const containerH = window.innerHeight;
    const occupiedRects = [];

    function isColliding(rect1) {
        for (const rect2 of occupiedRects) {
            const shrink = 10;
            if (!(rect1.right - shrink < rect2.left + shrink
                || rect1.left + shrink > rect2.right - shrink
                || rect1.bottom - shrink < rect2.top + shrink
                || rect1.top + shrink > rect2.bottom - shrink)) {
                return true;
            }
        }
        return false;
    }

    contentParts.forEach((part, index) => {
        const bubble = document.createElement("div");
        bubble.className = "gift-bubble";
        if (index === 0) bubble.classList.add("is-name");
        if (frameStyle === "name-top") bubble.classList.add("gift-bubble--name-top");

        if (frameColorName === "colorful") {
            const colorHex = COLORFUL_PALETTE[index % COLORFUL_PALETTE.length];
            const colorRgb = hexToRgb(colorHex);
            bubble.style.background = colorRgb
                ? `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${opacity})`
                : singleColorBgStyle;
        } else {
            bubble.style.background = singleColorBgStyle;
        }

        bubble.style.backdropFilter = backdropFilterStyle;
        bubble.style.webkitBackdropFilter = backdropFilterStyle;
        if (frameStyle === "name-top") {
            bubble.innerHTML = `
            <div class="bubble-header">${recipientName}</div>
            <div class="bubble-content">${part}</div>
        `;
        } else {
            bubble.innerHTML = `
            <div class="bubble-content">${recipientName} ${part}</div>
        `;
        }

        bubble.style.visibility = "hidden";
        overlay.appendChild(bubble);

        const w = bubble.offsetWidth;
        const h = bubble.offsetHeight;
        let left = 0;
        let top = 0;
        let attempts = 0;
        let safe = false;
        const pad = 20;
        const adjustedBottomReserved = 20;
        const maxTop = containerH - h - adjustedBottomReserved;

        while (attempts < 100) {
            left = pad + Math.random() * (containerW - w - pad * 2);
            top = pad + Math.random() * (maxTop - pad);
            const rect = { left, top, right: left + w, bottom: top + h };
            if (!isColliding(rect)) {
                safe = true;
                occupiedRects.push(rect);
                break;
            }
            attempts += 1;
        }

        if (!safe) {
            left = pad + Math.random() * (containerW - w - pad * 2);
            top = pad + Math.random() * (maxTop - pad);
        }

        bubble.style.left = `${left}px`;
        bubble.style.top = `${top}px`;
        bubble.style.zIndex = 10 + index;
        bubble.style.visibility = "visible";

        setTimeout(() => {
            bubble.classList.add("popup-show");
        }, index * 250 + 100);
    });
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

function renderGift(data) {
    if (!overlay) return;
    overlay.innerHTML = "";
    overlay.style.display = "block";

    renderBackground(data);
    renderBubbles(data);
    startMusicPlayback(data);
}

async function loadGift() {
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
        pendingGiftData = result.data;
        showWelcomeOverlay(result.data);
    } catch (error) {
        setStatus("Unable to load share.");
    }
}

window.addEventListener("load", loadGift);

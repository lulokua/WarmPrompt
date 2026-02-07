// Others 页面 - 询问收礼人名字

const backButton = document.getElementById("back-button");
const nameInput = document.getElementById("recipient-name");
const charCount = document.getElementById("char-count");
const continueButton = document.getElementById("continue-button");

// 设置相关 DOM 元素
const settingsToggle = document.getElementById("settings-toggle");
const settingsPanel = document.getElementById("settings-panel");
const settingsOverlay = document.getElementById("settings-overlay");
const settingsClose = document.getElementById("settings-close");
const themeToggle = document.getElementById("theme-toggle");
const themeThumb = document.getElementById("theme-thumb");
const themeLabel = document.getElementById("theme-label");
const turboToggle = document.getElementById("turbo-toggle");
const turboThumb = document.getElementById("turbo-thumb");
const turboLabel = document.getElementById("turbo-label");
const turboModal = document.getElementById("turbo-modal");
const turboModalOverlay = document.getElementById("turbo-modal-overlay");
const turboConfirm = document.getElementById("turbo-confirm");
const turboConfirmText = document.getElementById("turbo-confirm-text");
const turboCancel = document.getElementById("turbo-cancel");

// 常量定义
const THEME_KEY = "theme";
const TURBO_KEY = "turboMode";
const FRAME_STYLE_KEY = "frameStyle";
const PANEL_OPEN_CLASS = "is-open";
const OVERLAY_VISIBLE_CLASS = "is-visible";
const THUMB_ON_CLASS = "is-on";
const MEDIA_UPLOAD_ENDPOINT = String(window.WARM_MEDIA_UPLOAD_ENDPOINT || "/api/media/upload").trim();
const GIFT_SUBMIT_ENDPOINT = "/api/gift/submit";
const MAX_IMAGE_BYTES = 500 * 1024 * 1024;
const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;
const IMAGE_TOO_LARGE_MESSAGE = "你的这个图片已经超过大小 500 MB";
const VIDEO_TOO_LARGE_MESSAGE = "视频已经超过 1 GB";

// --- 设置面板功能 ---

function setPanelState(isOpen) {
    if (!settingsPanel || !settingsOverlay || !settingsToggle) {
        return;
    }

    // 关闭面板时，先移除焦点以避免 aria-hidden 警告
    if (!isOpen && settingsPanel.contains(document.activeElement)) {
        settingsToggle.focus();
    }

    settingsToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");

    // 使用 inert 属性代替 aria-hidden
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

function openSettings() {
    setPanelState(true);
}

function closeSettings() {
    setPanelState(false);
}

if (settingsToggle && settingsOverlay) {
    settingsToggle.addEventListener("click", () => {
        const isOpen = settingsPanel && settingsPanel.classList.contains(PANEL_OPEN_CLASS);
        setPanelState(!isOpen);
    });
    settingsOverlay.addEventListener("click", closeSettings);
}

if (settingsClose) {
    settingsClose.addEventListener("click", closeSettings);
}

// --- 主题功能 ---

function getStoredTheme() {
    try {
        return localStorage.getItem(THEME_KEY);
    } catch (error) {
        return null;
    }
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

    if (themeToggle) {
        themeToggle.setAttribute("aria-pressed", isDark ? "true" : "false");
    }
    if (themeLabel) {
        themeLabel.textContent = isDark ? "深色模式" : "浅色模式";
    }
    if (themeThumb) {
        themeThumb.classList.toggle(THUMB_ON_CLASS, isDark);
    }
}

function persistTheme(theme) {
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
        // Ignore storage errors.
    }
}

if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        const isDark = document.documentElement.classList.contains("dark");
        const nextTheme = isDark ? "light" : "dark";
        applyTheme(nextTheme);
        persistTheme(nextTheme);
    });
}

// --- 极速模式功能 ---

function getStoredTurboMode() {
    try {
        return localStorage.getItem(TURBO_KEY);
    } catch (error) {
        return null;
    }
}

function applyTurboMode(isEnabled) {
    if (turboToggle) {
        turboToggle.setAttribute("aria-pressed", isEnabled ? "true" : "false");
    }
    if (turboLabel) {
        turboLabel.textContent = isEnabled ? "已开启" : "已关闭";
    }
    if (turboThumb) {
        turboThumb.classList.toggle(THUMB_ON_CLASS, isEnabled);
    }
    document.documentElement.classList.toggle("turbo-mode", isEnabled);
}

function persistTurboMode(isEnabled) {
    try {
        localStorage.setItem(TURBO_KEY, isEnabled ? "true" : "false");
    } catch (error) {
        // Ignore storage errors.
    }
}

// 极速模式弹窗相关
let turboCountdownInterval = null;
let turboCountdown = 10;

function showTurboModal() {
    if (!turboModal || !turboModalOverlay) return;

    turboCountdown = 10;
    if (turboConfirm) {
        turboConfirm.disabled = true;
    }
    if (turboConfirmText) {
        turboConfirmText.textContent = `我知道了 (${turboCountdown}s)`;
    }

    turboModal.classList.add("is-visible");
    turboModal.setAttribute("aria-hidden", "false");
    turboModalOverlay.classList.add("is-visible");
    turboModalOverlay.setAttribute("aria-hidden", "false");

    turboCountdownInterval = setInterval(() => {
        turboCountdown--;
        if (turboConfirmText) {
            if (turboCountdown > 0) {
                turboConfirmText.textContent = `我知道了 (${turboCountdown}s)`;
            } else {
                turboConfirmText.textContent = "我知道了";
                if (turboConfirm) {
                    turboConfirm.disabled = false;
                }
                clearInterval(turboCountdownInterval);
                turboCountdownInterval = null;
            }
        }
    }, 1000);
}

function hideTurboModal() {
    if (!turboModal || !turboModalOverlay) return;

    turboModal.classList.remove("is-visible");
    turboModal.setAttribute("aria-hidden", "true");
    turboModalOverlay.classList.remove("is-visible");
    turboModalOverlay.setAttribute("aria-hidden", "true");

    if (turboCountdownInterval) {
        clearInterval(turboCountdownInterval);
        turboCountdownInterval = null;
    }
}

function confirmTurboMode() {
    hideTurboModal();
    persistTurboMode(true);
    window.location.reload();
}

function cancelTurboMode() {
    hideTurboModal();
}

if (turboToggle) {
    turboToggle.addEventListener("click", () => {
        const isCurrentlyEnabled = turboToggle.getAttribute("aria-pressed") === "true";
        if (isCurrentlyEnabled) {
            applyTurboMode(false);
            persistTurboMode(false);
        } else {
            showTurboModal();
        }
    });
}

if (turboConfirm) turboConfirm.addEventListener("click", confirmTurboMode);
if (turboCancel) turboCancel.addEventListener("click", cancelTurboMode);
if (turboModalOverlay) turboModalOverlay.addEventListener("click", cancelTurboMode);

// 初始化设置
const initialTheme = getStoredTheme() || getPreferredTheme();
applyTheme(initialTheme);
const initialTurboMode = getStoredTurboMode() === "true";
applyTurboMode(initialTurboMode);

// --- 名字输入相关逻辑 ---

// 返回按钮事件
if (backButton) {
    backButton.addEventListener("click", () => {
        // 添加退出动画效果
        document.querySelector(".name-card").style.animation = "fadeOutDown 0.3s ease-out forwards";
        setTimeout(() => {
            window.location.href = "../index.html";
        }, 250);
    });
}

// 添加退出动画样式
const style = document.createElement("style");
style.textContent = `
  @keyframes fadeOutDown {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(20px);
    }
  }
`;
document.head.appendChild(style);

// 危险字符正则表达式
const dangerousCharsRegex = /[<>'"`;\\\/\-\-\(\)\{\}\[\]&\$\#\!\=\|\^]/g;

// 显示美化的提示 Toast
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

// 校验并清理输入
function sanitizeInput(value) {
    if (dangerousCharsRegex.test(value)) {
        showToast("名字中不能包含特殊字符哦～", "warning");
        return value.replace(dangerousCharsRegex, "");
    }
    return value;
}

// 名字输入框事件
if (nameInput && charCount && continueButton) {
    nameInput.addEventListener("input", (e) => {
        handleInput(e.target, charCount, continueButton);
    });

    nameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && nameInput.value.trim().length > 0) {
            event.preventDefault();
            handleContinue();
        }
    });

    continueButton.addEventListener("click", handleContinue);
}

// 通用输入处理
function handleInput(inputElement, countElement, buttonElement) {
    let value = inputElement.value;
    const sanitizedValue = sanitizeInput(value);
    if (sanitizedValue !== value) {
        inputElement.value = sanitizedValue;
        value = sanitizedValue;
    }

    const length = value.length;
    countElement.textContent = length;

    if (length > 0) {
        inputElement.classList.add("has-value");
        buttonElement.disabled = false;
    } else {
        inputElement.classList.remove("has-value");
        buttonElement.disabled = true;
    }
}

// 处理第一步：收礼人名字
function handleContinue() {
    const name = nameInput.value.trim();

    if (!name) {
        shakeInput(nameInput);
        return;
    }

    try {
        sessionStorage.setItem("recipientName", name);
    } catch (error) {
    }

    // 切换到第二步
    const recipientCard = document.querySelector(".name-card:not(#sender-card)");
    const senderCard = document.getElementById("sender-card");
    const senderInput = document.getElementById("sender-name");

    if (recipientCard && senderCard) {
        recipientCard.style.animation = "fadeOutLeft 0.3s ease-out forwards";

        setTimeout(() => {
            recipientCard.style.display = "none";
            senderCard.style.display = "block";
            senderCard.style.animation = "fadeInRight 0.3s ease-out forwards";

            // 聚焦第二个输入框
            if (senderInput) {
                setTimeout(() => senderInput.focus(), 350);
            }
        }, 300);
    }
}

// --- 第二步：你的名字逻辑 ---
const senderInput = document.getElementById("sender-name");
const senderCharCount = document.getElementById("sender-char-count");
const senderContinueButton = document.getElementById("sender-continue-button");
const senderBackButton = document.getElementById("sender-back-button");

// --- 第三步：颜色选择逻辑相关 ---
const colorBackButton = document.getElementById("color-back-button");

// --- 第四步：毛玻璃调整逻辑相关 ---
const glassSlider = document.getElementById("glass-slider");
const glassPreviewBox = document.getElementById("glass-preview-box");
const glassBackButton = document.getElementById("glass-back-button");
const glassContinueButton = document.getElementById("glass-continue-button");
const frameStyleCard = document.getElementById("frame-style-card");
const frameStyleOptions = document.querySelectorAll(".frame-style-option");
const frameStyleBackButton = document.getElementById("frame-style-back-button");
const frameStyleContinueButton = document.getElementById("frame-style-continue-button");

if (senderInput && senderCharCount && senderContinueButton) {
    senderInput.addEventListener("input", (e) => {
        handleInput(e.target, senderCharCount, senderContinueButton);
    });

    senderInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && senderInput.value.trim().length > 0) {
            event.preventDefault();
            handleSenderContinue();
        }
    });

    senderContinueButton.addEventListener("click", handleSenderContinue);
}

// 返回上一步
if (senderBackButton) {
    senderBackButton.addEventListener("click", () => {
        const senderCard = document.getElementById("sender-card");
        const recipientCard = document.querySelector(".name-card:not(#sender-card)");

        if (senderCard && recipientCard) {
            senderCard.style.animation = "fadeOutRight 0.3s ease-out forwards";
            setTimeout(() => {
                senderCard.style.display = "none";
                recipientCard.style.display = "block";
                recipientCard.style.animation = "fadeInLeft 0.3s ease-out forwards";
                if (nameInput) nameInput.focus();
            }, 300);
        }
    });
}

// 处理第二步：发送人名字
// 处理第二步：发送人名字
function handleSenderContinue() {
    const senderName = senderInput.value.trim();

    if (!senderName) {
        shakeInput(senderInput);
        return;
    }

    try {
        sessionStorage.setItem("senderName", senderName);
    } catch (error) {
    }

    // 切换到第三步：颜色选择
    const senderCard = document.getElementById("sender-card");
    const colorCard = document.getElementById("color-card");

    if (senderCard && colorCard) {
        senderCard.style.animation = "fadeOutLeft 0.3s ease-out forwards";

        setTimeout(() => {
            senderCard.style.display = "none";
            colorCard.style.display = "block";
            colorCard.style.animation = "fadeInRight 0.3s ease-out forwards";

            // 初始化颜色网格
            initColorGrid();
        }, 300);
    }
}

function shakeInput(input) {
    input.focus();
    input.style.animation = "shake 0.5s ease";
    setTimeout(() => {
        input.style.animation = "";
    }, 500);
}

// 抖动动画和切换动画
const shakeStyle = document.createElement("style");
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
  @keyframes fadeOutLeft {
    to {
      opacity: 0;
      transform: translateX(-20px);
    }
  }
  @keyframes fadeInRight {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
`;
document.head.appendChild(shakeStyle);

// Escape 键返回
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        if (settingsPanel && settingsPanel.classList.contains(PANEL_OPEN_CLASS)) {
            closeSettings();
        } else {
            // 如果在第五步，按 ESC 返回第四步
            const frameStyleCard = document.getElementById("frame-style-card");
            if (frameStyleCard && frameStyleCard.style.display !== "none") {
                if (frameStyleBackButton) frameStyleBackButton.click();
                return;
            }

            // 如果在第四步，按 ESC 返回第三步
            const glassCard = document.getElementById("glass-card");
            if (glassCard && glassCard.style.display !== "none") {
                if (glassBackButton) glassBackButton.click();
                return;
            }

            // 如果在第三步，按 ESC 返回第二步
            const colorCard = document.getElementById("color-card");
            if (colorCard && colorCard.style.display !== "none") {
                if (colorBackButton) colorBackButton.click();
                return;
            }

            // 如果在第二步，按 ESC 返回第一步
            const senderCard = document.getElementById("sender-card");
            if (senderCard && senderCard.style.display !== "none") {
                const recipientCard = document.querySelector(".name-card:not(#sender-card)");
                senderCard.style.animation = "fadeOutRight 0.3s ease-out forwards";
                setTimeout(() => {
                    senderCard.style.display = "none";
                    recipientCard.style.display = "block";
                    recipientCard.style.animation = "fadeInLeft 0.3s ease-out forwards";
                    if (nameInput) nameInput.focus();
                }, 300);
                return;
            }

            if (backButton) {
                backButton.click();
            }
        }
    }
});

// 添加更多动画关键帧
const extraAnimStyle = document.createElement("style");
extraAnimStyle.textContent = `
  @keyframes fadeOutRight {
    to {
        opacity: 0;
        transform: translateX(20px);
    }
  }
  @keyframes fadeInLeft {
    from {
        opacity: 0;
        transform: translateX(-20px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
  }
`;
document.head.appendChild(extraAnimStyle);

// --- 第三步：颜色选择逻辑 ---

const colorGrid = document.getElementById("color-grid");
let selectedColor = null;

const COLORS = [
    "colorful", "orange", "amber", "yellow", "lime",
    "green", "emerald", "teal", "cyan", "sky",
    "blue", "indigo", "violet", "purple", "fuchsia",
    "pink", "rose", "slate", "stone", "neutral"
];

function initColorGrid() {
    if (!colorGrid) return;

    // 如果已经初始化过，且有选中值，保持选中状态
    const savedColor = sessionStorage.getItem("frameColor");
    selectedColor = savedColor || null;

    colorGrid.innerHTML = "";

    COLORS.forEach(color => {
        const option = document.createElement("div");
        option.className = `color-option color-${color}`;
        option.dataset.color = color;
        option.setAttribute("role", "radio");
        option.setAttribute("aria-label", color);

        if (color === selectedColor) {
            option.classList.add("selected");
            option.setAttribute("aria-checked", "true");
        } else {
            option.setAttribute("aria-checked", "false");
        }

        option.addEventListener("click", () => selectColor(color));
        colorGrid.appendChild(option);
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

function hexToRgb(hex) {
    if (!hex) return null;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function updateGlassPreview(value) {
    if (!glassPreviewBox) return;

    // value: 0 (强毛玻璃) -> 100 (不透明)

    // 透明度: 0 => 0.2, 100 => 1.0
    const opacity = 0.2 + (value / 100) * 0.8;

    // 模糊度: 0 => 20px, 100 => 0px
    const blur = 20 * (1 - value / 100);

    // 实际上，backdrop-filter 才是毛玻璃的关键
    glassPreviewBox.style.backdropFilter = `blur(${blur}px)`;
    glassPreviewBox.style.webkitBackdropFilter = `blur(${blur}px)`;

    // 确保元素本身不透明（以便显示文字和边框），只调整背景的透明度
    glassPreviewBox.style.opacity = 1;

    // 移除旧的颜色类，我们现在直接控制 background-color
    COLORS.forEach(c => glassPreviewBox.classList.remove(`color-${c}`));

    if (selectedColor === "colorful") {
        const backgroundStyle = `linear-gradient(135deg, rgba(255,0,0,${opacity}), rgba(255,127,0,${opacity}), rgba(255,255,0,${opacity}), rgba(0,255,0,${opacity}), rgba(0,0,255,${opacity}), rgba(139,0,255,${opacity}))`;
        glassPreviewBox.style.background = backgroundStyle;
    } else {
        const hexColor = COLOR_MAP[selectedColor];
        const rgb = hexToRgb(hexColor);
        if (rgb) {
            glassPreviewBox.style.background = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
        } else {
            // Fallback just in case
            glassPreviewBox.style.background = "rgba(255, 255, 255, 0.5)";
        }
    }
}

function normalizeFrameStyle(style) {
    return style === "inside" ? "inside" : "name-top";
}

function applyFrameStyleSelection(style) {
    const normalizedStyle = normalizeFrameStyle(style);

    if (frameStyleOptions && frameStyleOptions.length) {
        frameStyleOptions.forEach(option => {
            const isActive = option.dataset.style === normalizedStyle;
            option.classList.toggle("is-selected", isActive);
            option.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    }

    if (frameStyleContinueButton) {
        frameStyleContinueButton.disabled = false;
    }

    try {
        sessionStorage.setItem(FRAME_STYLE_KEY, normalizedStyle);
    } catch (error) {
    }
}

function initFrameStyleSelection() {
    let savedStyle = "name-top";
    try {
        savedStyle = normalizeFrameStyle(sessionStorage.getItem(FRAME_STYLE_KEY));
    } catch (error) {
    }
    applyFrameStyleSelection(savedStyle);
}

function updateFrameStylePreviews() {
    const previewBoxes = document.querySelectorAll(".frame-preview-box");
    if (!previewBoxes.length) return;

    const storedColor = selectedColor || sessionStorage.getItem("frameColor") || "colorful";
    if (!selectedColor) {
        selectedColor = storedColor;
    }

    const glassValue = parseInt(sessionStorage.getItem("glassOpacity") || (glassSlider ? glassSlider.value : "50"), 10);
    const opacity = 0.2 + (glassValue / 100) * 0.8;
    const blur = 20 * (1 - glassValue / 100);

    const recipientName = sessionStorage.getItem("recipientName") || "小明";
    const frameOptions = document.querySelectorAll(".frame-style-option");
    frameOptions.forEach(option => {
        const nameEl = option.querySelector(".frame-preview-name");
        const textEl = option.querySelector(".frame-preview-text");
        const style = option.dataset.style;
        if (nameEl) nameEl.textContent = recipientName;
        if (textEl) {
            if (style === "inside") {
                textEl.textContent = `${recipientName} 今天也要开心`;
            } else {
                textEl.textContent = `${recipientName}\n要好好的在一起`;
            }
        }
    });

    previewBoxes.forEach(box => {
        box.style.backdropFilter = `blur(${blur}px)`;
        box.style.webkitBackdropFilter = `blur(${blur}px)`;

        if (storedColor === "colorful") {
            const backgroundStyle = `linear-gradient(135deg, rgba(255,0,0,${opacity}), rgba(255,127,0,${opacity}), rgba(255,255,0,${opacity}), rgba(0,255,0,${opacity}), rgba(0,0,255,${opacity}), rgba(139,0,255,${opacity}))`;
            box.style.background = backgroundStyle;
            return;
        }

        const hexColor = COLOR_MAP[storedColor];
        const rgb = hexToRgb(hexColor);
        if (rgb) {
            box.style.background = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
        } else {
            box.style.background = "rgba(255, 255, 255, 0.5)";
        }
    });
}

// 页面加载时初始化颜色网格（如果是从后退回来的）
// 但主要是在 handleSenderContinue 中初始化
// 我们也可以在 load 时检查一下
if (document.getElementById("color-card") && document.getElementById("color-card").style.display !== "none") {
    initColorGrid();
}

if (frameStyleCard && frameStyleCard.style.display !== "none") {
    updateFrameStylePreviews();
    initFrameStyleSelection();
}

function selectColor(color) {
    selectedColor = color;

    // 更新 UI选中状态
    const options = colorGrid.querySelectorAll(".color-option");
    options.forEach(opt => {
        if (opt.dataset.color === color) {
            opt.classList.add("selected");
            opt.setAttribute("aria-checked", "true");
        } else {
            opt.classList.remove("selected");
            opt.setAttribute("aria-checked", "false");
        }
    });

    // 震动反馈
    if (navigator.vibrate) {
        navigator.vibrate(10);
    }

    // 保存颜色
    try {
        sessionStorage.setItem("frameColor", selectedColor);
    } catch (error) {
    }

    // 跳转到第四步：毛玻璃调整
    const colorCard = document.getElementById("color-card");
    const glassCard = document.getElementById("glass-card");

    if (colorCard && glassCard) {

        // 确保毛玻璃卡片初始化
        if (glassSlider) {
            const savedGlass = sessionStorage.getItem("glassOpacity") || 50;
            glassSlider.value = savedGlass;
            // 必须给 glassPreviewBox 赋值，否则可能为空白
            // 在这里立即调用一次 updateGlassPreview
            // 注意 updateGlassPreview 依赖 selectedColor，现在已经更新了
            updateGlassPreview(savedGlass);
        }

        // 延迟跳转，展示选中效果
        setTimeout(() => {
            colorCard.style.animation = "fadeOutLeft 0.3s ease-out forwards";

            setTimeout(() => {
                colorCard.style.display = "none";
                glassCard.style.display = "block";
                glassCard.style.animation = "fadeInRight 0.3s ease-out forwards";
            }, 300);
        }, 200);
    }
}

// 滑块事件
if (glassSlider) {
    glassSlider.addEventListener("input", (e) => {
        updateGlassPreview(e.target.value);
    });
}

if (frameStyleOptions && frameStyleOptions.length) {
    frameStyleOptions.forEach(option => {
        option.addEventListener("click", () => {
            applyFrameStyleSelection(option.dataset.style);
        });
    });
}

// 重新选色按钮
if (glassBackButton) {
    glassBackButton.addEventListener("click", () => {
        const glassCard = document.getElementById("glass-card");
        const colorCard = document.getElementById("color-card");

        if (glassCard && colorCard) {
            glassCard.style.animation = "fadeOutRight 0.3s ease-out forwards";
            setTimeout(() => {
                glassCard.style.display = "none";
                colorCard.style.display = "block";
                colorCard.style.animation = "fadeInLeft 0.3s ease-out forwards";
            }, 300);
        }
    });
}

// 完成按钮 -> 现在是继续按钮 (for glass card)
if (glassContinueButton) {
    glassContinueButton.addEventListener("click", () => {
        const glassValue = glassSlider ? glassSlider.value : 50;
        try {
            sessionStorage.setItem("glassOpacity", glassValue);
        } catch (error) {
        }

        // 跳转到第五步：方框版本
        const glassCard = document.getElementById("glass-card");
        const nextCard = document.getElementById("frame-style-card");

        if (glassCard && nextCard) {
            glassCard.style.animation = "fadeOutLeft 0.3s ease-out forwards";

            setTimeout(() => {
                glassCard.style.display = "none";
                nextCard.style.display = "block";
                nextCard.style.animation = "fadeInRight 0.3s ease-out forwards";
                updateFrameStylePreviews();
                initFrameStyleSelection();
            }, 300);
        }
    });
}

if (frameStyleBackButton) {
    frameStyleBackButton.addEventListener("click", () => {
        const frameCard = document.getElementById("frame-style-card");
        const glassCard = document.getElementById("glass-card");

        if (frameCard && glassCard) {
            frameCard.style.animation = "fadeOutRight 0.3s ease-out forwards";
            setTimeout(() => {
                frameCard.style.display = "none";
                glassCard.style.display = "block";
                glassCard.style.animation = "fadeInLeft 0.3s ease-out forwards";
            }, 300);
        }
    });
}

if (frameStyleContinueButton) {
    frameStyleContinueButton.addEventListener("click", () => {
        const storedStyle = normalizeFrameStyle(sessionStorage.getItem(FRAME_STYLE_KEY));
        applyFrameStyleSelection(storedStyle);

        const frameCard = document.getElementById("frame-style-card");
        const bgCard = document.getElementById("bg-card");

        if (frameCard && bgCard) {
            frameCard.style.animation = "fadeOutLeft 0.3s ease-out forwards";

            setTimeout(() => {
                frameCard.style.display = "none";
                bgCard.style.display = "block";
                bgCard.style.animation = "fadeInRight 0.3s ease-out forwards";
                initBgGrid();
            }, 300);
        }
    });
}

// --- 第六步：背景选择逻辑 ---
const bgGrid = document.getElementById("bg-grid");
const bgBackButton = document.getElementById("bg-back-button");
const bgContinueButton = document.getElementById("bg-continue-button");

const bgUploadImageInput = document.getElementById("bg-upload-image");
const uploadImageBtn = document.getElementById("upload-image-btn");

const bgUploadVideoInput = document.getElementById("bg-upload-video");
const uploadVideoBtn = document.getElementById("upload-video-btn");

const uploadPreview = document.getElementById("upload-preview");
const previewWrapper = document.querySelector(".preview-media-wrapper");
const removeUploadBtn = document.querySelector(".remove-upload");
const uploadButtonsRow = document.querySelector(".upload-buttons-row");

let selectedBg = null;
let customBgFile = null; // 存储用户上传的文件对象
let uploadedBgInfo = null;

// 修改默认背景列表，添加 'white'
const BACKGROUNDS = [
    "white"
];

// --- IndexedDB Helper ---
const DB_NAME = "WarmPromptDB";
const STORE_NAME = "assets";
const ASSET_KEY = "customBackground";

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e);
    });
}

async function saveAssetToDB(blob) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const request = store.put(blob, ASSET_KEY);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        throw err;
    }
}

async function clearAssetFromDB() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(ASSET_KEY);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
    }
}

// 初始化
function initBgGrid() {
    if (!bgGrid) return;

    const savedBg = sessionStorage.getItem("pageBackground");
    // 如果没有存过，默认选 'white'
    selectedBg = savedBg || "white";

    if (!savedBg) {
        try {
            sessionStorage.setItem("pageBackground", selectedBg);
        } catch (e) { }
    }

    // 检查是否有自定义背景标记
    if (selectedBg === "custom") {
        // 尝试恢复预览 (如果有需要可以在这里读取DB并显示，但通常用户重新上传或保留状态)
        // 简化起见，如果是在这个页面刷新，我们显示“已选择自定义背景”或者重置为white
        // 为了体验，如果页面刷新了，input file 是空的，所以最好重置为默认
        // 除非我们从 IndexedDB 读取并在预览区显示
        checkAndRestoreCustomBg();
    } else {
        renderGrid();
    }
}

async function checkAndRestoreCustomBg() {
    try {
        // 这里只是为了恢复 UI 状态，实际文件在 DB 里
        // 但 input file 无法程序化赋值文件，只能显示预览
        // 这里简化：如果 session 说是 custom，但 input 没文件，我们让用户重新选，或者去读 DB 显示预览
        // 为了健壮性，这里暂时重置为默认，除非我们实现从 DB 读取并在预览显示
        // 让我们尝试从 DB 读取显示预览
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(ASSET_KEY);

        request.onsuccess = () => {
            const file = request.result;
            if (file) {
                customBgFile = file;
                showPreview(file);
                renderGrid(); // Grid 里不选任何内置背景
                if (bgContinueButton) bgContinueButton.disabled = false;
            } else {
                // 没找到文件，重置为默认
                selectedBg = "white";
                sessionStorage.setItem("pageBackground", "white");
                renderGrid();
            }
        };
    } catch (e) {
        selectedBg = "white";
        renderGrid();
    }
}

function renderGrid() {
    bgGrid.innerHTML = "";
    BACKGROUNDS.forEach(bg => {
        const option = document.createElement("div");
        option.className = `bg-option bg-${bg}`;
        option.dataset.bg = bg;
        option.setAttribute("role", "radio");
        option.setAttribute("aria-label", bg === "white" ? "默认白色" : bg);
        option.title = bg === "white" ? "默认" : "";

        if (bg === selectedBg) {
            option.classList.add("selected");
            option.setAttribute("aria-checked", "true");
            if (bgContinueButton) bgContinueButton.disabled = false;
        } else {
            option.setAttribute("aria-checked", "false");
        }

        option.addEventListener("click", () => selectBg(bg));
        bgGrid.appendChild(option);
    });
}

function selectBg(bg) {
    selectedBg = bg;
    customBgFile = null; // 清除自定义文件引用
    uploadedBgInfo = null;

    // 隐藏预览，重置上传控件
    hidePreview();
    if (bgUploadImageInput) bgUploadImageInput.value = "";
    if (bgUploadVideoInput) bgUploadVideoInput.value = "";

    // 清理 DB 中的自定义文件
    clearAssetFromDB();

    renderGrid(); // 重新渲染以更新选中状态

    if (navigator.vibrate) {
        navigator.vibrate(10);
    }

    try {
        sessionStorage.setItem("pageBackground", bg);
    } catch (error) {
    }
}

// 处理上传逻辑
if (uploadImageBtn && bgUploadImageInput) {
    uploadImageBtn.addEventListener("click", () => {
        bgUploadImageInput.click();
    });

    bgUploadImageInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > MAX_IMAGE_BYTES) {
            showToast(IMAGE_TOO_LARGE_MESSAGE, "warning");
            e.target.value = "";
            return;
        }
        handleFileUpload(file);
    });
}

if (uploadVideoBtn && bgUploadVideoInput) {
    uploadVideoBtn.addEventListener("click", () => {
        bgUploadVideoInput.click();
    });

    bgUploadVideoInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > MAX_VIDEO_BYTES) {
            showToast(VIDEO_TOO_LARGE_MESSAGE, "warning");
            e.target.value = "";
            return;
        }
        handleFileUpload(file);
    });
}

function handleFileUpload(file) {
    customBgFile = file;
    selectedBg = "custom";
    uploadedBgInfo = null;

    // 更新 Grid 状态：取消所有内置背景的选中
    const options = bgGrid.querySelectorAll(".bg-option");
    options.forEach(opt => {
        opt.classList.remove("selected");
        opt.setAttribute("aria-checked", "false");
    });

    sessionStorage.setItem("pageBackground", "custom");
    if (bgContinueButton) bgContinueButton.disabled = false;

    showPreview(file);
}

function showPreview(file) {
    if (!uploadPreview || !previewWrapper) return;

    previewWrapper.innerHTML = "";
    const objectUrl = URL.createObjectURL(file);

    if (file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = objectUrl;
        img.onload = () => URL.revokeObjectURL(objectUrl);
        previewWrapper.appendChild(img);
    } else if (file.type.startsWith("video/")) {
        const video = document.createElement("video");
        video.src = objectUrl;
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        // video.onloadeddata = () => URL.revokeObjectURL(objectUrl); // 视频流可能需要保持 URL
        previewWrapper.appendChild(video);
    }

    if (uploadButtonsRow) uploadButtonsRow.style.display = "none";
    uploadPreview.style.display = "block";
}

function hidePreview() {
    if (!uploadPreview) return;
    uploadPreview.style.display = "none";
    if (uploadButtonsRow) uploadButtonsRow.style.display = "flex";
    if (previewWrapper) previewWrapper.innerHTML = "";
}

if (removeUploadBtn) {
    removeUploadBtn.addEventListener("click", () => {
        // 移除上传，恢复默认背景
        selectBg("white");
    });
}

if (bgBackButton) {
    bgBackButton.addEventListener("click", () => {
        const bgCard = document.getElementById("bg-card");
        const frameCard = document.getElementById("frame-style-card");
        if (bgCard && frameCard) {
            bgCard.style.animation = "fadeOutRight 0.3s ease-out forwards";
            setTimeout(() => {
                bgCard.style.display = "none";
                frameCard.style.display = "block";
                frameCard.style.animation = "fadeInLeft 0.3s ease-out forwards";
                updateFrameStylePreviews();
                initFrameStyleSelection();
            }, 300);
        }
    });
}

if (bgContinueButton) {
    bgContinueButton.addEventListener("click", async () => {
        // 如果是自定义背景，先保存到 IndexedDB
        if (selectedBg === "custom" && customBgFile) {
            const originalText = bgContinueButton.innerHTML;
            bgContinueButton.disabled = true;
            bgContinueButton.innerHTML = '<span class="button-text">保存中...</span>';

            try {
                await saveAssetToDB(customBgFile);
                goToMusicStep();
            } catch (err) {
                showToast("保存图片/视频失败，请重试", "warning");
                bgContinueButton.disabled = false;
                bgContinueButton.innerHTML = originalText;
            }
        } else {
            goToMusicStep();
        }
    });
}

function goToMusicStep() {
    const bgCard = document.getElementById("bg-card");
    const musicCard = document.getElementById("music-card");

    if (bgCard && musicCard) {
        bgCard.style.animation = "fadeOutLeft 0.3s ease-out forwards";

        setTimeout(() => {
            bgCard.style.display = "none";
            musicCard.style.display = "block";
            musicCard.style.animation = "fadeInRight 0.3s ease-out forwards";
            refreshQqMusicAccess();
        }, 300);
    }
}

// --- 第七步：音乐选择逻辑 ---
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
const neteaseFreeButton = musicSourceOptions
    ? musicSourceOptions.querySelector('[data-source="netease"]')
    : null;
const neteaseVipButton = musicSourceOptions
    ? musicSourceOptions.querySelector('[data-source="netease-login"]')
    : null;
const neteaseVipTag = neteaseVipButton ? neteaseVipButton.querySelector(".vip-tag") : null;
const neteaseVipTagDefault = "登录后才可以使用";
const neteaseVipMaintenanceTag = "正在维护";

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
            // Ignore storage errors.
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
            // Ignore storage errors.
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

// 音乐来源选择
if (musicSourceOptions) {
    const sourceBtns = musicSourceOptions.querySelectorAll(".music-source-btn");

    sourceBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const source = btn.dataset.source;
            currentMusicSource = source;

            // 更新按钮选中状态
            sourceBtns.forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");

            // 停止播放并清除选中
            stopMusicPreview();
            selectedMusic = null;
            if (selectedMusicPreview) selectedMusicPreview.style.display = "none";
            if (musicSearchResults) musicSearchResults.innerHTML = "";
            if (musicSearchInput) musicSearchInput.value = "";

            // 显示/隐藏搜索区域
            if (source === "none") {
                if (musicSearchSection) musicSearchSection.style.display = "none";
                sessionStorage.removeItem("musicData");
            } else {
                if (musicSearchSection) {
                    musicSearchSection.style.display = "block";
                    if (musicSearchInput) {
                        setTimeout(() => musicSearchInput.focus(), 300);
                    }
                }
            }

            if (navigator.vibrate) {
                navigator.vibrate(10);
            }
        });
    });

    refreshQqMusicAccess();
}

// 搜索按钮点击
if (musicSearchBtn) {
    musicSearchBtn.addEventListener("click", performMusicSearch);
}

// 回车搜索
if (musicSearchInput) {
    musicSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            performMusicSearch();
        }
    });
}

// --- QQ 音乐 API 合集 ---
// 通过后端 API 代理调用

const QQMUSIC_API_BASE = '/api/qqmusic';
const NETEASE_API_BASE = '/api/netease';

// 获取音乐播放 URL（通过后端 API）
async function getQQMusicURL(songmid, quality = "128") {
    try {
        const response = await fetch(`${QQMUSIC_API_BASE}/play`, {
            method: 'POST',
            credentials: "same-origin",
            headers: {
                'Content-Type': 'application/json'
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

// 用关键词搜索歌曲（通过后端 API）
async function searchQQMusicWithKeyword(keyword, resultNum = 20, pageNum = 1) {
    try {
        const response = await fetch(`${QQMUSIC_API_BASE}/search`, {
            method: 'POST',
            credentials: "same-origin",
            headers: {
                'Content-Type': 'application/json'
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

        // 检测 CC 攻击限流
        if (result.code === 429) {
            showToast(result.error || "请求过于频繁，请稍后再试", "warning");
            return null;
        }

        if (result.code === 200 && result.data) {
            // 转换为原格式以兼容现有代码
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

// 获取专辑封面图
function getQQAlbumCoverImage(albummid) {
    return `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg`;
}

// 检查是否被封禁
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

// --- 网易云音乐 API 合集 ---

// 用关键词搜索歌曲（通过后端 API）
async function searchNeteaseMusicWithKeyword(keyword, page = 1) {
    try {
        const response = await fetch(`${NETEASE_API_BASE}/search`, {
            method: 'POST',
            credentials: "same-origin",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: keyword,
                page: page
            })
        });
        const result = await response.json();

        // 检测限流
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
                    url: song.url // 网易云直接返回播放地址
                }))
            };
        }
        return null;
    } catch (err) {
        return null;
    }
}

// 获取网易云音乐播放 URL（通过后端 API）
async function getNeteasePlayURL(songid) {
    try {
        const response = await fetch(`${NETEASE_API_BASE}/play`, {
            method: 'POST',
            credentials: "same-origin",
            headers: {
                'Content-Type': 'application/json'
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

// 检查网易云是否被封禁
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
        // 先检查是否被封禁
        const blocked = await checkQQMusicBlocked();
        if (blocked) {
            if (musicSearchResults) {
                musicSearchResults.innerHTML = '<div class="search-error">请求被限流，请稍后再试</div>';
            }
            return;
        }

        const result = await searchQQMusicWithKeyword(query, 15, 1);

        if (result && result.list && result.list.length > 0) {
            // 转换数据格式
            const songs = result.list.map(song => ({
                songname: song.name,
                name: song.singer.map(s => s.name).join(" / "),
                mid: song.mid,
                albummid: song.album.mid,
                cover: getQQAlbumCoverImage(song.album.mid),
                pay: song.pay.pay_play === 1 ? "收费" : "免费"
            }));
            renderMusicResults(songs, "qq");
        } else {
            if (musicSearchResults) {
                musicSearchResults.innerHTML = '<div class="search-empty">未找到相关歌曲</div>';
            }
        }
    } catch (error) {
        if (musicSearchResults) {
            musicSearchResults.innerHTML = '<div class="search-error">搜索失败，请检查网络连接</div>';
        }
    }
}

async function searchNeteaseMusic(query) {
    try {
        // 先检查是否被封禁
        const blocked = await checkNeteaseBlocked();
        if (blocked) {
            if (musicSearchResults) {
                musicSearchResults.innerHTML = '<div class="search-error">请求被限流，请稍后再试</div>';
            }
            return;
        }

        const result = await searchNeteaseMusicWithKeyword(query, 1);

        if (result && result.list && result.list.length > 0) {
            // 转换数据格式
            const songs = result.list.map(song => ({
                songname: song.name,
                name: song.artist,
                mid: song.mid,
                cover: song.cover || '',
                url: song.url || '', // 网易云可能直接返回播放地址
                pay: "免费" // 网易云通过此 API 基本都是免费的
            }));
            renderMusicResults(songs, "netease");
        } else {
            if (musicSearchResults) {
                musicSearchResults.innerHTML = '<div class="search-empty">未找到相关歌曲</div>';
            }
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
            <img class="result-cover" src="${song.cover || ''}" alt="封面" onerror="this.style.display='none'">
            <div class="result-info">
                <div class="result-title">${song.songname || '未知歌曲'}</div>
                <div class="result-artist">${song.name || '未知歌手'}</div>
            </div>
            <div class="result-badge ${song.pay === '收费' ? 'pay' : 'free'}">${song.pay === '收费' ? 'VIP' : '免费'}</div>
        </div>
    `).join("");

    // 绑定点击事件
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
        mid: song.mid, // 歌曲 MID/ID，用于获取播放 URL
        albummid: song.albummid,
        src: song.url || null // 网易云可能直接有播放 URL
    };

    // 更新预览
    const previewCover = document.getElementById("preview-cover");
    const previewTitle = document.getElementById("preview-title");
    const previewArtist = document.getElementById("preview-artist");

    if (previewCover) previewCover.src = song.cover || "";
    if (previewTitle) previewTitle.textContent = song.songname || "未知歌曲";
    if (previewArtist) previewArtist.textContent = song.name || "未知歌手";

    if (selectedMusicPreview) {
        selectedMusicPreview.style.display = "flex";
    }

    // 隐藏搜索结果
    if (musicSearchResults) {
        musicSearchResults.innerHTML = "";
    }

    // 保存到 sessionStorage
    try {
        sessionStorage.setItem("musicData", JSON.stringify(selectedMusic));
    } catch (e) {
    }

    if (navigator.vibrate) {
        navigator.vibrate(10);
    }
}

// 播放预览
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
    } else {
        // 如果还没有获取过播放 URL，先获取
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

                if (url && url.length > 10) { // 确保 URL 有效
                    selectedMusic.src = url;
                    // 更新 sessionStorage
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
        }).catch(err => {
            showToast("播放失败，请尝试其他歌曲", "warning");
        });
    }
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

// 移除已选音乐
const removeMusicBtn = document.getElementById("remove-music-btn");
if (removeMusicBtn) {
    removeMusicBtn.addEventListener("click", () => {
        stopMusicPreview();
        selectedMusic = null;
        if (selectedMusicPreview) selectedMusicPreview.style.display = "none";
        sessionStorage.removeItem("musicData");
    });
}

// 返回按钮
if (musicBackButton) {
    musicBackButton.addEventListener("click", () => {
        stopMusicPreview();

        const musicCard = document.getElementById("music-card");
        const bgCard = document.getElementById("bg-card");

        if (musicCard && bgCard) {
            musicCard.style.animation = "fadeOutRight 0.3s ease-out forwards";
            setTimeout(() => {
                musicCard.style.display = "none";
                bgCard.style.display = "block";
                bgCard.style.animation = "fadeInLeft 0.3s ease-out forwards";
            }, 300);
        }
    });
}

// 完成按钮
if (musicContinueButton) {
    musicContinueButton.addEventListener("click", () => {
        stopMusicPreview();

        // 保存音乐选择状态
        if (currentMusicSource === "none") {
            sessionStorage.removeItem("musicData");
            sessionStorage.setItem("musicSource", "none");

            // 不使用音乐时，直接跳转到内容选择步骤（跳过播放设置）
            const musicCard = document.getElementById("music-card");
            const contentCard = document.getElementById("content-card");

            if (musicCard && contentCard) {
                musicCard.style.animation = "fadeOutLeft 0.3s ease-out forwards";
                setTimeout(() => {
                    musicCard.style.display = "none";
                    contentCard.style.display = "block";
                    contentCard.style.animation = "fadeInRight 0.3s ease-out forwards";

                    // 默认选中官方内容（如果未选过）
                    if (!selectedContentType) {
                        selectContentType("official");
                    }
                }, 300);
            }
            return;
        } else if (selectedMusic) {
            sessionStorage.setItem("musicSource", currentMusicSource);
        } else {
            // 选择了音乐来源但没选歌曲，提示用户
            showToast("请选择一首歌曲或选择不使用音乐", "warning");
            return;
        }

        // 跳转到播放模式选择
        const musicCard = document.getElementById("music-card");
        const playbackCard = document.getElementById("playback-card");

        if (musicCard && playbackCard) {
            musicCard.style.animation = "fadeOutLeft 0.3s ease-out forwards";

            setTimeout(() => {
                musicCard.style.display = "none";
                playbackCard.style.display = "block";
                playbackCard.style.animation = "fadeInRight 0.3s ease-out forwards";
            }, 300);
        }
    });
}


// --- 第八步：播放模式逻辑 ---
const playbackModeOptions = document.getElementById("playback-mode-options");
const playbackBackButton = document.getElementById("playback-back-button");
const playbackContinueButton = document.getElementById("playback-continue-button");

const playbackSnippetControls = document.getElementById("playback-snippet-controls");
const snippetSlider = document.getElementById("snippet-slider");
const snippetTimeDisplay = document.getElementById("snippet-time-display");
const snippetPreviewBtn = document.getElementById("snippet-preview-btn");

let currentPlaybackMode = "full"; // 默认完整播放
let snippetStartTime = 0;
let snippetAudio = null;
let snippetDuration = 0;

if (playbackModeOptions) {
    const modeBtns = playbackModeOptions.querySelectorAll(".music-source-btn");

    modeBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const mode = btn.dataset.mode;
            currentPlaybackMode = mode;

            // 更新按钮选中状态
            modeBtns.forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");

            // 显示/隐藏片段控制
            if (mode === "snippet") {
                if (playbackSnippetControls) playbackSnippetControls.style.display = "block";
                initSnippetAudio();
            } else {
                if (playbackSnippetControls) playbackSnippetControls.style.display = "none";
                stopSnippetPreview();
            }

            if (navigator.vibrate) {
                navigator.vibrate(10);
            }
        });
    });
}

function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`;
}

let isDraggingSnippet = false;

async function initSnippetAudio() {
    // 确保有音乐信息
    if (!selectedMusic) {
        // 尝试从 sessionStorage 读取
        try {
            const stored = sessionStorage.getItem("musicData");
            if (stored) selectedMusic = JSON.parse(stored);
        } catch (e) { }
    }

    if (!selectedMusic) return;

    // 如果还没有播放链接，尝试获取
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
        snippetAudio.addEventListener('loadedmetadata', () => {
            snippetDuration = snippetAudio.duration;
            if (snippetSlider) {
                snippetSlider.max = Math.floor(snippetDuration);
                // 稍微设置一个 limit，因为片段播放通常不需要从最后几秒开始
                if (snippetDuration > 10) snippetSlider.max = Math.floor(snippetDuration - 5);
            }
        });

        // 监听进度更新
        snippetAudio.addEventListener('timeupdate', () => {
            if (!isDraggingSnippet && snippetSlider && !snippetAudio.paused) {
                const currentTime = Math.floor(snippetAudio.currentTime);
                // 只有当 slider max 允许时才更新（避免超过 max 跳变）
                if (currentTime <= snippetSlider.max) {
                    snippetSlider.value = currentTime;
                    snippetStartTime = currentTime; // 同时也更新当前开始时间记录
                    if (snippetTimeDisplay) {
                        snippetTimeDisplay.textContent = formatTime(currentTime);
                    }
                }
            }
        });

        // 监听播放结束，更新图标
        snippetAudio.addEventListener('ended', () => {
            if (snippetPreviewBtn) {
                snippetPreviewBtn.innerHTML = `
                    <span class="button-icon" style="margin-right: 6px;">
                        <svg class="icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em;">
                            <path d="M715.8 493.5L335 165.1c-14.2-12.2-35-1.2-35 18.5v656.8c0 19.7 20.8 30.7 35 18.5l380.8-328.4c10.9-9.4 10.9-27.6 0-37z" fill="currentColor"/>
                        </svg>
                    </span>
                    试听片段
                `;
            }
        });

        snippetAudio.src = src;
    } else if (snippetAudio.src !== src) {
        snippetAudio.src = src;
    }
}

if (snippetSlider) {
    // 监听拖动开始和结束，避免冲突
    snippetSlider.addEventListener('mousedown', () => isDraggingSnippet = true);
    snippetSlider.addEventListener('mouseup', () => isDraggingSnippet = false);
    snippetSlider.addEventListener('touchstart', () => isDraggingSnippet = true);
    snippetSlider.addEventListener('touchend', () => isDraggingSnippet = false);

    snippetSlider.addEventListener('input', (e) => {
        snippetStartTime = parseInt(e.target.value);
        if (snippetTimeDisplay) {
            snippetTimeDisplay.textContent = formatTime(snippetStartTime);
        }
        // 如果正在试听，跳转进度
        if (snippetAudio) {
            snippetAudio.currentTime = snippetStartTime;
        }
    });
}

if (snippetPreviewBtn) {
    snippetPreviewBtn.addEventListener('click', () => {
        if (!snippetAudio) return;

        if (snippetAudio.paused) {
            snippetAudio.currentTime = snippetStartTime;
            snippetAudio.play();
            snippetPreviewBtn.innerHTML = `
                <span class="button-icon" style="margin-right: 6px;">⏸</span> 暂停试听
            `;
        } else {
            snippetAudio.pause();
            snippetPreviewBtn.innerHTML = `
                <span class="button-icon" style="margin-right: 6px;">
                    <svg class="icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em;">
                        <path d="M715.8 493.5L335 165.1c-14.2-12.2-35-1.2-35 18.5v656.8c0 19.7 20.8 30.7 35 18.5l380.8-328.4c10.9-9.4 10.9-27.6 0-37z" fill="currentColor"/>
                    </svg>
                </span>
                试听片段
            `;
        }
    });
}

function stopSnippetPreview() {
    if (snippetAudio) {
        snippetAudio.pause();
    }
    if (snippetPreviewBtn) {
        snippetPreviewBtn.innerHTML = `
            <span class="button-icon" style="margin-right: 6px;">
                 <svg class="icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style="width: 1em; height: 1em;">
                    <path d="M715.8 493.5L335 165.1c-14.2-12.2-35-1.2-35 18.5v656.8c0 19.7 20.8 30.7 35 18.5l380.8-328.4c10.9-9.4 10.9-27.6 0-37z" fill="currentColor"/>
                </svg>
            </span>
            试听片段
        `;
    }
}

if (playbackBackButton) {
    playbackBackButton.addEventListener("click", () => {
        stopSnippetPreview();
        const playbackCard = document.getElementById("playback-card");
        const musicCard = document.getElementById("music-card");

        if (playbackCard && musicCard) {
            playbackCard.style.animation = "fadeOutRight 0.3s ease-out forwards";
            setTimeout(() => {
                playbackCard.style.display = "none";
                musicCard.style.display = "block";
                musicCard.style.animation = "fadeInLeft 0.3s ease-out forwards";
            }, 300);
        }
    });
}

if (playbackContinueButton) {
    playbackContinueButton.addEventListener("click", () => {
        stopSnippetPreview();
        // 保存播放模式
        try {
            sessionStorage.setItem("playbackMode", currentPlaybackMode);
            if (currentPlaybackMode === "snippet") {
                sessionStorage.setItem("snippetStartTime", snippetStartTime);
            } else {
                sessionStorage.removeItem("snippetStartTime");
            }
        } catch (e) { }

        // 跳转到内容选择
        const playbackCard = document.getElementById("playback-card");
        const contentCard = document.getElementById("content-card");

        if (playbackCard && contentCard) {
            playbackCard.style.animation = "fadeOutLeft 0.3s ease-out forwards";
            setTimeout(() => {
                playbackCard.style.display = "none";
                contentCard.style.display = "block";
                contentCard.style.animation = "fadeInRight 0.3s ease-out forwards";

                // 默认选中官方内容（如果未选过）
                if (!selectedContentType) {
                    selectContentType("official");
                }
            }, 300);
        }
    });
}

// --- 第九步：内容选择逻辑 ---

// 官方内容文案
const OFFICIAL_CONTENT = "记得多喝水哦 今天也要开心 不要太辛苦了 累了就休息一下 你很重要 相信你可以的 加油，我在你身边 别担心，一切都会好的 你值得被温柔对待 保重身体 记得按时吃饭 早点休息 别给自己太大压力 慢慢来，不着急 你已经做得很好了 记得照顾好自己 困难只是暂时的 明天会更好 你不是一个人 有我陪着你 遇到困难记得找我 你的努力我都看到了 不开心就和我说 我会一直支持你 你很棒 相信自己 给自己一个拥抱 今天的你也很可爱 记得微笑 别忘了你的梦想 慢慢来就好 不要太勉强自己 心情不好就出去走走 晒晒太阳 听听喜欢的音乐 做自己喜欢的事 允许自己偶尔放松 你的感受很重要 不要忽视自己的需要 学会说不 保护好自己 你值得被爱 记得你有多珍贵 今天也辛苦了 谢谢你这么努力 看到你的进步真开心 为你感到骄傲 你的存在就是意义 记得深呼吸 放松肩膀 让自己舒服一点 做让你快乐的事 今天给自己一个小奖励 你配得上美好的事物 相信美好会发生 保持希望 一切都会过去的 风雨过后见彩虹 黑暗终会过去 光明就在前方 不要放弃 再坚持一下 你比你想象的更强大 相信时间的力量 给自己多一点时间 成长需要过程 接纳现在的自己 你一直在进步 每一天都是新的开始 过去的就让它过去 专注当下 珍惜此刻 享受生活 感受周围的美好 留意小确幸 记录美好瞬间 对自己好一点 温柔地对待自己 你很特别 独一无二的你 做真实的自己就好 不需要伪装 你本来的样子就很好 接受不完美 人无完人 犯错也没关系 失败是成长的一部分 从错误中学习 给自己第二次机会 允许自己重新开始 永远不晚 相信自己的选择 听从内心的声音 做让自己不后悔的决定 勇敢一点 尝试新事物 走出舒适区 但也要量力而行 保持平衡 工作与生活都重要 记得留时间给自己";

const contentOptions = document.getElementById("content-options");
const customContentSection = document.getElementById("custom-content-section");
const customContentText = document.getElementById("custom-content-text");
const officialContentPreview = document.getElementById("official-content-preview");
const contentBackButton = document.getElementById("content-back-button");
const contentContinueButton = document.getElementById("content-continue-button");

let selectedContentType = null; // "official" or "custom"

// 自定义内容限制常量
const MAX_CONTENT_LINES = 300;
const MAX_CHARS_PER_LINE = 15;

// 验证并修正自定义内容
function validateCustomContent(text) {
    const lines = text.split('\n');
    let hasExcess = false;

    // 限制行数
    if (lines.length > MAX_CONTENT_LINES) {
        lines.length = MAX_CONTENT_LINES;
        hasExcess = true;
    }

    // 限制每行字符数
    const trimmedLines = lines.map(line => {
        if (line.length > MAX_CHARS_PER_LINE) {
            hasExcess = true;
            return line.substring(0, MAX_CHARS_PER_LINE);
        }
        return line;
    });

    return {
        text: trimmedLines.join('\n'),
        hasExcess: hasExcess,
        lineCount: trimmedLines.length
    };
}

// 自定义内容输入监听
if (customContentText) {
    customContentText.addEventListener('input', () => {
        const result = validateCustomContent(customContentText.value);

        if (result.hasExcess) {
            customContentText.value = result.text;
            showToast(`每行最多${MAX_CHARS_PER_LINE}个字，最多${MAX_CONTENT_LINES}行`, "warning");
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

function selectContentType(type) {
    selectedContentType = type;

    // Update Buttons
    const typeBtns = contentOptions.querySelectorAll(".music-source-btn");
    typeBtns.forEach(btn => {
        if (btn.dataset.type === type) {
            btn.classList.add("selected");
        } else {
            btn.classList.remove("selected");
        }
    });

    // Toggle Sections
    if (type === "custom") {
        if (customContentSection) customContentSection.style.display = "block";
        if (officialContentPreview) officialContentPreview.style.display = "none";

        // Auto focus
        if (customContentText) setTimeout(() => customContentText.focus(), 100);

    } else {
        if (customContentSection) customContentSection.style.display = "none";

        // Show official text preview
        if (officialContentPreview) {
            officialContentPreview.style.display = "block";
            const p = officialContentPreview.querySelector(".preview-text");
            if (p) p.textContent = OFFICIAL_CONTENT;
        }
    }

    if (navigator.vibrate) navigator.vibrate(10);
}

if (contentBackButton) {
    contentBackButton.addEventListener("click", () => {
        const contentCard = document.getElementById("content-card");

        // 检查是否跳过了播放设置步骤（不使用音乐的情况）
        const musicSource = sessionStorage.getItem("musicSource");
        if (musicSource === "none") {
            // 返回到音乐选择步骤
            const musicCard = document.getElementById("music-card");
            if (contentCard && musicCard) {
                contentCard.style.animation = "fadeOutRight 0.3s ease-out forwards";
                setTimeout(() => {
                    contentCard.style.display = "none";
                    musicCard.style.display = "block";
                    musicCard.style.animation = "fadeInLeft 0.3s ease-out forwards";
                }, 300);
            }
        } else {
            // 返回到播放设置步骤
            const playbackCard = document.getElementById("playback-card");
            if (contentCard && playbackCard) {
                contentCard.style.animation = "fadeOutRight 0.3s ease-out forwards";
                setTimeout(() => {
                    contentCard.style.display = "none";
                    playbackCard.style.display = "block";
                    playbackCard.style.animation = "fadeInLeft 0.3s ease-out forwards";
                }, 300);
            }
        }
    });
}

if (contentContinueButton) {
    contentContinueButton.addEventListener("click", () => {
        // Check logic
        let finalContent = "";

        if (selectedContentType === "custom") {
            const text = customContentText ? customContentText.value.trim() : "";
            if (!text) {
                showToast("请写下你想说的话哦", "warning");
                if (customContentText) shakeInput(customContentText);
                return;
            }

            // 最终验证内容格式
            const validation = validateCustomContent(text);
            finalContent = validation.text;
        } else if (selectedContentType === "official") {
            // Official
            finalContent = OFFICIAL_CONTENT;
        } else {
            showToast("请先选择内容类型", "warning");
            return;
        }

        // Save to Session Storage
        try {
            sessionStorage.setItem("cardContent", finalContent);
        } catch (e) { }

        // 直接提交，不进入预览
        submitGift(contentContinueButton);
    });
}

// 在线预览按钮
const onlinePreviewButton = document.getElementById("online-preview-button");
if (onlinePreviewButton) {
    onlinePreviewButton.addEventListener("click", () => {
        // 先保存当前内容
        let finalContent = "";

        if (selectedContentType === "custom") {
            const text = customContentText ? customContentText.value.trim() : "";
            if (!text) {
                showToast("请写下你想说的话哦", "warning");
                if (customContentText) shakeInput(customContentText);
                return;
            }
            const validation = validateCustomContent(text);
            finalContent = validation.text;
        } else if (selectedContentType === "official") {
            finalContent = OFFICIAL_CONTENT;
        } else {
            showToast("请先选择内容类型", "warning");
            return;
        }

        // Save to Session Storage
        try {
            sessionStorage.setItem("cardContent", finalContent);
        } catch (e) { }

        // 跳转到第十步预览
        const contentCard = document.getElementById("content-card");
        const finalPreviewCard = document.getElementById("final-preview-card");

        if (contentCard && finalPreviewCard) {
            updateFinalPreviewText();
            contentCard.style.animation = "fadeOutLeft 0.3s ease-out forwards";
            setTimeout(() => {
                contentCard.style.display = "none";
                finalPreviewCard.style.display = "block";
                finalPreviewCard.style.animation = "fadeInRight 0.3s ease-out forwards";
            }, 300);
        }
    });
}

// Escape 键处理补充
// (在现有 Escape 监听器中无法直接插入，需要修改原监听器或者由于 JS 执行顺序，
// 下面的代码只是补充逻辑，实际需要整合。但为了简化，我们假设用户不怎么按 ESC 或者之前的逻辑能覆盖一部分)
// 更好的做法是统一处理 escape，但为了不破坏之前代码结构，我们可以在这里不加，或者谨慎加。
// 之前的代码是在 load 事件前，这里是全局替换 selectColor，所以位置在 COLORS 定义之后。


// --- 第十步：最终预览逻辑 ---

function getGreetingTime() {
    const hour = new Date().getHours();
    if (hour < 6) return "凌晨好";
    if (hour < 9) return "早上好";
    if (hour < 12) return "上午好";
    if (hour < 14) return "中午好";
    if (hour < 18) return "下午好";
    if (hour < 24) return "晚上好";
    return "您好";
}

function updateFinalPreviewText() {
    const finalGreetingText = document.getElementById("final-greeting-text");
    if (!finalGreetingText) return;

    const recipientName = sessionStorage.getItem("recipientName") || "朋友";
    const senderName = sessionStorage.getItem("senderName") || "神秘人";
    const timeGreeting = getGreetingTime();

    // xxx下午好，xxx给你定制一份独属于你的礼物 是否打开？
    finalGreetingText.textContent = `${recipientName}${timeGreeting}，${senderName}给你定制一份独属于你的礼物 是否打开？`;
}

const finalBackButton = document.getElementById("final-back-button");
const finalOpenButton = document.getElementById("final-open-button");

if (finalBackButton) {
    finalBackButton.addEventListener("click", () => {
        const finalPreviewCard = document.getElementById("final-preview-card");
        const contentCard = document.getElementById("content-card");

        if (finalPreviewCard && contentCard) {
            finalPreviewCard.style.animation = "fadeOutRight 0.3s ease-out forwards";
            setTimeout(() => {
                finalPreviewCard.style.display = "none";
                contentCard.style.display = "block";
                contentCard.style.animation = "fadeInLeft 0.3s ease-out forwards";
            }, 300);
        }
    });
}

if (finalOpenButton) {
    finalOpenButton.addEventListener("click", () => {
        showGiftPopup();
    });
}

// 页面加载完成后聚焦输入框
window.addEventListener("load", () => {
    if (nameInput) {
        setTimeout(() => {
            nameInput.focus();
        }, 500);
    }
});


// --- 礼物弹窗相关逻辑 ---

let giftSubmitInProgress = false;

async function getCustomBackgroundBlob() {
    if (customBgFile) return customBgFile;
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(ASSET_KEY);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
    } catch (e) {
        return null;
    }
}

async function uploadBackgroundToMediaServer() {
    if (selectedBg !== "custom") {
        return { url: "", mediaType: "" };
    }

    if (uploadedBgInfo && uploadedBgInfo.url) {
        return uploadedBgInfo;
    }

    if (!MEDIA_UPLOAD_ENDPOINT) {
        throw new Error("MEDIA_SERVER_NOT_CONFIGURED");
    }

    const blob = await getCustomBackgroundBlob();
    if (!blob) {
        throw new Error("BACKGROUND_MISSING");
    }

    const mediaType = blob.type && blob.type.startsWith("video/") ? "video" : "image";
    const ext = mediaType === "video" ? ".mp4" : ".jpg";
    const filename = blob.name || `background${ext}`;
    const formData = new FormData();
    formData.append("file", blob, filename);

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

    uploadedBgInfo = {
        url: result.data.url,
        mediaType: result.data.mediaType || ""
    };

    return uploadedBgInfo;
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

async function buildGiftPayload() {
    const recipientName = sessionStorage.getItem("recipientName") || "";
    const senderName = sessionStorage.getItem("senderName") || "";
    const cardContent = sessionStorage.getItem("cardContent") || "";

    if (!recipientName || !senderName) {
        showToast("请填写收礼人和赠送人名字", "warning");
        return null;
    }

    if (!cardContent) {
        showToast("请填写内容", "warning");
        return null;
    }

    const frameColor = sessionStorage.getItem("frameColor") || "colorful";
    const frameStyle = normalizeFrameStyle(sessionStorage.getItem(FRAME_STYLE_KEY));
    const glassOpacity = parseInt(sessionStorage.getItem("glassOpacity") || "50", 10);
    const pageBackground = sessionStorage.getItem("pageBackground") || "white";

    let backgroundMediaUrl = "";
    let backgroundMediaType = "";
    if (pageBackground === "custom") {
        const uploadInfo = await uploadBackgroundToMediaServer();
        backgroundMediaUrl = uploadInfo.url || "";
        backgroundMediaType = uploadInfo.mediaType || "";
    }

    const musicSource = sessionStorage.getItem("musicSource") || "none";
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
        frameColor,
        frameStyle,
        glassOpacity: Number.isFinite(glassOpacity) ? glassOpacity : 50,
        pageBackground,
        backgroundMediaUrl,
        backgroundMediaType,
        musicSource,
        musicUrl,
        musicData,
        playbackMode,
        snippetStartTime: Number.isFinite(snippetStartTime) ? snippetStartTime : 0
    };
}

function showShareResult(shareUrl) {
    if (!shareUrl) return;
    const giftOverlay = document.getElementById("gift-overlay");
    if (!giftOverlay) return;
    const existing = giftOverlay.querySelector(".share-result");
    if (existing) existing.remove();

    giftOverlay.style.display = "block";
    if (!giftOverlay.classList.contains("gift-overlay")) {
        giftOverlay.className = "gift-overlay";
    }
    if (!giftOverlay.querySelector(".gift-background-media")) {
        giftOverlay.style.background = "#ffffff";
    }

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

    giftOverlay.appendChild(container);
}

async function submitGift(submitButton, buttonContainer) {
    if (giftSubmitInProgress) return;

    giftSubmitInProgress = true;
    const originalContent = submitButton ? submitButton.innerHTML : "";
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = "提交中...";
    }

    try {
        const payload = await buildGiftPayload();
        if (!payload) {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = originalContent;
            }
            return;
        }

        const response = await fetch(GIFT_SUBMIT_ENDPOINT, {
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

        if (buttonContainer) {
            buttonContainer.remove();
        }

        showShareResult(result.data.shareUrl);
    } catch (error) {
        const message = error && error.message === "MEDIA_SERVER_NOT_CONFIGURED"
            ? "媒体服务器未配置"
            : error && error.message === "BACKGROUND_MISSING"
                ? "背景文件不存在"
                : error && error.message === "UPLOAD_FAILED"
                    ? "上传失败"
                    : error && error.message
                        ? error.message
                        : "提交失败";
        showToast(message, "warning");
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = originalContent;
        }
    } finally {
        giftSubmitInProgress = false;
    }
}


async function showGiftPopup() {
    const giftOverlay = document.getElementById("gift-overlay");
    
    if (!giftOverlay) return;

    // 清空 Overlay 内容，只保留背景
    giftOverlay.innerHTML = '';
    
    // 1. 准备内容
    const recipientName = sessionStorage.getItem("recipientName") || "朋友";
    const rawContent = sessionStorage.getItem("cardContent") || "祝你天天开心！";
    
    // 分割内容
    let sentences = [];
    
    let contentParts = rawContent.split(/[\n\s]+/);
    contentParts = contentParts.filter(p => p.trim().length > 0);
    
    // 如果内容太少（少于5个），我们重复几次以营造氛围，或者补充一些默认的暖心词
    if (contentParts.length < 5 && contentParts.length > 0) {
        const defaultFillers = ["加油", "未来可期", "记得微笑", "别放弃", "相信自己", "美好将至", "保持热爱"];
        // 补充一些
        let needed = 8 - contentParts.length;
        for(let i=0; i<needed; i++) {
            contentParts.push(defaultFillers[i % defaultFillers.length]);
        }
    } else if (contentParts.length === 0) {
         contentParts = ["祝你天天开心", "万事如意"];
    }
    
    // 构建气泡数据
    contentParts.forEach((part, idx) => {
        sentences.push({
            header: recipientName, // 头部显示名字
            content: part,
            isHighlight: idx === 0 // 标记第一个词为高亮(可选)
        });
    });

    // 2. 设置背景
    giftOverlay.className = "gift-overlay";
    
    // 检查是否有自定义背景
    const bgType = sessionStorage.getItem("pageBackground");
    if (bgType === "custom") {
        const blob = await getCustomBackgroundBlob();
        if (blob) {
            const objectUrl = URL.createObjectURL(blob);
            let mediaEl;
            if (blob.type.startsWith("video/")) {
                mediaEl = document.createElement("video");
                mediaEl.src = objectUrl;
                mediaEl.autoplay = true;
                mediaEl.loop = true;
                mediaEl.muted = true;
                mediaEl.playsInline = true;
                mediaEl.className = "gift-background-media";
            } else {
                mediaEl = document.createElement("img");
                mediaEl.src = objectUrl;
                mediaEl.className = "gift-background-media";
            }
            giftOverlay.appendChild(mediaEl);
            // 有自定义背景时，不设置白色底色
            giftOverlay.style.background = "transparent";
        } else {
            // 没有找到自定义背景文件，使用白色
            giftOverlay.style.background = "#ffffff";
        }
    } else {
        // 使用默认白色背景
        giftOverlay.style.background = "#ffffff";
    }

    // 3. 准备方框样式数据 (恢复颜色逻辑)
    const frameColorName = sessionStorage.getItem("frameColor") || "colorful";
    const frameStyle = normalizeFrameStyle(sessionStorage.getItem(FRAME_STYLE_KEY));
    const glassValue = parseInt(sessionStorage.getItem("glassOpacity") || "50");
    const opacity = 0.2 + (glassValue / 100) * 0.8;
    const blur = 20 * (1 - glassValue / 100);

    // 预定义一组多彩颜色 (Hex)，用于 colorful 模式
    const colorfulPalette = [
        "#f87171", // red
        "#fb923c", // orange
        "#fbbf24", // amber
        "#facc15", // yellow
        "#a3e635", // lime
        "#4ade80", // green
        "#34d399", // emerald
        "#2dd4bf", // teal
        "#22d3ee", // cyan
        "#38bdf8", // sky
        "#60a5fa", // blue
        "#818cf8", // indigo
        "#a78bfa", // violet
        "#c084fc", // purple
        "#e879f9", // fuchsia
        "#f472b6", // pink
        "#fb7185"  // rose
    ];

    let hexColor = "#ffffff";
    if (frameColorName !== "colorful" && typeof COLOR_MAP !== 'undefined' && COLOR_MAP[frameColorName]) {
        hexColor = COLOR_MAP[frameColorName];
    }
    
    let rgb = null;
    if (typeof hexToRgb === 'function' && frameColorName !== "colorful") {
        rgb = hexToRgb(hexColor);
    }

    // 单色模式的基础样式
    let singleColorBgStyle = "";
    if (rgb) {
        singleColorBgStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
    } else {
        singleColorBgStyle = `rgba(255, 255, 255, ${opacity})`;
    }

    const backdropFilterStyle = `blur(${blur}px)`;

    // 4. 显示 Overlay
    giftOverlay.style.display = "block";
    startMusicPlayback();

    // 5. 生成气泡并添加动画
    const containerW = window.innerWidth;
    const containerH = window.innerHeight;
    let occupiedRects = [];

    // 辅助函数：检测碰撞
    function isColliding(rect1, rects) {
        for (let r of rects) {
            const shrink = 10; 
            if (!(rect1.right - shrink < r.left + shrink ||
                rect1.left + shrink > r.right - shrink ||
                rect1.bottom - shrink < r.top + shrink ||
                rect1.top + shrink > r.bottom - shrink)) {
                return true;
            }
        }
        return false;
    }

    const MAX_VISIBLE_BUBBLES = 30;
    const bubbleElements = []; // 用于存储生成的 bubble 元素以便后续操作
    let bubbleIndex = 0; // 当前气泡索引（持续递增）
    let bubbleInterval = null; // 定时器引用

    // 创建单个气泡的函数
    function createBubble() {
        const item = sentences[bubbleIndex % sentences.length]; // 循环取内容
        const index = bubbleIndex;
        
        const bubble = document.createElement("div");
        bubble.className = "gift-bubble";
        if (item.isHighlight && (index % sentences.length) === 0) bubble.classList.add("is-name");
        if (frameStyle === "name-top") bubble.classList.add("gift-bubble--name-top");
        
        // 应用动态样式 (颜色)
        if (frameColorName === "colorful") {
            // 如果是多彩模式，按索引循环取色，赋予每个气泡不同的单色背景
            const colorHex = colorfulPalette[index % colorfulPalette.length];
            const colorRgb = hexToRgb(colorHex);
            if (colorRgb) {
                bubble.style.background = `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, ${opacity})`;
            } else {
                bubble.style.background = singleColorBgStyle;
            }
        } else {
            // 单色模式
            bubble.style.background = singleColorBgStyle;
        }
        
        bubble.style.backdropFilter = backdropFilterStyle;
        bubble.style.webkitBackdropFilter = backdropFilterStyle;
        
        // 构造内部 HTML
        if (frameStyle === "name-top") {
            bubble.innerHTML = `
            <div class="bubble-header">${item.header}</div>
            <div class="bubble-content">${item.content}</div>
        `;
        } else {
            bubble.innerHTML = `
            <div class="bubble-content">${item.header} ${item.content}</div>
        `;
        }

        // 先添加到 DOM 获取尺寸
        bubble.style.visibility = "hidden";
        giftOverlay.appendChild(bubble);
        bubbleElements.push(bubble); // 保存引用

        const w = bubble.offsetWidth;
        const h = bubble.offsetHeight;
        let left, top;
        let attempts = 0;
        let safe = false;
        const pad = 20; // 边距

        // 随机分布逻辑
        while (attempts < 100) {
            left = pad + Math.random() * (containerW - w - pad * 2);
            const adjustedBottomReserved = 20;
            const maxTop = containerH - h - adjustedBottomReserved;
            top = pad + Math.random() * (maxTop - pad);

            const rect = { left, top, right: left + w, bottom: top + h };
            
            // 碰撞检测（只检测最近的几个气泡，避免性能问题）
            const recentRects = occupiedRects.slice(-10);
            if (!isColliding(rect, recentRects)) {
                safe = true;
                break;
            }
            attempts++;
        }

        // 如果实在找不到不重叠的位置，强制放在安全区域内
        if (!safe) {
            left = pad + Math.random() * (containerW - w - pad * 2);
            const adjustedBottomReserved = 20;
            const maxTop = containerH - h - adjustedBottomReserved;
            top = pad + Math.random() * (maxTop - pad);
        }

        // 记录位置（只保留最近的位置记录）
        occupiedRects.push({ left, top, right: left + w, bottom: top + h });
        if (occupiedRects.length > 15) {
            occupiedRects.shift();
        }

        bubble.style.left = `${left}px`;
        bubble.style.top = `${top}px`;
        bubble.style.zIndex = 10 + (index % 100); 
        bubble.style.visibility = "visible";

        // 显示动画
        requestAnimationFrame(() => {
            bubble.classList.add("popup-show");
        });

        // 超过阈值，隐藏并移除旧的
        if (bubbleElements.length > MAX_VISIBLE_BUBBLES) {
            const oldBubble = bubbleElements.shift();
            if (oldBubble) {
                oldBubble.classList.remove("popup-show");
                
                // 等待过渡动画完成后从 DOM 中移除
                setTimeout(() => {
                    if (oldBubble.parentNode) {
                        oldBubble.parentNode.removeChild(oldBubble);
                    }
                }, 500);
            }
        }

        bubbleIndex++;
    }

    const BUBBLE_SHOW_INTERVAL = 250;
    const BUBBLE_SHOW_DELAY = 100;

    // 开始持续弹出气泡
    function startBubbleLoop() {
        // 与分享端节奏一致：首个延迟 100ms，之后每 250ms 一个
        setTimeout(() => {
            createBubble();
            bubbleInterval = setInterval(() => {
                createBubble();
            }, BUBBLE_SHOW_INTERVAL);
        }, BUBBLE_SHOW_DELAY);
    }

    // 启动气泡循环
    startBubbleLoop();

    // 6. 添加底部的“提交礼物”按钮
    const btnContainer = document.createElement("div");
    btnContainer.className = "submit-gift-container";
    const submitButton = document.createElement("button");
    submitButton.className = "submit-gift-btn";
    submitButton.type = "button";
    submitButton.innerHTML = `
        <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <path d="M406.656 706.944L195.84 496.256a32 32 0 1 0-45.248 45.248l256 256 512-512a32 32 0 0 0-45.248-45.248L406.592 706.944z"/>
        </svg>
        提交礼物
    `;
    submitButton.addEventListener("click", () => submitGift(submitButton, btnContainer));
    btnContainer.appendChild(submitButton);
    giftOverlay.appendChild(btnContainer);

    const prefersReducedMotion = window.matchMedia
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealDelay = (prefersReducedMotion || document.documentElement.classList.contains("turbo-mode"))
        ? 0
        : 2000;
    setTimeout(() => {
        btnContainer.classList.add("is-visible");
    }, revealDelay);
}


function startMusicPlayback() {
    // 停止之前的预览
    stopMusicPreview();
    stopSnippetPreview();

    const musicSource = sessionStorage.getItem("musicSource");
    if (musicSource === "none") return;

    // 尝试恢复 selectedMusic
    if (!selectedMusic) {
        try {
            selectedMusic = JSON.parse(sessionStorage.getItem("musicData"));
        } catch (e) { }
    }
    if (!selectedMusic) return;

    // 获取播放模式，优先使用内存变量
    let mode = typeof currentPlaybackMode !== 'undefined' ? currentPlaybackMode : (sessionStorage.getItem("playbackMode") || "full");

    if (mode === "snippet") {
        // 读取开始时间
        const storedStartTime = sessionStorage.getItem("snippetStartTime");
        if (storedStartTime) snippetStartTime = parseInt(storedStartTime);

        initSnippetAudio().then(() => {
            if (snippetAudio) {
                snippetAudio.currentTime = snippetStartTime;
                snippetAudio.loop = true;
                snippetAudio.play().catch(e => console.log("Snippet Play failed", e));
            }
        });
    } else {
        // Full playback
        if (!musicAudio) {
            musicAudio = document.getElementById("music-audio");
        }
        // 如果 DOM 里的 audio 元素没了或者不可用，创建一个新的
        if (!musicAudio) musicAudio = new Audio();

        const playFull = async () => {
            // 确保 URL
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
                musicAudio.play().catch(e => console.log("Full Play failed", e));
            }
        };
        playFull();
    }
}

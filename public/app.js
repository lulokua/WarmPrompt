function handleNavigation(event, target) {
  event.preventDefault(); // Prevent immediate default navigation

  let url;
  if (target === 'others') {
    url = 'others/';
  } else if (target === 'self') {
    url = 'self/index.html';
  } else if (target === 'letter') {
    url = 'letter/'; // New Text Letter path
  } else if (target === 'feedback') {
    url = 'feedback/';
  } else {
    url = '#';
  }

  // Check for Turbo Mode (defined on html element)
  const isTurbo = document.documentElement.classList.contains('turbo-mode');

  if (isTurbo) {
    // Turbo Mode: Immediate navigation for speed
    window.location.href = url;
    return;
  }

  // Aesthetic Mode: Play AI Transition Animation
  const overlay = document.getElementById('ai-transition-overlay');
  if (overlay) {
    overlay.classList.add('is-active');

    // Play the animation for 1.2 seconds before navigating
    // This creates the "AI Switching" feel requested
    setTimeout(() => {
      window.location.href = url;
    }, 1200);
  } else {
    // Fallback
    window.location.href = url;
  }
}

const settingsToggle = document.getElementById("settings-toggle");
const settingsPanel = document.getElementById("settings-panel");
const settingsOverlay = document.getElementById("settings-overlay");
const settingsClose = document.getElementById("settings-close");
const themeToggle = document.getElementById("theme-toggle");
const themeThumb = document.getElementById("theme-thumb");
const themeLabel = document.getElementById("theme-label");
const loginButton = document.getElementById("login-button");
const loginModal = document.getElementById("login-modal");
const loginModalOverlay = document.getElementById("login-modal-overlay");
const loginModalClose = document.getElementById("login-modal-close");
const loginModalConfirm = document.getElementById("login-modal-confirm");
const turboToggle = document.getElementById("turbo-toggle");
const turboThumb = document.getElementById("turbo-thumb");
const turboLabel = document.getElementById("turbo-label");
const turboModal = document.getElementById("turbo-modal");
const turboModalOverlay = document.getElementById("turbo-modal-overlay");
const turboConfirm = document.getElementById("turbo-confirm");
const turboConfirmText = document.getElementById("turbo-confirm-text");
const turboCancel = document.getElementById("turbo-cancel");
const domainWarning = document.getElementById("domain-warning");

const PANEL_OPEN_CLASS = "is-open";
const OVERLAY_VISIBLE_CLASS = "is-visible";
const THUMB_ON_CLASS = "is-on";
const THEME_KEY = "theme";
const TURBO_KEY = "turboMode";

function updateDomainWarning() {
  if (!domainWarning) {
    return;
  }

  const hostname = (window.location && window.location.hostname || "").toLowerCase();
  const allowedHosts = new Set(["show.lokua.xyz", "lc.lokua.xyz", "127.0.0.1"]);
  const shouldHide = allowedHosts.has(hostname);

  domainWarning.classList.toggle("is-hidden", shouldHide);
  domainWarning.setAttribute("aria-hidden", shouldHide ? "true" : "false");
}

function setPanelState(isOpen) {
  if (!settingsPanel || !settingsOverlay || !settingsToggle) {
    return;
  }

  // 关闭面板时，先移除焦点以避免 aria-hidden 警告
  if (!isOpen && settingsPanel.contains(document.activeElement)) {
    settingsToggle.focus();
  }

  settingsToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");

  // 使用 inert 属性代替 aria-hidden，更好地处理焦点和无障碍访问
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

// 极速模式功能
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

  // Update Version Label
  const versionLabel = document.querySelector(".version-label");
  if (versionLabel) {
    versionLabel.textContent = isEnabled ? "WarmPrompt v5.2" : "WarmPrompt v5.2";
  }

  // 可以在这里添加极速模式的实际功能影响
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
let turboCountdown = 5;

function showTurboModal() {
  if (!turboModal || !turboModalOverlay) return;

  // 重置倒计时
  turboCountdown = 5;
  if (turboConfirm) {
    turboConfirm.disabled = true;
  }
  if (turboConfirmText) {
    turboConfirmText.textContent = `我知道了 (${turboCountdown}s)`;
  }

  // 显示弹窗
  turboModal.classList.add("is-visible");
  turboModal.setAttribute("aria-hidden", "false");
  turboModalOverlay.classList.add("is-visible");
  turboModalOverlay.setAttribute("aria-hidden", "false");

  // 开始倒计时
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

  // 隐藏弹窗
  turboModal.classList.remove("is-visible");
  turboModal.setAttribute("aria-hidden", "true");
  turboModalOverlay.classList.remove("is-visible");
  turboModalOverlay.setAttribute("aria-hidden", "true");

  // 清除倒计时
  if (turboCountdownInterval) {
    clearInterval(turboCountdownInterval);
    turboCountdownInterval = null;
  }
}

function confirmTurboMode() {
  hideTurboModal();
  persistTurboMode(true);
  // 刷新页面以使极速模式完全生效
  window.location.reload();
}

function cancelTurboMode() {
  hideTurboModal();
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

// 登录按钮点击事件
if (loginButton) {
  loginButton.addEventListener("click", () => {
    showLoginModal();
  });
}

// 登录弹窗相关函数
function showLoginModal() {
  if (!loginModal || !loginModalOverlay) return;
  
  loginModal.classList.add("is-visible");
  loginModal.setAttribute("aria-hidden", "false");
  loginModalOverlay.classList.add("is-visible");
  loginModalOverlay.setAttribute("aria-hidden", "false");
}

function hideLoginModal() {
  if (!loginModal || !loginModalOverlay) return;
  
  loginModal.classList.remove("is-visible");
  loginModal.setAttribute("aria-hidden", "true");
  loginModalOverlay.classList.remove("is-visible");
  loginModalOverlay.setAttribute("aria-hidden", "true");
}

// 登录弹窗事件监听
if (loginModalClose) {
  loginModalClose.addEventListener("click", hideLoginModal);
}

if (loginModalConfirm) {
  loginModalConfirm.addEventListener("click", () => {
    hideLoginModal();
    window.location.href = "log_in/";
  });
}

if (loginModalOverlay) {
  loginModalOverlay.addEventListener("click", hideLoginModal);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSettings();
  }
});

const initialTheme = getStoredTheme() || getPreferredTheme();
applyTheme(initialTheme);

// 初始化极速模式（默认开启）
const initialTurboMode = true;
applyTurboMode(initialTurboMode);
persistTurboMode(true);

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const isDark = document.documentElement.classList.contains("dark");
    const nextTheme = isDark ? "light" : "dark";
    applyTheme(nextTheme);
    persistTheme(nextTheme);
  });
}

// 极速模式切换事件
if (turboToggle) {
  turboToggle.addEventListener("click", () => {
    const isCurrentlyEnabled = turboToggle.getAttribute("aria-pressed") === "true";
    if (isCurrentlyEnabled) {
      // 如果当前是开启状态，直接关闭
      applyTurboMode(false);
      persistTurboMode(false);
    } else {
      // 如果当前是关闭状态，显示确认弹窗
      showTurboModal();
    }
  });
}

// 极速模式弹窗按钮事件
if (turboConfirm) {
  turboConfirm.addEventListener("click", confirmTurboMode);
}

if (turboCancel) {
  turboCancel.addEventListener("click", cancelTurboMode);
}

if (turboModalOverlay) {
  turboModalOverlay.addEventListener("click", cancelTurboMode);
}

// =========================================
// CHANGELOG MODAL LOGIC
// =========================================
const changelogBadge = document.getElementById('changelog-badge');
const changelogModal = document.getElementById('changelog-modal');
const changelogOverlay = document.getElementById('changelog-overlay');
const changelogClose = document.getElementById('changelog-close');
const changelogConfirm = document.getElementById('changelog-confirm');

function openChangelogModal() {
  if (changelogModal && changelogOverlay) {
    changelogModal.classList.add('is-visible');
    changelogOverlay.classList.add('is-visible');
    changelogModal.setAttribute('aria-hidden', 'false');
    changelogOverlay.setAttribute('aria-hidden', 'false');
    if (changelogBadge) {
      changelogBadge.setAttribute('aria-expanded', 'true');
    }
  }
}

function closeChangelogModal() {
  if (changelogModal && changelogOverlay) {
    changelogModal.classList.remove('is-visible');
    changelogOverlay.classList.remove('is-visible');
    changelogModal.setAttribute('aria-hidden', 'true');
    changelogOverlay.setAttribute('aria-hidden', 'true');
    if (changelogBadge) {
      changelogBadge.setAttribute('aria-expanded', 'false');
    }
  }
}

if (changelogBadge) {
  changelogBadge.addEventListener('click', openChangelogModal);
}

if (changelogClose) {
  changelogClose.addEventListener('click', closeChangelogModal);
}

if (changelogConfirm) {
  changelogConfirm.addEventListener('click', closeChangelogModal);
}

if (changelogOverlay) {
  changelogOverlay.addEventListener('click', closeChangelogModal);
}

// Close changelog modal on Escape key
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && changelogModal && changelogModal.classList.contains('is-visible')) {
    closeChangelogModal();
  }
});

updateDomainWarning();

// =========================================
// GROUP NOTICE MODAL LOGIC
// =========================================
const groupNoticeModal = document.getElementById('group-notice-modal');
const groupNoticeOverlay = document.getElementById('group-notice-overlay');
const groupNoticeClose = document.getElementById('group-notice-close');
const groupNoticeConfirm = document.getElementById('group-notice-confirm');

function showGroupNoticeModal() {
  if (groupNoticeModal && groupNoticeOverlay) {
    groupNoticeModal.classList.add('is-visible');
    groupNoticeOverlay.classList.add('is-visible');
    groupNoticeModal.setAttribute('aria-hidden', 'false');
    groupNoticeOverlay.setAttribute('aria-hidden', 'false');
  }
}

function hideGroupNoticeModal() {
  if (groupNoticeModal && groupNoticeOverlay) {
    groupNoticeModal.classList.remove('is-visible');
    groupNoticeOverlay.classList.remove('is-visible');
    groupNoticeModal.setAttribute('aria-hidden', 'true');
    groupNoticeOverlay.setAttribute('aria-hidden', 'true');
  }
}

if (groupNoticeClose) {
  groupNoticeClose.addEventListener('click', hideGroupNoticeModal);
}

if (groupNoticeConfirm) {
  groupNoticeConfirm.addEventListener('click', hideGroupNoticeModal);
}

if (groupNoticeOverlay) {
  groupNoticeOverlay.addEventListener('click', hideGroupNoticeModal);
}

// 页面加载完成后尽快显示官方群公告弹窗
document.addEventListener('DOMContentLoaded', showGroupNoticeModal);

// Close group notice modal on Escape key
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && groupNoticeModal && groupNoticeModal.classList.contains('is-visible')) {
    hideGroupNoticeModal();
  }
});

// Preload logic or other initializations can go here

// =========================================
// SHUTDOWN COUNTDOWN
// =========================================
function updateCountdown() {
  const countdownElement = document.getElementById('countdown-timer');
  if (!countdownElement) return;

  // Target: 2026年02月15日 11:57
  const targetDate = new Date('2026-02-15T11:57:00');
  const now = new Date();
  const diff = targetDate - now;

  if (diff <= 0) {
    countdownElement.textContent = '已关闭';
    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    countdownElement.textContent = `${days}天${hours}小时${minutes}分`;
  } else if (hours > 0) {
    countdownElement.textContent = `${hours}小时${minutes}分`;
  } else {
    countdownElement.textContent = `${minutes}分钟`;
  }
}

// 初始化并每秒更新倒计时
updateCountdown();
setInterval(updateCountdown, 60000); // 每分钟更新一次

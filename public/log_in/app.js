(function () {
  "use strict";

  const SESSION_KEY = "wp_account_session";
  const BENEFITS_ENDPOINT = "/api/account/benefits";
  const ACTIVITY_ENDPOINT = "/api/account/activity";

  const BENEFIT_DEFS = [
    { key: "dailyGenerate", label: "每日生成", unit: "次" },
    { key: "neteasePlaylist", label: "网易云歌单", unit: "次" },
    { key: "qqMusic", label: "QQ音乐", unit: "次" },
    { key: "imageUpload", label: "上传图片", unit: "次" },
    { key: "videoUpload", label: "上传视频", unit: "次" },
    { key: "customDomain", label: "独立域名+微信", support: true },
    { key: "dedicatedServer", label: "独立服务器", support: true }
  ];

  const LEVEL_STYLES = {
    trial: "level-pill--trial",
    air: "level-pill--air",
    standard: "level-pill--standard",
    pro: "level-pill--pro"
  };

  const loginCard = document.getElementById("loginCard");
  const resultCard = document.getElementById("resultCard");
  const loginForm = document.getElementById("loginForm");
  const accountInput = document.getElementById("accountId");
  const passwordInput = document.getElementById("password");
  const togglePassword = document.getElementById("togglePassword");
  const loginBtn = document.getElementById("loginBtn");
  const formFeedback = document.getElementById("formFeedback");
  const levelPill = document.getElementById("levelPill");
  const userTitle = document.getElementById("userTitle");
  const userSubtitle = document.getElementById("userSubtitle");
  const metaAccount = document.getElementById("metaAccount");
  const metaExpire = document.getElementById("metaExpire");
  const benefitGrid = document.getElementById("benefitGrid");
  const todayTotal = document.getElementById("todayTotal");
  const todayBreakdown = document.getElementById("todayBreakdown");
  const planAccess = document.getElementById("planAccess");
  const planRetention = document.getElementById("planRetention");
  const shareList = document.getElementById("shareList");
  const shareEmpty = document.getElementById("shareEmpty");
  const logoutBtn = document.getElementById("logoutBtn");
  const homeBtn = document.getElementById("homeBtn");

  function setFeedback(message, type = "error") {
    formFeedback.textContent = message || "";
    formFeedback.classList.toggle("is-success", type === "success");
  }

  function setLoading(isLoading) {
    loginCard.classList.toggle("is-loading", isLoading);
    loginBtn.disabled = isLoading;
  }

  function formatCount(value, unit) {
    if (value < 0) return "无限";
    if (!value) return "不可用";
    return `${value}${unit || ""}`;
  }

  function formatSupport(value) {
    return value ? "支持" : "不可用";
  }

  function renderBenefits(benefits = {}) {
    benefitGrid.innerHTML = BENEFIT_DEFS.map((item) => {
      const value = item.support ? formatSupport(benefits[item.key]) : formatCount(benefits[item.key], item.unit);
      return `
        <div class="benefit-item">
          <span class="benefit-label">${item.label}</span>
          <span class="benefit-value">${value}</span>
        </div>
      `;
    }).join("");
  }

  function formatRemainingDays(value) {
    if (!Number.isFinite(Number(value))) return "-";
    const days = Math.max(0, Math.ceil(Number(value)));
    return `${days} 天`;
  }

  function formatRemainingAccess(value) {
    if (Number(value) < 0) return "无限";
    if (!Number.isFinite(Number(value))) return "-";
    return `${Math.max(0, Number(value))} 次`;
  }

  function renderActivity(data) {
    const today = data && data.today ? data.today : { total: 0, gift: 0, letter: 0 };
    const plan = data && data.plan ? data.plan : {};
    const items = data && Array.isArray(data.items) ? data.items : [];

    if (todayTotal) todayTotal.textContent = today.total || 0;
    if (todayBreakdown) {
      todayBreakdown.textContent = `${today.gift || 0} / ${today.letter || 0}`;
    }

    if (planAccess) {
      const accessValue = Number.isFinite(Number(plan.accessLimit)) ? Number(plan.accessLimit) : null;
      planAccess.textContent = accessValue !== null ? `${accessValue} 次` : "-";
    }
    if (planRetention) {
      const retentionValue = Number.isFinite(Number(plan.retentionDays)) ? Number(plan.retentionDays) : null;
      planRetention.textContent = retentionValue !== null ? `${retentionValue} 天` : "-";
    }

    if (!shareList || !shareEmpty) return;

    if (!items.length) {
      shareList.innerHTML = "";
      shareEmpty.classList.remove("is-hidden");
      return;
    }

    shareEmpty.classList.add("is-hidden");
    shareList.innerHTML = items.map((item) => {
      const typeLabel = item.type === "letter" ? "文字信" : "礼物";
      const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleString("zh-CN") : "-";
      const remainingAccess = formatRemainingAccess(item.remainingAccess);
      const remainingDays = formatRemainingDays(item.remainingDays);
      const accessTag = `访问剩余 ${remainingAccess}`;
      const retentionTag = `保留剩余 ${remainingDays}`;
      const shareUrl = item.shareUrl || "";

      return `
        <div class="share-item">
          <div>
            <div class="share-title">${typeLabel}</div>
            <div class="share-meta">${createdAt}</div>
          </div>
          <div class="share-tags">
            <span class="share-tag">${accessTag}</span>
            <span class="share-tag">${retentionTag}</span>
          </div>
          <a class="share-link" href="${shareUrl}" target="_blank" rel="noreferrer">${shareUrl}</a>
        </div>
      `;
    }).join("");
  }

  function normalizeLevelClass(type) {
    return LEVEL_STYLES[type] || "level-pill--pro";
  }

  function showResult(data) {
    const levelClass = normalizeLevelClass(data.type);
    levelPill.className = `level-pill ${levelClass}`;
    levelPill.textContent = data.levelLabel || "会员";
    userTitle.textContent = "欢迎回来";
    userSubtitle.textContent = "你的会员权益已加载";
    metaAccount.textContent = data.accountId || "-";
    metaExpire.textContent = data.expireDate || "-";
    renderBenefits(data.benefits || {});
    renderActivity({
      plan: {
        accessLimit: data.benefits && data.benefits.accessLimit,
        retentionDays: data.benefits && data.benefits.retentionDays
      },
      today: {},
      items: []
    });

    loginCard.classList.add("is-hidden");
    resultCard.classList.remove("is-hidden");
  }

  async function refreshActivity(showFeedback = false) {
    try {
      const response = await fetch(ACTIVITY_ENDPOINT, {
        method: "GET",
        credentials: "same-origin"
      });
      let result = null;
      try {
        result = await response.json();
      } catch (error) {
        result = null;
      }

      if (!response.ok || !result || !result.success || !result.data) {
        if (response.status === 401 || response.status === 403) {
          clearSession();
          showLogin();
          if (showFeedback) {
            setFeedback(result && result.message ? result.message : "登录已过期，请重新登录");
          }
        }
        return false;
      }

      renderActivity(result.data);
      return true;
    } catch (error) {
      return false;
    }
  }

  async function refreshBenefits(showFeedback = false) {
    try {
      const response = await fetch(BENEFITS_ENDPOINT, {
        method: "GET",
        credentials: "same-origin"
      });
      let result = null;
      try {
        result = await response.json();
      } catch (error) {
        result = null;
      }

      if (!response.ok || !result || !result.success || !result.data) {
        if (response.status === 401 || response.status === 403) {
          clearSession();
          showLogin();
          if (showFeedback) {
            setFeedback(result && result.message ? result.message : "登录已过期，请重新登录");
          }
        }
        return false;
      }

      saveSession(result.data);
      if (resultCard && !resultCard.classList.contains("is-hidden")) {
        showResult(result.data);
      }
      return true;
    } catch (error) {
      // Ignore refresh errors.
      return false;
    }
  }

  function showLogin() {
    loginCard.classList.remove("is-hidden");
    resultCard.classList.add("is-hidden");
  }

  function saveSession(data) {
    const payload = {
      accountId: data.accountId,
      type: data.type,
      levelLabel: data.levelLabel,
      expireDate: data.expireDate,
      expireAt: data.expireAt,
      benefits: data.benefits
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function isSessionValid(session) {
    if (!session || !session.expireAt) return false;
    return new Date(session.expireAt).getTime() > Date.now();
  }

  async function handleLogin(event) {
    event.preventDefault();
    setFeedback("");

    const accountId = accountInput.value.trim();
    const password = passwordInput.value.trim();

    if (!accountId || !password) {
      setFeedback("请输入账号与密码");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/account/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ accountId, password })
      });

      const result = await response.json();
      if (!result.success) {
        setFeedback(result.message || "登录失败");
        setLoading(false);
        return;
      }

      setFeedback("登录成功", "success");
      saveSession(result.data);
      showResult(result.data);
      refreshBenefits();
      refreshActivity();
    } catch (error) {
      setFeedback("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearSession();
    accountInput.value = "";
    passwordInput.value = "";
    setFeedback("");
    showLogin();
  }

  function handleGoHome() {
    window.location.href = "/";
  }

  function handlePasswordToggle() {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    togglePassword.textContent = isHidden ? "隐藏" : "显示";
  }

  async function restoreSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const session = JSON.parse(raw);
      if (isSessionValid(session)) {
        showResult(session);
        await refreshBenefits(true);
        await refreshActivity();
      } else {
        clearSession();
      }
    } catch (error) {
      clearSession();
    }
  }

  loginForm.addEventListener("submit", handleLogin);
  togglePassword.addEventListener("click", handlePasswordToggle);
  logoutBtn.addEventListener("click", handleLogout);
  homeBtn.addEventListener("click", handleGoHome);

  restoreSession();
})();

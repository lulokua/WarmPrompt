/**
 * 管理仪表盘脚本
 * WarmPrompt v5.0
 * 使用后端 API 管理账号
 */

(function () {
    'use strict';

    // DOM 元素
    const userInfo = document.getElementById('userInfo');
    const welcomeName = document.getElementById('welcomeName');
    const logoutBtn = document.getElementById('logoutBtn');
    const currentTime = document.getElementById('currentTime');
    const modalOverlay = document.getElementById('modalOverlay');
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalClose = document.getElementById('modalClose');
    const countTrial = document.getElementById('countTrial');
    const countAir = document.getElementById('countAir');
    const countPro = document.getElementById('countPro');
    const countStandard = document.getElementById('countStandard');

    // 账号生成按钮
    const addTrial = document.getElementById('addTrial');
    const addAir = document.getElementById('addAir');
    const addPro = document.getElementById('addPro');
    const addStandard = document.getElementById('addStandard');
    const historyTrial = document.getElementById('historyTrial');
    const historyAir = document.getElementById('historyAir');
    const historyPro = document.getElementById('historyPro');
    const historyStandard = document.getElementById('historyStandard');

    // 配置
    const IDLE_LIMIT_MS = 5 * 60 * 1000;
    const PING_THROTTLE_MS = 60 * 1000;

    const BENEFIT_DEFS = [
        { key: 'dailyGenerate', label: '每日生成', unit: '次' },
        { key: 'neteasePlaylist', label: '添加网易云歌单', unit: '次' },
        { key: 'qqMusic', label: '添加QQ音乐歌曲', unit: '次' },
        { key: 'imageUpload', label: '上传图片', unit: '次' },
        { key: 'videoUpload', label: '上传视频', unit: '次' },
        { key: 'customDomain', label: '独立域名+微信', support: true },
        { key: 'dedicatedServer', label: '独立服务器', support: true }
    ];

    function normalizeBenefitNumber(value) {
        if (value === null || value === undefined || value === '') {
            return 0;
        }
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
    }

    function normalizeBenefits(raw = {}) {
        return {
            dailyGenerate: normalizeBenefitNumber(raw.dailyGenerate),
            neteasePlaylist: normalizeBenefitNumber(raw.neteasePlaylist),
            qqMusic: normalizeBenefitNumber(raw.qqMusic),
            imageUpload: normalizeBenefitNumber(raw.imageUpload),
            videoUpload: normalizeBenefitNumber(raw.videoUpload),
            customDomain: Boolean(raw.customDomain),
            dedicatedServer: Boolean(raw.dedicatedServer)
        };
    }

    function formatBenefitCount(value, unit) {
        if (value < 0) return '无限';
        if (value === 0) return '不可用';
        return `${value}${unit}`;
    }

    function formatSupportValue(value) {
        return value ? '支持' : '不可用';
    }

    function formatBenefitValue(def, benefits) {
        if (def.support) {
            return formatSupportValue(benefits[def.key]);
        }
        return formatBenefitCount(benefits[def.key], def.unit || '');
    }

    function renderBenefits(rawBenefits, options = {}) {
        if (!rawBenefits) {
            return '<div class="benefit-empty">未设置</div>';
        }
        const benefits = normalizeBenefits(rawBenefits);
        const gridClass = options.compact ? 'benefit-grid benefit-grid--compact' : 'benefit-grid';
        const items = BENEFIT_DEFS.map((def) => {
            const value = formatBenefitValue(def, benefits);
            return `
                <div class="benefit-item">
                    <span class="benefit-label">${def.label}</span>
                    <span class="benefit-value">${value}</span>
                </div>
            `;
        }).join('');
        return `<div class="${gridClass}">${items}</div>`;
    }

    function buildBenefitsText(rawBenefits) {
        if (!rawBenefits) return '';
        const benefits = normalizeBenefits(rawBenefits);
        return BENEFIT_DEFS.map((def) => `${def.label}: ${formatBenefitValue(def, benefits)}`).join('\n');
    }

    function buildAccountClipboardText(account) {
        const lines = [
            `账号: ${account.accountId}`,
            `密码: ${account.password}`,
            `有效期: ${account.expireDate}`
        ];
        const benefitsText = buildBenefitsText(account.benefits);
        if (benefitsText) {
            lines.push('会员权益:');
            lines.push(benefitsText);
        }
        return lines.join('\n');
    }

    function escapeInlineText(text) {
        return String(text)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\n/g, '\\n');
    }

    let lastActivity = Date.now();
    let lastPing = 0;
    let isLoggingOut = false;

    // ============================================
    // API 调用函数
    // ============================================

    function getAuthHeaders() {
        const token = localStorage.getItem('admin_token');
        return token ? {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        } : { 'Content-Type': 'application/json' };
    }

    /**
     * 调用后端 API 生成账号
     */
    async function apiGenerateAccount(type, remark = '') {
        const response = await fetch('/api/admin/accounts/generate', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ type, remark })
        });
        return response.json();
    }

    /**
     * 获取账号列表
     */
    async function apiGetAccountList(type = null) {
        let url = '/api/admin/accounts/history';
        if (type) {
            url += `?type=${encodeURIComponent(type)}`;
        }
        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        return response.json();
    }

    /**
     * 删除账号
     */
    async function apiDeleteAccount(accountId) {
        const response = await fetch('/api/admin/accounts/delete', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ accountId })
        });
        return response.json();
    }

    /**
     * 获取账号统计
     */
    async function apiGetAccountStats() {
        const response = await fetch('/api/admin/accounts/stats', {
            method: 'GET',
            headers: getAuthHeaders()
        });
        return response.json();
    }

    // ============================================
    // 更新账号统计数量显示
    // ============================================
    async function updateHistoryCount() {
        try {
            const result = await apiGetAccountStats();
            if (result.success && result.data) {
                const counts = result.data.activeCounts || {};
                if (countTrial) countTrial.textContent = counts.trial || 0;
                if (countAir) countAir.textContent = counts.air || 0;
                if (countPro) countPro.textContent = counts.pro || 0;
                if (countStandard) countStandard.textContent = counts.standard || 0;
            }
        } catch (error) {
            // 失败时显示 0
            if (countTrial) countTrial.textContent = '0';
            if (countAir) countAir.textContent = '0';
            if (countPro) countPro.textContent = '0';
            if (countStandard) countStandard.textContent = '0';
        }
    }

    // 检查登录状态
    async function checkAuth() {
        const token = localStorage.getItem('admin_token');
        const expires = localStorage.getItem('admin_expires');
        const username = localStorage.getItem('admin_username');
        const authLoader = document.getElementById('authLoader');

        // 隐藏加载遮罩的函数
        function hideLoader() {
            if (authLoader) {
                authLoader.style.opacity = '0';
                authLoader.style.transition = 'opacity 0.3s ease';
                setTimeout(() => {
                    authLoader.style.display = 'none';
                }, 300);
            }
        }

        // 没有 token，直接跳转
        if (!token) {
            redirectToLogin();
            return false;
        }

        // 检查本地过期时间
        if (expires && Date.now() > parseInt(expires)) {
            clearSession();
            redirectToLogin();
            return false;
        }

        // 验证服务器端 session
        try {
            const response = await fetch('/api/admin/verify', {
                method: 'POST',
                headers: getAuthHeaders()
            });

            // 处理非 JSON 响应
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                clearSession();
                redirectToLogin();
                return false;
            }

            const result = await response.json();

            if (!result.success) {
                clearSession();
                redirectToLogin();
                return false;
            }

            if (result.data && result.data.expiresAt) {
                localStorage.setItem('admin_expires', result.data.expiresAt);
            }

            if (result.data && result.data.username) {
                localStorage.setItem('admin_username', result.data.username);
            }

            // 更新用户信息显示
            const displayName = (result.data && result.data.username) || username || '管理员';
            userInfo.textContent = displayName;
            welcomeName.textContent = displayName;

            // 验证成功，隐藏加载遮罩
            hideLoader();

            return true;

        } catch (error) {
            clearSession();
            redirectToLogin();
            return false;
        }
    }

    async function pingSession() {
        if (isLoggingOut) return;
        lastPing = Date.now();

        try {
            const response = await fetch('/api/admin/verify', {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const result = await response.json();

            if (!result.success) {
                logout();
                return;
            }

            if (result.data && result.data.expiresAt) {
                localStorage.setItem('admin_expires', result.data.expiresAt);
            }
        } catch (error) {
        }
    }

    function markActivity() {
        lastActivity = Date.now();
        if (lastActivity - lastPing > PING_THROTTLE_MS) {
            pingSession();
        }
    }

    function startIdleWatch() {
        lastActivity = Date.now();
        setInterval(() => {
            if (Date.now() - lastActivity > IDLE_LIMIT_MS) {
                logout();
            }
        }, 1000);
    }

    // 清除会话
    function clearSession() {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_username');
        localStorage.removeItem('admin_expires');
    }

    // 跳转到登录页
    function redirectToLogin() {
        window.location.href = '/admini/';
    }

    // 登出
    async function logout() {
        if (isLoggingOut) return;
        isLoggingOut = true;

        try {
            await fetch('/api/admin/logout', {
                method: 'POST',
                headers: getAuthHeaders()
            });
        } catch (error) {
        }

        clearSession();
        redirectToLogin();
    }

    // 更新时间显示
    function updateTime() {
        const now = new Date();
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        };
        currentTime.textContent = now.toLocaleString('zh-CN', options);
    }

    // 显示弹窗
    function showModal(title, content, isLarge = false) {
        modalTitle.textContent = title;
        modalBody.innerHTML = content;
        modal.classList.toggle('modal--large', isLarge);
        modalOverlay.classList.add('is-visible');
    }

    // 隐藏弹窗
    function hideModal() {
        modalOverlay.classList.remove('is-visible');
    }

    // 显示加载中弹窗
    function showLoadingModal(title) {
        const content = `
            <div style="text-align: center; padding: 32px 0;">
                <div style="width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
                <p style="color: var(--text-muted);">正在处理，请稍候...</p>
            </div>
            <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        `;
        showModal(title, content);
    }

    // 处理账号生成（使用后端 API）
    async function handleGenerate(type, typeName, typeColor) {
        // 显示加载中
        showLoadingModal(`正在生成 ${typeName} 账号...`);

        try {
            const result = await apiGenerateAccount(type);

            if (!result.success) {
                // 生成失败
                const errorContent = `
                    <div style="text-align: center; padding: 16px 0;">
                        <div style="width: 64px; height: 64px; margin: 0 auto 20px; background: #dc2626; border-radius: 16px; display: flex; align-items: center; justify-content: center;">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </div>
                        <h3 style="font-size: 1.25rem; margin-bottom: 8px; color: var(--text-primary);">生成失败</h3>
                        <p style="color: var(--text-secondary);">${result.message || '请稍后重试'}</p>
                    </div>
                `;
                showModal('生成失败', errorContent);
                return;
            }

            const account = result.data;
            const benefitsHtml = renderBenefits(account.benefits);
            const clipboardText = buildAccountClipboardText(account);
            const clipboardPayload = escapeInlineText(clipboardText);

            // 更新统计数量
            updateHistoryCount();

            // 显示成功弹窗
            const content = `
                <div style="text-align: center; padding: 16px 0;">
                    <div style="width: 64px; height: 64px; margin: 0 auto 20px; background: ${typeColor}; border-radius: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px ${typeColor}40;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                            <path d="M20 6L9 17l-5-5"/>
                        </svg>
                    </div>
                    <h3 style="font-size: 1.25rem; margin-bottom: 8px; color: var(--text-primary);">账号生成成功</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 24px;">${typeName} 授权账号已生成并保存到数据库</p>
                </div>
                
                <div style="background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); border-radius: 14px; padding: 20px;">
                    <div style="margin-bottom: 16px;">
                        <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 6px;">账号 ID</label>
                        <div style="font-size: 1rem; font-weight: 600; color: var(--text-primary); font-family: monospace; word-break: break-all;">${account.accountId}</div>
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 6px;">密码</label>
                        <div style="font-size: 1rem; font-weight: 600; color: var(--text-primary); font-family: monospace;">${account.password}</div>
                    </div>
                    <div>
                        <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 6px;">有效期至</label>
                        <div style="font-size: 1rem; font-weight: 600; color: var(--text-primary);">${account.expireDate}</div>
                    </div>
                </div>

                <div class="benefit-section">
                    <div class="benefit-title">会员权益</div>
                    ${benefitsHtml}
                </div>
                
                <button class="copy-account-btn" data-label="复制账号信息" onclick="copyAccount('${clipboardPayload}', this)" style="width: 100%; margin-top: 20px; padding: 14px; font-size: 0.95rem; font-weight: 600; color: white; background: ${typeColor}; border: none; border-radius: 12px; cursor: pointer; transition: all 0.2s ease;">
                    复制账号信息
                </button>
            `;

            showModal(`${typeName} 账号生成`, content);

        } catch (error) {
            const errorContent = `
                <div style="text-align: center; padding: 16px 0;">
                    <div style="width: 64px; height: 64px; margin: 0 auto 20px; background: #dc2626; border-radius: 16px; display: flex; align-items: center; justify-content: center;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </div>
                    <h3 style="font-size: 1.25rem; margin-bottom: 8px; color: var(--text-primary);">网络错误</h3>
                    <p style="color: var(--text-secondary);">请检查网络连接后重试</p>
                </div>
            `;
            showModal('生成失败', errorContent);
        }
    }

    // 显示账号记录（从数据库获取）
    async function showHistoryModal(type) {
        const typeLabels = { trial: '体验卡', air: 'Air', pro: 'Pro', standard: '标准版' };
        const titleLabel = typeLabels[type] || '账号';

        // 显示加载中
        showLoadingModal(`正在加载 ${titleLabel} 账号记录...`);

        try {
            const result = await apiGetAccountList(type);

            if (!result.success) {
                showModal(`${titleLabel} 账号记录`, `
                    <div class="history-empty">
                        <div class="history-empty-title">加载失败</div>
                        <p>${result.message || '请稍后重试'}</p>
                    </div>
                `, true);
                return;
            }

            const accounts = result.data.accounts || [];
            let content = '';

            if (accounts.length === 0) {
                content = `
                    <div class="history-empty">
                        <div class="history-empty-title">暂无账号记录</div>
                        <p>生成的账号将自动保存在这里</p>
                    </div>
                `;
            } else {
                content = '<div class="history-list">';

                accounts.forEach((account) => {
                    const typeLabels2 = { trial: '体验卡', air: 'AIR', pro: 'PRO', standard: '标准版' };
                    const typeLabel = typeLabels2[account.type] || account.type.toUpperCase();
                    const createdDate = new Date(account.createdAt).toLocaleString('zh-CN');
                    const benefitsHtml = renderBenefits(account.benefits, { compact: true });
                    const clipboardPayload = escapeInlineText(buildAccountClipboardText(account));

                    content += `
                        <div class="history-item" data-id="${account.accountId}">
                            <div class="history-item-header">
                                <span class="history-item-type history-item-type--${account.type}">${typeLabel}</span>
                                <span class="history-item-date">${createdDate}</span>
                            </div>
                            <div class="history-item-row">
                                <span class="history-item-label">账号</span>
                                <span class="history-item-value">${account.accountId}</span>
                            </div>
                            <div class="history-item-row">
                                <span class="history-item-label">密码</span>
                                <span class="history-item-value">${account.password}</span>
                            </div>
                            <div class="history-item-row">
                                <span class="history-item-label">有效期</span>
                                <span class="history-item-value">${account.expireDate}</span>
                            </div>
                            <div class="history-item-row history-item-row--stack">
                                <span class="history-item-label">权益</span>
                                <div class="history-item-value history-item-value--stack">
                                    ${benefitsHtml}
                                </div>
                            </div>
                            <div class="history-item-actions">
                                <button class="history-copy-btn" data-label="复制账号信息" onclick="copyAccount('${clipboardPayload}', this)">复制账号信息</button>
                                <button class="history-delete-btn" onclick="deleteAccount('${account.accountId}', '${type}')">删除</button>
                            </div>
                        </div>
                    `;
                });

                content += '</div>';
            }

            showModal(`${titleLabel} 账号记录 (${accounts.length})`, content, true);

        } catch (error) {
            showModal(`${titleLabel} 账号记录`, `
                <div class="history-empty">
                    <div class="history-empty-title">加载失败</div>
                    <p>网络错误，请稍后重试</p>
                </div>
            `, true);
        }
    }

    // 复制账号信息 (全局函数)
    window.copyAccount = function (text, button) {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            if (button) {
                const label = button.dataset.label || '复制账号信息';
                button.textContent = '已复制!';
                setTimeout(() => {
                    button.textContent = label;
                }, 2000);
            }
        });
    };

    // 删除账号 (全局函数，使用API)
    window.deleteAccount = async function (accountId, type) {
        if (!confirm('确定要删除这条账号记录吗？此操作不可撤销。')) {
            return;
        }

        try {
            const result = await apiDeleteAccount(accountId);
            if (result.success) {
                // 刷新历史记录
                showHistoryModal(type);
                // 更新统计
                updateHistoryCount();
            } else {
                alert('删除失败: ' + (result.message || '未知错误'));
            }
        } catch (error) {
            alert('网络错误，请稍后重试');
        }
    };

    // 事件绑定
    logoutBtn.addEventListener('click', logout);
    modalClose.addEventListener('click', hideModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            hideModal();
        }
    });

    addAir.addEventListener('click', () => {
        handleGenerate('air', 'Air', '#38bdf8');
    });

    addTrial.addEventListener('click', () => {
        handleGenerate('trial', '体验卡', '#ec4899');
    });

    addPro.addEventListener('click', () => {
        handleGenerate('pro', 'Pro', '#f59e0b');
    });

    addStandard.addEventListener('click', () => {
        handleGenerate('standard', '标准版', '#22c55e');
    });

    historyTrial.addEventListener('click', () => showHistoryModal('trial'));
    historyAir.addEventListener('click', () => showHistoryModal('air'));
    historyPro.addEventListener('click', () => showHistoryModal('pro'));
    historyStandard.addEventListener('click', () => showHistoryModal('standard'));

    // 键盘事件
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideModal();
        }
    });

    ['click', 'mousemove', 'keydown', 'touchstart', 'scroll'].forEach((eventName) => {
        document.addEventListener(eventName, markActivity, { passive: true });
    });

    // 初始化
    async function init() {
        const isAuthed = await checkAuth();
        if (!isAuthed) return;

        startIdleWatch();

        updateTime();
        setInterval(updateTime, 1000);

        // 更新账号记录数量
        updateHistoryCount();
    }

    init();

})();

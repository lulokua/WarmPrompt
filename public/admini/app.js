/**
 * 管理员登录页面脚本
 * WarmPrompt v5.0
 * 包含防暴力破解前端支持
 */

(function () {
    'use strict';

    // DOM 元素
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const secretKeyInput = document.getElementById('secretKey');
    const loginButton = document.getElementById('loginButton');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const togglePassword = document.getElementById('togglePassword');
    const rememberMe = document.getElementById('rememberMe');

    const REMEMBER_KEY = 'admin_remember';
    const SAVED_USERNAME_KEY = 'admin_saved_username';
    const SAVED_PASSWORD_KEY = 'admin_saved_password';

    // 锁定状态
    let lockoutTimer = null;
    let isLockedOut = false;

    // 密码显示/隐藏切换
    togglePassword.addEventListener('click', function () {
        const isVisible = this.classList.toggle('is-visible');
        passwordInput.type = isVisible ? 'text' : 'password';
        this.setAttribute('aria-label', isVisible ? '隐藏密码' : '显示密码');
    });

    /**
     * 显示错误信息
     * @param {string} message - 错误消息
     * @param {string} type - 错误类型：'error'(默认), 'warning', 'locked'
     */
    function showError(message, type = 'error') {
        errorText.textContent = message;
        errorMessage.hidden = false;

        // 移除所有类型类
        errorMessage.classList.remove('error-locked', 'error-warning');

        // 添加对应类型类
        if (type === 'locked') {
            errorMessage.classList.add('error-locked');
        } else if (type === 'warning') {
            errorMessage.classList.add('error-warning');
        }

        // 重新触发动画
        errorMessage.style.animation = 'none';
        errorMessage.offsetHeight; // 触发重排
        errorMessage.style.animation = null;
    }

    // 隐藏错误信息
    function hideError() {
        errorMessage.hidden = true;
        errorMessage.classList.remove('error-locked', 'error-warning');
    }

    /**
     * 格式化剩余时间
     */
    function formatTime(seconds) {
        if (seconds >= 60) {
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${minutes}分${secs.toString().padStart(2, '0')}秒`;
        }
        return `${seconds}秒`;
    }

    /**
     * 启动锁定倒计时
     */
    function startLockoutCountdown(remainingSeconds) {
        isLockedOut = true;
        setLoading(true);

        // 清除之前的计时器
        if (lockoutTimer) {
            clearInterval(lockoutTimer);
        }

        // 更新按钮样式
        loginButton.style.background = 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)';
        loginButton.style.boxShadow = '0 8px 30px rgba(220, 38, 38, 0.3)';

        const updateDisplay = () => {
            if (remainingSeconds <= 0) {
                // 锁定结束
                clearInterval(lockoutTimer);
                lockoutTimer = null;
                isLockedOut = false;

                // 恢复按钮状态
                loginButton.innerHTML = '<span class="button-text">登录</span><span class="button-loading" hidden><svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="31.4" stroke-dashoffset="10" /></svg>验证中...</span>';
                loginButton.style.background = '';
                loginButton.style.boxShadow = '';
                setLoading(false);
                hideError();
                showError('锁定已解除，您可以重新尝试登录', 'warning');
                return;
            }

            // 更新显示
            loginButton.innerHTML = `
                <span class="button-text" style="display: flex !important;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    已锁定 ${formatTime(remainingSeconds)}
                </span>
            `;
            showError(`登录失败次数过多，请等待 ${formatTime(remainingSeconds)} 后重试`, 'locked');

            remainingSeconds--;
        };

        // 立即显示一次
        updateDisplay();

        // 每秒更新
        lockoutTimer = setInterval(updateDisplay, 1000);
    }

    // 设置加载状态
    function setLoading(isLoading) {
        loginButton.disabled = isLoading;
        loginButton.classList.toggle('is-loading', isLoading);

        // 禁用输入框
        usernameInput.disabled = isLoading;
        passwordInput.disabled = isLoading;
        secretKeyInput.disabled = isLoading;
    }

    function getAuthHeaders() {
        const token = localStorage.getItem('admin_token');
        return token ? { 'Authorization': 'Bearer ' + token } : {};
    }

    function persistCredentials(username, password) {
        if (!rememberMe || !rememberMe.checked) {
            localStorage.removeItem(REMEMBER_KEY);
            localStorage.removeItem(SAVED_USERNAME_KEY);
            localStorage.removeItem(SAVED_PASSWORD_KEY);
            return;
        }

        localStorage.setItem(REMEMBER_KEY, 'true');
        localStorage.setItem(SAVED_USERNAME_KEY, username);
        localStorage.setItem(SAVED_PASSWORD_KEY, password);
    }

    function loadSavedCredentials() {
        if (!rememberMe) return;

        const remember = localStorage.getItem(REMEMBER_KEY) === 'true';
        if (!remember) return;

        const savedUsername = localStorage.getItem(SAVED_USERNAME_KEY) || '';
        const savedPassword = localStorage.getItem(SAVED_PASSWORD_KEY) || '';

        if (savedUsername) usernameInput.value = savedUsername;
        if (savedPassword) passwordInput.value = savedPassword;
        rememberMe.checked = true;
    }

    // 登录请求
    async function login(username, password, secretKey) {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password,
                secretKey: secretKey
            })
        });

        return response.json();
    }

    // 表单提交处理
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        // 如果正在锁定中，阻止提交
        if (isLockedOut) {
            return;
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const secretKey = secretKeyInput.value.trim();

        // 基本验证
        if (!username) {
            showError('请输入管理员账号');
            usernameInput.focus();
            return;
        }

        if (!password) {
            showError('请输入密码');
            passwordInput.focus();
            return;
        }

        if (!secretKey) {
            showError('请输入安全密钥');
            secretKeyInput.focus();
            return;
        }

        // 隐藏之前的错误
        hideError();

        // 开始加载
        setLoading(true);

        try {
            const result = await login(username, password, secretKey);

            if (result.success) {
                // 登录成功，保存 token
                localStorage.setItem('admin_token', result.data.token);
                localStorage.setItem('admin_username', result.data.username);
                localStorage.setItem('admin_expires', result.data.expiresAt);

                // 显示成功提示
                loginButton.innerHTML = `
                    <span class="button-text" style="display: flex !important;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        登录成功
                    </span>
                `;
                loginButton.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                loginButton.style.boxShadow = '0 8px 30px rgba(16, 185, 129, 0.3)';

                persistCredentials(username, password);

                // 跳转到管理页面
                setTimeout(() => {
                    window.location.href = '/admini/dashboard/';
                }, 1000);

            } else {
                // 处理不同错误类型
                const errorCode = result.code || '';

                if (errorCode === 'IP_LOCKED' || errorCode === 'RATE_LIMITED') {
                    // IP被锁定或速率限制
                    const remainingTime = result.data?.remainingTime || 900; // 默认15分钟
                    startLockoutCountdown(remainingTime);
                } else if (errorCode === 'IP_BLOCKED' || errorCode === 'IP_NOT_ALLOWED') {
                    // IP被永久封禁或不在白名单
                    showError(result.message || '访问被拒绝', 'locked');
                    setLoading(false);
                } else if (errorCode === 'INVALID_CREDENTIALS') {
                    // 凭证错误，显示剩余尝试次数
                    const remainingAttempts = result.data?.remainingAttempts;
                    if (remainingAttempts !== undefined && remainingAttempts <= 2) {
                        // 剩余次数少于等于2次时显示警告样式
                        showError(result.message, 'warning');
                    } else {
                        showError(result.message);
                    }
                    setLoading(false);

                    // 清空密码和密钥字段
                    passwordInput.value = '';
                    secretKeyInput.value = '';
                    passwordInput.focus();
                } else {
                    // 其他错误
                    showError(result.message || '登录失败，请检查您的凭证');
                    setLoading(false);

                    // 清空密码和密钥字段
                    passwordInput.value = '';
                    secretKeyInput.value = '';
                    passwordInput.focus();
                }
            }

        } catch (error) {
            showError('网络错误，请稍后重试');
            setLoading(false);
        }
    });

    // 输入框 Enter 键切换
    usernameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            passwordInput.focus();
        }
    });

    passwordInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            secretKeyInput.focus();
        }
    });

    // 清除输入时隐藏错误（仅在非锁定状态）
    [usernameInput, passwordInput, secretKeyInput].forEach(input => {
        input.addEventListener('input', () => {
            if (!isLockedOut) {
                hideError();
            }
        });
    });

    // 检查是否已登录
    async function checkExistingSession() {
        const token = localStorage.getItem('admin_token');
        const expires = localStorage.getItem('admin_expires');

        // 检查本地过期时间
        if (token && expires && Date.now() > parseInt(expires)) {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_username');
            localStorage.removeItem('admin_expires');
        }

        // 验证服务器端 session
        try {
            const response = await fetch('/api/admin/verify', {
                method: 'POST',
                headers: getAuthHeaders()
            });

            const result = await response.json();

            if (result.success) {
                if (result.data && result.data.expiresAt) {
                    localStorage.setItem('admin_expires', result.data.expiresAt);
                }
                if (result.data && result.data.username) {
                    localStorage.setItem('admin_username', result.data.username);
                }
                // 会话有效，跳转到管理页面
                window.location.href = '/admini/dashboard/';
            } else {
                // 会话无效，清除本地存储
                localStorage.removeItem('admin_token');
                localStorage.removeItem('admin_username');
                localStorage.removeItem('admin_expires');
            }
        } catch (error) {
        }
    }

    // 页面加载时检查会话
    checkExistingSession();

    if (rememberMe) {
        rememberMe.addEventListener('change', () => {
            if (!rememberMe.checked) {
                localStorage.removeItem(REMEMBER_KEY);
                localStorage.removeItem(SAVED_USERNAME_KEY);
                localStorage.removeItem(SAVED_PASSWORD_KEY);
            }
        });
    }

    loadSavedCredentials();

    // 聚焦第一个输入框
    usernameInput.focus();

    // 页面卸载时清理计时器
    window.addEventListener('beforeunload', () => {
        if (lockoutTimer) {
            clearInterval(lockoutTimer);
        }
    });

})();

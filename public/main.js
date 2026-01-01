document.addEventListener('DOMContentLoaded', () => {

    /* =========================================
       PART 1: LOADING SCREEN LOGIC
       ========================================= */

    // 模拟更真实的加载曲线 (快-慢-快)
    // 注意：ID 必须存在于 DOM 中
    const progressEl = document.getElementById('progress');
    const percentageEl = document.getElementById('percentage');
    const loadingScreen = document.getElementById('loading-screen');
    const mainApp = document.getElementById('main-app');

    // 只有在存在 loading 元素时才执行
    if (progressEl && percentageEl && loadingScreen) {
        let width = 0;

        function simulateLoading() {
            if (width >= 100) {
                // 加载完成，执行转场
                finishLoading();
                return;
            }

            // 随机增加进度，调整为目标约 8 秒加载时间
            // 每次增加 0.5% ~ 1.5% (平均 1%) -> 约 100 步
            let jump = Math.random() * 1 + 0.5;
            width += jump;

            if (width > 100) width = 100;

            progressEl.style.width = width + '%';
            percentageEl.innerText = Math.floor(width) + '%';

            // 基础延迟 30ms ~ 90ms (平均 60ms)
            // 100 步 * 60ms = 6000ms (6秒)
            let delay = Math.random() * 60 + 30;

            // 80% 以后变慢 (剩余约 20 步)
            // 每步增加 100ms -> 20 * 100 = 2000ms (2秒)
            // 总计约 8 秒
            if (width > 80) delay += 100;
            if (width > 95) delay += 200;  // 最后一点点额外停顿

            setTimeout(simulateLoading, delay);
        }

        function finishLoading() {
            console.log("Loading Finished");

            // 1. 渐隐 Loading Screen
            loadingScreen.style.transition = 'opacity 0.8s ease-out, transform 0.8s ease-out';
            loadingScreen.style.opacity = '0';
            loadingScreen.style.transform = 'scale(1.05)'; // 微微放大消失，更有质感
            loadingScreen.style.pointerEvents = 'none'; // 禁止交互

            // 2. 显示 Main App
            if (mainApp) {
                // 稍微延迟一点，等遮罩淡出开始后再显示主内容
                setTimeout(() => {
                    mainApp.classList.remove('opacity-0');
                    mainApp.style.opacity = '1';
                }, 200);
            }

            // 3. 彻底移除 Loading 节点 (可选，为了性能)
            setTimeout(() => {
                loadingScreen.remove();
            }, 1000);
        }

        // 启动加载
        setTimeout(simulateLoading, 500);
    } else {
        // 如果没有 loading 屏，直接显示主应用
        if (mainApp) {
            mainApp.classList.remove('opacity-0');
            mainApp.style.opacity = '1';
        }
    }


    /* =========================================
       PART 2: ORIGINAL APP LOGIC
       ========================================= */

    // --- 核心业务逻辑 (页面主按钮) ---
    // Loading 标题随机化 (Easter Egg)
    const titleEl = document.getElementById('loading-title');
    if (titleEl) {
        // 35% 概率出现中文语录
        if (Math.random() < 0.35) {
            titleEl.innerHTML = "优秀的人赚取利润<br>伟大的人赢得人心";

            // 针对中文长句的样式调整
            // 移除原本用于英文的超大字号和紧缩字间距
            titleEl.classList.remove('text-6xl', 'md:text-8xl', 'tracking-tighter', 'font-bold');
            // 添加适合中文的字号(稍小)、宽字间距、以及行高
            titleEl.classList.add('text-3xl', 'md:text-5xl', 'tracking-[0.2em]', 'font-medium', 'leading-relaxed');

            // 强制使用 MiSans 或系统字体，避免英文字体回退带来的不协调
            titleEl.style.fontFamily = "'MiSans', 'Noto Sans SC', sans-serif";
        }
    }

    const btns = document.querySelectorAll('.btn[data-target]');

    btns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnElement = e.target.closest('.btn');
            const target = btnElement.dataset.target;

            // 如果是链接，先阻止默认跳转，等待动画
            if (btnElement.tagName === 'A') {
                e.preventDefault();
            }

            let targetName = '';
            let targetUrl = '';

            if (target === 'newyear') {
                targetName = '【一起跨年 · 特别版】';
                targetUrl = btnElement.getAttribute('href');
            } else {
                targetName = '【给他人 · 方框版】';
                targetUrl = btnElement.getAttribute('href') || 'For_Others/';
            }

            document.body.style.transition = 'opacity 0.5s';
            document.body.style.opacity = '0';

            setTimeout(() => {
                // alert(`已确认选择：${targetName}\n正在为您加载配置...`); // 移除 alert，直接跳转体验更好
                window.location.href = targetUrl;
            }, 500);
        });
    });

    // --- 视差效果逻辑 ---
    document.addEventListener('mousemove', (e) => {
        // 简单节流或直接执行
        const x = (window.innerWidth - e.pageX * 2) / 100;
        const y = (window.innerHeight - e.pageY * 2) / 100;
        const shapes = document.querySelectorAll('.shape');
        shapes.forEach(shape => {
            const speed = shape.classList.contains('shape-1') ? 2 : -2;
            shape.style.transform = `translate(${x * speed}px, ${y * speed}px) scale(${1 + Math.abs(x / 100)})`;
        });
    });

    // --- 灵动胶囊客服逻辑 (Dynamic Support Capsule) ---
    const supportWidget = document.getElementById('supportWidget');
    const supportBackdrop = document.getElementById('supportBackdrop');
    const closeBtn = document.querySelector('.close-btn');
    const chatBody = document.querySelector('.chat-body');
    const chatInput = document.querySelector('.chat-input-area input');
    const sendBtn = document.querySelector('.send-btn');

    // 对话历史记录（用于上下文）
    let conversationHistory = [];

    if (supportWidget && supportBackdrop && closeBtn) {
        // 打开客服 (胶囊展开)
        supportWidget.addEventListener('click', (e) => {
            if (!supportWidget.classList.contains('is-expanded')) {
                toggleSupport(true);
            }
        });

        // 关闭客服 (点击遮罩或关闭按钮)
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSupport(false);
        });

        supportBackdrop.addEventListener('click', () => {
            toggleSupport(false);
        });
    }

    function toggleSupport(show) {
        if (show) {
            supportWidget.classList.add('is-expanded');
            supportBackdrop.classList.add('is-active');
            // 聚焦到输入框
            setTimeout(() => chatInput?.focus(), 600);
        } else {
            supportWidget.classList.remove('is-expanded');
            supportBackdrop.classList.remove('is-active');
        }
    }

    // --- AI 客服聊天逻辑 ---

    // 发送消息
    async function sendMessage() {
        if (!chatInput) return;

        const message = chatInput.value.trim();
        if (!message) return;

        // 清空输入框
        chatInput.value = '';

        // 添加用户消息到界面
        appendMessage('user', message);

        // 添加到对话历史
        conversationHistory.push({ role: 'user', content: message });

        // 显示加载状态
        const loadingEl = appendMessage('assistant', '', true);

        try {
            // 调用 AI API
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: conversationHistory
                })
            });

            const data = await response.json();

            // 移除加载状态
            loadingEl.remove();

            if (data.success) {
                // 添加 AI 回复到对话历史
                conversationHistory.push({ role: 'assistant', content: data.message });
                // 打字机效果显示回复
                await typewriterEffect(data.message);
            } else {
                appendMessage('assistant', '抱歉，暖暖暂时无法回复，请稍后再试~ 🥺');
            }

        } catch (error) {
            loadingEl.remove();
            console.error('AI Chat Error:', error);
            // 模拟回复（因为没有后端）
            setTimeout(() => {
                appendMessage('assistant', '（演示模式）后端接口未连接。您的消息是：' + message);
            }, 500);
        }
    }

    // 添加消息到聊天界面
    function appendMessage(role, content, isLoading = false) {
        if (!chatBody) return;

        const messageEl = document.createElement('div');
        messageEl.className = `message ${role === 'user' ? 'user' : 'system'}`;

        if (isLoading) {
            messageEl.innerHTML = `
                <div class="loading-dots">
                    <span></span><span></span><span></span>
                </div>
            `;
            messageEl.classList.add('loading');
        } else {
            messageEl.innerHTML = `<p>${escapeHtml(content)}</p>`;
        }

        chatBody.appendChild(messageEl);
        chatBody.scrollTop = chatBody.scrollHeight;

        return messageEl;
    }

    // 打字机效果
    async function typewriterEffect(text) {
        if (!chatBody) return;

        const messageEl = document.createElement('div');
        messageEl.className = 'message system';
        const pEl = document.createElement('p');
        messageEl.appendChild(pEl);
        chatBody.appendChild(messageEl);

        for (let i = 0; i < text.length; i++) {
            pEl.textContent += text[i];
            chatBody.scrollTop = chatBody.scrollHeight;
            // 随机延迟，模拟真实打字
            await sleep(20 + Math.random() * 30);
        }
    }

    // 辅助函数：延迟
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 辅助函数：HTML 转义
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 绑定发送事件
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    /* =========================================
       PART 3: SLOW MOTION FIREWORKS (Left Split)
       ========================================= */
    const canvas = document.getElementById('fireworks-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let cw = canvas.parentElement.clientWidth;
        let ch = canvas.parentElement.clientHeight;

        canvas.width = cw;
        canvas.height = ch;

        // Resize Logic
        const resize = () => {
            const parent = canvas.parentElement;
            if (parent) {
                cw = parent.clientWidth;
                ch = parent.clientHeight;
                canvas.width = cw;
                canvas.height = ch;
            }
        };

        const resizeObserver = new ResizeObserver(() => resize());
        resizeObserver.observe(canvas.parentElement);

        // --- 物理参数配置 (调教手感的核心) ---
        const config = {
            particleCount: 180,    // 粒子数量
            gravity: 0.035,        // [修改] 降低重力，让下坠动作像慢镜头一样
            friction: 0.97,        // [修改] 调整阻力，让粒子在低速下能滑行更久
            decay: 0.006,          // [修改] 降低衰减速度，让烟花在空中停留时间更长
            trailLength: 0.2,      // 拖尾长度 (越小拖尾越明显)
            launchInterval: 80,    // [修改] 放慢发射频率，增加呼吸感
            initSpeed: 4.5         // [修改] 降低爆炸初速度，爆发更柔和
        };

        let fireworks = [];
        let particles = [];
        let timer = 0;
        let hue = 120;

        function random(min, max) {
            return Math.random() * (max - min) + min;
        }

        function calculateDistance(p1x, p1y, p2x, p2y) {
            let xDistance = p1x - p2x;
            let yDistance = p1y - p2y;
            return Math.sqrt(Math.pow(xDistance, 2) + Math.pow(yDistance, 2));
        }

        // --- 烟花火箭 (上升阶段) ---
        class Firework {
            constructor(sx, sy, tx, ty) {
                this.x = sx;
                this.y = sy;
                this.sx = sx;
                this.sy = sy;
                this.tx = tx;
                this.ty = ty;

                this.distanceToTarget = calculateDistance(sx, sy, tx, ty);
                this.distanceTraveled = 0;

                this.coordinates = [];
                this.coordinateCount = 3;
                while (this.coordinateCount--) {
                    this.coordinates.push([this.x, this.y]);
                }

                this.angle = Math.atan2(ty - sy, tx - sx);
                this.speed = 1.5; // [修改] 降低初始升空速度
                this.acceleration = 1.03; // [修改] 降低升空加速度
                this.brightness = random(50, 70);
                this.targetRadius = 1;
            }

            update(index) {
                this.coordinates.pop();
                this.coordinates.unshift([this.x, this.y]);

                if (this.targetRadius < 8) {
                    this.targetRadius += 0.3;
                } else {
                    this.targetRadius = 1;
                }

                this.speed *= this.acceleration;

                let vx = Math.cos(this.angle) * this.speed;
                let vy = Math.sin(this.angle) * this.speed;

                this.distanceTraveled = calculateDistance(this.sx, this.sy, this.x + vx, this.y + vy);

                if (this.distanceTraveled >= this.distanceToTarget) {
                    createParticles(this.tx, this.ty);
                    fireworks.splice(index, 1);
                } else {
                    this.x += vx;
                    this.y += vy;
                }
            }

            draw() {
                ctx.beginPath();
                ctx.moveTo(this.coordinates[this.coordinates.length - 1][0], this.coordinates[this.coordinates.length - 1][1]);
                ctx.lineTo(this.x, this.y);
                ctx.strokeStyle = `hsl(${hue}, 100%, ${this.brightness}%)`;
                ctx.stroke();
            }
        }

        // --- 爆炸粒子 (重构为 VX/VY 物理向量模式) ---
        class Particle {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.coordinates = [];
                this.coordinateCount = 5;
                while (this.coordinateCount--) {
                    this.coordinates.push([this.x, this.y]);
                }

                // 1. 生成随机角度和初速度
                let angle = random(0, Math.PI * 2);
                let speed = random(1, config.initSpeed); // 速度差异化

                // 2. 将速度分解为水平(vx)和垂直(vy)分量
                // 这是实现真实抛物线的关键
                this.vx = Math.cos(angle) * speed;
                this.vy = Math.sin(angle) * speed;

                this.friction = config.friction;
                this.gravity = config.gravity;

                this.hue = random(hue - 50, hue + 50);
                this.brightness = random(50, 80);
                this.alpha = 1;
                this.decay = random(0.005, 0.015); // 寿命更长，以展示慢动作
                this.flicker = Math.random() > 0.5; // 闪烁开关
            }

            update(index) {
                // 更新尾迹
                this.coordinates.pop();
                this.coordinates.unshift([this.x, this.y]);

                // 3. 物理引擎更新逻辑

                // 空气阻力同时作用于水平和垂直速度
                this.vx *= this.friction;
                this.vy *= this.friction;

                // 重力只持续累加到垂直速度 (加速下坠的核心)
                this.vy += this.gravity;

                // 更新位置
                this.x += this.vx;
                this.y += this.vy;

                // 透明度衰减
                this.alpha -= this.decay;

                if (this.flicker) {
                    // 模拟燃烧不稳定的闪烁
                    this.brightness = random(40, 90);
                }

                if (this.alpha <= this.decay) {
                    particles.splice(index, 1);
                }
            }

            draw() {
                ctx.beginPath();
                ctx.moveTo(this.coordinates[this.coordinates.length - 1][0], this.coordinates[this.coordinates.length - 1][1]);
                ctx.lineTo(this.x, this.y);

                // 颜色和亮度
                ctx.strokeStyle = `hsla(${this.hue}, 100%, ${this.brightness}%, ${this.alpha})`;
                ctx.stroke();
            }
        }

        function createParticles(x, y) {
            let particleCount = config.particleCount;
            while (particleCount--) {
                particles.push(new Particle(x, y));
            }
        }

        function loop() {
            requestAnimationFrame(loop);

            // 使用 source-over 模式清理画布，alpha 值决定拖尾长度
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = `rgba(0, 0, 0, ${config.trailLength})`;
            ctx.fillRect(0, 0, cw, ch);

            // 使用 lighter 模式实现光效叠加 (重叠处变亮)
            ctx.globalCompositeOperation = 'lighter';

            hue += 0.5;

            // 绘制烟花火箭
            let i = fireworks.length;
            while (i--) {
                fireworks[i].draw();
                fireworks[i].update(i);
            }

            // 绘制粒子
            let j = particles.length;
            while (j--) {
                particles[j].draw();
                particles[j].update(j);
            }

            // 自动发射逻辑
            if (timer >= config.launchInterval) {
                let startX = cw / 2 + random(-cw / 3, cw / 3); // 发射范围
                // 目标高度：屏幕高度的 10% 到 40% 之间 (上半屏)
                let targetY = random(ch * 0.1, ch * 0.4);
                fireworks.push(new Firework(startX, ch, startX, targetY));
                timer = 0;
            } else {
                timer++;
            }
        }

        loop();
    }

});
document.addEventListener('DOMContentLoaded', () => {
    /* =========================================
       COUNTDOWN LOGIC
       ========================================= */
    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');
    const countdownContainer = document.getElementById('timer');
    const messageEl = document.getElementById('message');
    const headerEl = document.querySelector('h1');
    const yearContainer = document.querySelector('.year-container');

    // Set the date we're counting down to: Jan 1st of the next year
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    let targetDate = new Date(`${nextYear}-01-01T00:00:00`).getTime();

    let fireworksEnabled = false;

    function updateCountdown() {
        const now = new Date().getTime();
        const distance = targetDate - now;

        if (distance <= 0) {
            // Countdown finished
            clearInterval(countdownInterval);

            // Update UI
            if (countdownContainer) countdownContainer.style.display = 'none';
            // Trigger Year Switch Animation
            if (yearContainer) yearContainer.classList.add('switched');
            if (headerEl) headerEl.style.display = 'none';

            if (messageEl) {
                messageEl.classList.remove('hidden');
                messageEl.style.display = 'block';
                setTimeout(() => {
                    messageEl.style.opacity = '1';
                }, 100);
            }

            // Enable Fireworks
            fireworksEnabled = true;
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        if (daysEl) daysEl.innerText = formatTime(days);
        if (hoursEl) hoursEl.innerText = formatTime(hours);
        if (minutesEl) minutesEl.innerText = formatTime(minutes);
        if (secondsEl) secondsEl.innerText = formatTime(seconds);
    }

    function formatTime(time) {
        return time < 10 ? `0${time}` : time;
    }

    let countdownInterval = setInterval(updateCountdown, 1000);
    // Initial call
    // Initial call
    updateCountdown();

    /* =========================================
       ONLINE USER COUNT LOGIC
       ========================================= */
    const onlineCountEl = document.getElementById('online-count');

    function sendHeartbeat() {
        fetch('/api/newyear/heartbeat', {
            method: 'POST'
        })
            .then(response => response.json())
            .then(data => {
                if (onlineCountEl) {
                    onlineCountEl.innerText = data.count;
                }
            })
            .catch(error => console.error('Heartbeat error:', error));
    }

    // Send heartbeat every 5 seconds
    setInterval(sendHeartbeat, 5000);
    // Initial call
    sendHeartbeat();




    /* =========================================
       FIREWORKS LOGIC (Adapted from main.js)
       ========================================= */
    const canvas = document.getElementById('fireworks-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let cw = window.innerWidth;
        let ch = window.innerHeight;

        canvas.width = cw;
        canvas.height = ch;

        // Resize Logic
        window.addEventListener('resize', () => {
            cw = window.innerWidth;
            ch = window.innerHeight;
            canvas.width = cw;
            canvas.height = ch;
        });

        // --- Configuration ---
        const config = {
            particleCount: 150,     // More particles for celebration
            gravity: 0.05,          // Standard gravity
            friction: 0.96,
            decay: 0.012,
            trailLength: 0.1,
            launchInterval: 20,     // Faster launch when celebrating
            initSpeed: 5
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

        // --- Firework Class ---
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
                this.speed = 2;
                this.acceleration = 1.05;
                this.brightness = random(50, 70);
                this.targetRadius = 1;
            }

            update(index) {
                this.coordinates.pop();
                this.coordinates.unshift([this.x, this.y]);

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

        // --- Particle Class ---
        class Particle {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.coordinates = [];
                this.coordinateCount = 5;
                while (this.coordinateCount--) {
                    this.coordinates.push([this.x, this.y]);
                }
                let angle = random(0, Math.PI * 2);
                let speed = random(1, 10);
                this.vx = Math.cos(angle) * speed;
                this.vy = Math.sin(angle) * speed;
                this.friction = 0.95;
                this.gravity = 1;
                this.hue = random(hue - 20, hue + 20);
                this.brightness = random(50, 80);
                this.alpha = 1;
                this.decay = random(0.015, 0.03);
            }

            update(index) {
                this.coordinates.pop();
                this.coordinates.unshift([this.x, this.y]);
                this.vx *= this.friction;
                this.vy *= this.friction;
                this.vy += config.gravity;
                this.x += this.vx;
                this.y += this.vy;
                this.alpha -= this.decay;

                if (this.alpha <= this.decay) {
                    particles.splice(index, 1);
                }
            }

            draw() {
                ctx.beginPath();
                ctx.moveTo(this.coordinates[this.coordinates.length - 1][0], this.coordinates[this.coordinates.length - 1][1]);
                ctx.lineTo(this.x, this.y);
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

        // --- Main Loop ---
        function loop() {
            requestAnimationFrame(loop);

            // Use destination-out to create transparent trails
            // This fades out existing pixels over time, revealing the CSS background behind the canvas
            if (fireworksEnabled) {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; // Adjust alpha for trail duration (lower = longer trails)
                ctx.fillRect(0, 0, cw, ch);
            } else {
                ctx.clearRect(0, 0, cw, ch);
                return;
            }

            ctx.globalCompositeOperation = 'lighter';

            hue = random(0, 360); // Crazy colors for celebration

            // Update & Draw Fireworks
            let i = fireworks.length;
            while (i--) {
                fireworks[i].draw();
                fireworks[i].update(i);
            }

            // Update & Draw Particles
            let j = particles.length;
            while (j--) {
                particles[j].draw();
                particles[j].update(j);
            }

            // Auto Launch Logic
            if (timer >= config.launchInterval) {
                // Launch multiple fireworks at once for grand finale feel
                for (let k = 0; k < 2; k++) {
                    let startX = cw / 2 + random(-200, 200);
                    if (Math.random() > 0.5) startX = random(0, cw); // Randomize start position more
                    let startY = ch;
                    let targetX = random(0, cw);
                    let targetY = random(0, ch / 2);
                    fireworks.push(new Firework(startX, startY, targetX, targetY));
                }
                timer = 0;
            } else {
                timer++;
            }
        }

        loop();
    }

    /* =========================================
       UI INTERACTION LOGIC
       ========================================= */
    // Fullscreen Toggle
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable fullscreen: ${err.message}`);
                });
                fullscreenBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>';
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                    fullscreenBtn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
                }
            }
        });
    }

    // Online Count Visibility Toggle
    const toggleOnlineBtn = document.getElementById('toggle-online-btn');
    const onlineContainer = document.getElementById('online-count-container');

    if (toggleOnlineBtn && onlineContainer) {
        toggleOnlineBtn.addEventListener('click', () => {
            onlineContainer.classList.toggle('collapsed');
            const isCollapsed = onlineContainer.classList.contains('collapsed');

            // Change icon
            if (isCollapsed) {
                toggleOnlineBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path></svg>'; // Eye icon (show)
            } else {
                toggleOnlineBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>'; // X icon (close)
            }
        });
    }

    /* =========================================
       MUSIC & CLIMAX LOGIC
       ========================================= */
    const musicModal = document.getElementById('music-modal');
    const climaxModal = document.getElementById('climax-modal');
    const searchInput = document.getElementById('music-search-input');
    const searchBtn = document.getElementById('music-search-btn');
    const musicResults = document.getElementById('music-results');
    const skipMusicBtn = document.getElementById('skip-music-btn');
    const bgMusic = document.getElementById('bg-music');
    const toast = document.getElementById('toast');

    // Climax Modal Elements
    const selectedCover = document.getElementById('selected-cover');
    const selectedTitle = document.getElementById('selected-title');
    const selectedArtist = document.getElementById('selected-artist');
    const climaxMin = document.getElementById('climax-min');
    const climaxSec = document.getElementById('climax-sec');
    const confirmClimaxBtn = document.getElementById('confirm-climax-btn');
    const noClimaxBtn = document.getElementById('no-climax-btn');

    let selectedSong = null;

    // Check if first visit
    const hasVisited = localStorage.getItem('ny_has_visited');
    if (!hasVisited) {
        if (musicModal) musicModal.classList.remove('hidden');
    }

    // Helper: Show Toast
    function showToast(msg) {
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.remove('hidden');
        // Reset animation
        toast.style.animation = 'none';
        toast.offsetHeight; /* trigger reflow */
        toast.style.animation = null;
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }

    // --- Music Search ---
    if (searchBtn) {
        searchBtn.addEventListener('click', async () => {
            const query = searchInput.value.trim();
            if (!query) return showToast('请输入歌名或歌手');

            searchBtn.textContent = '搜索中...';
            searchBtn.disabled = true;

            try {
                const res = await fetch('/api/music/qq/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                });
                const data = await res.json();

                if (data.code === 200 && data.data && data.data.length > 0) {
                    renderMusicList(data.data);
                } else {
                    showToast('未找到相关歌曲');
                }
            } catch (err) {
                console.error(err);
                showToast('搜索失败，请稍后重试');
            } finally {
                searchBtn.textContent = '搜索';
                searchBtn.disabled = false;
            }
        });
    }

    function renderMusicList(songs) {
        musicResults.innerHTML = '';
        songs.forEach(song => {
            const el = document.createElement('div');
            el.className = 'music-item';
            el.innerHTML = `
                <img src="${song.cover}" alt="cover">
                <div class="music-info">
                    <div class="music-title">${song.title}</div>
                    <div class="music-artist">${song.artist}</div>
                </div>
            `;
            el.addEventListener('click', () => selectSong(song));
            musicResults.appendChild(el);
        });
    }

    async function selectSong(song) {
        selectedSong = song;
        // Pre-fetch play url
        if (!selectedSong.playUrl) {
            try {
                showToast('正在获取播放地址...');
                const res = await fetch('/api/music/qq/play', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ songmid: song.songmid })
                });
                const data = await res.json();
                if (data.code === 200 && data.data.playUrl) {
                    selectedSong.playUrl = data.data.playUrl;
                } else {
                    throw new Error('No play URL');
                }
            } catch (e) {
                showToast('无法获取该歌曲播放地址，请换一首');
                return;
            }
        }

        // Close Music Modal, Open Climax Modal
        musicModal.classList.add('hidden');

        // Update Climax Modal UI
        selectedTitle.textContent = song.title;
        selectedArtist.textContent = song.artist;
        selectedCover.src = song.cover;

        climaxModal.classList.remove('hidden');
    }

    if (skipMusicBtn) {
        skipMusicBtn.addEventListener('click', () => {
            musicModal.classList.add('hidden');
            localStorage.setItem('ny_has_visited', 'true');
            showToast('已跳过音乐设置，静音模式');
        });
    }

    // --- Climax Scheduler ---
    if (confirmClimaxBtn) {
        confirmClimaxBtn.addEventListener('click', () => {
            const min = parseInt(climaxMin.value) || 0;
            const sec = parseInt(climaxSec.value) || 0;
            const climaxOffset = min * 60 + sec; // seconds into the song where climax hits

            if (selectedSong && selectedSong.playUrl) {
                scheduleMusic(selectedSong.playUrl, climaxOffset);
                climaxModal.classList.add('hidden');
                localStorage.setItem('ny_has_visited', 'true');
            }
        });
    }

    if (noClimaxBtn) {
        noClimaxBtn.addEventListener('click', () => {
            if (selectedSong && selectedSong.playUrl) {
                bgMusic.src = selectedSong.playUrl;
                bgMusic.play().catch(e => console.log('Autoplay blocked:', e));
                showToast(`正在播放: ${selectedSong.title}`);
                climaxModal.classList.add('hidden');
                localStorage.setItem('ny_has_visited', 'true');
            }
        });
    }

    function scheduleMusic(url, climaxOffsetSeconds) {
        bgMusic.src = url;

        // Target: Jan 1st 00:00:00 of Next Year
        const climaxOffsetMs = climaxOffsetSeconds * 1000;
        const startTimestamp = targetDate - climaxOffsetMs; // Time we must START playing
        const now = Date.now();
        const diff = startTimestamp - now;

        if (diff > 0) {
            // Schedule it
            const secondsUntilStart = Math.ceil(diff / 1000);
            showToast(`已开启卡点模式！将在 ${secondsUntilStart} 秒后自动播放`);

            setTimeout(() => {
                bgMusic.play().then(() => {
                    showToast('卡点开始！音乐起 🎵');
                    console.log('Music started for climax sync');
                }).catch(e => {
                    showToast('自动播放被拦截，请点击屏幕任意位置');
                    document.addEventListener('click', () => bgMusic.play(), { once: true });
                });
            }, diff);
        } else {
            // Depending on how late we are
            // If we are late, but not past the climax time (targetDate)
            const lateBy = -diff; // positive ms
            if (now < targetDate) {
                // We missed the start, but we can seek!
                // Seek to 'lateBy' seconds
                bgMusic.currentTime = lateBy / 1000;
                bgMusic.play().catch(e => console.log(e));
                showToast(`已自动校准进度，卡点模式生效！`);
            } else {
                // We are past midnight/climax
                bgMusic.play().catch(e => console.log(e));
                showToast('新年已过，直接播放庆祝！');
            }
        }
    }
});

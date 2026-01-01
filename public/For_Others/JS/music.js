// ============================================
// MUSIC.JS - 音乐选择器逻辑
// ============================================

// --- DOM Elements ---
const musicPicker = document.getElementById('musicPicker');
const musicLinkInput = document.getElementById('musicLinkInput');
const musicFetchBtn = document.getElementById('musicFetchBtn');
const musicStatus = document.getElementById('musicStatus');
const musicSourceToggle = document.getElementById('musicSourceToggle');
const musicFilterToggle = document.getElementById('musicFilterToggle');
const musicSourceBtns = document.querySelectorAll('.source-btn');
const musicFilterBtns = document.querySelectorAll('.filter-btn');
const musicResults = document.getElementById('musicResults');
const musicEmptyState = document.getElementById('musicEmptyState');
const musicContent = document.getElementById('musicContent');
const albumArtImg = document.getElementById('albumArtImg');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const musicPreview = document.getElementById('musicPreview');
let activeMusicChip = null;

// Music Info Modal
const musicInfoModal = document.getElementById('musicInfoModal');
const musicInfoClose = document.getElementById('musicInfoClose');
const musicInfoOk = document.getElementById('musicInfoOk');
let hasSeenMusicModal = false;

// --- API Config (通过后端代理) ---
const MUSIC_API_BASE = '/api/music';
const FALLBACK_COVER = 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23333"/%3E%3C/svg%3E';

// --- CC Attack Warning ---
const ccAttackOverlay = document.getElementById('ccAttackOverlay');
const ccCountdown = document.getElementById('ccCountdown');
let ccCountdownInterval = null;

/**
 * 显示CC攻击全屏警告
 * @param {number} minutes - 剩余封禁分钟数
 */
function showCCAttackWarning(minutes = 10) {
    if (!ccAttackOverlay) return;

    // 显示覆盖层
    ccAttackOverlay.style.display = 'flex';
    setTimeout(() => {
        ccAttackOverlay.classList.add('active');
    }, 10);

    // 设置倒计时
    let remainingMinutes = minutes;
    if (ccCountdown) {
        ccCountdown.textContent = remainingMinutes;
    }

    // 清除之前的倒计时
    if (ccCountdownInterval) {
        clearInterval(ccCountdownInterval);
    }

    // 每分钟更新一次
    ccCountdownInterval = setInterval(() => {
        remainingMinutes--;
        if (ccCountdown) {
            ccCountdown.textContent = Math.max(0, remainingMinutes);
        }
        if (remainingMinutes <= 0) {
            clearInterval(ccCountdownInterval);
            hideCCAttackWarning();
        }
    }, 60000);
}

/**
 * 隐藏CC攻击警告
 */
function hideCCAttackWarning() {
    if (!ccAttackOverlay) return;
    ccAttackOverlay.classList.remove('active');
    setTimeout(() => {
        ccAttackOverlay.style.display = 'none';
    }, 500);
    if (ccCountdownInterval) {
        clearInterval(ccCountdownInterval);
        ccCountdownInterval = null;
    }
}

/**
 * 检查错误是否为CC攻击限流
 * @param {Object} result - API响应结果
 * @returns {boolean}
 */
function isCCAttackError(result) {
    return result && result.code === 404 &&
        result.error && result.error.includes('CC攻击');
}

/**
 * 从错误消息中提取剩余分钟数
 * @param {string} errorMsg - 错误消息
 * @returns {number}
 */
function extractMinutesFromError(errorMsg) {
    const match = errorMsg.match(/(\d+)\s*分钟/);
    return match ? parseInt(match[1], 10) : 10;
}

/**
 * 页面加载时检查IP是否被封禁
 */
async function checkBlockedStatus() {
    try {
        const response = await fetch(`${MUSIC_API_BASE}/blocked`);
        const result = await response.json();

        if (result.blocked && result.remainingMinutes > 0) {
            showCCAttackWarning(result.remainingMinutes);
        }
    } catch (error) {
        // 静默处理错误
    }
}

// 页面加载时检查封禁状态
document.addEventListener('DOMContentLoaded', checkBlockedStatus);

// --- Event Listeners ---
if (musicInfoClose) {
    musicInfoClose.addEventListener('click', hideMusicInfoModal);
}
if (musicInfoOk) {
    musicInfoOk.addEventListener('click', hideMusicInfoModal);
}
musicInfoModal.addEventListener('click', (e) => {
    if (e.target === musicInfoModal) {
        hideMusicInfoModal();
    }
});

musicSourceBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setMusicSource(btn.getAttribute('data-source'));
    });
});

musicFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setMusicFilter(btn.getAttribute('data-filter'));
    });
});

musicLinkInput.addEventListener('input', () => {
    updateMusicFetchState();
});

musicLinkInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && musicLinkInput.value.trim().length > 0) {
        handleMusicFetch();
    }
});

musicFetchBtn.addEventListener('click', () => {
    handleMusicFetch();
});

// --- Modal Functions ---
let musicInfoCountdown = null;

function showMusicInfoModal() {
    if (musicInfoModal) {
        musicInfoModal.classList.add('active');

        // 禁用按钮并启动5秒倒计时
        if (musicInfoOk) {
            musicInfoOk.disabled = true;
            musicInfoOk.style.opacity = '0.5';
            musicInfoOk.style.cursor = 'not-allowed';

            let seconds = 5;
            musicInfoOk.textContent = `我知道了 (${seconds})`;

            musicInfoCountdown = setInterval(() => {
                seconds--;
                if (seconds > 0) {
                    musicInfoOk.textContent = `我知道了 (${seconds})`;
                } else {
                    clearInterval(musicInfoCountdown);
                    musicInfoCountdown = null;
                    musicInfoOk.textContent = '我知道了';
                    musicInfoOk.disabled = false;
                    musicInfoOk.style.opacity = '1';
                    musicInfoOk.style.cursor = 'pointer';
                }
            }, 1000);
        }

        // 禁用关闭按钮（也需要等5秒）
        if (musicInfoClose) {
            musicInfoClose.style.display = 'none';
        }
    }
}

function hideMusicInfoModal() {
    // 如果倒计时还在进行中，不允许关闭
    if (musicInfoOk && musicInfoOk.disabled) {
        return;
    }

    if (musicInfoModal) {
        musicInfoModal.classList.remove('active');
    }

    // 清理倒计时
    if (musicInfoCountdown) {
        clearInterval(musicInfoCountdown);
        musicInfoCountdown = null;
    }

    // 恢复关闭按钮
    if (musicInfoClose) {
        musicInfoClose.style.display = '';
    }

    // 弹窗关闭后显示音乐选择器
    if (musicPicker && !musicPicker.classList.contains('active')) {
        musicPicker.classList.add('active');
        initMusicPickerUI();
    }
}

// --- Music Functions ---
function updateMusicFetchState() {
    const hasValue = musicLinkInput.value.trim().length > 0;
    musicFetchBtn.disabled = !hasValue;
}

function setMusicStatus(text, state) {
    musicStatus.textContent = text;
    musicStatus.classList.remove('error', 'success');
    if (state === 'error') {
        musicStatus.classList.add('error');
    }
    if (state === 'success') {
        musicStatus.classList.add('success');
    }
}

function getMusicStatusHint() {
    if (userData.musicSource === 'netease') {
        return '默认网易云：搜索歌曲名或 ID';
    }
    return 'QQ 音乐：输入“歌名 - 歌手”或粘贴分享链接';
}

function setDefaultMusicStatus() {
    if (userData.music) {
        setMusicStatus('已选择音乐', 'success');
        return;
    }
    setMusicStatus(getMusicStatusHint());
}

function setMusicSource(source) {
    const normalized = source === 'qq' ? 'qq' : 'netease';

    if (normalized === 'qq') {
        if (!qqMusicUnlocked) {
            showQqMusicModal();
            return;
        }
    }

    if (userData.musicSource === normalized) {
        updateMusicSourceUI();
        return;
    }
    userData.musicSource = normalized;
    if (normalized === 'qq') {
        clearMusicResults();
    }
    updateMusicSourceUI();
    setDefaultMusicStatus();
}

function setMusicFilter(filter) {
    const normalized = filter === 'id' ? 'id' : 'name';
    userData.musicFilter = normalized;
    musicFilterBtns.forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === normalized);
    });
}

function updateMusicSourceUI() {
    musicSourceBtns.forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-source') === userData.musicSource);
    });

    const isNetease = userData.musicSource === 'netease';
    musicFilterToggle.classList.toggle('hidden', !isNetease);

    if (isNetease) {
        musicLinkInput.placeholder = '搜索网易云歌曲名或ID...';
        musicLinkInput.value = userData.musicQuery || '';
    } else {
        musicLinkInput.placeholder = '输入“歌名 - 歌手”或粘贴 QQ 音乐分享链接...';
        musicLinkInput.value = userData.musicShareUrl || '';
    }

    setMusicFilter(userData.musicFilter || 'name');
    updateMusicFetchState();
}

function renderMusicPlaceholder() {
    if (musicContent) musicContent.style.display = 'none';
    if (musicEmptyState) musicEmptyState.style.display = 'flex';
    if (musicPreview) {
        musicPreview.pause();
        musicPreview.removeAttribute('src');
    }
}

function clearMusicResults() {
    if (!musicResults) return;
    musicResults.innerHTML = '';
    musicResults.classList.remove('visible');
}

function renderMusicResults(results) {
    if (!musicResults) return;
    if (!Array.isArray(results) || results.length === 0) {
        clearMusicResults();
        return;
    }

    musicResults.innerHTML = '';
    results.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'music-result-item';

        const cover = document.createElement('img');
        cover.className = 'music-result-cover';
        cover.alt = item.title ? `${item.title} cover` : 'Cover';
        cover.src = item.cover || FALLBACK_COVER;

        const meta = document.createElement('div');
        meta.className = 'music-result-meta';

        const title = document.createElement('div');
        title.className = 'music-result-title';
        title.textContent = item.title || '未知歌曲';

        const artist = document.createElement('div');
        artist.className = 'music-result-artist';
        artist.textContent = item.artist || '未知歌手';

        meta.append(title, artist);

        const chip = document.createElement('div');
        chip.className = 'music-result-chip';
        chip.textContent = item.source === 'qq' ? 'QQ音乐' : (item.sourceId ? `ID ${item.sourceId}` : '网易云');
        chip.dataset.defaultText = chip.textContent;

        if (userData.music && userData.music.source === item.source && userData.music.sourceId === item.sourceId) {
            button.classList.add('active');
        }

        button.addEventListener('click', async () => {
            if (activeMusicChip && activeMusicChip !== chip) {
                const fallbackText = activeMusicChip.dataset.defaultText || activeMusicChip.textContent;
                activeMusicChip.textContent = fallbackText;
            }
            activeMusicChip = chip;

            // If QQ music and missing playUrl, fetch it
            if (item.source === 'qq' && !item.playUrl && (item.songmid || item.shareUrl)) {
                const originalText = chip.textContent;
                chip.textContent = '加载中...';
                const url = await fetchQqPlayUrl(item.songmid, item.shareUrl);
                if (url) {
                    item.playUrl = url;
                    chip.textContent = chip.dataset.defaultText || originalText;
                } else {
                    chip.textContent = '加载失败';
                }
            }

            userData.music = item;
            renderMusicCard(item);
            setMusicStatus(item.source === 'qq' ? `已选择: ${item.title}` : '已选择网易云音乐', 'success');
            musicResults.querySelectorAll('.music-result-item').forEach((btn) => {
                btn.classList.remove('active');
            });
            button.classList.add('active');
            await tryPlayPreview();
        });

        button.append(cover, meta, chip);
        musicResults.appendChild(button);
    });

    musicResults.classList.add('visible');
}

function renderMusicCard(music) {
    if (musicEmptyState) musicEmptyState.style.display = 'none';
    if (musicContent) musicContent.style.display = 'flex';
    if (trackTitle) {
        trackTitle.textContent = music.title || '未知歌曲';
        trackTitle.title = music.title || '';
    }
    if (trackArtist) trackArtist.textContent = music.artist || '未知歌手';
    if (albumArtImg) albumArtImg.src = music.cover || FALLBACK_COVER;

    if (musicPreview) {
        if (music.playUrl) {
            musicPreview.src = music.playUrl;
            musicPreview.style.display = 'block';
        } else {
            musicPreview.pause();
            musicPreview.removeAttribute('src');
            musicPreview.style.display = 'none';
        }
    }
}

async function tryPlayPreview() {
    if (!musicPreview || !musicPreview.src) return;
    try {
        await musicPreview.play();
        if (activeMusicChip) {
            activeMusicChip.textContent = '播放中';
        }
        setMusicStatus('正在播放', 'success');
    } catch (error) {
        if (activeMusicChip) {
            activeMusicChip.textContent = '点击播放';
        }
        setMusicStatus('自动播放被浏览器限制，请点击歌曲试听', 'error');
    }
}

function pickMusicUrl(musicUrls) {
    if (!musicUrls || typeof musicUrls !== 'object') return '';
    const preferredKeys = ['128', 'aac_96', 'aac_48', 'ogg_96', 'ogg_192', 'ogg_640'];
    for (const key of preferredKeys) {
        if (musicUrls[key]?.url) {
            return musicUrls[key].url;
        }
    }
    const fallback = Object.values(musicUrls).find((entry) => entry?.url);
    return fallback ? fallback.url : '';
}

function normalizeQqMusicData(data) {
    if (!data) return null;
    const songmid = data.songmid || data.song_mid || data.mid || '';
    const shareUrl = data.shareUrl || data.share_url || '';
    return {
        source: 'qq',
        sourceId: data.songid || data.song_id || data.id || '',
        title: data.music_title || data.title || data.songname || data.name || '',
        artist: data.music_singer || data.singer || data.artist || data.author || '',
        cover: data.music_picurl || data.pic || data.cover || data.image || '',
        playUrl: pickMusicUrl(data.music_urls) || data.music_url || data.url || data.play_url || '',
        songmid: songmid,
        shareUrl: shareUrl || (songmid ? `https://y.qq.com/n/ryqq/songDetail/${songmid}` : ''),
        lyric: data.lyric || ''
    };
}

function normalizeNeteaseMusicData(data) {
    if (!data) return null;
    return {
        source: 'netease',
        sourceId: data.songid || data.id || '',
        title: data.title || data.name || '',
        artist: data.author || data.artist || '',
        cover: data.pic || data.cover || '',
        playUrl: data.url || data.play_url || '',
        lyric: data.lrc || data.lyric || ''
    };
}

function isQqShareLink(input) {
    const value = String(input || '').trim();
    if (!value) return false;
    if (/^https?:\/\//i.test(value)) return true;
    return value.includes('y.qq.com') || value.includes('qq.com');
}

function parseQqSearchInput(input) {
    const value = String(input || '').trim();
    if (!value) return { query: '' };
    const parts = value.split(/\s*[-/|]\s*/).filter(Boolean);
    if (parts.length >= 2) {
        return {
            title: parts[0],
            artist: parts.slice(1).join(' '),
            query: value
        };
    }
    return { query: value };
}

async function requestQqMusic(inputValue) {
    const trimmed = String(inputValue || '').trim();
    const isShare = isQqShareLink(trimmed);
    const endpoint = isShare ? `${MUSIC_API_BASE}/qq` : `${MUSIC_API_BASE}/qq/search`;
    const payload = isShare ? { url: trimmed } : parseQqSearchInput(trimmed);

    if (!isShare && !payload.query && !payload.title && !payload.artist) {
        throw new Error('请输入歌名和歌手');
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const result = await response.json();

    // 检测CC攻击限流
    if (isCCAttackError(result)) {
        const minutes = extractMinutesFromError(result.error);
        showCCAttackWarning(minutes);
        throw new Error('请求被限流');
    }

    if (!response.ok || result.code !== 200) {
        throw new Error(result.error || (isShare ? '解析失败' : '搜索失败'));
    }

    return result.data;
}

async function fetchQqPlayUrl(songmid, shareUrl) {
    const normalizedSongmid = typeof songmid === 'string' ? songmid.trim() : '';
    const normalizedShareUrl = typeof shareUrl === 'string' ? shareUrl.trim() : '';
    if (!normalizedSongmid && !normalizedShareUrl) return '';
    try {
        const response = await fetch(`${MUSIC_API_BASE}/qq/play`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songmid: normalizedSongmid, shareUrl: normalizedShareUrl })
        });
        const result = await response.json();
        if (result.code === 200 && result.data && result.data.playUrl) {
            return result.data.playUrl;
        }
    } catch (e) {
        console.error('Fetch QQ play url failed', e);
    }
    return '';
}

async function requestNeteaseMusic(query, filter, page) {
    const params = new URLSearchParams({
        input: query,
        filter: filter || 'name',
        page: String(page || 1)
    });

    const response = await fetch(`${MUSIC_API_BASE}/netease?${params.toString()}`);

    const result = await response.json();

    // 检测CC攻击限流
    if (isCCAttackError(result)) {
        const minutes = extractMinutesFromError(result.error);
        showCCAttackWarning(minutes);
        throw new Error('请求被限流');
    }

    if (!response.ok || result.code !== 200) {
        throw new Error(result.error || '搜索失败');
    }

    return result.data;
}

async function handleMusicFetch() {
    const inputValue = musicLinkInput.value.trim();
    if (!inputValue) {
        const emptyHint = userData.musicSource === 'netease'
            ? '请输入歌曲名或 ID'
            : '请输入歌名和歌手，或粘贴分享链接';
        setMusicStatus(emptyHint, 'error');
        return;
    }

    const isNetease = userData.musicSource === 'netease';
    const isQqShare = !isNetease && isQqShareLink(inputValue);
    setMusicStatus(isNetease ? '正在搜索网易云...' : '正在寻找旋律...', '');
    musicFetchBtn.disabled = true;

    try {
        if (isNetease) {
            const results = await requestNeteaseMusic(inputValue, userData.musicFilter, userData.musicPage);
            const normalizedList = results
                .map((item) => normalizeNeteaseMusicData(item))
                .filter((item) => item && (item.title || item.playUrl));
            if (!normalizedList.length) {
                throw new Error('未找到相关结果');
            }

            userData.musicQuery = inputValue;
            userData.musicResults = normalizedList;

            const firstTrack = normalizedList[0];
            userData.music = firstTrack;
            renderMusicResults(normalizedList);
            renderMusicCard(firstTrack);
            setMusicStatus(`已找到 ${normalizedList.length} 首，默认选择第 1 首`, 'success');
            await tryPlayPreview();
        } else {
            const data = await requestQqMusic(inputValue);

            if (Array.isArray(data)) {
                const normalizedList = data
                    .map((item) => normalizeQqMusicData(item))
                    .filter((item) => item);

                if (!normalizedList.length) {
                    throw new Error('未找到相关结果');
                }

                userData.musicShareUrl = inputValue;
                userData.musicResults = normalizedList;

                renderMusicResults(normalizedList);
                setMusicStatus(`QQ音乐：找到 ${normalizedList.length} 首歌曲`, 'success');
            } else {
                const normalized = normalizeQqMusicData(data);
                userData.musicShareUrl = inputValue;
                if (!normalized || (!normalized.title && !normalized.playUrl)) {
                    throw new Error('未能解析音乐信息');
                }

                userData.music = normalized;
                renderMusicResults([normalized]);
                renderMusicCard(normalized);
                setMusicStatus('成功捕获！', 'success');
                await tryPlayPreview();
            }
        }
    } catch (error) {
        const message = error && error.message ? error.message : '请求失败';
        const prefix = isNetease ? '搜索失败' : (isQqShare ? '解析失败' : '搜索失败');
        setMusicStatus(`${prefix}：${message}`, 'error');
        if (isNetease) {
            clearMusicResults();
        }
    } finally {
        musicFetchBtn.disabled = false;
        updateMusicFetchState();
    }
}

// --- Step 5 UI ---
function updateStep5UI() {
    questionTitle.childNodes[0].nodeValue = "选择音乐";
    questionSubtitle.textContent = "";
    questionSubtitle.style.color = '#000000';
    questionSubtitle.style.textShadow = 'none';

    nameInput.style.display = 'none';
    colorPicker.classList.remove('active');
    opacityPicker.classList.remove('active');
    bgImagePicker.classList.remove('active');
    playbackPicker.classList.remove('active');
    messagePicker.classList.remove('active');
    document.getElementById('letterPicker').classList.remove('active');

    prevBtn.classList.add('visible');
    submitBtn.classList.add('active');

    // 重置背景为白色
    applyBackground('white');

    // 如果还没看过弹窗，先不显示音乐选择器
    if (!hasSeenMusicModal) {
        musicPicker.classList.remove('active');
        setTimeout(() => {
            showMusicInfoModal();
            hasSeenMusicModal = true;
        }, 300);
    } else {
        // 已经看过弹窗，直接显示音乐选择器
        musicPicker.classList.add('active');
        initMusicPickerUI();
    }
}

// 初始化音乐选择器UI
function initMusicPickerUI() {
    updateMusicSourceUI();

    if (userData.musicSource === 'netease' && userData.musicResults.length) {
        renderMusicResults(userData.musicResults);
    } else {
        clearMusicResults();
    }

    if (userData.music) {
        renderMusicCard(userData.music);
    } else {
        renderMusicPlaceholder();
    }
    setDefaultMusicStatus();
}

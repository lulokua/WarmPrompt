// ============================================
// CORE.JS - 核心逻辑、状态管理、步骤切换
// ============================================

// --- DOM Elements ---
const nameInput = document.getElementById('nameInput');
const submitBtn = document.getElementById('submitBtn');
const prevBtn = document.getElementById('prevBtn');
const mainContainer = document.getElementById('main-container');
// greeting and userNameDisplay elements removed from DOM
const questionTitle = document.getElementById('questionTitle');
const questionSubtitle = document.getElementById('questionSubtitle');

// Picker Containers
const colorPicker = document.getElementById('colorPicker');
const colorBtns = document.querySelectorAll('.color-btn');
const opacityPicker = document.getElementById('opacityPicker');
const opacityInput = document.getElementById('opacityInput');
const opacityPreviewBox = document.getElementById('opacityPreviewBox');

// Background Elements
const bgImagePicker = document.getElementById('bgImagePicker');
const bgImageInput = document.getElementById('bgImageInput');
const bgVideoInput = document.getElementById('bgVideoInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadVideoBtn = document.getElementById('uploadVideoBtn');
const resetBgBtn = document.getElementById('resetBgBtn');
const bgPreviewImg = document.getElementById('bgPreviewImg');
const bgPreviewVideo = document.getElementById('bgPreviewVideo');
const bgPreviewText = document.getElementById('bgPreviewText');
const bgVideoLayer = document.getElementById('bgVideoLayer');

// Playback Picker
const playbackPicker = document.getElementById('playbackPicker');
const letterPicker = document.getElementById('letterPicker');
const letterModeBtns = document.querySelectorAll('[data-letter-mode]');
const letterContent = document.getElementById('letterContent');
const letterInput = document.getElementById('letterInput');
const modeBtns = document.querySelectorAll('.mode-btn');
const highlightControls = document.getElementById('highlightControls');
const startTimeInput = document.getElementById('startTimeInput');
const currentTimeDisplay = document.getElementById('currentTimeDisplay');
const totalTimeDisplay = document.getElementById('totalTimeDisplay');
const previewStartBtn = document.getElementById('previewStartBtn');

// --- State ---
let step = 0;
let userData = {
    userName: '',
    friendName: '',
    color: '#4facfe',
    blur: '10',
    bgImage: null,
    bgFile: null,
    bgType: 'white',
    videoDuration: null,
    videoVerifyCode: '',
    music: null,
    musicSource: 'netease',
    musicFilter: 'name',
    musicQuery: '',
    musicResults: [],
    musicPage: 1,
    musicShareUrl: '',
    playbackMode: 'full',
    startTime: 0,
    msgMode: 'official',
    message: '',
    hasLetter: false,
    letterContent: ''
};

// Color Schemes
const colorSchemes = {
    '#4facfe': { accent1: '#4facfe', accent2: '#00f2fe', accent3: '#4facfe' },
    '#ff0099': { accent1: '#ff0099', accent2: '#493240', accent3: '#ff0099' },
    '#f9d423': { accent1: '#f9d423', accent2: '#ff4e50', accent3: '#f9d423' },
    '#00f2fe': { accent1: '#00f2fe', accent2: '#4facfe', accent3: '#00f2fe' },
    '#ffffff': { accent1: '#e0e0e0', accent2: '#ffffff', accent3: '#e0e0e0' },
    '#00b09b': { accent1: '#00b09b', accent2: '#96c93d', accent3: '#00b09b' },
    '#ff416c': { accent1: '#ff416c', accent2: '#ff4b2b', accent3: '#ff416c' },
    '#8e2de2': { accent1: '#8e2de2', accent2: '#4a00e0', accent3: '#8e2de2' },
    '#f37335': { accent1: '#f37335', accent2: '#fdc830', accent3: '#f37335' },
    '#11998e': { accent1: '#11998e', accent2: '#38ef7d', accent3: '#11998e' },
    // New Colors
    '#30cfd0': { accent1: '#30cfd0', accent2: '#330867', accent3: '#30cfd0' },
    '#667eea': { accent1: '#667eea', accent2: '#764ba2', accent3: '#667eea' },
    '#a8edea': { accent1: '#a8edea', accent2: '#fed6e3', accent3: '#a8edea' },
    '#fed6e3': { accent1: '#fed6e3', accent2: '#a8edea', accent3: '#fed6e3' }
};

// --- Event Listeners ---
nameInput.addEventListener('input', () => {
    if (nameInput.value.trim().length > 0) {
        submitBtn.classList.add('active');
    } else {
        submitBtn.classList.remove('active');
    }
});

nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && nameInput.value.trim().length > 0) {
        submitName();
    }
});

submitBtn.addEventListener('click', () => {
    if (nameInput.value.trim().length > 0) {
        submitName();
    }
});

prevBtn.addEventListener('click', () => {
    goBack();
});

colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        selectColor(btn);
    });
});

// Prevent scrolling on mobile
// Prevent scrolling on mobile
document.addEventListener('touchmove', function (e) {
    if (e.target.type === 'range') return;
    if (e.target.closest('.music-results')) return;
    if (e.target.closest('.quote-card')) return;
    if (e.target.closest('.modal-content')) return; // Allow scrolling in modals
    if (e.target.tagName.toLowerCase() === 'textarea') return; // Allow scrolling in textareas
    e.preventDefault();
}, { passive: false });

// Blur Change
opacityInput.addEventListener('input', function (e) {
    const val = parseFloat(e.target.value);
    userData.blur = val;

    // 正向逻辑：
    // 往"清晰"拖 (val -> 0): 变为正常方框 (blur -> 0px)
    // 往"模糊"拖 (val -> 30): 增加毛玻璃效果 (blur -> 30px)
    const blurValue = val;

    document.documentElement.style.setProperty('--glass-blur', blurValue + 'px');

    const glassBox = document.getElementById('opacityPreviewBox');
    if (glassBox) {
        glassBox.style.backdropFilter = 'blur(' + blurValue + 'px)';
        glassBox.style.webkitBackdropFilter = 'blur(' + blurValue + 'px)';

        // 配合调整透明度
        // 正常方框时 (val=0, blur=0)，背景淡一点 (0.1)
        // 毛玻璃强时 (val=30, blur=30)，背景稍微不透明一点 (0.25) 显示质感
        const opacity = 0.1 + (val / 30) * 0.15;
        glassBox.style.backgroundColor = 'rgba(255, 255, 255, ' + opacity + ')';
    }
});

// File Upload
uploadBtn.addEventListener('click', () => bgImageInput.click());

// Video upload requires donation verification
const videoDonationModal = document.getElementById('videoDonationModal');
const videoDonationClose = document.getElementById('videoDonationClose');
const btnVideoWechat = document.getElementById('btnVideoWechat');
const btnVideoAlipay = document.getElementById('btnVideoAlipay');
const videoDonateQrImg = document.getElementById('videoDonateQrImg');
const videoVerifyCode = document.getElementById('videoVerifyCode');
const videoVerifyBtn = document.getElementById('videoVerifyBtn');
const videoVerifyStatus = document.getElementById('videoVerifyStatus');

// Track if video upload is verified (session only, not persisted)
let isVideoVerified = false;

// QR code paths for video donation
const wechatQrPath = 'https://my-blog.cn-nb1.rains3.com/WarmPrompt_v4.0/%E5%BE%AE%E4%BF%A1.png';
const alipayQrPath = 'https://my-blog.cn-nb1.rains3.com/WarmPrompt_v4.0/%E6%94%AF%E4%BB%98%E5%AE%9D.png';

function showVideoDonationModal() {
    videoDonationModal.classList.add('active');
    videoDonateQrImg.src = wechatQrPath;
    btnVideoWechat.classList.add('active');
    btnVideoAlipay.classList.remove('active');
    videoVerifyCode.value = '';
    videoVerifyStatus.textContent = '';
    videoVerifyStatus.style.color = '';
}

function hideVideoDonationModal() {
    videoDonationModal.classList.remove('active');
}

uploadVideoBtn.addEventListener('click', () => {
    if (isVideoVerified) {
        // Already verified, allow upload
        bgVideoInput.click();
    } else {
        // Show donation modal
        showVideoDonationModal();
    }
});

videoDonationClose.addEventListener('click', hideVideoDonationModal);

// "算了吧" 按钮
const videoDonationCancel = document.getElementById('videoDonationCancel');
if (videoDonationCancel) {
    videoDonationCancel.addEventListener('click', hideVideoDonationModal);
}

btnVideoWechat.addEventListener('click', () => {
    btnVideoWechat.classList.add('active');
    btnVideoAlipay.classList.remove('active');
    videoDonateQrImg.src = wechatQrPath;
});

btnVideoAlipay.addEventListener('click', () => {
    btnVideoAlipay.classList.add('active');
    btnVideoWechat.classList.remove('active');
    videoDonateQrImg.src = alipayQrPath;
});

videoVerifyBtn.addEventListener('click', async () => {
    const code = videoVerifyCode.value.trim();
    const normalizedCode = code.toUpperCase();
    if (!code) {
        videoVerifyStatus.textContent = '请输入验证码';
        videoVerifyStatus.style.color = '#ff6b6b';
        return;
    }

    videoVerifyBtn.disabled = true;
    videoVerifyBtn.textContent = '验证中...';
    videoVerifyStatus.textContent = '';

    try {
        const response = await fetch('/api/gift/verify-video-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: normalizedCode })
        });
        const data = await response.json();

        if (data.success) {
            isVideoVerified = true;
            // 不再保存到 localStorage，仅在当前会话有效
            userData.videoVerifyCode = normalizedCode;
            videoVerifyStatus.textContent = '✓ 验证成功！';
            videoVerifyStatus.style.color = '#51cf66';

            setTimeout(() => {
                hideVideoDonationModal();
                bgVideoInput.click();
            }, 800);
        } else {
            userData.videoVerifyCode = '';
            videoVerifyStatus.textContent = data.message || '验证码无效';
            videoVerifyStatus.style.color = '#ff6b6b';
        }
    } catch (error) {
        userData.videoVerifyCode = '';
        videoVerifyStatus.textContent = '验证失败，请稍后重试';
        videoVerifyStatus.style.color = '#ff6b6b';
    } finally {
        videoVerifyBtn.disabled = false;
        videoVerifyBtn.textContent = '验证';
    }
});

bgImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // 检查文件大小，限制为3MB
        const maxSize = 3 * 1024 * 1024; // 3MB
        if (file.size > maxSize) {
            alert('图片大小不能超过3MB哦~');
            bgImageInput.value = '';
            return;
        }

        userData.bgFile = file;
        const reader = new FileReader();
        reader.onload = function (event) {
            userData.bgImage = event.target.result;
            userData.bgType = 'image';
            applyBackground('image', event.target.result);
        };
        reader.readAsDataURL(file);
    }
});

bgVideoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // 检查文件大小，限制为20MB
        const maxSize = 20 * 1024 * 1024; // 20MB
        if (file.size > maxSize) {
            alert('视频大小不能超过20MB哦~');
            bgVideoInput.value = '';
            return;
        }

        // 检查视频时长，限制为15秒
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.preload = 'metadata';

        video.onloadedmetadata = function () {
            window.URL.revokeObjectURL(video.src);
            const duration = video.duration;

            if (duration > 15) {
                alert('视频时长不能超过15秒哦~');
                bgVideoInput.value = '';
                return;
            }

            // 验证通过，应用视频背景
            userData.bgFile = file;
            const videoUrl = URL.createObjectURL(file);
            userData.bgImage = videoUrl;
            userData.bgType = 'video';
            userData.videoDuration = duration; // 保存视频时长用于服务器验证
            applyBackground('video', videoUrl);
        };

        video.onerror = function () {
            alert('无法读取视频文件，请检查格式是否正确');
            bgVideoInput.value = '';
        };

        video.src = url;
    }
});

resetBgBtn.addEventListener('click', () => {
    userData.bgImage = null;
    userData.bgFile = null;
    userData.bgType = 'white';
    userData.videoDuration = null; // 清除视频时长
    bgImageInput.value = "";
    bgVideoInput.value = "";
    applyBackground('white');
});

// --- Core Functions ---
function resetVideoElement(videoEl) {
    if (!videoEl) return;
    videoEl.pause();
    videoEl.removeAttribute('src');
    videoEl.load();
    videoEl.onerror = null;
}

function tryPlayVideoElement(videoEl) {
    if (!videoEl) return;
    const playPromise = videoEl.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => { });
    }
}

function applyBackground(type, value) {
    document.body.style.backgroundImage = 'none';
    bgVideoLayer.style.display = 'none';
    resetVideoElement(bgVideoLayer);
    bgPreviewImg.style.display = 'none';
    bgPreviewVideo.style.display = 'none';
    resetVideoElement(bgPreviewVideo);
    bgPreviewText.style.display = 'none';

    // Clear inline display styles on orbs so CSS classes can control them
    document.querySelector('.orb-1').style.display = '';
    document.querySelector('.orb-2').style.display = '';

    if (type === 'white') {
        document.body.classList.add('light-theme');
        document.body.classList.add('hide-orbs');
        bgPreviewText.style.display = 'block';
        bgPreviewText.textContent = "默认白色";
    } else if (type === 'image') {
        document.body.classList.remove('light-theme');
        document.body.classList.add('hide-orbs');
        document.body.style.backgroundImage = `url(${value})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        bgPreviewImg.src = value;
        bgPreviewImg.style.display = 'block';
    } else if (type === 'video') {
        document.body.classList.remove('light-theme');
        document.body.classList.add('hide-orbs');
        const handleVideoError = () => {
            resetVideoElement(bgVideoLayer);
            resetVideoElement(bgPreviewVideo);
            bgVideoLayer.style.display = 'none';
            bgPreviewVideo.style.display = 'none';
            userData.bgImage = null;
            userData.bgFile = null;
            userData.bgType = 'white';
            userData.videoDuration = null;
            bgVideoInput.value = '';
            alert('视频无法播放，请尝试使用 MP4/MOV 格式');
            applyBackground('white');
        };
        bgVideoLayer.onerror = handleVideoError;
        bgPreviewVideo.onerror = handleVideoError;
        bgVideoLayer.src = value;
        bgVideoLayer.style.display = 'block';
        bgPreviewVideo.src = value;
        bgPreviewVideo.style.display = 'block';
        bgVideoLayer.load();
        bgPreviewVideo.load();
        tryPlayVideoElement(bgVideoLayer);
        tryPlayVideoElement(bgPreviewVideo);
    } else {
        document.body.classList.remove('light-theme');
        document.body.classList.remove('hide-orbs');
        bgPreviewText.style.display = 'block';
        bgPreviewText.textContent = "默认深色";
    }
}

function selectColor(btn) {
    colorBtns.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    const color = btn.getAttribute('data-color');
    userData.color = color;
    const scheme = colorSchemes[color] || colorSchemes['#4facfe'];
    document.documentElement.style.setProperty('--accent-1', scheme.accent1);
    document.documentElement.style.setProperty('--accent-2', scheme.accent2);
    document.documentElement.style.setProperty('--accent-3', scheme.accent3);
}

// --- Step Navigation ---
function submitName() {
    const inputValue = nameInput.value.trim();

    // 验证名字长度不超过6个字
    if ((step === 0 || step === 1) && inputValue.length > 6) {
        alert('名字最多6个字哦~');
        return;
    }

    if (step === 0) {
        userData.userName = inputValue;
        transitionToStep(1);
    } else if (step === 1) {
        userData.friendName = inputValue;
        transitionToStep(2);
    } else if (step === 2) {
        transitionToStep(3);
    } else if (step === 3) {
        transitionToStep(4);
    } else if (step === 4) {
        transitionToStep(5);
    } else if (step === 5) {
        if (!userData.music) {
            setMusicStatus('请先选择一首音乐再继续', 'error');
            return;
        }
        // 自动暂停音乐预览
        if (musicPreview) {
            musicPreview.pause();
        }
        transitionToStep(6);
    } else if (step === 6) {
        // 自动暂停音乐预览
        if (musicPreview) {
            musicPreview.pause();
        }
        transitionToStep(7);
    } else if (step === 7) {
        if (userData.msgMode === 'custom' && !validateCustomMessage()) {
            return;
        }
        transitionToStep(8);
    } else if (step === 8) {
        showFinalGreeting();
    }
}

function goBack() {
    if (step === 1) transitionToStep(0);
    else if (step === 2) transitionToStep(1);
    else if (step === 3) transitionToStep(2);
    else if (step === 4) transitionToStep(3);
    else if (step === 5) transitionToStep(4);
    else if (step === 6) transitionToStep(5);
    else if (step === 7) transitionToStep(6);
    else if (step === 8) transitionToStep(7);
}

function transitionToStep(nextStep) {
    mainContainer.classList.add('fade-out');

    setTimeout(() => {
        step = nextStep;

        // Reset submitBtn to default icon
        submitBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14m-7-7l7 7-7 7" />
            </svg>`;
        submitBtn.style.width = "";
        submitBtn.style.padding = "";
        submitBtn.style.borderRadius = "";
        submitBtn.style.fontSize = "";

        if (nextStep === 0) updateStep0UI();
        else if (nextStep === 1) updateStep1UI();
        else if (nextStep === 2) updateStep2UI();
        else if (nextStep === 3) updateStep3UI();
        else if (nextStep === 4) updateStep4UI();
        else if (nextStep === 5) updateStep5UI();
        else if (nextStep === 6) updateStep6UI();
        else if (nextStep === 7) updateStep7UI();
        else if (nextStep === 8) updateStep8UI();

        mainContainer.classList.remove('fade-out');
        resetAnimation(questionTitle, '0.1s');

        if (nextStep === 0 || nextStep === 1) nameInput.focus();
        // 不自动聚焦音乐输入框，避免输入法自动弹出
        if (nextStep === 7 && userData.msgMode === 'custom') customMessageInput.focus();
        if (nextStep === 8 && userData.hasLetter) letterInput.focus();
    }, 600);
}

// --- Step UI Updates ---
function updateStep0UI() {
    questionTitle.childNodes[0].nodeValue = "你好";
    questionSubtitle.textContent = "请问怎么称呼？";
    questionSubtitle.style.color = '';
    questionSubtitle.style.textShadow = '';
    nameInput.style.display = 'block';
    colorPicker.classList.remove('active');
    opacityPicker.classList.remove('active');
    bgImagePicker.classList.remove('active');
    musicPicker.classList.remove('active');
    playbackPicker.classList.remove('active');
    messagePicker.classList.remove('active');
    letterPicker.classList.remove('active');
    nameInput.value = userData.userName;
    nameInput.placeholder = "输入你的名字";
    nameInput.maxLength = 6;
    prevBtn.classList.remove('visible');
    submitBtn.classList.add('active');
}

function updateStep1UI() {
    questionTitle.childNodes[0].nodeValue = "你的朋友";
    questionSubtitle.textContent = "怎么称呼他/她？";
    questionSubtitle.style.color = '';
    questionSubtitle.style.textShadow = '';
    nameInput.style.display = 'block';
    colorPicker.classList.remove('active');
    opacityPicker.classList.remove('active');
    bgImagePicker.classList.remove('active');
    musicPicker.classList.remove('active');
    playbackPicker.classList.remove('active');
    messagePicker.classList.remove('active');
    letterPicker.classList.remove('active');
    nameInput.value = userData.friendName || "";
    nameInput.placeholder = "输入朋友的名字";
    nameInput.maxLength = 6;
    prevBtn.classList.add('visible');
    if (nameInput.value.trim().length > 0) {
        submitBtn.classList.add('active');
    } else {
        submitBtn.classList.remove('active');
    }
}

function updateStep2UI() {
    questionTitle.childNodes[0].nodeValue = "选择方框一种颜色";
    questionSubtitle.textContent = "代表当下的心情";
    questionSubtitle.style.color = '';
    questionSubtitle.style.textShadow = '';
    nameInput.style.display = 'none';
    colorPicker.classList.add('active');
    opacityPicker.classList.remove('active');
    bgImagePicker.classList.remove('active');
    musicPicker.classList.remove('active');
    playbackPicker.classList.remove('active');
    messagePicker.classList.remove('active');
    letterPicker.classList.remove('active');
    prevBtn.classList.add('visible');
    submitBtn.classList.add('active');
}

function updateStep3UI() {
    questionTitle.childNodes[0].nodeValue = "毛玻璃感";
    questionSubtitle.textContent = "调整方框的模糊程度";
    questionSubtitle.style.color = '';
    questionSubtitle.style.textShadow = '';
    nameInput.style.display = 'none';
    colorPicker.classList.remove('active');
    opacityPicker.classList.add('active');
    bgImagePicker.classList.remove('active');
    musicPicker.classList.remove('active');
    playbackPicker.classList.remove('active');
    messagePicker.classList.remove('active');
    letterPicker.classList.remove('active');
    prevBtn.classList.add('visible');
    submitBtn.classList.add('active');
    applyBackground('default');
}

function updateStep4UI() {
    questionTitle.childNodes[0].nodeValue = "背景风格";
    questionSubtitle.textContent = "选择或上传背景图";
    questionSubtitle.style.color = '#000000';
    questionSubtitle.style.textShadow = 'none';
    nameInput.style.display = 'none';
    colorPicker.classList.remove('active');
    opacityPicker.classList.remove('active');
    bgImagePicker.classList.add('active');
    musicPicker.classList.remove('active');
    playbackPicker.classList.remove('active');
    messagePicker.classList.remove('active');
    letterPicker.classList.remove('active');
    prevBtn.classList.add('visible');
    submitBtn.classList.add('active');

    if (userData.bgImage && userData.bgType) {
        applyBackground(userData.bgType, userData.bgImage);
    } else {
        applyBackground('white');
    }
}

function updateStep6UI() {
    questionTitle.childNodes[0].nodeValue = "播放模式";
    questionSubtitle.textContent = "定制你的旋律";
    questionSubtitle.style.color = '#000000';
    questionSubtitle.style.textShadow = 'none';
    nameInput.style.display = 'none';
    colorPicker.classList.remove('active');
    opacityPicker.classList.remove('active');
    bgImagePicker.classList.remove('active');
    musicPicker.classList.remove('active');
    playbackPicker.classList.add('active');
    messagePicker.classList.remove('active');
    prevBtn.classList.add('visible');
    submitBtn.classList.add('active');

    // 重置背景为白色
    applyBackground('white');

    updatePlaybackModeUI();

    if (musicPreview.duration && !isNaN(musicPreview.duration)) {
        initSlider(musicPreview.duration);
    } else {
        musicPreview.onloadedmetadata = () => {
            initSlider(musicPreview.duration);
        };
        if (userData.music && userData.music.playUrl && !musicPreview.src) {
            musicPreview.src = userData.music.playUrl;
        }
    }
}

// --- Playback Mode ---
function updatePlaybackModeUI() {
    modeBtns.forEach(btn => {
        const mode = btn.getAttribute('data-mode');
        if (mode === userData.playbackMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (userData.playbackMode === 'highlight') {
        highlightControls.style.display = 'flex';
    } else {
        highlightControls.style.display = 'none';
    }
}

modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        userData.playbackMode = btn.getAttribute('data-mode');
        updatePlaybackModeUI();
    });
});

function initSlider(duration) {
    startTimeInput.max = Math.floor(duration);
    totalTimeDisplay.textContent = formatTime(duration);
    if (userData.startTime > duration) userData.startTime = 0;
    startTimeInput.value = userData.startTime || 0;
    updateTimeDisplay();
}

// 标记是否正在拖动进度条
let isDraggingSlider = false;

startTimeInput.addEventListener('mousedown', () => {
    isDraggingSlider = true;
});

startTimeInput.addEventListener('mouseup', () => {
    isDraggingSlider = false;
});

startTimeInput.addEventListener('touchstart', () => {
    isDraggingSlider = true;
});

startTimeInput.addEventListener('touchend', () => {
    isDraggingSlider = false;
});

startTimeInput.addEventListener('input', () => {
    userData.startTime = parseInt(startTimeInput.value);
    updateTimeDisplay();
    musicPreview.currentTime = userData.startTime;
});

// 音乐播放时实时更新进度条
musicPreview.addEventListener('timeupdate', () => {
    // 如果正在拖动进度条，不自动更新
    if (isDraggingSlider) return;

    const currentTime = musicPreview.currentTime;
    startTimeInput.value = Math.floor(currentTime);
    currentTimeDisplay.textContent = formatTime(currentTime);
});

function updateTimeDisplay() {
    currentTimeDisplay.textContent = formatTime(userData.startTime);
}

previewStartBtn.addEventListener('click', async () => {
    musicPreview.currentTime = userData.startTime;
    try {
        await musicPreview.play();
    } catch (e) { console.error(e); }
});

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// --- Letter Step ---
function updateStep8UI() {
    questionTitle.childNodes[0].nodeValue = "附加信件";
    questionSubtitle.textContent = "有没有什么想说的话？";
    questionSubtitle.style.color = '#000000';
    questionSubtitle.style.textShadow = 'none';

    nameInput.style.display = 'none';
    colorPicker.classList.remove('active');
    opacityPicker.classList.remove('active');
    bgImagePicker.classList.remove('active');
    musicPicker.classList.remove('active');
    playbackPicker.classList.remove('active');
    messagePicker.classList.remove('active');
    letterPicker.classList.add('active');

    prevBtn.classList.add('visible');
    submitBtn.classList.add('active');

    // 重置背景为白色
    applyBackground('white');

    // Change button to "Preview Effect" text
    submitBtn.innerHTML = "预览效果";
    submitBtn.style.width = "auto";
    submitBtn.style.padding = "0 20px";
    submitBtn.style.borderRadius = "25px";
    submitBtn.style.fontSize = "1rem";

    updateLetterModeUI();
}

function updateLetterModeUI() {
    letterModeBtns.forEach(btn => {
        const mode = btn.getAttribute('data-letter-mode');
        const isActive = (userData.hasLetter && mode === 'yes') || (!userData.hasLetter && mode === 'no');
        if (isActive) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    if (userData.hasLetter) {
        letterContent.style.display = 'flex';
    } else {
        letterContent.style.display = 'none';
    }
}

letterModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-letter-mode');
        userData.hasLetter = (mode === 'yes');
        updateLetterModeUI();
        if (userData.hasLetter) {
            setTimeout(() => letterInput.focus(), 100);
        }
    });
});

letterInput.addEventListener('input', () => {
    userData.letterContent = letterInput.value;
});
// --- Letter Overlay Logic ---
function showLetterOverlay() {
    const letterOverlay = document.getElementById('letterOverlay');
    const recipient = document.getElementById('letterRecipient');
    const sender = document.getElementById('letterSender');
    const body = document.getElementById('letterBodyText');

    // Fill content
    recipient.textContent = userData.friendName || "朋友";
    sender.textContent = userData.userName || "我";
    body.innerText = userData.letterContent || "这里似乎没有写什么..."; // innerText preserves newlines

    // Show
    letterOverlay.classList.add('active');

    // Enable Swipe on Letter to go to Popups
    enableSwipeToCloseLetter(letterOverlay);
}

function enableSwipeToCloseLetter(container) {
    let startY = 0;
    let isDragging = false;
    let isScrollingLetterBody = false;
    const card = container.querySelector('.letter-card');
    const swipeHint = container.querySelector('.swipe-hint-container');
    const letterBody = container.querySelector('.letter-body');

    // 设置 touch-action 以支持自定义手势
    if (container) container.style.touchAction = 'none';
    // 但是信件内容区域需要允许垂直滚动
    if (letterBody) letterBody.style.touchAction = 'pan-y';

    const isInsideLetterBody = (target) => {
        return letterBody && (target === letterBody || letterBody.contains(target));
    };

    const canLetterBodyScroll = (direction) => {
        if (!letterBody) return false;
        if (direction === 'up') {
            // 向上滑动 = 内容向下滚动，检查是否还能往下滚
            return letterBody.scrollTop < (letterBody.scrollHeight - letterBody.clientHeight);
        } else {
            // 向下滑动 = 内容向上滚动，检查是否还能往上滚
            return letterBody.scrollTop > 0;
        }
    };

    const handleStart = (y, e) => {
        startY = y;
        isDragging = true;
        isScrollingLetterBody = false;

        // 检查触摸是否在信件内容区域内
        if (e && e.target && isInsideLetterBody(e.target)) {
            // 如果信件内容可滚动，则标记为滚动模式
            if (letterBody && letterBody.scrollHeight > letterBody.clientHeight) {
                isScrollingLetterBody = true;
            }
        }

        if (card && !isScrollingLetterBody) card.style.transition = 'none';
    };

    const handleMove = (y, e) => {
        if (!isDragging) return;
        const diff = startY - y;

        // 如果在信件内容区域滚动
        if (isScrollingLetterBody) {
            // 如果向上滑动（diff > 0）且内容还能向下滚动，让它自然滚动
            if (diff > 0 && canLetterBodyScroll('up')) {
                return; // 让浏览器处理滚动
            }
            // 如果向下滑动（diff < 0）且内容还能向上滚动，让它自然滚动
            if (diff < 0 && canLetterBodyScroll('down')) {
                return; // 让浏览器处理滚动
            }
            // 如果到达边界，切换到卡片滑动模式但不做任何转换（防止意外关闭）
            return;
        }

        // 卡片滑动模式：阻止默认行为
        if (diff > 10 && e && e.cancelable) e.preventDefault();

        if (diff > 0) {
            if (card) card.style.transform = `translateY(${-diff / 3}px) scale(${1 - diff / 5000}) rotateX(${diff / 50}deg)`;
            if (swipeHint) swipeHint.style.opacity = Math.max(0, 1 - diff / 200);
        }
    };

    const handleEnd = (y) => {
        if (!isDragging) return;
        isDragging = false;

        // 如果是信件内容滚动模式，不处理卡片关闭
        if (isScrollingLetterBody) {
            isScrollingLetterBody = false;
            return;
        }

        const diff = startY - y;
        if (card) card.style.transition = 'all 0.8s cubic-bezier(0.22, 1, 0.36, 1)';

        if (diff > 100) {
            // Success: Fly Up
            if (card) {
                card.style.transform = `translateY(-120vh) rotateX(20deg)`;
                card.style.opacity = '0';
            }
            container.style.pointerEvents = 'none'; // Prevent double swipes

            setTimeout(() => {
                container.classList.remove('active');
                if (typeof startSquarePopups === 'function') {
                    startSquarePopups();
                }
            }, 500);
        } else {
            // Reset
            if (card) card.style.transform = '';
            if (swipeHint) swipeHint.style.opacity = '';
        }
    };

    // 使用 addEventListener 避免覆盖其他事件处理器
    container.addEventListener('touchstart', (e) => handleStart(e.touches[0].clientY, e), { passive: false });
    container.addEventListener('touchmove', (e) => {
        if (isDragging && !isScrollingLetterBody) {
            handleMove(e.touches[0].clientY, e);
        } else if (isScrollingLetterBody) {
            handleMove(e.touches[0].clientY, e);
        }
    }, { passive: false });
    container.addEventListener('touchend', (e) => handleEnd(e.changedTouches[0].clientY));

    container.addEventListener('mousedown', (e) => handleStart(e.clientY, e));
    window.addEventListener('mousemove', (e) => { if (isDragging) handleMove(e.clientY, e); });
    window.addEventListener('mouseup', (e) => { if (isDragging) handleEnd(e.clientY); });
}

// Helper: Swipe Logic for Reveal Page (Music -> Popups)
function enableSwipeToNext(container) {
    let startY = 0;
    let isDragging = false;
    const card = container.querySelector('.music-immersive-card');
    const swipeHint = container.querySelector('.swipe-hint-container');

    const handleStart = (y) => {
        // Only trigger if we are somewhat near the bottom or generally swiping up essentially anywhere is fine, 
        // but let's avoid interfering with the progress bar or play button if possible.
        // For simplicity: allow anywhere on the container background.
        startY = y;
        isDragging = true;
        if (card) card.style.transition = 'none';

    };

    const handleMove = (y, e) => {
        if (!isDragging) return;
        const diff = startY - y; // Positive = Dragging Up

        // Prevent scrolling
        if (e && e.cancelable) e.preventDefault();

        if (diff > 0) {
            // Visual feedback: Move entire card up slightly with resistance
            if (card) card.style.transform = `translateY(${-diff / 3}px) scale(${1 - diff / 5000})`;
            if (swipeHint) swipeHint.style.opacity = Math.max(0, 1 - diff / 200);
        }
    };

    const handleEnd = (y) => {
        if (!isDragging) return;
        isDragging = false;

        const diff = startY - y;
        if (card) card.style.transition = 'all 0.6s cubic-bezier(0.22, 1, 0.36, 1)';

        // Threshold
        if (diff > 80) {
            // Success: Fly Up
            if (card) {
                card.style.transform = `translateY(-100vh) scale(0.8)`;
                card.style.opacity = '0';
            }
            if (swipeHint) swipeHint.style.opacity = '0';

            setTimeout(() => {
                container.classList.remove('active');

                // --- FLOW UPDATE: Check for Letter ---
                if (userData.hasLetter) {
                    showLetterOverlay();
                } else {
                    if (typeof startSquarePopups === 'function') {
                        startSquarePopups();
                    }
                }
            }, 300);
        } else {
            // Reset
            if (card) card.style.transform = '';
            if (swipeHint) swipeHint.style.opacity = '';
        }
    };

    // Force touch-action to prevent scrolling
    if (container) container.style.touchAction = 'none';

    // Remove old listeners
    container.ontouchstart = null;
    container.ontouchmove = null;
    container.ontouchend = null;
    container.onmousedown = null;

    // Robust Touch Listeners
    container.addEventListener('touchstart', (e) => handleStart(e.touches[0].clientY), { passive: false });
    container.addEventListener('touchmove', (e) => handleMove(e.touches[0].clientY, e), { passive: false });
    container.addEventListener('touchend', (e) => handleEnd(e.changedTouches[0].clientY));

    // Mouse
    container.addEventListener('mousedown', (e) => handleStart(e.clientY));

    // Global Mouse Handlers
    window.addEventListener('mousemove', (e) => { if (isDragging) handleMove(e.clientY, e); });
    window.addEventListener('mouseup', (e) => { if (isDragging) handleEnd(e.clientY); });
}

// Helper: Swipe Logic
function enableSwipeToOpen(overlayElement) {
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    const card = overlayElement.querySelector('.final-card');
    const swipeHint = overlayElement.querySelector('.swipe-hint-container');

    const handleStart = (y) => {
        startY = y;
        isDragging = true;
        card.style.transition = 'none';
    };

    const handleMove = (y) => {
        if (!isDragging) return;
        currentY = y;
        const diff = startY - currentY;

        if (diff > 0) {
            const moveY = -diff;
            card.style.transform = `translateY(${moveY}px) scale(${1 - diff / 3000})`;
            if (swipeHint) swipeHint.style.opacity = Math.max(0, 1 - diff / 200);
        }
    };

    const handleEnd = () => {
        if (!isDragging) return;
        isDragging = false;

        const diff = startY - currentY;
        card.style.transition = 'all 0.6s cubic-bezier(0.22, 1, 0.36, 1)';

        if (diff > 100) {
            card.style.transform = `translateY(-100vh) scale(0.8)`;
            card.style.opacity = '0';
            setTimeout(() => {
                overlayElement.classList.remove('active');
                initRevealPage();
            }, 300);
        } else {
            card.style.transform = '';
            if (swipeHint) swipeHint.style.opacity = '';
        }
    };

    overlayElement.addEventListener('touchstart', (e) => handleStart(e.touches[0].clientY), { passive: false });
    overlayElement.addEventListener('touchmove', (e) => {
        if (isDragging) e.preventDefault();
        handleMove(e.touches[0].clientY);
    }, { passive: false });
    overlayElement.addEventListener('touchend', handleEnd);

    overlayElement.addEventListener('mousedown', (e) => handleStart(e.clientY));
    window.addEventListener('mousemove', (e) => {
        if (isDragging) { e.preventDefault(); handleMove(e.clientY); }
    });
    window.addEventListener('mouseup', handleEnd);
}

// --- Final Greeting ---
function showFinalGreeting() {
    mainContainer.classList.add('fade-out');

    // Get elements
    const overlay = document.getElementById('finalPreviewOverlay');
    const timeGreeting = document.getElementById('finalTimeGreeting');
    const recipientName = document.getElementById('finalRecipientName');
    const giftMessage = document.getElementById('finalGiftMessage');
    const giftIcons = document.getElementById('finalGiftIcons');
    // const openBtn = document.getElementById('finalOpenBtn');

    // 1. Time Logic
    const hour = new Date().getHours();
    let greetingText = "你好";
    if (hour >= 5 && hour < 12) greetingText = "早上好";
    else if (hour >= 12 && hour < 18) greetingText = "下午好";
    else greetingText = "晚上好";

    timeGreeting.textContent = greetingText;

    // 2. Name Logic
    // User Explanation: "My name [Title] is the Friend's Name... Friend's Name [Sender] is User's Name"
    recipientName.textContent = userData.friendName || "朋友";

    // 3. Gift Logic (Music + Box are default = 2. If Letter = +1. Total 2 or 3)
    let giftCount = 2; // Default: Music + Box
    if (userData.hasLetter) giftCount = 3;

    // Construct the message: "你的朋友 [User] 给你准备了 [X] 个礼物"
    const sender = userData.userName || "神秘人";
    giftMessage.innerHTML = `
        你的朋友 <span class="highlight-text">${sender}</span> 给你准备了
        <span class="gift-count-badge">${giftCount}</span> 个礼物
    `;

    // 4. Icons Logic
    let iconsHtml = `
        <div class="gift-icon" title="专属音乐">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>
            </svg>
        </div>
        <div class="gift-icon" title="心意礼盒">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="12" y1="3" x2="12" y2="21"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
            </svg>
        </div>
    `;

    if (userData.hasLetter) {
        iconsHtml += `
            <div class="gift-icon" title="一封信">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
            </div>
        `;
    }
    giftIcons.innerHTML = iconsHtml;

    // 5. 初始隐藏提交按钮，等待用户完成预览后再显示
    const submitBtnContainer = document.querySelector('.final-action-buttons');
    if (submitBtnContainer) {
        submitBtnContainer.classList.remove('show');
    }

    // 6. 应用用户选择的背景
    if (userData.bgImage && userData.bgType) {
        applyBackground(userData.bgType, userData.bgImage);
    } else if (userData.bgType === 'white') {
        applyBackground('white');
    } else {
        applyBackground('default');
    }

    // 7. Show Overlay
    setTimeout(() => {
        mainContainer.style.display = 'none'; // Completely hide form
        overlay.classList.add('active');
        enableSwipeToOpen(overlay);
    }, 600);
}

function resetAnimation(element, delay = '0s') {
    element.style.animation = 'none';
    element.offsetHeight;
    element.style.animation = null;
    element.style.animation = `textReveal 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards ${delay}`;
}

// --- Reveal Page Logic (Added via CLI) ---
const giftRevealContainer = document.getElementById('giftRevealContainer');
const revealAlbumArt = document.getElementById('revealAlbumArt');
const revealTitle = document.getElementById('revealTitle');
const revealArtist = document.getElementById('revealArtist');
const revealCurrentTime = document.getElementById('revealCurrentTime');
const revealTotalTime = document.getElementById('revealTotalTime');
const revealProgressBar = document.getElementById('revealProgressBar');
const revealPlayBtn = document.getElementById('revealPlayBtn');
const revealNextBtn = document.getElementById('revealNextBtn');
const revealNextText = document.getElementById('revealNextText');

function initRevealPage() {
    // 1. Fill Data
    if (userData.music) {
        revealTitle.textContent = userData.music.title || "Unknown Track";
        revealArtist.textContent = userData.music.artist || "Unknown Artist";
        revealAlbumArt.src = userData.music.cover || "default-record.png";
    }

    // 2. Setup Audio
    const audio = document.getElementById('musicPreview');
    if (audio) {
        // Sync duration
        if (!isNaN(audio.duration)) {
            revealTotalTime.textContent = formatTime(audio.duration);
        }
        audio.onloadedmetadata = () => {
            revealTotalTime.textContent = formatTime(audio.duration);
        };

        // Sync Progress
        audio.ontimeupdate = () => {
            if (!isNaN(audio.duration)) {
                const percent = (audio.currentTime / audio.duration) * 100;
                revealProgressBar.style.width = percent + '%';
                revealCurrentTime.textContent = formatTime(audio.currentTime);
            }
        };

        // Set Start Time based on User Preference
        if (userData.playbackMode === 'highlight' && userData.startTime > 0) {
            audio.currentTime = userData.startTime;
        } else {
            audio.currentTime = 0;
        }

        // Play automatically
        audio.volume = 1.0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.then(_ => {
                updateRevealPlayBtnState(true);
            }).catch(error => {
                console.log("Autoplay prevented:", error);
                updateRevealPlayBtnState(false);
            });
        }

        // Play/Pause Click
        revealPlayBtn.onclick = () => {
            if (audio.paused) {
                audio.play();
                updateRevealPlayBtnState(true);
            } else {
                audio.pause();
                updateRevealPlayBtnState(false);
            }
        };
    }

    // 3. Setup Next Step (Swipe to Continue logic)
    const nextText = userData.hasLetter ? "向上滑动打开信件" : "向上滑动查看祝福";
    if (revealNextText) revealNextText.textContent = nextText;

    // Enable Swipe Logic on the Container
    enableSwipeToNext(giftRevealContainer);

    // 4. Show Interface
    giftRevealContainer.classList.add('active');

    // 5. Trigger Animations? handled by CSS .active class
}

function updateRevealPlayBtnState(isPlaying) {
    if (isPlaying) {
        giftRevealContainer.classList.add('playing');
        revealPlayBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
            </svg>`;
    } else {
        giftRevealContainer.classList.remove('playing');
        revealPlayBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
            </svg>`;
    }
}

// ============================================
// GIFT SUBMISSION - 提交礼物到服务器
// ============================================

const finalSubmitBtn = document.getElementById('finalSubmitBtn');
const shareModalOverlay = document.getElementById('shareModalOverlay');
const shareUrlInput = document.getElementById('shareUrlInput');
const copyShareUrl = document.getElementById('copyShareUrl');
const shareModalClose = document.getElementById('shareModalClose');

// 存储上传后的文件名
let uploadedBgFilename = null;

/**
 * 将 Base64 或 Blob URL 转换为 File 对象
 */
async function urlToFile(url, filename, mimeType) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new File([blob], filename, { type: mimeType || blob.type });
    } catch (error) {
        console.error('转换文件失败:', error);
        return null;
    }
}

/**
 * 上传背景文件
 */
async function uploadBackgroundFile() {
    if (!userData.bgImage || !userData.bgType || userData.bgType === 'default' || userData.bgType === 'white') {
        return null;
    }

    try {
        let file = userData.bgFile;
        if (!file) {
            const mimeType = userData.bgType === 'video' ? 'video/mp4' : 'image/jpeg';
            const ext = userData.bgType === 'video' ? 'mp4' : 'jpg';
            const filename = `bg_${Date.now()}.${ext}`;
            file = await urlToFile(userData.bgImage, filename, mimeType);
        }
        if (!file) return null;

        const formData = new FormData();
        formData.append('file', file);
        if (userData.bgType === 'video' && userData.videoVerifyCode) {
            formData.append('videoVerifyCode', userData.videoVerifyCode);
        }

        const response = await fetch('/api/gift/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (result.code === 200 && result.data) {
            return result.data.filename;
        }
        return null;
    } catch (error) {
        console.error('上传背景失败:', error);
        return null;
    }
}

/**
 * 提交礼物
 */
async function submitGift() {
    const btn = finalSubmitBtn;

    // 防止重复提交
    if (btn.classList.contains('loading') || btn.classList.contains('success')) {
        return;
    }

    // 停止小方框预览
    if (typeof stopSquarePopups === 'function') {
        stopSquarePopups();
    }

    // 设置加载状态
    btn.classList.add('loading');

    try {
        // 构建表单数据
        const formData = new FormData();
        formData.append('senderName', userData.userName || '神秘人');
        formData.append('recipientName', userData.friendName || '朋友');
        formData.append('boxColor', userData.color || '#4facfe');
        formData.append('blurLevel', userData.blur || 15);
        formData.append('bgType', userData.bgType || 'default');
        if (userData.bgType === 'video' && !userData.videoVerifyCode) {
            btn.classList.remove('loading');
            alert('请先完成视频验证码验证');
            return;
        }

        // 背景文件 - 直接附加到请求中
        let backgroundFile = userData.bgFile;
        if (!backgroundFile && userData.bgImage && (userData.bgType === 'image' || userData.bgType === 'video')) {
            const mimeType = userData.bgType === 'video' ? 'video/mp4' : 'image/jpeg';
            const ext = userData.bgType === 'video' ? 'mp4' : 'jpg';
            const filename = `bg_${Date.now()}.${ext}`;
            backgroundFile = await urlToFile(userData.bgImage, filename, mimeType);
        }

        if (userData.bgType === 'image') {
            const file = backgroundFile;
            if (!file) {
                btn.classList.remove('loading');
                alert('图片上传失败，请重新选择图片');
                return;
            }
            formData.append('photo', file);
            console.log('[Gift] Attaching image file:', file.name, file.size);
        } else if (userData.bgType === 'video') {
            const file = backgroundFile;
            if (!file) {
                btn.classList.remove('loading');
                alert('视频上传失败，请重新选择视频');
                return;
            }
            formData.append('video', file);
            console.log('[Gift] Attaching video file:', file.name, file.size);
            if (userData.videoVerifyCode) {
                formData.append('videoVerifyCode', userData.videoVerifyCode);
            }
            // 添加视频时长（用于服务器端验证）
            if (userData.videoDuration) {
                formData.append('videoDuration', userData.videoDuration);
            }
        }

        // 音乐信息
        if (userData.music) {
            formData.append('musicPlatform', userData.musicSource || 'netease');
            formData.append('musicId', userData.music.id || '');
            formData.append('musicTitle', userData.music.title || '');
            formData.append('musicArtist', userData.music.artist || '');
            formData.append('musicCoverUrl', userData.music.cover || '');
            formData.append('musicPlayUrl', userData.music.playUrl || '');
        }

        // 播放模式
        formData.append('playbackMode', userData.playbackMode || 'full');
        formData.append('startTime', userData.startTime || 0);

        // 祝福语
        formData.append('messageMode', userData.msgMode || 'official');
        formData.append('messageContent', userData.message || '');

        // 信件
        formData.append('hasLetter', userData.hasLetter);
        formData.append('letterContent', userData.letterContent || '');

        console.log('[Gift] Submitting gift with bgType:', userData.bgType);

        const response = await fetch('/api/gift/create', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.code === 200 && result.data) {
            // 成功
            btn.classList.remove('loading');
            btn.classList.add('success');
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                    <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>创建成功</span>
            `;

            // 显示分享模态框
            setTimeout(() => {
                showShareModal(result.data.giftCode);
            }, 500);

        } else if (result.code === 429) {
            // 每日限制达到上限
            btn.classList.remove('loading');
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                </svg>
                <span>今日次数已用完</span>
            `;
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.6';

            // 显示友好提示
            showDailyLimitAlert(result.message || result.error, result.data);

        } else if (result.code === 400) {
            // 验证失败
            btn.classList.remove('loading');
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <span>验证失败，请修正</span>
            `;

            // 显示验证错误弹窗
            showValidationErrorAlert(result.message || result.error, result.errors);

            // 3秒后恢复按钮
            setTimeout(() => {
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                        <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>提交礼物</span>
                `;
            }, 3000);

        } else {
            throw new Error(result.error || '提交失败');
        }

    } catch (error) {
        console.error('提交礼物失败:', error);
        btn.classList.remove('loading');
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>提交失败，点击重试</span>
        `;

        // 3秒后恢复按钮
        setTimeout(() => {
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                    <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>提交礼物</span>
            `;
        }, 3000);
    }
}

/**
 * 显示每日限制提示弹窗
 */
function showDailyLimitAlert(message, limitData) {
    // 创建弹窗元素
    const alertOverlay = document.createElement('div');
    alertOverlay.className = 'daily-limit-overlay';
    alertOverlay.innerHTML = `
        <div class="daily-limit-modal">
            <div class="daily-limit-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                </svg>
            </div>
            <h3 class="daily-limit-title">今日次数已用完</h3>
            <p class="daily-limit-message">${message}</p>
            <div class="daily-limit-stats">
                <span>已使用: <strong>${limitData?.used || '?'}/${limitData?.limit || '?'}</strong></span>
            </div>
            <button class="daily-limit-btn">我知道了</button>
        </div>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .daily-limit-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            animation: fadeIn 0.3s ease;
        }
        .daily-limit-modal {
            background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 40px;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            animation: modalSlideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .daily-limit-icon {
            margin-bottom: 20px;
            color: #f59e0b;
        }
        .daily-limit-icon svg {
            filter: drop-shadow(0 0 20px rgba(245, 158, 11, 0.5));
        }
        .daily-limit-title {
            font-size: 1.5rem;
            font-weight: 700;
            color: #fff;
            margin: 0 0 12px 0;
        }
        .daily-limit-message {
            font-size: 0.95rem;
            color: rgba(255, 255, 255, 0.7);
            line-height: 1.6;
            margin: 0 0 20px 0;
        }
        .daily-limit-stats {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            padding: 12px;
            margin-bottom: 24px;
            color: rgba(255, 255, 255, 0.8);
        }
        .daily-limit-stats strong {
            color: #f59e0b;
        }
        .daily-limit-btn {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            border: none;
            border-radius: 12px;
            padding: 14px 40px;
            font-size: 1rem;
            font-weight: 600;
            color: #fff;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .daily-limit-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px -10px rgba(79, 172, 254, 0.5);
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes modalSlideUp {
            from { opacity: 0; transform: translateY(30px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
    `;
    document.head.appendChild(style);

    // 添加到页面
    document.body.appendChild(alertOverlay);

    // 绑定关闭事件
    const closeBtn = alertOverlay.querySelector('.daily-limit-btn');
    closeBtn.addEventListener('click', () => {
        alertOverlay.style.animation = 'fadeIn 0.3s ease reverse';
        setTimeout(() => {
            alertOverlay.remove();
            style.remove();
        }, 300);
    });

    // 点击背景也可关闭
    alertOverlay.addEventListener('click', (e) => {
        if (e.target === alertOverlay) {
            alertOverlay.style.animation = 'fadeIn 0.3s ease reverse';
            setTimeout(() => {
                alertOverlay.remove();
                style.remove();
            }, 300);
        }
    });
}

/**
 * 显示验证错误提示弹窗
 */
function showValidationErrorAlert(message, errors) {
    // 构建错误列表 HTML
    let errorsHtml = '';
    if (errors && errors.length > 0) {
        errorsHtml = `
            <ul class="validation-error-list">
                ${errors.map(err => `<li>${err}</li>`).join('')}
            </ul>
        `;
    }

    // 创建弹窗元素
    const alertOverlay = document.createElement('div');
    alertOverlay.className = 'validation-error-overlay';
    alertOverlay.innerHTML = `
        <div class="validation-error-modal">
            <div class="validation-error-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
            </div>
            <h3 class="validation-error-title">提交内容不符合要求</h3>
            <p class="validation-error-message">${errorsHtml || message}</p>
            <div class="validation-error-tips">
                <strong>温馨提示：</strong>
                <ul>
                    <li>名字不能超过 6 个字符</li>
                    <li>图片不能超过 3MB</li>
                    <li>视频不能超过 20MB 或 15 秒</li>
                </ul>
            </div>
            <button class="validation-error-btn">我知道了</button>
        </div>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .validation-error-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            animation: fadeIn 0.3s ease;
        }
        .validation-error-modal {
            background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 40px;
            max-width: 450px;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            animation: modalSlideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .validation-error-icon {
            margin-bottom: 20px;
            color: #ef4444;
        }
        .validation-error-icon svg {
            filter: drop-shadow(0 0 20px rgba(239, 68, 68, 0.5));
        }
        .validation-error-title {
            font-size: 1.5rem;
            font-weight: 700;
            color: #fff;
            margin: 0 0 16px 0;
        }
        .validation-error-message {
            font-size: 0.95rem;
            color: rgba(255, 255, 255, 0.7);
            line-height: 1.6;
            margin: 0 0 20px 0;
            text-align: left;
        }
        .validation-error-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .validation-error-list li {
            padding: 8px 12px;
            margin: 6px 0;
            background: rgba(239, 68, 68, 0.15);
            border-left: 3px solid #ef4444;
            border-radius: 0 8px 8px 0;
            color: #fca5a5;
        }
        .validation-error-tips {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            padding: 16px;
            margin-bottom: 24px;
            text-align: left;
            font-size: 0.9rem;
            color: rgba(255, 255, 255, 0.6);
        }
        .validation-error-tips strong {
            color: rgba(255, 255, 255, 0.8);
            display: block;
            margin-bottom: 8px;
        }
        .validation-error-tips ul {
            margin: 0;
            padding-left: 20px;
        }
        .validation-error-tips li {
            margin: 4px 0;
        }
        .validation-error-btn {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            border: none;
            border-radius: 12px;
            padding: 14px 40px;
            font-size: 1rem;
            font-weight: 600;
            color: #fff;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .validation-error-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px -10px rgba(239, 68, 68, 0.5);
        }
    `;
    document.head.appendChild(style);

    // 添加到页面
    document.body.appendChild(alertOverlay);

    // 绑定关闭事件
    const closeBtn = alertOverlay.querySelector('.validation-error-btn');
    closeBtn.addEventListener('click', () => {
        alertOverlay.style.animation = 'fadeIn 0.3s ease reverse';
        setTimeout(() => {
            alertOverlay.remove();
            style.remove();
        }, 300);
    });

    // 点击背景也可关闭
    alertOverlay.addEventListener('click', (e) => {
        if (e.target === alertOverlay) {
            alertOverlay.style.animation = 'fadeIn 0.3s ease reverse';
            setTimeout(() => {
                alertOverlay.remove();
                style.remove();
            }, 300);
        }
    });
}

/**
 * 显示分享模态框
 */
function showShareModal(giftCode) {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/gift/${giftCode}`;

    shareUrlInput.value = shareUrl;
    shareModalOverlay.classList.add('active');
}

/**
 * 隐藏分享模态框
 */
function hideShareModal() {
    shareModalOverlay.classList.remove('active');
}

/**
 * 复制分享链接
 */
function copyShareLink() {
    shareUrlInput.select();
    shareUrlInput.setSelectionRange(0, 99999); // 移动端兼容

    try {
        navigator.clipboard.writeText(shareUrlInput.value).then(() => {
            copyShareUrl.textContent = '已复制!';
            setTimeout(() => {
                copyShareUrl.textContent = '复制';
            }, 2000);
        });
    } catch (err) {
        // Fallback
        document.execCommand('copy');
        copyShareUrl.textContent = '已复制!';
        setTimeout(() => {
            copyShareUrl.textContent = '复制';
        }, 2000);
    }
}

// 事件监听
if (finalSubmitBtn) {
    finalSubmitBtn.addEventListener('click', submitGift);
}

if (copyShareUrl) {
    copyShareUrl.addEventListener('click', copyShareLink);
}

if (shareModalClose) {
    shareModalClose.addEventListener('click', hideShareModal);
}

// 点击模态框背景关闭
if (shareModalOverlay) {
    shareModalOverlay.addEventListener('click', (e) => {
        if (e.target === shareModalOverlay) {
            hideShareModal();
        }
    });
}

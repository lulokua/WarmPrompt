// ============================================
// DONATION.JS - 捐款流程逻辑
// ============================================

// --- DOM Elements ---
const qqMusicModal = document.getElementById('qqMusicModal');
const qqMusicClose = document.getElementById('qqMusicClose');
const qqMusicDonate = document.getElementById('qqMusicDonate');
const qqMusicCancel = document.getElementById('qqMusicCancel');
const sadModal = document.getElementById('sadModal');
const sadClose = document.getElementById('sadClose');
const sadDonate = document.getElementById('sadDonate');
const sadCancel = document.getElementById('sadCancel');
const donateModal = document.getElementById('donateModal');
const donateClose = document.getElementById('donateClose');
const btnWechat = document.getElementById('btnWechat');
const btnAlipay = document.getElementById('btnAlipay');
const donateQrImg = document.getElementById('donateQrImg');
const saveQrBtn = document.getElementById('saveQrBtn');

// --- State ---
let qqMusicUnlocked = false;

// --- QR Codes ---
const WECHAT_QR = 'https://my-blog.cn-nb1.rains3.com/WarmPrompt_v4.0/%E5%BE%AE%E4%BF%A1.png';
const ALIPAY_QR = 'https://my-blog.cn-nb1.rains3.com/WarmPrompt_v4.0/%E6%94%AF%E4%BB%98%E5%AE%9D.png';

// --- Modal Functions ---
function showQqMusicModal() {
    if (qqMusicModal) qqMusicModal.classList.add('active');
}

function hideQqMusicModal() {
    if (qqMusicModal) qqMusicModal.classList.remove('active');
}

function showSadModal() {
    if (sadModal) sadModal.classList.add('active');
}

function hideSadModal() {
    if (sadModal) sadModal.classList.remove('active');
}

function showDonateModal() {
    if (donateModal) {
        donateModal.classList.add('active');
        setDonateType('wechat');
    }
}

function hideDonateModal() {
    if (donateModal) donateModal.classList.remove('active');
}

// --- Donate Type ---
function setDonateType(type) {
    if (type === 'wechat') {
        btnWechat.classList.add('active');
        btnAlipay.classList.remove('active');
        donateQrImg.src = WECHAT_QR;
    } else {
        btnAlipay.classList.add('active');
        btnWechat.classList.remove('active');
        donateQrImg.src = ALIPAY_QR;
    }
}

// --- Download QR Code ---
async function downloadQrCode() {
    if (!donateQrImg.src) return;

    const originalText = saveQrBtn.textContent;
    saveQrBtn.textContent = "保存中...";
    saveQrBtn.disabled = true;

    try {
        const response = await fetch(donateQrImg.src);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = btnWechat.classList.contains('active') ? 'wechat_donate.png' : 'alipay_donate.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        saveQrBtn.textContent = "保存成功！";
    } catch (e) {
        console.error('Download error:', e);
        const link = document.createElement('a');
        link.href = donateQrImg.src;
        link.download = btnWechat.classList.contains('active') ? 'wechat_donate.png' : 'alipay_donate.png';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        saveQrBtn.textContent = "保存成功！";
    }

    setTimeout(() => {
        saveQrBtn.textContent = originalText;
        saveQrBtn.disabled = false;
    }, 2000);

    // 3 seconds delay to enter QQ Music
    setTimeout(() => {
        hideDonateModal();
        qqMusicUnlocked = true;
        setMusicSource('qq');
    }, 3000);
}

// --- Event Listeners ---
if (qqMusicClose) qqMusicClose.addEventListener('click', hideQqMusicModal);
if (qqMusicDonate) qqMusicDonate.addEventListener('click', () => { hideQqMusicModal(); showDonateModal(); });
if (qqMusicCancel) qqMusicCancel.addEventListener('click', () => { hideQqMusicModal(); showSadModal(); });

if (sadClose) sadClose.addEventListener('click', hideSadModal);
if (sadCancel) sadCancel.addEventListener('click', () => {
    hideSadModal();
    qqMusicUnlocked = true;
    setMusicSource('qq');
});
if (sadDonate) sadDonate.addEventListener('click', () => { hideSadModal(); showDonateModal(); });

if (donateClose) donateClose.addEventListener('click', hideDonateModal);
if (btnWechat) btnWechat.addEventListener('click', () => setDonateType('wechat'));
if (btnAlipay) btnAlipay.addEventListener('click', () => setDonateType('alipay'));
if (saveQrBtn) saveQrBtn.addEventListener('click', downloadQrCode);

// Close on outside click
window.addEventListener('click', (e) => {
    if (e.target === qqMusicModal) hideQqMusicModal();
    if (e.target === sadModal) hideSadModal();
    if (e.target === donateModal) hideDonateModal();
});

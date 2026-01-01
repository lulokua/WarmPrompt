// ============================================
// MESSAGE.JS - 消息选择器逻辑
// ============================================

// --- DOM Elements ---
const messagePicker = document.getElementById('messagePicker');
const msgModeBtns = document.querySelectorAll('[data-msg-mode]');
const officialMessageContent = document.getElementById('officialMessageContent');
const customMessageContent = document.getElementById('customMessageContent');
const customMessageInput = document.getElementById('customMessageInput');
const messageValidation = document.getElementById('messageValidation');
const refreshQuoteBtn = document.getElementById('refreshQuoteBtn');
const officialQuotePreview = document.getElementById('officialQuotePreview');

// --- Official Quotes ---
const officialQuotes = [
    "记得多喝水哦", "今天也要开心", "不要太辛苦了", "累了就休息一下", "你很重要", "相信你可以的", "加油，我在你身边", "别担心，一切都会好的", "你值得被温柔对待", "保重身体", "记得按时吃饭", "早点休息", "别给自己太大压力", "慢慢来，不着急", "你已经做得很好了", "记得照顾好自己", "困难只是暂时的", "明天会更好", "你不是一个人", "有我陪着你", "遇到困难记得找我", "你的努力我都看到了", "不开心就和我说", "我会一直支持你", "你很棒", "相信自己", "给自己一个拥抱", "今天的你也很可爱", "记得微笑", "别忘了你的梦想", "慢慢来就好", "不要太勉强自己", "心情不好就出去走走", "晒晒太阳", "听听喜欢的音乐", "做自己喜欢的事", "允许自己偶尔放松", "你的感受很重要", "不要忽视自己的需要", "学会说不", "保护好自己", "你值得被爱", "记得你有多珍贵", "今天也辛苦了", "谢谢你这么努力", "看到你的进步真开心", "为你感到骄傲", "你的存在就是意义", "记得深呼吸", "放松肩膀", "让自己舒服一点", "做让你快乐的事", "今天给自己一个小奖励", "你配得上美好的事物", "相信美好会发生", "保持希望", "一切都会过去的", "风雨过后见彩虹", "黑暗终会过去", "光明就在前方", "不要放弃", "再坚持一下", "你比你想象的更强大", "相信时间的力量", "给自己多一点时间", "成长需要过程", "接纳现在的自己", "你一直在进步", "每一天都是新的开始", "过去的就让它过去", "专注当下", "珍惜此刻", "享受生活", "感受周围的美好", "留意小确幸", "记录美好瞬间", "对自己好一点", "温柔地对待自己", "你很特别", "独一无二的你", "做真实的自己就好", "不需要伪装", "你本来的样子就很好", "接受不完美", "人无完人", "犯错也没关系", "失败是成长的一部分", "从错误中学习", "给自己第二次机会", "允许自己重新开始", "永远不晚", "相信自己的选择", "听从内心的声音", "做让自己不后悔的决定", "勇敢一点", "尝试新事物", "走出舒适区", "但也要量力而行", "保持平衡", "工作与生活都重要", "记得留时间给自己"
];

// --- Functions ---
function updateStep7UI() {
    questionTitle.childNodes[0].nodeValue = "方框内容";
    questionSubtitle.textContent = "方框的内容";
    questionSubtitle.style.color = '#000000';
    questionSubtitle.style.textShadow = 'none';

    nameInput.style.display = 'none';
    colorPicker.classList.remove('active');
    opacityPicker.classList.remove('active');
    bgImagePicker.classList.remove('active');
    musicPicker.classList.remove('active');
    playbackPicker.classList.remove('active');
    document.getElementById('letterPicker').classList.remove('active');
    messagePicker.classList.add('active');

    prevBtn.classList.add('visible');
    submitBtn.classList.add('active');

    // 重置背景为白色
    applyBackground('white');

    if (!userData.message && userData.msgMode === 'official') {
        // pickRandomQuote(); // Removed
    }
    updateMessageModeUI();
}

function updateMessageModeUI() {
    const isOfficial = userData.msgMode === 'official';

    msgModeBtns.forEach(btn => {
        if (btn.getAttribute('data-msg-mode') === userData.msgMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (isOfficial) {
        officialMessageContent.style.display = 'flex';
        customMessageContent.style.display = 'none';

        // Use all quotes joined together
        const allQuotes = officialQuotes.join('  ');
        userData.message = allQuotes;
        officialQuotePreview.textContent = allQuotes;

        // Hide refresh button since it's all content
        if (refreshQuoteBtn) refreshQuoteBtn.style.display = 'none';
    } else {
        officialMessageContent.style.display = 'none';
        customMessageContent.style.display = 'flex';
        customMessageInput.value = userData.message || '';
        validateCustomMessage();

        // Restore/Reset refresh button visibility if needed (though it's in official content div)
        if (refreshQuoteBtn) refreshQuoteBtn.style.display = 'flex';
    }
}

// Removed pickRandomQuote logic since we use all content now


function validateCustomMessage() {
    const text = customMessageInput.value;
    const lines = text.split('\n');
    let isValid = true;
    let errorMsg = '';

    if (lines.length > 40) {
        isValid = false;
        errorMsg = `行数过多 (${lines.length}/40)`;
    } else {
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].length > 6) {
                isValid = false;
                errorMsg = `第 ${i + 1} 行超过 6 个字`;
                break;
            }
        }
    }

    if (isValid) {
        userData.message = text;
        messageValidation.textContent = `格式正确 (${lines.length} 行)`;
        messageValidation.className = 'validation-status success';
        submitBtn.classList.add('active');
        submitBtn.disabled = false;
    } else {
        messageValidation.textContent = errorMsg;
        messageValidation.className = 'validation-status error';
        submitBtn.classList.remove('active');
    }
    return isValid;
}

// --- Event Listeners ---
msgModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        userData.msgMode = btn.getAttribute('data-msg-mode');
        if (userData.msgMode !== 'official') {
            userData.message = customMessageInput.value;
        }
        updateMessageModeUI();
    });
});


// refreshQuoteBtn.addEventListener('click', pickRandomQuote);

customMessageInput.addEventListener('input', () => {
    validateCustomMessage();
});

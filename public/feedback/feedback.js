(() => {
  const form = document.getElementById("feedback-form");
  if (!form) return;

  const listSection = document.getElementById("feedback-list-section");
  const formSection = document.getElementById("feedback-form-section");
  const detailSection = document.getElementById("feedback-detail");
  const addButton = document.getElementById("feedback-add");
  const backButton = document.getElementById("feedback-back");
  const cancelButton = document.getElementById("feedback-cancel");
  const listEl = document.getElementById("feedback-list");
  const loadingEl = document.getElementById("feedback-loading");
  const emptyEl = document.getElementById("feedback-empty");
  const emptyDefaultText = emptyEl ? emptyEl.textContent : "";
  const totalEl = document.getElementById("feedback-total");
  const detailBackButton = document.getElementById("detail-back");
  const detailLikeButton = document.getElementById("detail-like");
  const detailLikeCount = document.getElementById("detail-like-count");
  const detailType = document.getElementById("detail-type");
  const detailDate = document.getElementById("detail-date");
  const detailTitle = document.getElementById("detail-title");
  const detailContent = document.getElementById("detail-content");
  const detailMeta = document.getElementById("detail-meta");
  const detailCommentCount = document.getElementById("detail-comment-count");
  const detailCommentsList = document.getElementById("detail-comments-list");
  const detailCommentForm = document.getElementById("detail-comment-form");
  const detailCommentName = document.getElementById("detail-comment-name");
  const detailCommentInput = document.getElementById("detail-comment-input");
  const detailCommentStatus = document.getElementById("detail-comment-status");
  const detailCommentSubmit = document.getElementById("detail-comment-submit");

  const typeInput = document.getElementById("feedback-type");
  const typeButtons = Array.from(document.querySelectorAll(".chip"));
  const titleInput = document.getElementById("feedback-title");
  const contentInput = document.getElementById("feedback-content");
  const contentCount = document.getElementById("content-count");
  const contactTypeSelect = document.getElementById("feedback-contact-type");
  const contactInput = document.getElementById("feedback-contact");
  const deviceInput = document.getElementById("feedback-device");
  const pageInput = document.getElementById("feedback-page");
  const submitButton = document.getElementById("feedback-submit");
  const resetButton = document.getElementById("feedback-reset");
  const statusEl = document.getElementById("feedback-status");

  const MAX_CONTENT = contentInput
    ? parseInt(contentInput.getAttribute("maxlength") || "2000", 10)
    : 2000;
  const MAX_COMMENT = detailCommentInput
    ? parseInt(detailCommentInput.getAttribute("maxlength") || "500", 10)
    : 500;

  const TYPE_LABELS = {
    suggestion: "建议优化",
    bug: "Bug 报告",
    experience: "使用体验",
    other: "其他"
  };

  let currentDetailId = null;
  const EMOJIS = [
    "😀","😄","😁","😊","😍","🥰","😘","😜",
    "🤔","😅","😂","🤣","😇","🙂","🙃","😉",
    "😌","😎","😭","😤","😡","🤯","🥳","😴",
    "👍","👏","🙏","💪","💡","🔥","🌟","🎉",
    "❤️","💖","💔","✅","⚠️","🎯","🧠","📌"
  ];

  function showListView() {
    if (listSection) listSection.classList.remove("is-hidden");
    if (formSection) formSection.classList.add("is-hidden");
    if (detailSection) detailSection.classList.add("is-hidden");
    if (detailSection) detailSection.setAttribute("aria-hidden", "true");
    currentDetailId = null;
    closeEmojiPanels();
    setStatus("");
  }

  function showFormView() {
    if (listSection) listSection.classList.add("is-hidden");
    if (formSection) formSection.classList.remove("is-hidden");
    if (detailSection) detailSection.classList.add("is-hidden");
    if (detailSection) detailSection.setAttribute("aria-hidden", "true");
    currentDetailId = null;
    closeEmojiPanels();
  }

  function showDetailView() {
    if (listSection) listSection.classList.add("is-hidden");
    if (formSection) formSection.classList.add("is-hidden");
    if (detailSection) detailSection.classList.remove("is-hidden");
    if (detailSection) detailSection.setAttribute("aria-hidden", "false");
    closeEmojiPanels();
  }

  function setStatus(message, tone) {
    if (!statusEl) return;
    if (!message) {
      statusEl.textContent = "";
      statusEl.classList.remove("is-visible");
      statusEl.removeAttribute("data-tone");
      return;
    }
    statusEl.textContent = message;
    statusEl.classList.add("is-visible");
    if (tone) {
      statusEl.setAttribute("data-tone", tone);
    } else {
      statusEl.removeAttribute("data-tone");
    }
  }

  function setLoading(isLoading) {
    if (submitButton) submitButton.disabled = isLoading;
    if (resetButton) resetButton.disabled = isLoading;
  }

  function setDetailStatus(message, tone) {
    if (!detailCommentStatus) return;
    if (!message) {
      detailCommentStatus.textContent = "";
      detailCommentStatus.classList.remove("is-visible");
      detailCommentStatus.removeAttribute("data-tone");
      return;
    }
    detailCommentStatus.textContent = message;
    detailCommentStatus.classList.add("is-visible");
    if (tone) {
      detailCommentStatus.setAttribute("data-tone", tone);
    } else {
      detailCommentStatus.removeAttribute("data-tone");
    }
  }

  function updateCount() {
    if (!contentInput || !contentCount) return;
    const length = contentInput.value.length;
    contentCount.textContent = `${length}/${MAX_CONTENT}`;
  }

  function setType(type) {
    const nextType = type || "suggestion";
    if (typeInput) {
      typeInput.value = nextType;
    }
    typeButtons.forEach((button) => {
      const isActive = button.dataset.type === nextType;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-checked", isActive ? "true" : "false");
    });
  }

  function resolvePagePath() {
    if (document.referrer) {
      try {
        return new URL(document.referrer).pathname;
      } catch (error) {
        return document.referrer;
      }
    }
    return window.location.pathname;
  }

  function resolveDeviceHint() {
    if (navigator.userAgentData && navigator.userAgentData.platform) {
      return navigator.userAgentData.platform;
    }
    if (navigator.platform) {
      return navigator.platform;
    }
    return "";
  }

  function fillDefaults() {
    if (pageInput) {
      pageInput.value = resolvePagePath();
    }
    if (deviceInput && !deviceInput.value) {
      deviceInput.value = resolveDeviceHint();
    }
  }

  function formatDate(value) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    const pad = (num) => String(num).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function createMetaItem(label, value) {
    if (!value) return null;
    const span = document.createElement("span");
    span.className = "feedback-meta-item";
    span.textContent = `${label}：${value}`;
    return span;
  }

  function setLikeButtonState(isLiked, likeCount) {
    if (!detailLikeButton) return;
    detailLikeButton.classList.toggle("is-active", isLiked);
    detailLikeButton.setAttribute("aria-pressed", isLiked ? "true" : "false");
    if (detailLikeCount) {
      detailLikeCount.textContent = String(likeCount || 0);
    }
  }

  function insertEmoji(targetId, emoji) {
    const textarea = document.getElementById(targetId);
    if (!textarea) return;
    const start = typeof textarea.selectionStart === "number" ? textarea.selectionStart : textarea.value.length;
    const end = typeof textarea.selectionEnd === "number" ? textarea.selectionEnd : textarea.value.length;
    const value = textarea.value || "";
    textarea.value = value.slice(0, start) + emoji + value.slice(end);
    const nextPos = start + emoji.length;
    if (textarea.setSelectionRange) {
      textarea.setSelectionRange(nextPos, nextPos);
    }
    textarea.focus();
    if (textarea === contentInput) {
      updateCount();
    }
  }

  function buildEmojiPanel(panel) {
    if (!panel || panel.dataset.ready) return;
    panel.innerHTML = "";
    EMOJIS.forEach((emoji) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "emoji-button";
      btn.textContent = emoji;
      btn.addEventListener("click", () => {
        const targetId = panel.dataset.target;
        if (targetId) {
          insertEmoji(targetId, emoji);
        }
        closeEmojiPanels();
      });
      panel.appendChild(btn);
    });
    panel.dataset.ready = "true";
  }

  function closeEmojiPanels() {
    const panels = document.querySelectorAll(".emoji-panel.is-open");
    panels.forEach((panel) => {
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
      const toggle = document.querySelector(`.emoji-toggle[data-target="${panel.dataset.target}"]`);
      if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  function toggleEmojiPanel(toggle) {
    const targetId = toggle.dataset.target;
    const panel = document.querySelector(`.emoji-panel[data-target="${targetId}"]`);
    if (!panel) return;
    buildEmojiPanel(panel);
    const isOpen = panel.classList.contains("is-open");
    closeEmojiPanels();
    if (!isOpen) {
      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      toggle.setAttribute("aria-expanded", "true");
    }
  }

  function renderComments(comments, totalCount) {
    if (!detailCommentsList) return;
    detailCommentsList.innerHTML = "";

    const count = Number.isFinite(Number(totalCount)) ? Number(totalCount) : comments.length;
    if (detailCommentCount) {
      detailCommentCount.textContent = `共 ${count} 条`;
    }

    if (!comments || comments.length === 0) {
      const empty = document.createElement("div");
      empty.className = "feedback-empty";
      empty.textContent = "暂无评论，来说两句吧。";
      detailCommentsList.appendChild(empty);
      return;
    }

    comments.forEach((comment) => {
      const item = document.createElement("div");
      item.className = "comment-item";
      item.dataset.commentId = String(comment.comment_id);

      const head = document.createElement("div");
      head.className = "comment-head";

      const name = document.createElement("span");
      name.className = "comment-name";
      name.textContent = comment.author_name ? String(comment.author_name) : "匿名用户";

      const date = document.createElement("span");
      date.className = "comment-date";
      date.textContent = formatDate(comment.created_at);

      head.appendChild(name);
      head.appendChild(date);

      const content = document.createElement("div");
      content.className = "comment-content";
      content.textContent = comment.comment_content || "";

      const actions = document.createElement("div");
      actions.className = "comment-actions";

      const likeBtn = document.createElement("button");
      likeBtn.className = "comment-like";
      likeBtn.dataset.commentId = String(comment.comment_id);
      likeBtn.setAttribute("aria-pressed", comment.liked ? "true" : "false");
      if (comment.liked) {
        likeBtn.classList.add("is-active");
      }
      const likeCount = Number.isFinite(Number(comment.like_count)) ? Number(comment.like_count) : 0;
      likeBtn.textContent = `赞 ${likeCount}`;

      actions.appendChild(likeBtn);

      item.appendChild(head);
      item.appendChild(content);
      item.appendChild(actions);

      detailCommentsList.appendChild(item);
    });
  }

  function renderDetail(data) {
    if (!data || !data.feedback) return;
    const feedback = data.feedback;
    const comments = Array.isArray(data.comments) ? data.comments : [];

    if (detailType) {
      detailType.textContent = TYPE_LABELS[feedback.feedback_type] || "反馈";
    }
    if (detailDate) {
      detailDate.textContent = formatDate(feedback.created_at);
    }
    if (detailTitle) {
      const title = feedback.feedback_title ? String(feedback.feedback_title).trim() : "";
      detailTitle.textContent = title || "（无标题）";
    }
    if (detailContent) {
      detailContent.textContent = feedback.feedback_content || "";
    }
    if (detailMeta) {
      detailMeta.innerHTML = "";
      const contact = feedback.contact_value
        ? `${feedback.contact_type || "联系"} ${feedback.contact_value}`
        : "";
      const metaItems = [
        createMetaItem("页面", feedback.page_path),
        createMetaItem("设备", feedback.device_info),
        createMetaItem("联系方式", contact)
      ].filter(Boolean);
      metaItems.forEach((node) => detailMeta.appendChild(node));
    }

    setLikeButtonState(Boolean(data.liked), feedback.like_count || 0);
    renderComments(comments, feedback.comment_count);
  }

  function renderFeedbackList(items, total) {
    if (!listEl) return;
    listEl.innerHTML = "";

    if (totalEl) {
      totalEl.textContent = `共 ${total} 条`;
    }

    if (!items || items.length === 0) {
      if (emptyEl) emptyEl.classList.remove("is-hidden");
      return;
    }

    if (emptyEl) {
      emptyEl.textContent = emptyDefaultText;
      emptyEl.classList.add("is-hidden");
    }

    items.forEach((item) => {
      const card = document.createElement("article");
      card.className = "feedback-item";
      card.dataset.id = String(item.feedback_id || "");

      const head = document.createElement("div");
      head.className = "feedback-item-head";

      const badge = document.createElement("span");
      badge.className = "feedback-badge";
      badge.textContent = TYPE_LABELS[item.feedback_type] || "反馈";

      const date = document.createElement("span");
      date.className = "feedback-item-date";
      date.textContent = formatDate(item.created_at);

      head.appendChild(badge);
      head.appendChild(date);

      const title = document.createElement("div");
      title.className = "feedback-item-title";
      const safeTitle = item.feedback_title ? String(item.feedback_title).trim() : "";
      title.textContent = safeTitle || "（无标题）";

      const content = document.createElement("div");
      content.className = "feedback-item-content";
      content.textContent = item.feedback_content || "";

      const meta = document.createElement("div");
      meta.className = "feedback-item-meta";
      const contact = item.contact_value
        ? `${item.contact_type || "联系"} ${item.contact_value}`
        : "";
      const likeCount = Number.isFinite(Number(item.like_count)) ? Number(item.like_count) : 0;
      const commentCount = Number.isFinite(Number(item.comment_count)) ? Number(item.comment_count) : 0;

      const metaItems = [
        createMetaItem("页面", item.page_path),
        createMetaItem("设备", item.device_info),
        createMetaItem("联系方式", contact),
        createMetaItem("点赞", String(likeCount)),
        createMetaItem("评论", String(commentCount))
      ].filter(Boolean);

      metaItems.forEach((node) => meta.appendChild(node));

      card.appendChild(head);
      card.appendChild(title);
      card.appendChild(content);
      if (metaItems.length > 0) {
        card.appendChild(meta);
      }

      listEl.appendChild(card);
    });
  }

  function setListLoading(isLoading) {
    if (loadingEl) {
      loadingEl.classList.toggle("is-hidden", !isLoading);
    }
  }

  async function loadFeedbackList() {
    setListLoading(true);
    if (emptyEl) emptyEl.classList.add("is-hidden");
    if (listEl) listEl.innerHTML = "";

    try {
      const response = await fetch("/api/feedback/list?limit=5000");
      if (!response.ok) {
        throw new Error("Bad response");
      }
      const data = await response.json();
      const items = data && data.data && Array.isArray(data.data.items) ? data.data.items : [];
      const total = data && data.data && Number.isFinite(Number(data.data.total))
        ? Number(data.data.total)
        : items.length;
      renderFeedbackList(items, total);
    } catch (error) {
      if (emptyEl) {
        emptyEl.textContent = "加载失败，请稍后刷新。";
        emptyEl.classList.remove("is-hidden");
      }
      if (totalEl) {
        totalEl.textContent = "共 0 条";
      }
    } finally {
      setListLoading(false);
    }
  }

  async function loadDetail(feedbackId) {
    if (!detailCommentsList) return;
    detailCommentsList.innerHTML = "";
    const loading = document.createElement("div");
    loading.className = "feedback-loading";
    loading.textContent = "正在加载详情...";
    detailCommentsList.appendChild(loading);

    try {
      const response = await fetch(`/api/feedback/detail?id=${encodeURIComponent(feedbackId)}`);
      if (!response.ok) {
        throw new Error("Bad response");
      }
      const data = await response.json();
      if (!data || data.success === false) {
        throw new Error("Bad data");
      }
      renderDetail(data.data);
    } catch (error) {
      if (detailCommentsList) {
        detailCommentsList.innerHTML = "";
        const empty = document.createElement("div");
        empty.className = "feedback-empty";
        empty.textContent = "加载失败，请稍后重试。";
        detailCommentsList.appendChild(empty);
      }
    }
  }

  async function toggleFeedbackLike() {
    if (!currentDetailId) return;
    if (!detailLikeButton) return;
    detailLikeButton.disabled = true;
    try {
      const response = await fetch("/api/feedback/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackId: currentDetailId })
      });
      if (!response.ok) {
        throw new Error("Bad response");
      }
      const data = await response.json();
      if (!data || data.success === false) {
        throw new Error("Bad data");
      }
      setLikeButtonState(Boolean(data.data.liked), data.data.likeCount || 0);
      loadFeedbackList();
    } catch (error) {
      // ignore
    } finally {
      detailLikeButton.disabled = false;
    }
  }

  async function toggleCommentLike(commentId, button) {
    if (!commentId) return;
    if (button) button.disabled = true;
    try {
      const response = await fetch("/api/feedback/comment/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId })
      });
      if (!response.ok) {
        throw new Error("Bad response");
      }
      const data = await response.json();
      if (!data || data.success === false) {
        throw new Error("Bad data");
      }
      const liked = Boolean(data.data.liked);
      const likeCount = Number.isFinite(Number(data.data.likeCount)) ? Number(data.data.likeCount) : 0;
      if (button) {
        button.classList.toggle("is-active", liked);
        button.setAttribute("aria-pressed", liked ? "true" : "false");
        button.textContent = `赞 ${likeCount}`;
      }
    } catch (error) {
      // ignore
    } finally {
      if (button) button.disabled = false;
    }
  }

  typeButtons.forEach((button) => {
    button.addEventListener("click", () => setType(button.dataset.type));
  });

  if (contentInput) {
    contentInput.addEventListener("input", updateCount);
  }

  if (addButton) {
    addButton.addEventListener("click", () => {
      showFormView();
    });
  }

  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      showListView();
    });
  }

  if (listEl) {
    listEl.addEventListener("click", (event) => {
      const card = event.target.closest(".feedback-item");
      if (!card || !card.dataset.id) return;
      currentDetailId = Number(card.dataset.id);
      if (!currentDetailId) return;
      showDetailView();
      loadDetail(currentDetailId);
    });
  }

  const emojiToggles = document.querySelectorAll(".emoji-toggle");
  emojiToggles.forEach((toggle) => {
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleEmojiPanel(toggle);
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".emoji-toolbar")) {
      closeEmojiPanels();
    }
  });

  if (backButton) {
    backButton.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "/";
      }
    });
  }

  if (detailBackButton) {
    detailBackButton.addEventListener("click", () => {
      showListView();
    });
  }

  if (detailLikeButton) {
    detailLikeButton.addEventListener("click", () => {
      toggleFeedbackLike();
    });
  }

  if (detailCommentsList) {
    detailCommentsList.addEventListener("click", (event) => {
      const button = event.target.closest(".comment-like");
      if (!button) return;
      const commentId = Number(button.dataset.commentId);
      if (!commentId) return;
      toggleCommentLike(commentId, button);
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      form.reset();
      setType("suggestion");
      fillDefaults();
      updateCount();
      setStatus("");
    });
  }

  if (detailCommentForm) {
    detailCommentForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setDetailStatus("");
      if (!currentDetailId) return;
      const content = detailCommentInput ? detailCommentInput.value.trim() : "";
      const authorName = detailCommentName ? detailCommentName.value.trim() : "";

      if (!content) {
        setDetailStatus("请填写评论内容。", "error");
        return;
      }
      if (content.length > MAX_COMMENT) {
        setDetailStatus(`评论不能超过 ${MAX_COMMENT} 字。`, "error");
        return;
      }

      if (detailCommentSubmit) {
        detailCommentSubmit.disabled = true;
      }

      try {
        const response = await fetch("/api/feedback/comment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            feedbackId: currentDetailId,
            content,
            authorName
          })
        });
        let data = {};
        try {
          data = await response.json();
        } catch (error) {
          data = {};
        }
        if (!response.ok || data.success === false) {
          setDetailStatus(data.message || "评论失败，请稍后再试。", "error");
          return;
        }
        if (detailCommentInput) detailCommentInput.value = "";
        setDetailStatus("评论成功。", "success");
        await loadDetail(currentDetailId);
        loadFeedbackList();
      } catch (error) {
        setDetailStatus("评论失败，请稍后再试。", "error");
      } finally {
        if (detailCommentSubmit) {
          detailCommentSubmit.disabled = false;
        }
      }
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");

    const payload = {
      type: typeInput ? typeInput.value : "suggestion",
      title: titleInput ? titleInput.value.trim() : "",
      content: contentInput ? contentInput.value.trim() : "",
      contactType: contactTypeSelect ? contactTypeSelect.value : "",
      contact: contactInput ? contactInput.value.trim() : "",
      device: deviceInput ? deviceInput.value.trim() : "",
      page: pageInput ? pageInput.value.trim() : "",
      userAgent: navigator.userAgent || ""
    };

    if (!payload.content) {
      setStatus("请填写反馈内容。", "error");
      return;
    }

    if (payload.content.length > MAX_CONTENT) {
      setStatus(`反馈内容不能超过 ${MAX_CONTENT} 字。`, "error");
      return;
    }

    setLoading(true);
    setStatus("正在提交，请稍候...", "info");

    try {
      const response = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      let data = {};
      try {
        data = await response.json();
      } catch (error) {
        data = {};
      }

      if (!response.ok || data.success === false) {
        setStatus(data.message || "提交失败，请稍后重试。", "error");
        return;
      }

      setStatus(data.message || "提交成功，感谢你的反馈！", "success");
      form.reset();
      setType("suggestion");
      fillDefaults();
      updateCount();
      await loadFeedbackList();
      showListView();
    } catch (error) {
      setStatus("网络异常，提交失败，请稍后再试。", "error");
    } finally {
      setLoading(false);
    }
  });

  setType("suggestion");
  fillDefaults();
  updateCount();
  showListView();
  loadFeedbackList();
})();

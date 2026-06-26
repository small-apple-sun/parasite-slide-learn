(function () {
  "use strict";

  /** 站点级文案（与单题无关） */
  const SITE = {
    institutionLines: [],
    watermark: "",
    footerSlogan: "",
    defaultPrompt: "请报告图片中对象的名称",
  };

  const STORAGE_KEY = "parasiteSlideLearn_stats";
  const REVIEW_KEY = "parasiteSlideLearn_needReview";
  const SOUND_KEY = "parasiteSlideLearn_soundOn";
  const STREAK_SESSION_KEY = "parasiteSlideLearn_knowStreak";
  const SEARCH_STORAGE_KEY = "parasiteSlideLearn_searchQuery";

  function userStorageKey(base) {
    const fn = window.__PARASITE_SLIDE_STORAGE_KEY__;
    return typeof fn === "function" ? fn(base) : base;
  }

  function getLocalItem(base) {
    try {
      const scoped = userStorageKey(base);
      let v = localStorage.getItem(scoped);
      if (v == null && scoped !== base) v = localStorage.getItem(base);
      return v;
    } catch {
      return null;
    }
  }

  function setLocalItem(base, value) {
    try {
      localStorage.setItem(userStorageKey(base), value);
    } catch {
      /* quota */
    }
  }

  function removeLocalItem(base) {
    try {
      localStorage.removeItem(userStorageKey(base));
    } catch {
      /* ignore */
    }
  }

  function getSessionItem(base) {
    try {
      return sessionStorage.getItem(userStorageKey(base));
    } catch {
      return null;
    }
  }

  function setSessionItem(base, value) {
    try {
      sessionStorage.setItem(userStorageKey(base), value);
    } catch {
      /* ignore */
    }
  }

  function removeSessionItem(base) {
    try {
      sessionStorage.removeItem(userStorageKey(base));
    } catch {
      /* ignore */
    }
  }

  /** 俗称 / 简写 → 题库中可能出现的写法（命中任一即算匹配） */
  const SEARCH_SYNONYMS = {
    肝吸虫: ["肝吸虫", "华支睾吸虫", "华支睾"],
    肺吸虫: ["肺吸虫", "卫氏并殖", "并殖吸虫", "并殖"],
    血吸虫: ["血吸虫", "日本血吸虫", "曼氏血吸虫", "埃及血吸虫"],
    贾第: ["贾第", "蓝氏贾第", "贾第鞭毛虫"],
    滴虫: ["滴虫", "阴道毛滴虫", "毛滴虫"],
  };

  const FUN_KNOW_TOAST = [
    "太棒了，又记住一个！",
    "知识 +1，脑回路闪闪发光 ✨",
    "显微镜之神向你点头",
    "这题已被你稳稳拿捏",
    "好样的！学习效率拉满",
    "记住啦～明天还记得算你赢",
    "给你发一朵赛博小红花",
    "棒棒哒，继续下一张！",
    "真不错，形态学语感 +1",
    "可以可以，保持这个节奏",
  ];

  const FUN_NOT_TOAST = [
    "没关系，先放进复习本慢慢啃～",
    "不认识很正常，多见几次就熟啦",
    "这位「小客人」需要多关照一下",
    "已记录，下次再来收拾它",
    "慢慢记，不着急",
  ];

  const FUN_CLEARED_TOAST = [
    "🎉 复习本清空！可以得意一分钟",
    "清空达成，奖励自己喝口水吧",
    "全部过关，今日份成就感 +MAX",
  ];

  /** @type {{ id: string, title: string, image: string, prompt?: string, scientific?: string, notes?: string }[]} */
  let allItems = [];
  /** @type {typeof allItems} */
  let items = [];
  let index = 0;
  let revealed = true;

  /** @type {Set<string>} */
  let needReview = new Set();

  let toastTimer = null;
  let toastHideTimer = null;
  let searchSaveTimer = null;

  /** @type {AudioContext | null} */
  let audioCtx = null;

  const el = {
    loadError: document.getElementById("loadError"),
    app: document.getElementById("app"),
    reviewEmpty: document.getElementById("reviewEmpty"),
    appActions: document.getElementById("appActions"),
    counter: document.getElementById("counter"),
    stats: document.getElementById("stats"),
    deckSearch: document.getElementById("deckSearch"),
    btnSearchClear: document.getElementById("btnSearchClear"),
    searchEmpty: document.getElementById("searchEmpty"),
    slide: document.getElementById("slide"),
    streakBadge: document.getElementById("streakBadge"),
    slideBrand: document.getElementById("slideBrand"),
    slideTitle: document.getElementById("slideTitle"),
    slideId: document.getElementById("slideId"),
    slideName: document.getElementById("slideName"),
    cardImageWrap: document.getElementById("cardImageWrap"),
    cardImage: document.getElementById("cardImage"),
    slideWatermark: document.getElementById("slideWatermark"),
    slidePrompt: document.getElementById("slidePrompt"),
    slideExtra: document.getElementById("slideExtra"),
    slideScientific: document.getElementById("slideScientific"),
    slideNotes: document.getElementById("slideNotes"),
    slideAnswerAside: document.getElementById("slideAnswerAside"),
    slideSlogan: document.getElementById("slideSlogan"),
    btnReveal: document.getElementById("btnReveal"),
    btnKnow: document.getElementById("btnKnow"),
    btnNotKnow: document.getElementById("btnNotKnow"),
    btnPrev: document.getElementById("btnPrev"),
    btnNext: document.getElementById("btnNext"),
    btnRandom: document.getElementById("btnRandom"),
    randomMode: document.getElementById("randomMode"),
    quizMode: document.getElementById("quizMode"),
    reviewOnly: document.getElementById("reviewOnly"),
    soundOn: document.getElementById("soundOn"),
    toast: document.getElementById("toast"),
  };

  function soundEnabled() {
    return Boolean(el.soundOn && el.soundOn.checked);
  }

  function ensureAudio() {
    if (!soundEnabled()) return Promise.resolve(null);
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        return Promise.resolve(null);
      }
    }
    if (audioCtx.state === "suspended") {
      return audioCtx.resume().then(function () {
        return audioCtx;
      });
    }
    return Promise.resolve(audioCtx);
  }

  function playTone(freq, durationSec, volume, wave) {
    void ensureAudio().then(function (ctx) {
      if (!ctx || !soundEnabled()) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = wave || "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      const v = volume != null ? volume : 0.06;
      gain.gain.setValueAtTime(v, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.0008,
        ctx.currentTime + durationSec
      );
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + durationSec + 0.02);
    });
  }

  function soundFlip() {
    playTone(400, 0.07, 0.055, "triangle");
  }

  function soundNav() {
    playTone(620, 0.045, 0.04, "sine");
  }

  function soundKnow() {
    void ensureAudio().then(function (ctx) {
      if (!ctx || !soundEnabled()) return;
      const t = ctx.currentTime;
      const notes = [523.25, 659.25];
      for (let i = 0; i < notes.length; i += 1) {
        const freq = notes[i];
        const start = t + i * 0.07;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.065, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.16);
        osc.start(start);
        osc.stop(start + 0.18);
      }
    });
  }

  function soundNotKnow() {
    playTone(200, 0.11, 0.065, "sine");
  }

  function motionReduced() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  function pickFun(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getKnowStreak() {
    try {
      const v = getSessionItem(STREAK_SESSION_KEY);
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }

  function setKnowStreak(n) {
    try {
      if (n <= 0) removeSessionItem(STREAK_SESSION_KEY);
      else setSessionItem(STREAK_SESSION_KEY, String(n));
    } catch {
      /* ignore */
    }
  }

  function bumpKnowStreak() {
    const n = getKnowStreak() + 1;
    setKnowStreak(n);
    return n;
  }

  function resetKnowStreak() {
    setKnowStreak(0);
  }

  function updateStreakBadge() {
    if (!el.streakBadge) return;
    const n = getKnowStreak();
    if (n <= 0) {
      el.streakBadge.classList.add("hidden");
      el.streakBadge.textContent = "";
      el.streakBadge.classList.remove("streak-tick");
      return;
    }
    el.streakBadge.classList.remove("hidden");
    el.streakBadge.textContent = "连对 " + n + " 题 · 继续保持";
    el.streakBadge.classList.remove("streak-tick");
    void el.streakBadge.offsetWidth;
    el.streakBadge.classList.add("streak-tick");
  }

  function confettiBurst() {
    if (motionReduced()) return;
    const layer = document.createElement("div");
    layer.className = "confetti-layer";
    const colors = [
      "#1565c0",
      "#2e7d32",
      "#ff9800",
      "#e91e63",
      "#7e57c2",
      "#00acc1",
    ];
    for (let i = 0; i < 28; i += 1) {
      const p = document.createElement("span");
      p.className = "confetti-piece";
      p.style.left = Math.random() * 96 + 2 + "%";
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = Math.random() * 0.2 + "s";
      p.style.setProperty("--dx", (Math.random() - 0.5) * 120 + "px");
      p.style.setProperty("--rot", Math.random() * 1080 + "deg");
      layer.appendChild(p);
    }
    document.body.appendChild(layer);
    setTimeout(function () {
      layer.remove();
    }, 2200);
  }

  function triggerSlideEnter() {
    if (motionReduced() || !el.slide) return;
    el.slide.classList.remove("slide-enter");
    void el.slide.offsetWidth;
    el.slide.classList.add("slide-enter");
  }

  function pulseAnswerAside() {
    if (motionReduced() || !el.slideAnswerAside) return;
    el.slideAnswerAside.classList.remove("answer-pulse");
    void el.slideAnswerAside.offsetWidth;
    el.slideAnswerAside.classList.add("answer-pulse");
  }

  function soundCelebrate() {
    void ensureAudio().then(function (ctx) {
      if (!ctx || !soundEnabled()) return;
      const t = ctx.currentTime;
      const notes = [392, 523.25, 659.25];
      for (let i = 0; i < notes.length; i += 1) {
        const freq = notes[i];
        const start = t + i * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.052, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.22);
        osc.start(start);
        osc.stop(start + 0.24);
      }
    });
  }

  function showToast(msg, opts) {
    opts = opts || {};
    const duration =
      typeof opts.ms === "number" && opts.ms > 0 ? opts.ms : 2000;
    if (!el.toast) return;
    if (toastTimer) clearTimeout(toastTimer);
    if (toastHideTimer) clearTimeout(toastHideTimer);
    el.toast.textContent = msg;
    el.toast.classList.remove("hidden", "is-out");
    el.toast.classList.toggle("toast--sparkle", Boolean(opts.sparkle));
    toastTimer = setTimeout(function () {
      el.toast.classList.add("is-out");
      toastHideTimer = setTimeout(function () {
        el.toast.classList.add("hidden");
        el.toast.classList.remove("is-out", "toast--sparkle");
      }, 280);
    }, duration);
  }

  function loadNeedReview() {
    try {
      const raw = getLocalItem(REVIEW_KEY);
      if (!raw) return new Set();
      const p = JSON.parse(raw);
      if (p && Array.isArray(p.ids)) {
        return new Set(p.ids.map(String));
      }
    } catch {
      /* ignore */
    }
    return new Set();
  }

  function saveNeedReview() {
    try {
      setLocalItem(
        REVIEW_KEY,
        JSON.stringify({ ids: Array.from(needReview) })
      );
    } catch {
      /* quota */
    }
  }

  function pruneNeedReview() {
    if (!allItems.length) return;
    const valid = new Set(
      allItems.map(function (x) {
        return x.id;
      })
    );
    let changed = false;
    needReview.forEach(function (id) {
      if (!valid.has(id)) {
        needReview.delete(id);
        changed = true;
      }
    });
    if (changed) saveNeedReview();
  }

  function getSearchQuery() {
    if (!el.deckSearch) return "";
    return String(el.deckSearch.value || "").trim();
  }

  function itemHaystack(it) {
    return [
      it.id,
      it.title,
      it.prompt || "",
      it.scientific || "",
      it.notes || "",
    ]
      .join(" ")
      .toLowerCase();
  }

  function expandSearchWord(word) {
    const w = word.trim();
    if (!w) return [];
    const syn = SEARCH_SYNONYMS[w];
    if (syn && syn.length) return syn.slice();
    return [w];
  }

  function wordMatchesHay(word, hay) {
    const w = word.trim();
    if (!w) return true;
    const needles = expandSearchWord(w).map(function (x) {
      return String(x).toLowerCase();
    });
    const wl = w.toLowerCase();
    if (needles.indexOf(wl) === -1) needles.push(wl);
    for (let i = 0; i < needles.length; i += 1) {
      if (hay.indexOf(needles[i]) !== -1) return true;
    }
    return false;
  }

  function itemMatchesSearch(it, rawQuery) {
    const q = String(rawQuery || "").trim();
    if (!q) return true;
    const hay = itemHaystack(it);
    const parts = q.split(/\s+/).filter(Boolean);
    return parts.every(function (part) {
      return wordMatchesHay(part, hay);
    });
  }

  function rebuildPool() {
    pruneNeedReview();
    let base;
    if (el.reviewOnly.checked) {
      base = allItems.filter(function (x) {
        return needReview.has(x.id);
      });
    } else {
      base = allItems.slice();
    }
    const sq = getSearchQuery();
    if (sq) {
      items = base.filter(function (x) {
        return itemMatchesSearch(x, sq);
      });
    } else {
      items = base;
    }
    if (index >= items.length) {
      index = Math.max(0, items.length - 1);
    }
    updateEmptyState();
  }

  function updateEmptyState() {
    const q = getSearchQuery();
    const reviewBaseEmpty =
      el.reviewOnly.checked &&
      !allItems.some(function (x) {
        return needReview.has(x.id);
      });
    const searchNoMatch = Boolean(q) && items.length === 0 && !reviewBaseEmpty;

    el.reviewEmpty.classList.toggle("hidden", !reviewBaseEmpty);
    if (el.searchEmpty) {
      el.searchEmpty.classList.toggle("hidden", !searchNoMatch);
    }
    const hideMain = reviewBaseEmpty || searchNoMatch;
    el.slide.classList.toggle("hidden", hideMain);
    el.appActions.classList.toggle("hidden", hideMain);
  }

  function persistSearchSoon() {
    if (searchSaveTimer) clearTimeout(searchSaveTimer);
    searchSaveTimer = setTimeout(function () {
      searchSaveTimer = null;
      try {
        const v = getSearchQuery();
        if (v) setLocalItem(SEARCH_STORAGE_KEY, v);
        else removeLocalItem(SEARCH_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }, 320);
  }

  function applySearchRebuild() {
    const curId =
      items.length && index >= 0 && index < items.length
        ? items[index].id
        : null;
    rebuildPool();
    if (curId) {
      const ni = items.findIndex(function (x) {
        return x.id === curId;
      });
      if (ni >= 0) index = ni;
      else index = 0;
    } else {
      index = Math.min(index, Math.max(0, items.length - 1));
    }
    revealed = initialRevealed();
    persistSearchSoon();
    render();
  }

  function quizOn() {
    return Boolean(el.quizMode && el.quizMode.checked);
  }

  function initialRevealed() {
    return !quizOn();
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function loadStats() {
    try {
      const raw = getLocalItem(STORAGE_KEY);
      if (!raw) return { day: todayStr(), viewsToday: 0, idCounts: {} };
      const p = JSON.parse(raw);
      const day = typeof p.day === "string" ? p.day : todayStr();
      const viewsToday =
        day === todayStr() && typeof p.viewsToday === "number" ? p.viewsToday : 0;
      const idCounts =
        p.idCounts && typeof p.idCounts === "object" ? p.idCounts : {};
      return { day: todayStr(), viewsToday, idCounts };
    } catch {
      return { day: todayStr(), viewsToday: 0, idCounts: {} };
    }
  }

  function saveStats(s) {
    try {
      setLocalItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* ignore quota */
    }
  }

  function recordView(id) {
    const s = loadStats();
    const d = todayStr();
    if (s.day !== d) {
      s.day = d;
      s.viewsToday = 0;
    }
    s.viewsToday += 1;
    s.idCounts[id] = (s.idCounts[id] || 0) + 1;
    saveStats(s);
    return s;
  }

  function countNeedReviewInDeck() {
    let n = 0;
    allItems.forEach(function (x) {
      if (needReview.has(x.id)) n += 1;
    });
    return n;
  }

  function updateStatsLine() {
    const s = loadStats();
    const d = todayStr();
    const today = s.day === d ? s.viewsToday : 0;
    const pending = countNeedReviewInDeck();
    if (items.length > 0) {
      el.stats.textContent =
        "今日展示 " +
        today +
        " 次 · 当前题累计 " +
        (s.idCounts[items[index].id] || 0) +
        " 次 · 待复习 " +
        pending +
        " 张";
    } else {
      el.stats.textContent =
        pending > 0
          ? "待复习 " + pending + " 张（当前筛选下无题可练）"
          : "待复习 0 张";
    }
  }

  function applyRevealUi() {
    const q = quizOn();
    const hideAnswer = q && !revealed;
    el.slideTitle.classList.toggle("is-hidden-answer", hideAnswer);
    el.slidePrompt.classList.toggle("is-hidden-answer", hideAnswer);
    el.slideExtra.classList.toggle("is-hidden-answer", hideAnswer);

    if (el.btnReveal) {
      el.btnReveal.disabled = !q;
      el.btnReveal.title = q
        ? ""
        : "请先勾选顶栏「先隐藏答案」";
      el.btnReveal.textContent = revealed ? "隐藏答案" : "显示答案";
      el.btnReveal.setAttribute("aria-expanded", String(revealed || !q));
    }
  }

  function setRevealed(v) {
    revealed = v;
    applyRevealUi();
  }

  function renderBrand() {
    el.slideBrand.innerHTML = SITE.institutionLines
      .map(function (line) {
        return (
          '<span class="brand-line">' + escapeHtml(line) + "</span>"
        );
      })
      .join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render() {
    renderBrand();
    el.slideWatermark.textContent = SITE.watermark;
    el.slideSlogan.textContent = SITE.footerSlogan;

    updateEmptyState();
    let counterText =
      items.length > 0 ? index + 1 + " / " + items.length : "0 / 0";
    if (items.length > 0 && getSearchQuery()) counterText += "（筛选）";
    el.counter.textContent = counterText;

    if (!items.length) {
      updateStatsLine();
      return;
    }

    const it = items[index];

    el.slideId.textContent = it.id;
    el.slideName.textContent = it.title;
    el.cardImage.src = it.image || "";
    el.cardImage.alt = "形态学识图配图：" + it.title;
    el.slidePrompt.textContent = it.prompt || SITE.defaultPrompt;

    const sci = it.scientific && String(it.scientific).trim();
    const notes = it.notes && String(it.notes).trim();
    el.slideScientific.textContent = sci ? "学名 / 英文：" + sci : "";
    el.slideScientific.classList.toggle("hidden", !sci);
    el.slideNotes.textContent = notes || "";
    el.slideNotes.classList.toggle("hidden", !notes);
    el.slideExtra.classList.toggle("hidden", !sci && !notes);

    applyRevealUi();
    updateStatsLine();
    updateStreakBadge();

    el.btnPrev.disabled = items.length <= 1;
    el.btnNext.disabled = items.length <= 1;
    el.btnRandom.disabled = items.length <= 1;
  }

  function goTo(newIndex) {
    if (!items.length) return;
    const next = ((newIndex % items.length) + items.length) % items.length;
    if (next === index) return;
    soundNav();
    index = next;
    revealed = initialRevealed();
    recordView(items[index].id);
    render();
    triggerSlideEnter();
  }

  function randomIndex(excludeCurrent) {
    if (items.length <= 1) return 0;
    let j = index;
    let guard = 0;
    while (j === index && guard < 50) {
      j = Math.floor(Math.random() * items.length);
      guard += 1;
    }
    return excludeCurrent ? j : Math.floor(Math.random() * items.length);
  }

  function onPrev() {
    goTo(index - 1);
  }

  function onNext() {
    if (el.randomMode.checked) {
      goTo(randomIndex(true));
    } else {
      goTo(index + 1);
    }
  }

  function onRandom() {
    goTo(randomIndex(true));
  }

  function toggleReveal() {
    if (!items.length || !quizOn()) return;
    const willReveal = !revealed;
    setRevealed(willReveal);
    soundFlip();
    if (willReveal) pulseAnswerAside();
  }

  function onKnow() {
    if (!items.length) return;
    soundKnow();
    const reviewOnly = el.reviewOnly.checked;
    needReview.delete(items[index].id);
    saveNeedReview();
    rebuildPool();
    revealed = initialRevealed();

    if (!items.length) {
      showToast(pickFun(FUN_CLEARED_TOAST), { sparkle: true, ms: 2800 });
      if (!motionReduced()) confettiBurst();
      soundCelebrate();
      resetKnowStreak();
      updateStreakBadge();
      render();
      return;
    }

    const streak = bumpKnowStreak();
    updateStreakBadge();
    if (streak >= 3 && streak % 3 === 0 && !motionReduced()) confettiBurst();
    if (streak === 5 || streak === 10 || streak === 20) soundCelebrate();

    function buildKnowToast(extra) {
      let t = pickFun(FUN_KNOW_TOAST);
      if (streak > 1) t += "（连对 " + streak + " 题）";
      return extra ? t + extra : t;
    }

    if (reviewOnly) {
      index = Math.min(index, items.length - 1);
      recordView(items[index].id);
      showToast(buildKnowToast(""), {
        sparkle: streak >= 3,
        ms: streak >= 3 ? 2400 : 2200,
      });
      render();
    } else if (items.length <= 1) {
      recordView(items[index].id);
      showToast(buildKnowToast("（当前仅此一题）"), { ms: 2400 });
      render();
    } else {
      showToast(buildKnowToast(" · 下一题！"), {
        sparkle: streak >= 3,
        ms: 2200,
      });
      goTo(index + 1);
    }
  }

  function onNotKnow() {
    if (!items.length) return;
    soundNotKnow();
    resetKnowStreak();
    updateStreakBadge();
    const id = items[index].id;
    const wasIn = needReview.has(id);
    needReview.add(id);
    saveNeedReview();
    const n = countNeedReviewInDeck();
    updateStatsLine();
    const tail = wasIn
      ? "（已在复习本 · 共 " + n + " 张）"
      : "（待复习 " + n + " 张）";
    showToast(pickFun(FUN_NOT_TOAST) + tail, { ms: 2600 });
  }

  function onKeydown(e) {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    if (e.code === "Space") {
      if (!quizOn()) return;
      e.preventDefault();
      toggleReveal();
    } else if (e.code === "ArrowLeft") {
      e.preventDefault();
      onPrev();
    } else if (e.code === "ArrowRight") {
      e.preventDefault();
      onNext();
    } else if (e.code === "KeyR" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      onRandom();
    } else if (e.code === "KeyK" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      onKnow();
    } else if (e.code === "KeyN" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      onNotKnow();
    }
  }

  function showApp() {
    el.app.classList.remove("hidden");
  }

  function parseSlidesJson(data) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("题库为空或格式不是数组");
    }
    return data.map(function (row, i) {
      const id = String(row.id != null ? row.id : i + 1);
      if (!row.image) {
        throw new Error("题目缺少 image（id=" + id + "）");
      }
      return {
        id: id,
        title: row.title ? String(row.title) : "待标注",
        image: String(row.image),
        prompt: row.prompt != null ? String(row.prompt) : undefined,
        scientific: row.scientific != null ? String(row.scientific) : undefined,
        notes: row.notes != null ? String(row.notes) : undefined,
      };
    });
  }

  let embedScriptRequested = false;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.charset = "utf-8";
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error("无法加载 " + src));
      };
      document.head.appendChild(s);
    });
  }

  async function tryLoadSlidesData() {
    const isFile = window.location.protocol === "file:";

    if (isFile) {
      if (!embedScriptRequested) {
        embedScriptRequested = true;
        try {
          await loadScript("data/slides.embed.js");
        } catch (e) {
          throw new Error(
            "双击打开需要 data/slides.embed.js。请在项目目录执行：python3 tools/embed_slides.py"
          );
        }
      }
      if (
        Array.isArray(window.__SLIDES_EMBED__) &&
        window.__SLIDES_EMBED__.length
      ) {
        return parseSlidesJson(window.__SLIDES_EMBED__);
      }
      throw new Error("slides.embed.js 未包含有效题库");
    }

    try {
      const res = await fetch("data/slides.json", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        return parseSlidesJson(data);
      }
    } catch {
      /* 尝试 embed 兜底 */
    }

    if (!embedScriptRequested) {
      embedScriptRequested = true;
      try {
        await loadScript("data/slides.embed.js");
      } catch {
        /* ignore */
      }
    }
    if (
      Array.isArray(window.__SLIDES_EMBED__) &&
      window.__SLIDES_EMBED__.length
    ) {
      return parseSlidesJson(window.__SLIDES_EMBED__);
    }

    throw new Error(
      "无法加载 data/slides.json（请用本地 HTTP 服务打开，或生成 slides.embed.js）"
    );
  }

  function wireUi() {
    needReview = loadNeedReview();
    try {
      const s = getLocalItem(SOUND_KEY);
      if (s === "0" && el.soundOn) el.soundOn.checked = false;
    } catch {
      /* ignore */
    }
    if (el.soundOn) {
      el.soundOn.addEventListener("change", function () {
        try {
          setLocalItem(SOUND_KEY, el.soundOn.checked ? "1" : "0");
        } catch {
          /* ignore */
        }
      });
    }
    el.btnReveal.addEventListener("click", toggleReveal);
    el.btnKnow.addEventListener("click", onKnow);
    el.btnNotKnow.addEventListener("click", onNotKnow);
    el.btnPrev.addEventListener("click", onPrev);
    el.btnNext.addEventListener("click", onNext);
    el.btnRandom.addEventListener("click", onRandom);
    el.quizMode.addEventListener("change", function () {
      revealed = initialRevealed();
      render();
    });
    el.reviewOnly.addEventListener("change", function () {
      const curId =
        items.length && index >= 0 && index < items.length
          ? items[index].id
          : null;
      rebuildPool();
      if (curId) {
        const ni = items.findIndex(function (x) {
          return x.id === curId;
        });
        index = ni >= 0 ? ni : Math.min(index, Math.max(0, items.length - 1));
      } else {
        index = Math.min(index, Math.max(0, items.length - 1));
      }
      revealed = initialRevealed();
      if (items.length) recordView(items[index].id);
      render();
    });
    if (el.deckSearch) {
      el.deckSearch.addEventListener("input", function () {
        applySearchRebuild();
      });
      el.deckSearch.addEventListener("keydown", function (e) {
        if (e.code === "Escape") {
          e.preventDefault();
          el.deckSearch.value = "";
          try {
          removeLocalItem(SEARCH_STORAGE_KEY);
          } catch {
            /* ignore */
          }
          applySearchRebuild();
          el.deckSearch.blur();
        }
      });
    }
    if (el.btnSearchClear) {
      el.btnSearchClear.addEventListener("click", function () {
        if (el.deckSearch) el.deckSearch.value = "";
        try {
        removeLocalItem(SEARCH_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        applySearchRebuild();
        if (el.deckSearch) el.deckSearch.focus();
      });
    }
    el.cardImageWrap.addEventListener("click", function () {
      if (!items.length) return;
      toggleReveal();
    });
    document.addEventListener("keydown", onKeydown);
  }

  async function init() {
    wireUi();
    try {
      allItems = await tryLoadSlidesData();
      try {
        const savedQ = getLocalItem(SEARCH_STORAGE_KEY);
        if (savedQ && el.deckSearch) el.deckSearch.value = savedQ;
      } catch {
        /* ignore */
      }
      rebuildPool();
      el.loadError.classList.add("hidden");
      index = items.length ? Math.floor(Math.random() * items.length) : 0;
      revealed = initialRevealed();
      showApp();
      if (items.length) recordView(items[index].id);
      render();
    } catch (err) {
      el.loadError.classList.remove("hidden");
      el.loadError.textContent =
        "加载题库失败：" +
        (err && err.message ? err.message : String(err)) +
        "。若用「双击 index.html」打开，请先运行：python3 tools/embed_slides.py；也可在本目录运行 ./serve.sh 或 python3 -m http.server 后再访问。";
    }
  }

  window.__PARASITE_SLIDE_START__ = init;
})();

/* Interview prep site. Content comes from window.SITE (build.py bundles content/*.md) and window.EXTRA_QS.
   Answers: saved to the artifact's db when published on claude.ai, else to this browser's localStorage. */
(function () {
  "use strict";
  const SITE = window.SITE;
  if (!SITE) return;
  const DOCS = SITE.docs;
  const INTERVIEW = new Date("2026-11-27T09:30:00+08:00");
  const $view = document.getElementById("view");
  const local = {
    get(k, d) { try { const v = localStorage.getItem("prep:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("prep:" + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const md = (s) => marked.parse(s || "");
  const mdInline = (s) => marked.parseInline(s || "");
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return "q" + h.toString(36); };

  // ---------- markdown helpers ----------
  function sections(text, level) {
    const re = new RegExp("^" + "#".repeat(level) + " (.+)$", "gm");
    const out = []; let m, last = null;
    while ((m = re.exec(text))) {
      if (last) last.body = text.slice(last.start, m.index);
      last = { title: m[1].trim(), start: re.lastIndex }; out.push(last);
    }
    if (last) last.body = text.slice(last.start);
    return out;
  }
  function section(text, re) {
    for (const lvl of [2, 3]) { const hit = sections(text, lvl).find((s) => re.test(s.title)); if (hit) return hit.body.trim(); }
    return "";
  }
  const splitRow = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
  function tables(text) {
    const lines = text.split("\n"); const out = []; let h2 = "", h3 = "", lastPara = "";
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^## /.test(l)) { h2 = l.slice(3).trim(); h3 = ""; lastPara = ""; continue; }
      if (/^### /.test(l)) { h3 = l.slice(4).trim(); lastPara = ""; continue; }
      if (/^\|/.test(l) && /^\|\s*:?-{2,}/.test(lines[i + 1] || "")) {
        const header = splitRow(l); const rows = []; i += 2;
        while (i < lines.length && /^\|/.test(lines[i])) rows.push(splitRow(lines[i++]));
        i--; out.push({ h2, h3, intro: lastPara, header, rows }); continue;
      }
      if (l.trim()) lastPara = l.trim();
    }
    return out;
  }
  const isBlank = (s) => !s || /^(\s|<br\s*\/?>|-|—)*$/i.test(s);

  // ---------- question bank ----------
  const CATS = [["usecase", "Use case"], ["behavioural", "Behavioural"], ["technical", "Technical"], ["performance", "Performance"], ["ai", "AI"], ["domain", "Domain"]];
  const CAT_LABEL = Object.fromEntries(CATS);
  function buildQuestions() {
    const qs = []; const seen = new Set();
    const push = (q) => { const k = q.q.toLowerCase().replace(/[\s\p{P}]+/gu, " ").trim(); if (seen.has(k)) return; seen.add(k); q.id = q.id || hash(q.q); qs.push(q); };
    for (const t of tables(DOCS.usecases || "")) {
      const H = t.header.map((h) => h.toLowerCase());
      const qi = H.findIndex((h) => /問題/.test(h)); if (qi < 0) continue;
      const hi = H.findIndex((h) => /想聽/.test(h));
      const ai = H.findIndex((h) => /答案/.test(h));
      if (H.length === 2 && t.h3) { // one use case = one card with several prompts
        push({ id: hash("uc:" + t.h3), cat: "usecase", src: "Use case", q: t.h3.replace(/^\d+\.\s*/, ""),
          hint: t.intro.replace(/^面試官想聽[：:]\s*/, ""), prompts: t.rows.map((r) => r[0]),
          docAns: t.rows.filter((r) => !isBlank(r[1])).map((r) => `- **${r[0]}**：${r[1]}`).join("\n") });
        continue;
      }
      const cat = /performance/i.test(t.h2) ? "performance" : /\bAI\b/.test(t.h2) ? "ai" : /加分/.test(t.h2) ? "usecase" : "behavioural";
      t.rows.forEach((r) => { if (!isBlank(r[qi])) push({ cat, src: t.h2, q: r[qi], hint: hi >= 0 ? r[hi] : "", docAns: ai >= 0 && !isBlank(r[ai]) ? r[ai] : "" }); });
    }
    (window.EXTRA_QS || []).forEach((x) => push(Object.assign({ src: "補充題" }, x)));
    return qs;
  }
  const QUESTIONS = buildQuestions();
  const QBYID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

  // STAR template → questions it can answer (matched on question text).
  const STAR_LINKS = [
    [/discover/i, /模糊|ambiguous|don't fully understand|requirements from finance|business logic/i],
    [/prioriti/i, /deadline|優先|prioriti/i],
    [/design/i, /非技術|explain|kpi|stakeholder/i],
    [/data quality/i, /數據質素|data quality|唔夾|reconcil|numbers are right/i],
    [/performance|build/i, /效能|slow|慢|performance|自動化一個人手/i],
    [/uat/i, /UAT|需求改|意見唔合|change mid/i],
    [/go-live|handover/i, /新工具|新流程|leave|maintainable|go-live|Excel/i],
    [/bau/i, /重複|repetitive|monitor|keeps running/i],
    [/\bai\b/i, /\bAI\b|copilot/i],
  ];

  // ---------- answer store ----------
  const Ans = {
    data: local.get("answers", {}), db: null, mode: "local", listeners: [], timers: {},
    get(id) { return this.data[id] || {}; },
    filled(id) { const a = this.get(id); return !!((a.text && a.text.trim()) || Object.values(a.fields || {}).some((v) => v && v.trim())); },
    save(id, patch) {
      const q = QBYID[id]; const cur = Object.assign({}, this.get(id), patch, { q: q ? q.q : "", cat: q ? q.cat : "", updatedAt: new Date().toISOString() });
      this.data[id] = cur; local.set("answers", this.data);
      clearTimeout(this.timers[id]);
      return new Promise((res) => {
        this.timers[id] = setTimeout(async () => {
          if (!this.db) return res("local");
          try { await this.db.collection("answers").doc(id).set(this.data[id]); res("db"); }
          catch (e) { res(e && e.code === "invalid_argument" ? "readonly" : "error"); }
        }, 900);
      });
    },
    async init() {
      if (!window.claude || !window.claude.use) return;
      let db = null; try { db = await window.claude.use("db"); } catch (e) { db = null; }
      if (!db) return;
      this.db = db; this.mode = "db";
      db.collection("answers").onSnapshot((snap) => {
        snap.docs.forEach((d) => { if (d.exists) { const v = d.data(); const mine = this.data[d.id]; if (!mine || !mine.updatedAt || (v.updatedAt || "") >= mine.updatedAt) this.data[d.id] = Object.assign({}, v); } });
        // push answers typed before the store was reachable
        Object.entries(this.data).forEach(([id, v]) => { if (!snap.docs.find((d) => d.id === id) && (v.text || v.fields)) db.collection("answers").doc(id).set(v).catch(() => {}); });
        local.set("answers", this.data);
        syncFields();
      }, () => { this.db = null; this.mode = "local"; syncFields(); });
    },
  };
  function syncFields() {
    document.querySelectorAll("textarea[data-qid]").forEach((ta) => {
      if (ta === document.activeElement) return;
      const a = Ans.get(ta.dataset.qid); const v = ta.dataset.field ? ((a.fields || {})[ta.dataset.field] || "") : (a.text || "");
      if (ta.value !== v) ta.value = v;
    });
    document.querySelectorAll("[data-mark]").forEach((el) => el.classList.toggle("done", Ans.filled(el.dataset.mark)));
    const p = document.getElementById("progress"); if (p) p.textContent = progressText();
    const m = document.getElementById("storeMode"); if (m) m.textContent = storeText();
  }
  const progressText = () => `已寫 ${QUESTIONS.filter((q) => Ans.filled(q.id)).length} / ${QUESTIONS.length} 題`;
  const storeText = () => Ans.mode === "db" ? "答案自動儲存到呢個 artifact（任何裝置都睇到，Claude 都讀到）" : "答案儲存喺呢部機嘅瀏覽器";

  // ---------- question card ----------
  function answerArea(q) {
    const a = Ans.get(q.id);
    if (q.prompts) {
      return q.prompts.map((p, i) => `<label class="field" for="f-${q.id}-${i}">${esc(p)}</label>
        <textarea id="f-${q.id}-${i}" class="small" data-qid="${q.id}" data-field="${esc(p)}" placeholder="point form，廣東話英文都得；冇經驗就寫「冇」">${esc((a.fields || {})[p] || "")}</textarea>`).join("") +
        `<label class="field" for="t-${q.id}">英文 STAR 草稿（可以之後先寫）</label>
        <textarea id="t-${q.id}" data-qid="${q.id}" placeholder="S / T / A / R">${esc(a.text || "")}</textarea>`;
    }
    return `<textarea id="t-${q.id}" data-qid="${q.id}" placeholder="寫你嘅答案，或者寫用邊個 use case / STAR 故事（例如「use case 2」）">${esc(a.text || "")}</textarea>`;
  }
  const SUG = window.SUGGESTED || {};
  function suggestBlock(q) {
    const g = SUG[q.q]; if (!g) return "";
    return `<div class="suggest"><div class="label">建議答案（根據你講嘅）</div>
      ${g.note ? `<p class="muted">${esc(g.note)}</p>` : ""}<div class="md">${md(g.text)}</div>
      ${g.short ? `<div class="label">短版（20 秒）</div><p>${esc(g.short)}</p>` : ""}
      <button class="btn ghost useSug" data-sug="${q.id}">用呢個做我嘅答案起點</button></div>`;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest(".useSug"); if (!b) return;
    const q = QBYID[b.dataset.sug]; const ta = document.getElementById("t-" + q.id); if (!ta) return;
    if (ta.value.trim() && !b.dataset.confirm) { b.dataset.confirm = "1"; b.textContent = "會覆蓋你已寫嘅答案，再撳一次確認"; return; }
    ta.value = SUG[q.q].text; ta.dispatchEvent(new Event("input", { bubbles: true })); b.textContent = "已放入，可以照改"; delete b.dataset.confirm;
  });
  function questionCard(q, opts) {
    opts = opts || {};
    return `<article class="card qcard" data-mark="${q.id}">
      <p class="q"><span class="tag">${CAT_LABEL[q.cat]}</span>${mdInline(q.q)}<span class="tick" aria-label="已寫">✓</span></p>
      ${q.hint ? `<div class="label">面試官想聽</div><div class="hint">${mdInline(q.hint)}</div>` : ""}
      ${q.docAns ? `<div class="label">Doc 入面嘅答案</div><div class="md">${md(q.docAns)}</div>` : ""}
      ${suggestBlock(q)}
      ${opts.hideAnswer ? "" : `<div class="label">我嘅答案</div>${answerArea(q)}<div class="saved muted" aria-live="polite"></div>`}
    </article>`;
  }
  document.addEventListener("input", (e) => {
    const ta = e.target; if (!ta.dataset || !ta.dataset.qid) return;
    const id = ta.dataset.qid; const card = ta.closest(".qcard"); const st = card && card.querySelector(".saved");
    const patch = ta.dataset.field ? { fields: Object.assign({}, Ans.get(id).fields, { [ta.dataset.field]: ta.value }) } : { text: ta.value };
    if (st) st.textContent = "儲存緊…";
    Ans.save(id, patch).then((where) => {
      if (st) st.textContent = where === "db" ? "已儲存" : where === "local" ? "已儲存（呢部機）" : where === "readonly" ? "呢個 view 唔可以寫，已存喺呢部機" : "未能儲存到雲端，已存喺呢部機";
      if (card) card.classList.toggle("done", Ans.filled(id));
      const p = document.getElementById("progress"); if (p) p.textContent = progressText();
    });
  });

  // ---------- pages ----------
  const ov = DOCS.overview || "";
  function checkify(text, key) {
    const done = local.get("chk:" + key, {}); let n = 0;
    const items = []; const paras = [];
    text.split("\n").forEach((l) => {
      const m = l.match(/^\s*(?:[-*]|\d+\.)\s+(\[[ xX]\]\s+)?(.+)$/);
      if (!m) { if (l.trim()) paras.push(`<p>${mdInline(l)}</p>`); return; }
      const i = n++; const on = done[i] != null ? done[i] : /\[[xX]\]/.test(m[1] || "");
      items.push(`<li><label><input type="checkbox" data-k="${key}" data-i="${i}" ${on ? "checked" : ""}> <span>${mdInline(m[2])}</span></label></li>`);
    });
    return paras.join("") + (items.length ? `<ul class="check">${items.join("")}</ul>` : "");
  }
  document.addEventListener("change", (e) => {
    const t = e.target; if (!t.dataset || !t.dataset.k) return;
    const d = local.get("chk:" + t.dataset.k, {}); d[t.dataset.i] = t.checked; local.set("chk:" + t.dataset.k, d);
  });

  function pageHome() {
    const three = section(ov, /三點|三個重點/);
    const pitchM = three.match(/One-line pitch[：:]\s*\*?"?([^\n]+?)"?\*?\s*$/im);
    const pitch = pitchM ? pitchM[1].replace(/^[*"]+|[*"]+$/g, "") : "";
    const list = (three.match(/^\d+\..+$/gm) || []).join("\n");
    const hook = (three.match(/^講動機.+$/m) || [""])[0];
    const R = SITE.demo.results;
    const fri = section(DOCS.other || "", /星期五|當日/);
    return `
      ${pitch ? `<div class="card pitch"><div class="label">One-line pitch</div>${mdInline(pitch)}</div>` : ""}
      <div class="card"><h3>星期五要講清楚嘅三點</h3><div class="md">${md(list)}</div>${hook ? `<p class="muted">${mdInline(hook)}</p>` : ""}</div>
      <div class="card"><h3>Demo 一句講晒</h3><p>${R.admin_records} policies, <b>${R.match_rate}%</b> matched automatically, ${R.exception_total} exceptions with reason codes, and record counts and HK$ control totals tie on both sides. <a href="#demo">睇 demo</a></p></div>
      <div class="card"><h3>答題進度</h3><p id="progress">${progressText()}</p><div class="row"><a class="btn" href="#bank">寫答案</a><a class="btn ghost" href="#practice">練習模式</a></div><p class="muted" id="storeMode">${storeText()}</p></div>
      <div class="card"><h3>反問問題</h3><div class="md">${md(section(ov, /反問/))}</div></div>
      ${fri ? `<div class="card"><h3>星期五當日 checklist</h3>${checkify(fri, "fri")}</div>` : ""}
      <div class="card"><h3>仲要準備</h3>${checkify(section(ov, /仲要準備/), "prep")}</div>
      <div class="card"><h3>Role 解讀同 90 日計劃</h3><div class="md">${md(section(ov, /role 實際/i))}${md(section(ov, /90 日/))}</div></div>`;
  }

  function pageBank() {
    const cat = local.get("bankCat", "all"); const qtext = local.get("bankQ", ""); const only = local.get("bankOnly", "all");
    const list = QUESTIONS.filter((q) => (cat === "all" || q.cat === cat) &&
      (only === "all" || (only === "todo" ? !Ans.filled(q.id) : Ans.filled(q.id))) &&
      (!qtext || (q.q + " " + q.hint).toLowerCase().includes(qtext.toLowerCase())));
    const count = (k) => QUESTIONS.filter((q) => q.cat === k).length;
    return `<h2>問題庫</h2><p class="muted"><span id="progress">${progressText()}</span> · <span id="storeMode">${storeText()}</span></p>
      <div class="chips" role="group" aria-label="類別">${[["all", "全部"], ...CATS].map(([k, l]) => `<button class="chip ${k === cat ? "on" : ""}" data-cat="${k}">${l} ${k === "all" ? QUESTIONS.length : count(k)}</button>`).join("")}</div>
      <div class="chips" role="group" aria-label="狀態">${[["all", "全部"], ["todo", "未寫"], ["done", "已寫"]].map(([k, l]) => `<button class="chip ${k === only ? "on" : ""}" data-only="${k}">${l}</button>`).join("")}</div>
      <input type="search" id="bankQ" placeholder="搜尋題目或關鍵字" value="${esc(qtext)}">
      <div id="bankList">${list.map((q) => questionCard(q)).join("") || `<p class="empty">冇符合嘅題目</p>`}</div>
      <div class="card"><div class="row"><button class="btn ghost" id="copyAll">複製所有答案（Markdown）</button><span class="muted" id="copyMsg"></span></div><textarea id="copyBox" hidden readonly></textarea></div>`;
  }
  function allAnswersMd() {
    return CATS.map(([k, l]) => {
      const qs = QUESTIONS.filter((q) => q.cat === k && Ans.filled(q.id)); if (!qs.length) return "";
      return `## ${l}\n\n` + qs.map((q) => { const a = Ans.get(q.id);
        const f = Object.entries(a.fields || {}).filter(([, v]) => v && v.trim()).map(([p, v]) => `- ${p}：${v.trim()}`).join("\n");
        return `### ${q.q}\n\n${f ? f + "\n\n" : ""}${(a.text || "").trim()}\n`; }).join("\n");
    }).filter(Boolean).join("\n");
  }
  function wireBank() {
    $view.querySelectorAll("[data-cat]").forEach((b) => (b.onclick = () => { local.set("bankCat", b.dataset.cat); render(); }));
    $view.querySelectorAll("[data-only]").forEach((b) => (b.onclick = () => { local.set("bankOnly", b.dataset.only); render(); }));
    const s = document.getElementById("bankQ"); let t;
    s.oninput = () => { clearTimeout(t); t = setTimeout(() => { local.set("bankQ", s.value); const pos = s.selectionStart; render(); const n = document.getElementById("bankQ"); n.focus(); n.setSelectionRange(pos, pos); }, 250); };
    document.getElementById("copyAll").onclick = () => {
      const txt = allAnswersMd() || "（未有答案）"; const msg = document.getElementById("copyMsg");
      const box = document.getElementById("copyBox");
      const fallback = () => { box.hidden = false; box.value = txt; box.select(); msg.textContent = "已選取，手動複製"; };
      try { navigator.clipboard.writeText(txt).then(() => (msg.textContent = "已複製"), fallback); } catch (e) { fallback(); }
    };
  }

  // Practice mode
  const P = { cat: "all", q: null, left: 120, timer: null, shown: false, seen: [] };
  function pickQuestion() {
    const pool = QUESTIONS.filter((q) => P.cat === "all" || q.cat === P.cat);
    let fresh = pool.filter((q) => !P.seen.includes(q.id)); if (!fresh.length) { P.seen = []; fresh = pool; }
    P.q = fresh[Math.floor(Math.random() * fresh.length)] || null; if (P.q) P.seen.push(P.q.id);
    P.left = 120; P.shown = false; stopTimer();
  }
  function stopTimer() { if (P.timer) clearInterval(P.timer); P.timer = null; }
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  function pagePractice() {
    if (!P.q) pickQuestion(); const q = P.q;
    return `<h2>練習模式</h2><p class="muted">隨機抽題，用英文大聲答兩分鐘，答完先睇答案。</p>
      <div class="chips">${[["all", "全部"], ...CATS].map(([k, l]) => `<button class="chip ${k === P.cat ? "on" : ""}" data-pcat="${k}">${l}</button>`).join("")}</div>
      ${q ? `<div class="card practice">
        <p class="q big"><span class="tag">${CAT_LABEL[q.cat]}</span>${mdInline(q.q)}</p>
        <div class="timer ${P.left <= 20 ? "low" : ""}" id="clock">${mmss(P.left)}</div>
        <div class="bar"><i id="bar" style="width:${(P.left / 120) * 100}%"></i></div>
        <div class="row center">
          <button class="btn" id="go">${P.timer ? "暫停" : P.left < 120 ? "繼續" : "開始 2 分鐘"}</button>
          <button class="btn ghost" id="reveal">${P.shown ? "收埋答案" : "睇答案"}</button>
          <button class="btn ghost" id="next">下一題</button>
        </div></div>
      ${P.shown ? questionCard(q) : ""}
      <p class="muted">今次練咗 ${P.seen.length} 題</p>` : `<p class="empty">呢個類別冇題目</p>`}`;
  }
  function wirePractice() {
    $view.querySelectorAll("[data-pcat]").forEach((b) => (b.onclick = () => { P.cat = b.dataset.pcat; P.seen = []; pickQuestion(); render(); }));
    const go = document.getElementById("go"); if (!go) return;
    go.onclick = () => {
      if (P.timer) { stopTimer(); render(); return; }
      P.timer = setInterval(() => {
        P.left = Math.max(0, P.left - 1);
        const c = document.getElementById("clock"), b = document.getElementById("bar"); if (!c) { stopTimer(); return; }
        c.textContent = mmss(P.left); c.classList.toggle("low", P.left <= 20); b.style.width = (P.left / 120) * 100 + "%";
        if (P.left === 0) { stopTimer(); P.shown = true; render(); }
      }, 1000);
      render();
    };
    document.getElementById("reveal").onclick = () => { P.shown = !P.shown; render(); };
    document.getElementById("next").onclick = () => { pickQuestion(); render(); };
  }

  function pageUsecases() {
    const ucs = QUESTIONS.filter((q) => q.cat === "usecase");
    const intro = (DOCS.usecases || "").split("\n").find((l) => l.startsWith("喺空白格")) || "";
    return `<h2>Use case 填寫</h2><p class="muted">${esc(intro)}</p><p class="muted"><span id="storeMode">${storeText()}</span></p>
      ${ucs.map((q) => questionCard(q)).join("")}`;
  }

  function pageStar() {
    const text = DOCS.star || "";
    const stories = sections(text, 2);
    const intro = text.split(/\n## /)[0].replace(/^# .+\n/, "");
    return `<h2>STAR 故事</h2><div class="md muted">${md(intro)}</div>
      ${stories.map((s) => {
        const link = STAR_LINKS.find(([re]) => re.test(s.title));
        const qs = link ? QUESTIONS.filter((q) => link[1].test(q.q)).slice(0, 8) : [];
        return `<article class="card"><h3>${esc(s.title)}</h3><div class="md">${md(s.body)}</div>
          ${qs.length ? `<div class="label">可以用嚟答</div><ul class="links">${qs.map((q) => `<li><span class="tag">${CAT_LABEL[q.cat]}</span>${esc(q.q)}</li>`).join("")}</ul>` : ""}</article>`;
      }).join("")}`;
  }

  const SHEETS = [["ifrs17", "IFRS 17 同月結"], ["alteryx-sql", "Alteryx / SQL"], ["transformation", "Transformation"], ["dwh-dg", "DWH / DG"], ["other", "其他重點"]];
  const sheetDocs = (key) => Object.keys(DOCS).filter((d) => d === key || d.startsWith(key + "-")).sort();
  function pageSheets() {
    const avail = SHEETS.filter(([k]) => sheetDocs(k).length);
    let cur = local.get("sheet", avail[0] && avail[0][0]); if (!avail.find(([k]) => k === cur)) cur = avail[0] && avail[0][0];
    if (!cur) return `<p class="empty">未有 cheat sheet 內容</p>`;
    const text = sheetDocs(cur).map((d) => DOCS[d]).join("\n\n");
    const heads = sections(text, 2);
    return `<h2>Cheat sheets</h2>
      <div class="chips">${avail.map(([k, l]) => `<button class="chip ${k === cur ? "on" : ""}" data-sheet="${k}">${l}</button>`).join("")}</div>
      ${heads.length > 2 ? `<nav class="card toc" aria-label="目錄">${heads.map((h, i) => `<a href="#sheets" data-jump="${i}">${esc(h.title)}</a>`).join("")}</nav>` : ""}
      <div class="card md" id="sheetBody">${md(text)}</div>`;
  }
  function wireSheets() {
    $view.querySelectorAll("[data-sheet]").forEach((b) => (b.onclick = () => { local.set("sheet", b.dataset.sheet); render(); window.scrollTo(0, 0); }));
    const h2s = $view.querySelectorAll("#sheetBody h2");
    $view.querySelectorAll("[data-jump]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); const el = h2s[+a.dataset.jump]; if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }));
  }

  const hk = (v) => "HK$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function workflowSvg() {
    const lane = (y, label, color, steps) => {
      const w = 116, gap = 10, x0 = 92;
      return `<rect x="0" y="${y}" width="84" height="46" rx="8" fill="${color}"/>
        <text x="42" y="${y + 28}" text-anchor="middle" font-size="12" font-weight="600" fill="#ffffff">${label}</text>` +
        steps.map((s, i) => { const x = x0 + i * (w + gap);
          return `<rect x="${x}" y="${y}" width="${w}" height="46" rx="8" fill="none" stroke="${color}" stroke-width="1.5"/>
            <text x="${x + w / 2}" y="${y + 20}" text-anchor="middle" font-size="11.5" font-weight="600" class="ink">${s[0]}</text>
            <text x="${x + w / 2}" y="${y + 35}" text-anchor="middle" font-size="10" class="sub">${s[1]}</text>` +
            (i < steps.length - 1 ? `<path d="M${x + w} ${y + 23} h${gap}" stroke="${color}" stroke-width="1.5" fill="none"/>` : ""); }).join("");
    };
    return `<div class="scroll"><svg viewBox="0 0 600 262" width="100%" style="min-width:520px" role="img" aria-label="Reconciliation workflow, four lanes">
      ${lane(4, "Policy Admin", "#1F6F8B", [["Input", "extract"], ["HKD", "premium × FX"], ["DQ filter", "null → exception"], ["Refund flag", "< 0 → review"]])}
      ${lane(58, "GL detail", "#1F6F8B", [["Cleanse", "pad policy no. 8"], ["Unique", "dupes → exception"], ["Summarize", "by policy"], ["Period", "= Oct"]])}
      ${lane(112, "Match", "#6A4C93", [["Join", "on policy no."], ["J: diff", "|diff| < HK$1"], ["L: Nov join", "timing / missing"], ["R: GL only", "or DQ-failed"]])}
      ${lane(166, "Report", "#B4532A", [["Union", "all exceptions"], ["Reason code", "per row"], ["Test tool", "counts & HK$ tie"], ["Output", "Excel + Power BI"]])}
      <text x="0" y="236" font-size="11" class="sub">Every filtered row lands in the exception report; nothing is dropped.</text>
      <text x="0" y="254" font-size="11" class="sub">A real GL holds summarised journals, so in practice match against the premium sub-ledger.</text>
    </svg></div>`;
  }
  function pageDemo() {
    const R = SITE.demo.results, c = R.control;
    const ex = Object.entries(R.exceptions).sort((a, b) => b[1] - a[1]);
    return `<h2>Demo：Premium reconciliation</h2>
      <p class="muted">Policy Admin vs GL. Alteryx workflow design with dummy data (October 2026); Python reference run, counts and HK$ totals verified.</p>
      <div class="stats">
        <div class="stat"><b class="c-accent">${R.match_rate}%</b><span>${R.matched} of ${R.admin_records} matched</span></div>
        <div class="stat"><b class="c-teal">${R.exception_total}</b><span>exceptions with reason codes</span></div>
        <div class="stat"><b class="c-green">2 / 2</b><span>control totals tie</span></div>
      </div>
      <div class="card"><h3>Problem</h3><p>Month-end premium matching between two extracts is manual (VLOOKUPs) and known by one person (illustrative). Goal: match automatically, show only what a human must review, with controls an auditor can follow.</p></div>
      <div class="card"><h3>Workflow</h3>${workflowSvg()}</div>
      <div class="card"><h3>Exceptions</h3><div class="md"><table><thead><tr><th>Reason</th><th class="num">Count</th><th class="num">HK$</th></tr></thead><tbody>
        ${ex.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${v}</td><td class="num">${hk(R.exception_amounts[k] || 0)}</td></tr>`).join("")}
        <tr><th>Total</th><th class="num">${R.exception_total}</th><th></th></tr></tbody></table></div></div>
      <div class="card"><h3>Controls</h3>
        <p><b>Counts:</b> Admin ${R.admin_records} = ${R.matched} matched + ${R.admin_exception_rows} exceptions. GL ${R.gl_records} = ${R.matched} + ${R.gl_exception_rows}.</p>
        <p><b>HK$ Admin:</b> <span class="num">${hk(c.admin_total)} = ${hk(c.matched_admin)} + ${hk(c.admin_exception_amt)}</span></p>
        <p><b>HK$ GL:</b> <span class="num">${hk(c.gl_total)} = ${hk(c.matched_gl)} + ${hk(c.gl_exception_amt)}</span></p>
        <p>Matched sides differ by ${hk(c.matched_rounding_diff)} (${R.rounding_within_tol} rounding items within tolerance). Refunds are flagged, not rejected.</p></div>
      <div class="card"><h3>Where AI fits next, under control</h3><ul>
        <li><b>Classify:</b> suggest a reason for unexplained exceptions.</li>
        <li><b>Draft:</b> Copilot drafts the variance note; numbers come from the workflow, not the model.</li>
        <li><b>Review:</b> items above a HK$ threshold always get a human.</li>
        <li><b>Measure:</b> track AI accuracy against reviewer decisions monthly.</li></ul></div>
      <details class="card"><summary>Exception report（${SITE.demo.exceptions.length} rows）</summary><div class="md"><table><thead><tr><th>Side</th><th>Reason</th><th>Policy</th><th class="num">HK$</th></tr></thead><tbody>
        ${SITE.demo.exceptions.map((r) => `<tr><td>${esc(r.side)}</td><td>${esc(r.reason)}</td><td>${esc(r.policy)}</td><td class="num">${hk(+r.amount_hkd)}</td></tr>`).join("")}</tbody></table></div></details>`;
  }

  function pageReference() {
    const ovSrc = section(ov, /^Sources$/i);
    return `<h2>Reference</h2><div class="card md">${md((DOCS.reference || "").replace(/^# .+\n/, ""))}</div>
      ${ovSrc ? `<div class="card md"><h3>總覽 tab 來源</h3>${md(ovSrc)}</div>` : ""}`;
  }

  // ---------- router ----------
  const PAGES = [
    ["home", "首頁", pageHome], ["bank", "問題庫", pageBank, wireBank], ["usecases", "Use case", pageUsecases],
    ["practice", "練習", pagePractice, wirePractice], ["star", "STAR", pageStar], ["sheets", "Cheat sheet", pageSheets, wireSheets],
    ["demo", "Demo", pageDemo], ["ref", "來源", pageReference],
  ];
  document.getElementById("tabs").innerHTML = PAGES.map(([k, l]) => `<a href="#${k}" data-p="${k}">${l}</a>`).join("");
  let lastPage = null;
  function render() {
    const key = location.hash.slice(1) || "home";
    const p = PAGES.find((x) => x[0] === key) || PAGES[0];
    if (p[0] !== "practice") stopTimer();
    $view.innerHTML = p[2](); if (p[3]) p[3]();
    document.querySelectorAll("nav.tabs a").forEach((a) => a.classList.toggle("on", a.dataset.p === p[0]));
    document.querySelectorAll("[data-mark]").forEach((el) => el.classList.toggle("done", Ans.filled(el.dataset.mark)));
    if (lastPage !== p[0]) window.scrollTo(0, 0);
    lastPage = p[0];
  }
  window.addEventListener("hashchange", render);
  render();
  Ans.init();

  function tick() {
    const ms = INTERVIEW - Date.now(); const el = document.getElementById("countdown"); if (!el) return;
    if (ms <= 0) { el.textContent = "面試日"; return; }
    const h = Math.floor(ms / 3.6e6), m = Math.floor((ms % 3.6e6) / 6e4);
    el.textContent = h >= 24 ? `距離面試 ${Math.floor(h / 24)} 日 ${h % 24} 小時` : `距離面試 ${h} 小時 ${m} 分`;
  }
  tick(); setInterval(tick, 30000);
})();

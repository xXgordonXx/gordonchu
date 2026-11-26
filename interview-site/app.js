/* Interview prep site: everything is derived from window.SITE (built by build.py from content/*.md). */
(function () {
  "use strict";
  const SITE = window.SITE;
  if (!SITE) return;
  const DOCS = SITE.docs;
  const INTERVIEW = new Date("2026-11-27T09:00:00+08:00");
  const $view = document.getElementById("view");
  const store = {
    get(k, d) { try { const v = localStorage.getItem("prep:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("prep:" + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const md = (s) => marked.parse(s || "");
  const mdInline = (s) => marked.parseInline(s || "");

  // ---------- markdown helpers ----------
  // Split a doc into sections by heading level: [{title, level, body}]
  function sections(text, level) {
    const re = new RegExp("^" + "#".repeat(level) + " (.+)$", "gm");
    const out = []; let m, last = null;
    while ((m = re.exec(text))) {
      if (last) last.body = text.slice(last.start, m.index);
      last = { title: m[1].trim(), level, start: re.lastIndex };
      out.push(last);
    }
    if (last) last.body = text.slice(last.start);
    out.forEach((s) => delete s.start);
    return out;
  }
  function section(text, re) {
    for (const lvl of [2, 3, 1]) {
      const hit = sections(text, lvl).find((s) => re.test(s.title));
      if (hit) return hit.body.trim();
    }
    return "";
  }
  const splitRow = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
  // All pipe tables in a text, with the nearest preceding headings: [{h2, h3, intro, header, rows}]
  function tables(text) {
    const lines = text.split("\n"); const out = [];
    let h2 = "", h3 = "", lastPara = "";
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^## /.test(l)) { h2 = l.slice(3).trim(); h3 = ""; lastPara = ""; continue; }
      if (/^### /.test(l)) { h3 = l.slice(4).trim(); lastPara = ""; continue; }
      if (/^\|/.test(l) && /^\|\s*:?-{2,}/.test(lines[i + 1] || "")) {
        const header = splitRow(l); const rows = []; i += 2;
        while (i < lines.length && /^\|/.test(lines[i])) rows.push(splitRow(lines[i++]));
        i--; out.push({ h2, h3, intro: lastPara, header, rows });
        continue;
      }
      if (l.trim() && !/^\|/.test(l)) lastPara = l.trim();
    }
    return out;
  }
  const isBlank = (s) => !s || /^(\s|<br\s*\/?>|-|—)*$/i.test(s);

  // ---------- question bank ----------
  const CATS = [
    ["behavioural", "Behavioural"], ["technical", "Technical"], ["performance", "Performance"],
    ["ai", "AI"], ["domain", "Domain"],
  ];
  const CAT_LABEL = Object.fromEntries(CATS);
  function categorise(doc, h2, h3, q) {
    const t = (h2 + " " + h3 + " " + q).toLowerCase();
    if (/performance|效能|慢|優化|index/.test(t)) return "performance";
    if (/\bai\b|copilot|genai|agentic|hallucination/.test(t)) return "ai";
    if (/behaviou?ral|use case|加分題/.test(t)) return "behavioural";
    if (doc === "ifrs17" || doc === "other" || /ifrs|月結|保險|保費|佣金|理賠|chubb/.test(t)) return "domain";
    if (doc === "usecases") return "behavioural";
    return "technical";
  }
  function buildQuestions() {
    const qs = [];
    for (const [doc, text] of Object.entries(DOCS)) {
      if (/^(reference|overview)$/.test(doc)) continue;
      for (const t of tables(text)) {
        const H = t.header.map((h) => h.toLowerCase());
        const qi = H.findIndex((h) => /問題|question|題目/.test(h));
        if (qi < 0) continue;
        const hi = H.findIndex((h) => /想聽|重點|要點|答法|key|tip|點答|答題|model/.test(h));
        const ai = H.findIndex((h) => /你嘅答案|我嘅答案|my answer|your answer/.test(h));
        // Use case tables are "問題 | 你嘅答案" prompts for one story: fold into one card.
        if (doc === "usecases" && H.length === 2 && t.h3) {
          const filled = t.rows.filter((r) => !isBlank(r[1]));
          qs.push({
            id: "uc:" + t.h3, doc, cat: "behavioural", src: "Use case",
            q: "Tell me about a time: " + t.h3.replace(/^\d+\.\s*/, ""),
            hint: t.intro.replace(/^面試官想聽[：:]\s*/, ""),
            ans: filled.map((r) => `- **${r[0]}**：${r[1]}`).join("\n"),
            prompts: t.rows.map((r) => r[0]),
          });
          continue;
        }
        t.rows.forEach((r) => {
          if (isBlank(r[qi])) return;
          const q = r[qi];
          const others = r.map((c, j) => ({ h: t.header[j], c })).filter((x, j) => j !== qi && j !== ai && j !== hi && !isBlank(x.c));
          qs.push({
            id: doc + ":" + q, doc, cat: categorise(doc, t.h2, t.h3, q),
            src: [t.h2, t.h3].filter(Boolean).join(" › "),
            q, hint: hi >= 0 ? r[hi] : "",
            ans: ai >= 0 && !isBlank(r[ai]) ? r[ai] : "",
            extra: others.map((x) => `**${x.h}**：${x.c}`).join("<br>"),
          });
        });
      }
    }
    return qs;
  }
  const QUESTIONS = buildQuestions();

  function answerBlock(q) {
    const mine = store.get("ans:" + q.id, "");
    const fromDoc = q.ans ? `<div class="md">${md(q.ans)}</div>` : "";
    const draft = mine ? `<div class="md">${md(mine)}</div>` : "";
    if (!fromDoc && !draft) return `<p class="empty">未填。可以喺 doc「Use case 填寫」填，或者撳「寫草稿」（只存喺呢部機）。</p>`;
    return fromDoc + (draft ? `<div class="label">我嘅草稿</div>${draft}` : "");
  }
  function questionCard(q, opts) {
    opts = opts || {};
    return `<div class="card" data-id="${esc(q.id)}">
      <p class="q"><span class="tag">${CAT_LABEL[q.cat]}</span>${mdInline(q.q)}</p>
      ${q.src ? `<div class="muted">${esc(q.src)}</div>` : ""}
      ${q.hint ? `<div class="label">面試官想聽</div><div>${mdInline(q.hint)}</div>` : ""}
      ${q.extra ? `<div class="muted" style="margin-top:6px">${mdInline(q.extra)}</div>` : ""}
      ${q.prompts && !q.ans ? `<div class="label">要講到</div><div class="muted">${q.prompts.map(esc).join(" · ")}</div>` : ""}
      <div class="label">我嘅答案</div>
      <div class="ans">${answerBlock(q)}</div>
      ${opts.noEdit ? "" : `<details class="edit"><summary>寫草稿</summary>
        <textarea placeholder="英文答案草稿（只存喺呢部機嘅瀏覽器）">${esc(store.get("ans:" + q.id, ""))}</textarea>
        <div class="row"><button class="btn ghost save">儲存</button><span class="muted saved"></span></div></details>`}
    </div>`;
  }
  function wireEdits(root) {
    root.querySelectorAll(".card[data-id]").forEach((card) => {
      const b = card.querySelector(".save"); if (!b) return;
      b.onclick = () => {
        const id = card.dataset.id; const v = card.querySelector("textarea").value.trim();
        store.set("ans:" + id, v);
        card.querySelector(".ans").innerHTML = answerBlock(QUESTIONS.find((x) => x.id === id));
        card.querySelector(".saved").textContent = "已儲存";
      };
    });
  }

  // ---------- pages ----------
  const ov = DOCS.overview || "";
  function pageHome() {
    const three = section(ov, /三點|三個重點/);
    const pitchM = ov.match(/One-line pitch[^\n]*?[：:]\s*\*?"?([^\n]+)/i);
    const pitch = pitchM ? pitchM[1].replace(/^\*+|\*+$/g, "").replace(/^"|"$/g, "") : "";
    const threeList = three.split(/\n(?=one-line pitch|講動機)/i)[0];
    const rest = three.slice(threeList.length).replace(/^One-line pitch[^\n]*\n?/im, "");
    const asks = section(ov, /反問/);
    const fri = section(DOCS.other || "", /星期五|當日/);
    const checklist = section(ov, /仲要準備|checklist/i);
    const demoR = SITE.demo.results;
    return `
      ${pitch ? `<div class="card pitch">${mdInline(pitch)}</div>` : ""}
      <div class="card"><h3>三個重點</h3><div class="md">${md(threeList)}</div>${rest.trim() ? `<div class="md muted">${md(rest)}</div>` : ""}</div>
      <div class="card"><h3>Demo 一句講晒</h3><p>${demoR.admin_records} policies, <b>${demoR.match_rate}%</b> matched automatically, ${demoR.exception_total} exceptions with reason codes, record count and HK$ control totals tie on both sides. <a href="#demo">睇 demo →</a></p></div>
      <div class="card"><h3>反問問題</h3><div class="md">${md(asks)}</div></div>
      ${fri ? `<div class="card"><h3>星期五當日</h3><div class="md check">${checkify(fri, "fri")}</div></div>` : ""}
      ${checklist ? `<div class="card"><h3>仲要準備</h3><div class="md check">${checkify(checklist, "prep")}</div></div>` : ""}
      <div class="card"><div class="row"><a class="btn" href="#practice" style="text-decoration:none;display:inline-block">開始練習 →</a><span class="muted">${QUESTIONS.length} 條題目</span></div></div>`;
  }
  // Render "- [ ]" lists (or plain bullets) as persistent tick boxes.
  function checkify(text, key) {
    const done = store.get("chk:" + key, {});
    let n = 0;
    const html = text.split("\n").map((l) => {
      const m = l.match(/^\s*[-*]\s+(\[[ xX]\]\s+)?(.+)$/);
      if (!m) return l.trim() ? `<p>${mdInline(l)}</p>` : "";
      const i = n++; const on = done[i] ?? /\[[xX]\]/.test(m[1] || "");
      return `<li><label><input type="checkbox" data-k="${key}" data-i="${i}" ${on ? "checked" : ""}>${mdInline(m[2])}</label></li>`;
    }).join("");
    return html.replace(/(<li>[\s\S]*<\/li>)/, "<ul>$1</ul>");
  }
  document.addEventListener("change", (e) => {
    const t = e.target; if (!t.dataset || !t.dataset.k) return;
    const d = store.get("chk:" + t.dataset.k, {}); d[t.dataset.i] = t.checked; store.set("chk:" + t.dataset.k, d);
  });

  function pageBank() {
    const cat = store.get("bankCat", "all"); const qtext = store.get("bankQ", "");
    const list = QUESTIONS.filter((q) => (cat === "all" || q.cat === cat) &&
      (!qtext || (q.q + q.hint + q.ans + (q.extra || "")).toLowerCase().includes(qtext.toLowerCase())));
    const counts = Object.fromEntries(CATS.map(([k]) => [k, QUESTIONS.filter((q) => q.cat === k).length]));
    return `<h2>問題庫</h2>
      <div class="chips">${[["all", "全部"], ...CATS].map(([k, l]) => `<button class="chip ${k === cat ? "on" : ""}" data-cat="${k}">${l} ${k === "all" ? QUESTIONS.length : counts[k]}</button>`).join("")}</div>
      <input type="search" id="bankQ" placeholder="搜尋題目、關鍵字" value="${esc(qtext)}">
      <div id="bankList">${list.map((q) => questionCard(q)).join("") || `<p class="empty">冇符合嘅題目</p>`}</div>`;
  }
  function wireBank() {
    $view.querySelectorAll("[data-cat]").forEach((b) => (b.onclick = () => { store.set("bankCat", b.dataset.cat); render(); }));
    const s = document.getElementById("bankQ");
    s.oninput = () => { store.set("bankQ", s.value); const pos = s.selectionStart; render(); const n = document.getElementById("bankQ"); n.focus(); n.setSelectionRange(pos, pos); };
    wireEdits($view);
  }

  // Practice mode
  let P = { cat: "all", q: null, left: 120, timer: null, shown: false, seen: [] };
  function pickQuestion() {
    const pool = QUESTIONS.filter((q) => P.cat === "all" || q.cat === P.cat);
    let fresh = pool.filter((q) => !P.seen.includes(q.id));
    if (!fresh.length) { P.seen = []; fresh = pool; }
    P.q = fresh[Math.floor(Math.random() * fresh.length)] || null;
    if (P.q) P.seen.push(P.q.id);
    P.left = 120; P.shown = false; stopTimer();
  }
  function stopTimer() { if (P.timer) clearInterval(P.timer); P.timer = null; }
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  function pagePractice() {
    if (!P.q) pickQuestion();
    const q = P.q;
    return `<h2>練習模式</h2>
      <div class="chips">${[["all", "全部"], ...CATS].map(([k, l]) => `<button class="chip ${k === P.cat ? "on" : ""}" data-pcat="${k}">${l}</button>`).join("")}</div>
      ${q ? `<div class="card">
        <p class="q" style="font-size:18px"><span class="tag">${CAT_LABEL[q.cat]}</span>${mdInline(q.q)}</p>
        <div class="timer ${P.left <= 20 ? "low" : ""}" id="clock">${mmss(P.left)}</div>
        <div class="bar"><i id="bar" style="width:${(P.left / 120) * 100}%"></i></div>
        <div class="row" style="justify-content:center">
          <button class="btn" id="go">${P.timer ? "暫停" : P.left < 120 ? "繼續" : "開始 2 分鐘"}</button>
          <button class="btn ghost" id="reveal">${P.shown ? "收埋答案" : "睇答案"}</button>
          <button class="btn ghost" id="next">下一題</button>
        </div>
      </div>
      <div id="revealed">${P.shown ? questionCard(q, { noEdit: true }) : ""}</div>
      <p class="muted">今次已練 ${P.seen.length} 題。用英文大聲答，答完先睇答案。</p>` : `<p class="empty">呢個類別冇題目</p>`}`;
  }
  function wirePractice() {
    $view.querySelectorAll("[data-pcat]").forEach((b) => (b.onclick = () => { P.cat = b.dataset.pcat; P.seen = []; pickQuestion(); render(); }));
    const go = document.getElementById("go"); if (!go) return;
    go.onclick = () => {
      if (P.timer) { stopTimer(); render(); return; }
      P.timer = setInterval(() => {
        P.left = Math.max(0, P.left - 1);
        const c = document.getElementById("clock"), b = document.getElementById("bar");
        if (!c) { stopTimer(); return; }
        c.textContent = mmss(P.left); c.classList.toggle("low", P.left <= 20); b.style.width = (P.left / 120) * 100 + "%";
        if (P.left === 0) { stopTimer(); P.shown = true; if (navigator.vibrate) navigator.vibrate(200); render(); }
      }, 1000);
      render();
    };
    document.getElementById("reveal").onclick = () => { P.shown = !P.shown; render(); };
    document.getElementById("next").onclick = () => { pickQuestion(); render(); };
  }

  // STAR stories: one card per story heading, linked to questions that mention it.
  function pageStar() {
    const text = DOCS.star || "";
    let stories = sections(text, 3); if (stories.length < 2) stories = sections(text, 2);
    const intro = text.split(/\n#{2,3} /)[0].replace(/^# .+\n/, "");
    return `<h2>STAR 故事</h2>${intro.trim() ? `<div class="md muted">${md(intro)}</div>` : ""}
      ${stories.map((s) => {
        const key = s.title.replace(/[（(].*$/, "").trim();
        const linked = QUESTIONS.filter((q) => q.ans && q.ans.toLowerCase().includes(key.toLowerCase().slice(0, 12)));
        const maps = s.body.match(/(?:對應|適用|Use for|可以答)[^\n]*/i);
        return `<div class="card"><h3>${esc(s.title)}</h3>
          ${maps ? `<p class="muted">${mdInline(maps[0])}</p>` : ""}
          ${linked.length ? `<p class="muted">問題庫引用：${linked.map((q) => esc(q.q)).join(" · ")}</p>` : ""}
          <details open><summary>內容</summary><div class="md">${md(s.body)}</div></details></div>`;
      }).join("")}`;
  }

  // Cheat sheets: rendered docs with a heading index.
  const SHEETS = [
    ["ifrs17", "IFRS 17 同月結"], ["alteryx-sql", "Alteryx / SQL"], ["transformation", "Transformation"],
    ["dwh-dg", "DWH / DG"], ["other", "其他重點"],
  ];
  function sheetDocs(key) { return Object.keys(DOCS).filter((d) => d === key || d.startsWith(key + "-")).sort(); }
  function pageSheets() {
    const avail = SHEETS.filter(([k]) => sheetDocs(k).length);
    let cur = store.get("sheet", avail[0] && avail[0][0]);
    if (!avail.find(([k]) => k === cur)) cur = avail[0] && avail[0][0];
    if (!cur) return `<p class="empty">未有 cheat sheet 內容</p>`;
    const text = sheetDocs(cur).map((d) => DOCS[d]).join("\n\n");
    const heads = sections(text, 2);
    return `<h2>Cheat sheets</h2>
      <div class="chips">${avail.map(([k, l]) => `<button class="chip ${k === cur ? "on" : ""}" data-sheet="${k}">${l}</button>`).join("")}</div>
      ${heads.length > 2 ? `<div class="card toc">${heads.map((h, i) => `<a href="#sheets" data-jump="h${i}">${esc(h.title)}</a>`).join("")}</div>` : ""}
      <div class="card md" id="sheetBody">${md(text)}</div>`;
  }
  function wireSheets() {
    $view.querySelectorAll("[data-sheet]").forEach((b) => (b.onclick = () => { store.set("sheet", b.dataset.sheet); render(); window.scrollTo(0, 0); }));
    const h2s = $view.querySelectorAll("#sheetBody h2");
    $view.querySelectorAll("[data-jump]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); const el = h2s[+a.dataset.jump.slice(1)]; if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }));
  }

  // Demo: summary + workflow diagram drawn from results.json.
  const hk = (v) => "HK$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function workflowSvg() {
    const lane = (y, label, color, steps) => {
      const w = 116, gap = 10, x0 = 92;
      return `<rect x="0" y="${y}" width="84" height="46" rx="8" fill="${color}"/>
        <text x="42" y="${y + 28}" text-anchor="middle" font-size="12" font-weight="600" style="fill:#fff">${label}</text>` +
        steps.map((s, i) => {
          const x = x0 + i * (w + gap);
          return `<rect x="${x}" y="${y}" width="${w}" height="46" rx="8" fill="none" stroke="${color}" stroke-width="1.5"/>
            <text x="${x + w / 2}" y="${y + 20}" text-anchor="middle" font-size="11.5" font-weight="600">${s[0]}</text>
            <text x="${x + w / 2}" y="${y + 35}" text-anchor="middle" font-size="10" class="sub">${s[1]}</text>` +
            (i < steps.length - 1 ? `<path d="M${x + w} ${y + 23} h${gap}" stroke="${color}" stroke-width="1.5"/>` : "");
        }).join("");
    };
    return `<svg viewBox="0 0 600 270" width="100%" role="img" aria-label="Reconciliation workflow">
      ${lane(4, "Policy Admin", "#1F6F8B", [["Input", "extract"], ["HKD", "premium × FX"], ["DQ filter", "null → exception"], ["Refund flag", "< 0 → review"]])}
      ${lane(58, "GL detail", "#1F6F8B", [["Cleanse", "pad policy no. 8"], ["Unique", "dupes → exception"], ["Summarize", "by policy"], ["Period", "= Oct"]])}
      ${lane(112, "Match", "#6A4C93", [["Join", "on policy no."], ["J: diff", "|diff| < HK$1"], ["L: Nov join", "timing / missing"], ["R: GL only", "or DQ-failed"]])}
      ${lane(166, "Report", "#B4532A", [["Union", "all exceptions"], ["Reason code", "per row"], ["Test tool", "counts & HK$ tie"], ["Output", "Excel + Power BI"]])}
      <text x="0" y="240" font-size="11" class="sub">Every filtered row lands in the exception report; nothing is dropped.</text>
      <text x="0" y="258" font-size="11" class="sub">Real GL holds summarised journals, so in practice match against the premium sub-ledger.</text>
    </svg>`;
  }
  function pageDemo() {
    const R = SITE.demo.results, c = R.control;
    const ex = Object.entries(R.exceptions).sort((a, b) => b[1] - a[1]);
    return `<h2>Demo：Premium reconciliation</h2>
      <p class="muted">Policy Admin vs GL, Alteryx workflow design with dummy data (October 2026). Python reference run; counts and HK$ totals verified.</p>
      <div class="stats" style="margin-bottom:12px">
        <div class="stat"><b style="color:var(--accent)">${R.match_rate}%</b><span>${R.matched} of ${R.admin_records} matched</span></div>
        <div class="stat"><b style="color:var(--teal)">${R.exception_total}</b><span>exceptions, each with a reason code</span></div>
        <div class="stat"><b style="color:var(--green)">2 / 2</b><span>control totals tie</span></div>
      </div>
      <div class="card"><h3>Problem</h3><p>Month-end premium matching between two extracts is manual (VLOOKUPs) and known by one person (illustrative). Goal: match automatically, show only what a human must review, with controls an auditor can follow.</p></div>
      <div class="card"><h3>Workflow</h3>${workflowSvg()}</div>
      <div class="card md"><h3>Exceptions</h3><table><thead><tr><th>Reason</th><th style="text-align:right">Count</th><th style="text-align:right">HK$</th></tr></thead><tbody>
        ${ex.map(([k, v]) => `<tr><td>${esc(k)}</td><td style="text-align:right">${v}</td><td style="text-align:right">${hk(R.exception_amounts[k] || 0)}</td></tr>`).join("")}
        <tr><th>Total</th><th style="text-align:right">${R.exception_total}</th><th></th></tr></tbody></table></div>
      <div class="card"><h3>Controls</h3>
        <p><b>Counts:</b> Admin ${R.admin_records} = ${R.matched} matched + ${R.admin_exception_rows} exceptions. GL ${R.gl_records} = ${R.matched} + ${R.gl_exception_rows}.</p>
        <p><b>HK$ Admin:</b> ${hk(c.admin_total)} = ${hk(c.matched_admin)} + ${hk(c.admin_exception_amt)}</p>
        <p><b>HK$ GL:</b> ${hk(c.gl_total)} = ${hk(c.matched_gl)} + ${hk(c.gl_exception_amt)}</p>
        <p>Matched sides differ by ${hk(c.matched_rounding_diff)} (${R.rounding_within_tol} rounding items within tolerance). Refunds are flagged, not rejected.</p></div>
      <div class="card"><h3>Where AI fits next, under control</h3><ul>
        <li><b>Classify:</b> suggest a reason for unexplained exceptions.</li>
        <li><b>Draft:</b> Copilot drafts the variance note; numbers come from the workflow, not the model.</li>
        <li><b>Review:</b> items above a HK$ threshold always get a human.</li>
        <li><b>Measure:</b> track AI accuracy against reviewer decisions monthly.</li></ul></div>
      <details class="card"><summary>Exception report（${SITE.demo.exceptions.length} rows）</summary><div class="md"><table><thead><tr><th>Side</th><th>Reason</th><th>Policy</th><th style="text-align:right">HK$</th></tr></thead><tbody>
        ${SITE.demo.exceptions.map((r) => `<tr><td>${esc(r.side)}</td><td>${esc(r.reason)}</td><td>${esc(r.policy)}</td><td style="text-align:right">${hk(+r.amount_hkd)}</td></tr>`).join("")}</tbody></table></div></details>
      <p><a href="demo/Recon_Demo_OnePager.pdf">一頁紙 PDF</a></p>`;
  }

  function pageReference() {
    const text = DOCS.reference || "";
    const ovSrc = section(ov, /^Sources$/i);
    return `<h2>Reference</h2><div class="card md">${md(text.replace(/^# .+\n/, ""))}</div>
      ${ovSrc ? `<div class="card md"><h3>總覽 tab 來源</h3>${md(ovSrc)}</div>` : ""}`;
  }

  // ---------- router ----------
  const PAGES = [
    ["home", "首頁", "⌂", pageHome], ["bank", "問題庫", "Q", pageBank, wireBank], ["practice", "練習", "▶", pagePractice, wirePractice],
    ["star", "STAR", "★", pageStar], ["sheets", "Cheat", "≡", pageSheets, wireSheets], ["demo", "Demo", "◇", pageDemo], ["ref", "來源", "§", pageReference],
  ];
  document.getElementById("tabs").innerHTML = PAGES.map(([k, l, ic]) => `<a href="#${k}" data-p="${k}"><span class="ic">${ic}</span>${l}</a>`).join("");
  let lastPage = null;
  function render() {
    const key = (location.hash.slice(1) || "home");
    const p = PAGES.find((x) => x[0] === key) || PAGES[0];
    if (p[0] !== "practice") stopTimer();
    $view.innerHTML = p[3]();
    if (p[4]) p[4]();
    document.querySelectorAll("nav.tabs a").forEach((a) => a.classList.toggle("on", a.dataset.p === p[0]));
    if (lastPage !== p[0]) window.scrollTo(0, 0);
    lastPage = p[0];
  }
  window.addEventListener("hashchange", render);
  render();

  function tick() {
    const ms = INTERVIEW - Date.now(); const el = document.getElementById("countdown");
    if (ms <= 0) { el.textContent = "面試日 · 加油"; return; }
    const h = Math.floor(ms / 3.6e6), m = Math.floor((ms % 3.6e6) / 6e4);
    el.textContent = h >= 24 ? `距離面試 ${Math.floor(h / 24)} 日 ${h % 24} 小時` : `距離面試 ${h} 小時 ${m} 分`;
  }
  tick(); setInterval(tick, 30000);
})();

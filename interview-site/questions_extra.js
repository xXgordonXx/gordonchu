/* Extra likely questions not already in the doc's tables. hint = 面試官想聽 / 答題方向（廣東話）。
   Facts about the candidate are never filled in here; answers are written by the candidate. */
window.EXTRA_QS = [
  // ---- Behavioural / role fit ----
  { cat: "behavioural", q: "Why this role, and why CFO Transformation specifically?", hint: "連到三份工：trusted data、automation、AI enablement；講你想由 BI 轉去落手改善 finance 流程" },
  { cat: "behavioural", q: "What do you understand this role to be doing day to day?", hint: "Alteryx / SQL 建對數同報表 workflow、DQ、同 finance 用家傾需求、文件化；AI 係之後嘅事" },
  { cat: "behavioural", q: "Walk me through your CV in two minutes.", hint: "每份工一句：做咩、用咩工具、一個數字成果；最後連去呢份工" },
  { cat: "behavioural", q: "Tell me about a time you worked closely with finance or accounting users.", hint: "你點樣理解佢哋嘅月結壓力、用佢哋嘅語言、交付咗咩" },
  { cat: "behavioural", q: "Tell me about a time you worked with IT to get data or access.", hint: "清楚寫需求、跟進、明白 IT 嘅限制（security、change control）" },
  { cat: "behavioural", q: "Describe a project where you owned the whole thing end to end.", hint: "由需求到上線到交接；你自己做咗邊部分要講清楚" },
  { cat: "behavioural", q: "How do you make sure your numbers are right before you send them?", hint: "record count、control total、同上期比較、抽樣核對、第二個人睇" },
  { cat: "behavioural", q: "Tell me about a time you found a problem nobody asked you to look at.", hint: "主動、有數據支持、提出方案而唔係淨係報問題" },
  { cat: "behavioural", q: "How do you handle a request when you don't fully understand the business logic?", hint: "問 data owner、用真實例子確認、寫低假設俾對方 sign off" },
  { cat: "behavioural", q: "What kind of manager or team do you work best with?", hint: "誠實但正面；配合呢個 team 係 transformation、要自己主動" },
  { cat: "behavioural", q: "What is your notice period and expected salary?", hint: "準備一個數字範圍同 notice period；唔好即場估" },
  { cat: "behavioural", q: "Do you have any questions for us?", hint: "用首頁嘅反問問題；最少準備三條" },

  // ---- Technical: Alteryx ----
  { cat: "technical", q: "Walk me through how you would build a premium reconciliation in Alteryx.", hint: "Input → cleanse key → Unique 搵重複 → Summarize → Join（J/L/R）→ 每個 exception 有 reason code → Union → Test tool 檢查 count 同 HK$ total → Output。可以用 demo 講" },
  { cat: "technical", q: "What do the J, L and R outputs of the Join tool mean, and what do you do with each?", hint: "J = matched，L = 左邊冇對到，R = 右邊冇對到；L 同 R 唔可以丟，要入 exception report" },
  { cat: "technical", q: "Join vs Join Multiple vs Union vs Append Fields: when do you use each?", hint: "Join 按 key 對；Join Multiple 多個 input 同一 key；Union 上下疊；Append Fields 係 cartesian，小心行數爆" },
  { cat: "technical", q: "Standard macro vs batch macro vs iterative macro?", hint: "Standard = 重用邏輯；Batch = 每個 group / 檔案跑一次（例如每個月）；Iterative = 循環到條件滿足" },
  { cat: "technical", q: "How do you make an Alteryx workflow maintainable for someone else?", hint: "Tool Container 分段、annotation、命名、參數放 Text Input 或 config 檔、唔好 hard-code 路徑、SOP" },
  { cat: "technical", q: "How would you schedule and monitor workflows so failures are noticed?", hint: "Alteryx Server / Gallery 或者 Alteryx One 排程；失敗發 email；log；Test tool 令 control 唔夾時 workflow 停" },
  { cat: "technical", q: "How do you handle a source file whose format or columns change?", hint: "Dynamic Input / Select 嘅 unknown field 設定、加 schema check、失敗即停，唔好靜靜雞出錯數" },
  { cat: "technical", q: "How would you handle data type issues such as policy numbers losing leading zeros?", hint: "一律轉 string、PadLeft 到固定長度；demo 入面 GL policy no. 就係咁處理" },
  // ---- Technical: SQL ----
  { cat: "technical", q: "How do you find records in table A that are not in table B?", hint: "LEFT JOIN ... WHERE b.key IS NULL，或者 NOT EXISTS；小心 NOT IN 遇到 NULL" },
  { cat: "technical", q: "How do you find and remove duplicates in SQL?", hint: "GROUP BY key HAVING COUNT(*) > 1；ROW_NUMBER() OVER (PARTITION BY key ORDER BY ...) = 1 留最新一筆" },
  { cat: "technical", q: "Explain WHERE vs HAVING.", hint: "WHERE 喺 aggregate 之前 filter 行；HAVING 喺 GROUP BY 之後 filter group" },
  { cat: "technical", q: "Give an example of a window function you have used.", hint: "LAG 做 month-over-month、SUM() OVER 做 running total、ROW_NUMBER 揀最新記錄" },
  { cat: "technical", q: "Write a query for total premium by product by month, with the change from last month.", hint: "GROUP BY product, month 再 LAG(total) OVER (PARTITION BY product ORDER BY month)" },
  { cat: "technical", q: "CTE vs subquery vs temp table: how do you choose?", hint: "CTE 易讀；temp table 可以加 index、重用、大數據量；subquery 簡單情況" },
  { cat: "technical", q: "How do NULLs affect joins, COUNT and SUM?", hint: "NULL = NULL 唔成立所以 join 唔到；COUNT(col) 唔計 NULL；SUM 忽略 NULL；用 COALESCE" },
  // ---- Technical: Excel / Power Query / Power BI / Python ----
  { cat: "technical", q: "XLOOKUP vs VLOOKUP vs INDEX/MATCH?", hint: "XLOOKUP 可以向左、預設 exact match、有 if_not_found；VLOOKUP 插欄會錯" },
  { cat: "technical", q: "When would you use Power Query instead of Alteryx?", hint: "用家自己喺 Excel 維護、數據量細、冇 Alteryx license；Alteryx 適合多來源、大量、排程" },
  { cat: "technical", q: "In Power BI, what is a star schema and why does it matter?", hint: "fact table + dimension tables；DAX 簡單、效能好、關係清楚" },
  { cat: "technical", q: "Measure vs calculated column in Power BI?", hint: "Measure 按 filter context 即時計，唔佔 storage；calculated column 每行存起" },
  { cat: "technical", q: "How would you restrict a Power BI report so each team sees only its own data?", hint: "Row-level security，按 role 同 dimension filter" },
  { cat: "technical", q: "When would you use Python rather than Alteryx?", hint: "複雜邏輯、要 version control 同 unit test、冇 license；但 finance 用家維護 Alteryx 較易" },
  { cat: "technical", q: "How do you test a workflow before it goes live?", hint: "test cases 包括 edge cases（null、負數、重複）、同人手結果 parallel run、control total tie" },

  // ---- Data quality / governance ----
  { cat: "technical", q: "Which data quality dimensions do you check?", hint: "Completeness、accuracy、consistency、timeliness、validity、uniqueness；每個舉一個保險例子" },
  { cat: "technical", q: "What controls would you build into an automated finance workflow?", hint: "record count、control total、reasonableness check、maker-checker、access control、change log、exception 唔可以消失" },
  { cat: "technical", q: "What is data lineage and why does audit care about it?", hint: "數字由 source 去到報表嘅路徑；auditor 要追得返每個數" },
  { cat: "technical", q: "Who should own a data quality rule: Finance, IT or the data team?", hint: "Business（data owner）定義規則，data team 實施同監察，IT 管系統；RACI" },
  { cat: "technical", q: "Master data vs reference data vs transactional data, with insurance examples?", hint: "Master：保單、客戶、agent；Reference：產品代碼、貨幣、GL account；Transactional：保費、理賠、佣金" },

  // ---- Domain ----
  { cat: "domain", q: "Explain IFRS 17 in simple terms.", hint: "保險合約按 group 計量：未來現金流現值 + risk adjustment + CSM（未賺利潤，隨服務攤銷）；三個 model：GMM/BBA、PAA、VFA" },
  { cat: "domain", q: "Why does IFRS 17 make data harder for finance?", hint: "要更細嘅 granularity（cohort、portfolio）、actuarial 同 accounting 數據要接埋、更多 disclosure 同 reconciliation" },
  { cat: "domain", q: "How does premium data flow from policy admin to the general ledger?", hint: "Policy admin → premium sub-ledger → posting rules → GL journals（summarised）；所以實際係對 sub-ledger，再 sub-ledger 對 GL by account" },
  { cat: "domain", q: "Written premium vs earned premium vs collected premium?", hint: "Written = 簽發；Earned = 按保障期間賺到；Collected = 實際收到錢" },
  { cat: "domain", q: "What are the main month-end close steps, and where does a data analyst add value?", hint: "cut-off → sub-ledger 結 → 對數 → accruals / adjustments → reporting → review；analyst 喺對數自動化、exception、報表" },
  { cat: "domain", q: "Why might actuarial numbers and accounting numbers not tie?", hint: "時間點、granularity、假設、數據來源唔同；要有 reconciliation 同清楚定義" },
  { cat: "domain", q: "How would you treat FX differences in a premium reconciliation?", hint: "用邊個 rate（transaction vs month-end）、設 tolerance、分開 FX exception 同真正金額差異" },
  { cat: "domain", q: "What do you know about Generali and its current strategy?", hint: "Lifetime Partner 27：AI & Data-Driven Excellence；有來源先講，推測要講明" },
  { cat: "domain", q: "What regulatory or group reporting would an HK life insurer's finance team handle?", hint: "IFRS 17 財報、Insurance Authority 監管報表、集團 reporting；唔肯定嘅細節唔好扮識" },

  // ---- Transformation ----
  { cat: "technical", q: "How would you decide which finance processes to automate first?", hint: "頻率 × 工時 × 錯誤風險 × 難度；先揀數據已經有、影響大、易量度嘅 quick win" },
  { cat: "technical", q: "How do you gather requirements from finance users who are busy at month-end?", hint: "避開月結、睇佢做一次（shadowing）、攞真實檔案、寫低步驟再確認" },
  { cat: "technical", q: "How do you run UAT and a parallel run with finance?", hint: "test cases、用家簽收、parallel run 一至兩個月結、差異要解釋、先 cut over" },
  { cat: "technical", q: "How do you make sure a workflow keeps running when you are on leave?", hint: "SOP、backup owner、監察同 alert、交接 session、文件放共用位置" },
  { cat: "technical", q: "What would you deliver in your first 90 days?", hint: "首頁 90 日計劃：1–30 日學流程同 data owner，31–60 日 1–2 個 use case，61–90 日上線同量度" },

  // ---- AI (gaps not in the doc table) ----
  { cat: "ai", q: "What does AI enablement in finance mean to you?", hint: "唔止係用 Copilot：數據準備好、揀 use case、做試點、governance 同 controls、量度成效、培訓用家、上線後監察" },
  { cat: "ai", q: "How would you use Copilot in Excel or Power BI in your daily work?", hint: "寫 formula / DAX 初稿、解釋舊 workflow、寫文件；結果一定自己核對" },
  { cat: "ai", q: "What is RAG, and is there a finance use case for it?", hint: "先搵相關文件再生成答案；例如 accounting policy / SOP 問答；要有來源引用" },
  { cat: "ai", q: "How do you prepare data so that AI can use it?", hint: "乾淨、定義清楚、有 governance 同權限、敏感資料 masking；所以先做 trusted data" },
  { cat: "ai", q: "How could Azure AI or OCR help finance?", hint: "Document Intelligence 讀單據 / 發票，再用 rule 同人手覆核；量度準確率" },

  // ---- Performance (gaps) ----
  { cat: "performance", q: "Your reconciliation used to run in minutes and now takes an hour. How do you investigate?", hint: "數據量變咗？新 join fan-out？source 慢？先量度每一步時間，再改最大嗰個" },
];


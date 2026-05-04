/* ═══════════════════════════════════════════════
   NetWatch — script.js
   Handles: monitoring loop, filtering,
   stats, logs, clock, service mapping
═══════════════════════════════════════════════ */

"use strict";

// ── PORT → SERVICE MAP ────────────────────────────────────────────────────
const SERVICE_MAP = {
  20: "FTP-Data", 21: "FTP", 22: "SSH", 23: "Telnet",
  25: "SMTP", 53: "DNS", 67: "DHCP", 68: "DHCP",
  80: "HTTP", 110: "POP3", 143: "IMAP", 161: "SNMP",
  194: "IRC", 443: "HTTPS", 465: "SMTPS", 587: "SMTP-TLS",
  993: "IMAPS", 995: "POP3S", 3306: "MySQL", 3389: "RDP",
  5432: "PostgreSQL", 6379: "Redis", 8080: "HTTP-Alt",
  8443: "HTTPS-Alt", 27017: "MongoDB"
};

function getService(port) {
  return SERVICE_MAP[port] || "—";
}

// ── SAMPLE DATASET ────────────────────────────────────────────────────────
// Simulates CSV rows loaded from backend (or static file)
const DATASET = [
  { src:"192.168.1.10", dst:"8.8.8.8",      proto:"UDP",  srcPort:54321, dstPort:53,   size:78  },
  { src:"192.168.1.5",  dst:"142.250.77.46", proto:"TCP",  srcPort:49201, dstPort:443,  size:512 },
  { src:"10.0.0.4",     dst:"192.168.1.1",   proto:"ICMP", srcPort:0,     dstPort:0,    size:64  },
  { src:"192.168.1.15", dst:"93.184.216.34", proto:"TCP",  srcPort:50002, dstPort:80,   size:340 },
  { src:"192.168.1.22", dst:"172.217.3.110", proto:"TCP",  srcPort:51000, dstPort:443,  size:890 },
  { src:"10.0.0.7",     dst:"8.8.4.4",       proto:"UDP",  srcPort:12345, dstPort:53,   size:92  },
  { src:"192.168.1.3",  dst:"192.168.1.1",   proto:"TCP",  srcPort:22,    dstPort:22,   size:200 },
  { src:"192.168.1.8",  dst:"151.101.65.69", proto:"TCP",  srcPort:52000, dstPort:443,  size:1024},
  { src:"10.0.0.12",    dst:"192.168.1.20",  proto:"ICMP", srcPort:0,     dstPort:0,    size:64  },
  { src:"192.168.1.19", dst:"104.26.10.125", proto:"TCP",  srcPort:48900, dstPort:80,   size:256 },
  { src:"192.168.1.5",  dst:"8.8.8.8",       proto:"UDP",  srcPort:55000, dstPort:53,   size:100 },
  { src:"192.168.1.30", dst:"192.30.255.112",proto:"TCP",  srcPort:53001, dstPort:22,   size:180 },
  { src:"10.0.0.2",     dst:"208.67.222.222",proto:"UDP",  srcPort:60100, dstPort:53,   size:88  },
  { src:"192.168.1.11", dst:"52.94.236.248", proto:"TCP",  srcPort:49800, dstPort:443,  size:760 },
  { src:"192.168.1.18", dst:"192.168.1.1",   proto:"TCP",  srcPort:50900, dstPort:3306, size:430 },
  { src:"10.0.0.5",     dst:"192.168.1.15",  proto:"ICMP", srcPort:0,     dstPort:0,    size:64  },
  { src:"192.168.1.6",  dst:"185.60.216.35", proto:"TCP",  srcPort:51200, dstPort:443,  size:612 },
  { src:"192.168.1.25", dst:"8.8.8.8",       proto:"UDP",  srcPort:63000, dstPort:53,   size:75  },
  { src:"192.168.1.7",  dst:"91.198.174.192",proto:"TCP",  srcPort:50400, dstPort:80,   size:310 },
  { src:"10.0.0.9",     dst:"192.168.1.1",   proto:"ICMP", srcPort:0,     dstPort:0,    size:64  },
  { src:"192.168.1.14", dst:"151.101.0.81",  proto:"TCP",  srcPort:52800, dstPort:8080, size:450 },
  { src:"192.168.1.2",  dst:"172.67.128.0",  proto:"TCP",  srcPort:49600, dstPort:443,  size:980 },
  { src:"10.0.0.3",     dst:"8.8.4.4",       proto:"UDP",  srcPort:57200, dstPort:53,   size:84  },
  { src:"192.168.1.17", dst:"13.107.42.14",  proto:"TCP",  srcPort:50100, dstPort:443,  size:720 },
  { src:"192.168.1.9",  dst:"192.168.1.1",   proto:"TCP",  srcPort:8080,  dstPort:8080, size:190 },
];

// ── STATE ─────────────────────────────────────────────────────────────────
let allRows     = [];        // full captured data
let filteredRows = null;     // null = no filter active
let isRunning   = false;
let monitorInterval = null;
let elapsedInterval = null;
let dataIndex   = 0;
let rowCounter  = 0;
let startTime   = null;
let sessionId   = null;
let elapsed     = 0;

// ── CLOCK ─────────────────────────────────────────────────────────────────
function tickClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  const ss = String(now.getSeconds()).padStart(2,'0');
  document.getElementById("clockDisplay").textContent = `${hh}:${mm}:${ss}`;
}
setInterval(tickClock, 1000);
tickClock();

// ── SESSION ELAPSED TIMER ─────────────────────────────────────────────────
function fmtElapsed(s) {
  const m = String(Math.floor(s/60)).padStart(2,'0');
  const sec = String(s%60).padStart(2,'0');
  return `${m}:${sec}`;
}

// ── LOG ───────────────────────────────────────────────────────────────────
function addLog(msg, cls = "log-info") {
  const box = document.getElementById("logBox");
  const d   = document.createElement("div");
  const now = new Date();
  const ts  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  d.className = `log-entry ${cls}`;
  d.textContent = `[${ts}] ${msg}`;
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
}

function clearLog() {
  document.getElementById("logBox").innerHTML = "";
  addLog("Log cleared.", "log-warn");
}

// ── START / STOP ──────────────────────────────────────────────────────────
function startMonitoring() {
  if (isRunning) return;

  isRunning  = true;
  dataIndex  = 0;
  elapsed    = 0;
  startTime  = new Date();
  sessionId  = "SES-" + Math.random().toString(36).substr(2,6).toUpperCase();

  document.getElementById("btnStart").disabled = true;
  document.getElementById("btnStop").disabled  = false;
  document.getElementById("siSession").textContent = sessionId;

  const pill = document.getElementById("statusPill");
  pill.classList.add("active");
  document.getElementById("statusText").textContent = "ACTIVE";

  // Clear table
  allRows      = [];
  filteredRows = null;
  rowCounter   = 0;
  renderTable(allRows);
  updateStats();

  addLog(`Session ${sessionId} started.`, "log-start");
  addLog(`Dataset loaded — ${DATASET.length} records queued.`, "log-info");

  // Elapsed timer
  elapsedInterval = setInterval(() => {
    elapsed++;
    document.getElementById("siElapsed").textContent = fmtElapsed(elapsed);
  }, 1000);

  // Packet feed — one row every 800ms
  monitorInterval = setInterval(() => {
    if (dataIndex >= DATASET.length) {
      addLog("Dataset exhausted. Monitoring complete.", "log-warn");
      stopMonitoring();
      return;
    }

    const raw  = DATASET[dataIndex];
    const now  = new Date();
    const ts   = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    const row  = { ...raw, time: ts };

    allRows.push(row);
    rowCounter++;
    dataIndex++;

    document.getElementById("siCaptured").textContent = rowCounter;

    const display = filteredRows !== null ? applyFilterToRows(allRows) : allRows;
    renderTable(display);
    updateStats();

    addLog(`PKT #${rowCounter}  ${raw.proto}  ${raw.src} → ${raw.dst}  [${raw.size}B]`, "log-packet");
  }, 800);
}

function stopMonitoring() {
  if (!isRunning) return;
  isRunning = false;

  clearInterval(monitorInterval);
  clearInterval(elapsedInterval);
  monitorInterval = null;

  document.getElementById("btnStart").disabled = false;
  document.getElementById("btnStop").disabled  = true;

  const pill = document.getElementById("statusPill");
  pill.classList.remove("active");
  document.getElementById("statusText").textContent = "IDLE";

  addLog(`Session ${sessionId} stopped. ${rowCounter} packets captured.`, "log-stop");
}

// ── RENDER TABLE ─────────────────────────────────────────────────────────
function renderTable(rows) {
  const tbody = document.getElementById("tableBody");
  document.getElementById("pktCounter").textContent = `${rows.length} record${rows.length!==1?'s':''}`;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">
      <div class="empty-state">
        <span class="empty-icon">◌</span>
        <span>No packets captured yet</span>
      </div></td></tr>`;
    return;
  }

  // Render newest-first
  const sorted = [...rows].reverse();
  tbody.innerHTML = sorted.map((r, i) => {
    const svc     = getService(r.dstPort);
    const badgeCls = `proto-${r.proto.toLowerCase()}`;
    const num     = rows.length - i;
    return `<tr class="${i === 0 ? 'row-new' : ''}">
      <td>${num}</td>
      <td>${r.time}</td>
      <td>${r.src}</td>
      <td>${r.dst}</td>
      <td><span class="proto-badge ${badgeCls}">${r.proto}</span></td>
      <td>${r.srcPort || '—'}</td>
      <td>${r.dstPort || '—'}</td>
      <td class="service-tag">${svc}</td>
      <td>${r.size} B</td>
    </tr>`;
  }).join("");
}

// ── STATS ─────────────────────────────────────────────────────────────────
function updateStats() {
  const rows = allRows;
  const total = rows.length;

  const cntTCP  = rows.filter(r=>r.proto==="TCP").length;
  const cntUDP  = rows.filter(r=>r.proto==="UDP").length;
  const cntICMP = rows.filter(r=>r.proto==="ICMP").length;

  const avgSize = total > 0
    ? Math.round(rows.reduce((s,r)=>s+r.size,0)/total)
    : 0;

  document.getElementById("statTotal").textContent   = total;
  document.getElementById("statAvgSize").textContent = avgSize + " B";
  document.getElementById("cntTCP").textContent      = cntTCP;
  document.getElementById("cntUDP").textContent      = cntUDP;
  document.getElementById("cntICMP").textContent     = cntICMP;

  // Protocol bars
  const pct = (n) => total > 0 ? Math.round((n/total)*100) + "%" : "0%";
  document.getElementById("barTCP").style.width  = pct(cntTCP);
  document.getElementById("barUDP").style.width  = pct(cntUDP);
  document.getElementById("barICMP").style.width = pct(cntICMP);
}

// ── FILTER ────────────────────────────────────────────────────────────────
function applyFilterToRows(rows) {
  const proto = document.getElementById("filterProto").value.trim();
  const src   = document.getElementById("filterSrc").value.trim().toLowerCase();
  const dst   = document.getElementById("filterDst").value.trim().toLowerCase();

  return rows.filter(r => {
    if (proto && r.proto !== proto) return false;
    if (src   && !r.src.toLowerCase().includes(src)) return false;
    if (dst   && !r.dst.toLowerCase().includes(dst)) return false;
    return true;
  });
}

function applyFilter() {
  const proto = document.getElementById("filterProto").value.trim();
  const src   = document.getElementById("filterSrc").value.trim();
  const dst   = document.getElementById("filterDst").value.trim();

  if (!proto && !src && !dst) {
    document.getElementById("filterResult").textContent = "No filter criteria entered.";
    return;
  }

  filteredRows = applyFilterToRows(allRows);
  renderTable(filteredRows);

  const parts = [];
  if (proto) parts.push(`proto=${proto}`);
  if (src)   parts.push(`src=${src}`);
  if (dst)   parts.push(`dst=${dst}`);

  document.getElementById("filterResult").textContent =
    `${filteredRows.length} match(es) — ${parts.join(", ")}`;

  addLog(`Filter applied [${parts.join(", ")}] → ${filteredRows.length} result(s)`, "log-filter");
}

function resetFilter() {
  document.getElementById("filterProto").value = "";
  document.getElementById("filterSrc").value   = "";
  document.getElementById("filterDst").value   = "";
  document.getElementById("filterResult").textContent = "";
  filteredRows = null;
  renderTable(allRows);
  addLog("Filter cleared. Showing all records.", "log-filter");
}

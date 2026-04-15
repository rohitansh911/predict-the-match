import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

// ─────────────────────────────────────────────────────────────
//  CONFIG  — swap these two lines with your Firebase values
// ─────────────────────────────────────────────────────────────
const FB_URL = "https://my-react-app-backend-f2a7a-default-rtdb.asia-southeast1.firebasedatabase.app";
const FB_API_KEY = "AIzaSyDi_xSLqMk3K-IEzifeWTCn8LFlj7IKlls";

// ─────────────────────────────────────────────────────────────
//  COLOURS & FONT
// ─────────────────────────────────────────────────────────────
const C = {
  bg: "#020214", card: "#07071F", border: "#12125A",
  pink: "#FF1170", pinkD: "#7A0035",
  blue: "#00D4FF", blueD: "#004466",
  gold: "#FFD700", goldD: "#7A5800",
  white: "#EEF0FF", dim: "#5566AA",
  green: "#00FF88", red: "#FF2200",
};
const PF = "'Press Start 2P', monospace";

// ─────────────────────────────────────────────────────────────
//  DEVICE ID  (write-once guard)
// ─────────────────────────────────────────────────────────────
function getDeviceId() {
  const K = "_ptm_did";
  let id = localStorage.getItem(K);
  if (!id) {
    id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem(K, id);
  }
  return id;
}

// ─────────────────────────────────────────────────────────────
//  FIREBASE HELPERS
// ─────────────────────────────────────────────────────────────
const fbRead = async (path) => {
  try { return await (await fetch(`${FB_URL}/${path}.json`)).json(); }
  catch { return null; }
};
const fbWrite = async (path, data, tok) => {
  const r = await fetch(`${FB_URL}/${path}.json${tok ? `?auth=${tok}` : ""}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  const j = await r.json();
  if (j?.error) throw new Error(j.error);
  return j;
};
const adminLogin = async (email, pw) => {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FB_API_KEY}`,
    {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pw, returnSecureToken: true })
    }
  );
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.idToken;
};
const submitPrediction = async (form) => {
  const did = getDeviceId();
  const san = (s, n = 50) => String(s).replace(/[<>"'`;&]/g, "").trim().slice(0, n);
  const safe = {
    nickname: san(form.nickname, 20),
    team: form.team === "team1" ? "team1" : "team2",
    team1Score: `${Math.min(400, Math.max(0, +form.t1r || 0))}/${Math.min(10, Math.max(0, +form.t1w || 0))}`,
    team2Score: `${Math.min(400, Math.max(0, +form.t2r || 0))}/${Math.min(10, Math.max(0, +form.t2w || 0))}`,
    mom: san(form.mom, 40),
    timestamp: Date.now(),
  };
  const r = await fetch(`${FB_URL}/submissions/${did}.json`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(safe),
  });
  const j = await r.json();
  if (j?.error) {
    if (/permission/i.test(j.error)) throw new Error("ALREADY_SUBMITTED");
    throw new Error(j.error);
  }
};

// ─────────────────────────────────────────────────────────────
//  SCORING
// ─────────────────────────────────────────────────────────────
function calcScore(pred, match) {
  if (!match?.realScore) return null;
  const p = s => { const [r, w] = (s || "0/0").split("/"); return [+r || 0, +w || 0]; };
  const [r1a, w1a] = p(match.realScore.team1), [r2a, w2a] = p(match.realScore.team2);
  const [r1p, w1p] = p(pred.team1Score), [r2p, w2p] = p(pred.team2Score);
  // Only score the predicted runs/wickets for the WINNING team
  const team1Won = r1a > r2a;
  const [rWa, wWa] = team1Won ? [r1a, w1a] : [r2a, w2a];
  const [rWp, wWp] = team1Won ? [r1p, w1p] : [r2p, w2p];
  const runPts = (a, b) => Math.max(0, 30 - Math.abs(a - b));
  let pts = runPts(rWp, rWa) + (wWp === wWa ? 10 : 0);
  if (r1p + r2p > 0 && (r1p > r2p) === (r1a > r2a)) pts += 20;
  if (pred.mom?.trim().toLowerCase() === match.realMOM?.trim().toLowerCase()) pts += 20;
  return pts;
}

// ─────────────────────────────────────────────────────────────
//  GLOBAL STYLES
// ─────────────────────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{background:${C.bg};color:${C.white};font-family:${PF};-webkit-font-smoothing:none;overflow-x:hidden}
::-webkit-scrollbar{width:5px;background:${C.card}}
::-webkit-scrollbar-thumb{background:${C.pink}}

input,select{
  font-family:${PF}!important;font-size:8px;
  background:#08082A;border:3px solid ${C.border};
  color:${C.white};padding:11px 12px;width:100%;outline:none;
  border-radius:0;-webkit-appearance:none;transition:border .15s,box-shadow .15s;
}
input:focus,select:focus{border-color:${C.blue};box-shadow:0 0 0 2px ${C.blue}33}
input::placeholder{color:${C.dim}}
select option{background:#08082A}

.btn{
  font-family:${PF}!important;font-size:8px;letter-spacing:1px;
  text-transform:uppercase;cursor:pointer;border:none;padding:13px 18px;
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  transition:transform .08s,box-shadow .08s;user-select:none;
}
.btn:disabled{opacity:.45;cursor:not-allowed;transform:none!important}
.btn:not(:disabled):hover{transform:translate(-2px,-2px)}
.btn:not(:disabled):active{transform:translate(2px,2px)}
.btn-pink{background:${C.pink};color:#fff;box-shadow:4px 4px 0 ${C.pinkD};border:2px solid #FF66AA}
.btn-pink:not(:disabled):hover{box-shadow:6px 6px 0 ${C.pinkD}}
.btn-blue{background:${C.blue};color:#000;box-shadow:4px 4px 0 ${C.blueD};border:2px solid #88EEFF}
.btn-blue:not(:disabled):hover{box-shadow:6px 6px 0 ${C.blueD}}
.btn-gold{background:${C.gold};color:#000;box-shadow:4px 4px 0 ${C.goldD};border:2px solid #FFE566}
.btn-gold:not(:disabled):hover{box-shadow:6px 6px 0 ${C.goldD}}
.btn-red{background:#CC0000;color:#fff;box-shadow:4px 4px 0 #660000;border:2px solid #FF4444}
.btn-red:not(:disabled):hover{box-shadow:6px 6px 0 #660000}

.card{background:${C.card};border:3px solid ${C.border};padding:18px}
.card-pink{background:${C.card};border:3px solid ${C.pink};padding:18px;box-shadow:4px 4px 0 ${C.pinkD}}
.card-blue{background:${C.card};border:3px solid ${C.blue};padding:18px;box-shadow:4px 4px 0 ${C.blueD}}
.card-gold{background:${C.card};border:3px solid ${C.gold};padding:18px;box-shadow:4px 4px 0 ${C.goldD}}

.gpink{color:${C.pink};text-shadow:0 0 10px ${C.pink}99}
.gblue{color:${C.blue};text-shadow:0 0 10px ${C.blue}99}
.ggold{color:${C.gold};text-shadow:0 0 10px ${C.gold}99}
.ggreen{color:${C.green};text-shadow:0 0 10px ${C.green}99}

.lbl{font-size:7px;color:${C.dim};display:block;margin-bottom:7px;text-transform:uppercase;letter-spacing:1px}
.fg{margin-bottom:14px}

.err{font-size:7px;color:${C.pink};text-align:center;padding:10px;background:${C.pink}18;border:2px solid ${C.pink}44;margin-bottom:12px}
.ok{font-size:7px;color:${C.green};text-align:center;padding:10px;background:${C.green}18;border:2px solid ${C.green}44;margin-bottom:12px}

.pxdiv{height:4px;background:repeating-linear-gradient(90deg,${C.pink} 0 8px,transparent 8px 16px);margin:16px 0}
.pxdiv-b{height:4px;background:repeating-linear-gradient(90deg,${C.blue} 0 8px,transparent 8px 16px);margin:16px 0}

@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes fly{0%{transform:translate(0,0) rotate(0deg)}25%{transform:translate(18px,-22px) rotate(90deg)}50%{transform:translate(36px,-10px) rotate(180deg)}75%{transform:translate(52px,-30px) rotate(270deg)}100%{transform:translate(72px,0px) rotate(360deg)}}
@keyframes stumble{0%,100%{transform:rotate(0deg)}20%{transform:rotate(-15deg) translateX(-3px)}40%{transform:rotate(25deg) translateX(3px)}60%{transform:rotate(-8deg)}80%{transform:rotate(12deg)}}
@keyframes crowd{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.4)}}
@keyframes slide{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:translateX(0)}}
@keyframes glow{0%,100%{text-shadow:0 0 6px ${C.pink}66}50%{text-shadow:0 0 20px ${C.pink},0 0 40px ${C.pink}88}}
@keyframes goldglow{0%,100%{text-shadow:0 0 10px ${C.gold}99,0 0 30px ${C.gold}44}50%{text-shadow:0 0 30px ${C.gold},0 0 60px ${C.gold},0 0 100px ${C.gold}88}}
@keyframes drop{0%{opacity:0;transform:translateY(-100px) scale(.75)}65%{transform:translateY(12px) scale(1.05)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes pop{0%{opacity:0;transform:scale(0) rotate(-6deg)}65%{transform:scale(1.15) rotate(2deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
@keyframes suspense{0%{letter-spacing:0px;opacity:.3}100%{letter-spacing:10px;opacity:1}}
@keyframes winner{0%{opacity:0;transform:scale(.4) rotate(-4deg)}60%{transform:scale(1.12) rotate(1deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
@keyframes riseped{from{transform:scaleY(0);transform-origin:bottom}to{transform:scaleY(1);transform-origin:bottom}}
@keyframes cf0{0%{transform:translate(0,0) rotate(0)}100%{transform:translate(-80px,160px) rotate(400deg);opacity:0}}
@keyframes cf1{0%{transform:translate(0,0) rotate(0)}100%{transform:translate(80px,150px) rotate(-350deg);opacity:0}}
@keyframes cf2{0%{transform:translate(0,0) rotate(0)}100%{transform:translate(-40px,140px) rotate(300deg);opacity:0}}
@keyframes cf3{0%{transform:translate(0,0) rotate(0)}100%{transform:translate(100px,170px) rotate(-400deg);opacity:0}}
@keyframes cf4{0%{transform:translate(0,0) rotate(0)}100%{transform:translate(-100px,180px) rotate(380deg);opacity:0}}
@keyframes cf5{0%{transform:translate(0,0) rotate(0)}100%{transform:translate(50px,190px) rotate(-300deg);opacity:0}}
@keyframes flashbg{0%,100%{background:transparent}50%{background:${C.gold}18}}

.blink{animation:blink 1s step-end infinite}
.up{animation:up .4s ease-out both}
.glow{animation:glow 2s ease-in-out infinite}
.goldglow{animation:goldglow 1.8s ease-in-out infinite}
.slide{animation:slide .35s ease-out both}
.drop{animation:drop .6s cubic-bezier(.22,.68,0,1.2) both}
.pop{animation:pop .55s cubic-bezier(.22,.68,0,1.2) both}

/* scanlines */
.scanlines::after{
  content:'';position:fixed;inset:0;pointer-events:none;z-index:9999;
  background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.1) 3px,rgba(0,0,0,.1) 4px);
}

/* nav tabs */
.nav{display:flex;gap:0;border-bottom:3px solid ${C.border};margin-bottom:24px}
.nav-tab{
  font-family:${PF};font-size:7px;padding:10px 14px;cursor:pointer;
  border:none;background:transparent;color:${C.dim};letter-spacing:1px;
  border-bottom:3px solid transparent;margin-bottom:-3px;transition:color .15s;
}
.nav-tab.active{color:${C.pink};border-bottom-color:${C.pink};background:${C.pink}11}
.nav-tab:hover:not(.active){color:${C.white}}

/* pixel bg */
.pixbg{
  background-image:
    radial-gradient(ellipse at 10% 70%,${C.pink}20 0%,transparent 50%),
    radial-gradient(ellipse at 90% 20%,${C.blue}18 0%,transparent 50%),
    radial-gradient(ellipse at 50% 100%,${C.gold}0D 0%,transparent 40%);
}
`;

// ─────────────────────────────────────────────────────────────
//  PIXEL ART — SVG Cricket Scene
// ─────────────────────────────────────────────────────────────
function CricketScene({ animate = false }) {
  return (
    <svg width="320" height="120" viewBox="0 0 320 120" style={{ imageRendering: "pixelated", display: "block", margin: "0 auto" }}>
      {/* Sky gradient bg */}
      <rect width="320" height="120" fill="#020214" />

      {/* Stars */}
      {[[20, 8], [60, 15], [100, 5], [150, 12], [200, 7], [250, 10], [290, 14], [35, 25], [80, 20], [180, 18], [310, 22]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="2" height="2" fill={i % 2 === 0 ? "#FFD700" : "#00D4FF"} opacity={.7} />
      ))}

      {/* Crowd (pixel people silhouettes) */}
      {[20, 36, 52, 68, 84, 100, 116, 132, 148, 164, 180, 196, 212, 228, 244, 260, 276, 292].map((x, i) => (
        <g key={x}>
          <rect x={x} y={52} width={8} height={14} fill={i % 3 === 0 ? C.pink : i % 3 === 1 ? C.blue : "#AA44FF"} opacity={.55}
            style={animate ? { animation: `crowd ${.8 + i * .07}s ease-in-out infinite`, transformOrigin: `${x + 4}px 66px` } : {}} />
          <rect x={x + 1} y={44} width={6} height={8} fill={i % 3 === 0 ? "#FF88AA" : i % 3 === 1 ? "#88EEFF" : "#CC88FF"} opacity={.5} />
        </g>
      ))}

      {/* Pitch */}
      <rect x="60" y="78" width="200" height="30" fill="#3A2800" rx="0" />
      <rect x="60" y="78" width="200" height="4" fill="#5A3E00" />
      {/* Crease lines */}
      <rect x="80" y="78" width="4" height="30" fill="#F0E8C0" opacity=".6" />
      <rect x="236" y="78" width="4" height="30" fill="#F0E8C0" opacity=".6" />
      {/* Pitch texture dots */}
      {[[100, 85], [130, 90], [160, 83], [190, 88], [220, 84]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="3" height="3" fill="#6B5000" opacity=".5" />
      ))}

      {/* Grass */}
      <rect x="0" y="108" width="320" height="12" fill="#0A3A0A" />
      {[10, 25, 42, 58, 75, 92, 108, 125, 142, 158, 175, 192, 208, 225, 242, 258, 275, 292, 308].map((x, i) => (
        <g key={x}>
          <rect x={x} y={102} width="3" height={6 + i % 3 * 2} fill={i % 2 === 0 ? "#0D5A0D" : "#0A4A0A"} />
          <rect x={x + 4} y={104} width="2" height={4 + i % 2 * 3} fill="#0D5A0D" />
        </g>
      ))}

      {/* ─── STUMPS (left end) ─── */}
      <g>
        {/* bails */}
        <rect x="83" y="72" width="16" height="3" fill="#F5DEB3" />
        <rect x="84" y="71" width="4" height="2" fill="#C8A84B" />
        <rect x="91" y="71" width="4" height="2" fill="#C8A84B" />
        {/* stumps */}
        {[83, 88, 93].map((x, i) => (
          <rect key={i} x={x} y={74} width={4} height={32}
            fill={i === 1 ? "#FFD700" : "#DEB887"}
            style={i === 1 && animate ? { animation: "stumble .4s ease-out 1.5s both", transformOrigin: `${x + 2}px 74px` } : {}} />
        ))}
      </g>

      {/* ─── STUMPS (right end) ─── */}
      <g>
        <rect x="221" y="72" width="16" height="3" fill="#F5DEB3" />
        <rect x="222" y="71" width="4" height="2" fill="#C8A84B" />
        <rect x="229" y="71" width="4" height="2" fill="#C8A84B" />
        {[221, 226, 231].map((x, i) => (
          <rect key={i} x={x} y={74} width={4} height={32} fill={i === 1 ? "#FFD700" : "#DEB887"} />
        ))}
      </g>

      {/* ─── BATSMAN (pixel character) ─── */}
      <g>
        {/* body */}
        <rect x="198" y="58" width="14" height="18" fill="#FF1170" />
        {/* head */}
        <rect x="200" y="50" width="10" height="10" fill="#FFCCAA" />
        {/* helmet */}
        <rect x="199" y="48" width="12" height="6" fill="#CC0055" />
        <rect x="199" y="48" width="12" height="3" fill="#FF1170" />
        {/* bat */}
        <rect x="210" y="62" width="5" height="22" fill="#DEB887" />
        <rect x="210" y="62" width="5" height="5" fill="#C8A84B" />
        {/* legs */}
        <rect x="200" y="76" width="5" height="14" fill="#FFFFFF" />
        <rect x="207" y="76" width="5" height="14" fill="#FFFFFF" />
        {/* shoes */}
        <rect x="198" y="88" width="7" height="5" fill="#222" />
        <rect x="207" y="88" width="7" height="5" fill="#222" />
        {/* gloves */}
        <rect x="196" y="64" width="5" height="6" fill="#FFD700" />
      </g>

      {/* ─── BOWLER ─── */}
      <g>
        <rect x="102" y="62" width="12" height="16" fill="#00D4FF" />
        <rect x="103" y="54" width="10" height="10" fill="#FFCCAA" />
        <rect x="102" y="52" width="12" height="5" fill="#005577" />
        {/* bowling arm extended */}
        <rect x="112" y="60" width="14" height="4" fill="#FFCCAA" />
        <rect x="100" y="62" width="4" height="10" fill="#00D4FF" />
        {/* legs */}
        <rect x="103" y="78" width="5" height="14" fill="#FFF" />
        <rect x="109" y="78" width="5" height="14" fill="#FFF" />
        <rect x="101" y="89" width="7" height="5" fill="#111" />
        <rect x="109" y="89" width="7" height="5" fill="#111" />
      </g>

      {/* ─── BALL ─── */}
      <g style={animate ? { animation: "fly 1.2s cubic-bezier(.2,.6,.4,1) infinite", transformOrigin: "126px 74px" } : {}}>
        <rect x="122" y="70" width="10" height="10" fill="#CC1111" />
        <rect x="122" y="70" width="10" height="2" fill="#EE2222" />
        <rect x="122" y="78" width="10" height="2" fill="#AA0000" />
        <rect x="120" y="72" width="2" height="6" fill="#AA0000" />
        <rect x="132" y="72" width="2" height="6" fill="#AA0000" />
        {/* seam */}
        <rect x="126" y="70" width="2" height="10" fill="#AA0000" opacity=".5" />
      </g>

      {/* ─── SCOREBOARD ─── */}
      <rect x="230" y="20" width="72" height="32" fill="#0A0A30" />
      <rect x="230" y="20" width="72" height="32" fill="none" stroke={C.gold} strokeWidth="2" />
      <rect x="230" y="20" width="72" height="8" fill={C.gold} opacity=".2" />
      <text x="266" y="28" textAnchor="middle" fontFamily={PF} fontSize="5" fill={C.gold}>SCORE</text>
      <text x="252" y="43" textAnchor="middle" fontFamily={PF} fontSize="9" fill={C.pink}>183</text>
      <text x="268" y="43" textAnchor="middle" fontFamily={PF} fontSize="9" fill={C.dim}>/</text>
      <text x="284" y="43" textAnchor="middle" fontFamily={PF} fontSize="9" fill={C.blue}>6</text>

      {/* ─── UMPIRE ─── */}
      <g>
        <rect x="162" y="64" width="10" height="16" fill="#FFF" />
        <rect x="163" y="57" width="8" height="9" fill="#FFCCAA" />
        <rect x="162" y="55" width="10" height="4" fill="#FFF" />
        {/* raised finger */}
        <rect x="157" y="52" width="3" height="16" fill="#FFCCAA" />
        <rect x="172" y="64" width="12" height="3" fill="#FFCCAA" />
        <rect x="162" y="80" width="4" height="12" fill="#FFF" />
        <rect x="168" y="80" width="4" height="12" fill="#FFF" />
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
//  STATUS BADGE
// ─────────────────────────────────────────────────────────────
function Badge({ status }) {
  const m = {
    open: [C.blue, "▶ PREDICTIONS OPEN"],
    locked: [C.gold, "⏸ MATCH IN PROGRESS"],
    ended: [C.pink, "🏆 MATCH ENDED"],
  };
  const [col, label] = m[status] || m.open;
  return (
    <span style={{
      fontFamily: PF, fontSize: 6, padding: "5px 10px",
      background: col + "22", border: `2px solid ${col}`, color: col,
      textShadow: `0 0 8px ${col}`, letterSpacing: 1,
    }}>{label}</span>
  );
}

// ─────────────────────────────────────────────────────────────
//  FAN VIEW
// ─────────────────────────────────────────────────────────────
function FanView({ match, submitted, onSubmit }) {
  const [form, setForm] = useState({ nickname: "", team: "", t1r: "", t1w: "5", t2r: "", t2w: "7", mom: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const t1 = match?.team1 || "Team 1";
  const t2 = match?.team2 || "Team 2";

  const submit = async () => {
    setErr("");
    if (!form.nickname.trim()) { setErr("⚠ Enter a nickname!"); return; }
    if (!form.team) { setErr("⚠ Pick your team first!"); return; }
    if (!form.t1r || isNaN(form.t1r)) { setErr(`⚠ Enter ${t1} runs!`); return; }
    if (!form.t2r || isNaN(form.t2r)) { setErr(`⚠ Enter ${t2} runs!`); return; }
    if (!form.mom.trim()) { setErr("⚠ Pick a Man of the Match!"); return; }
    setBusy(true);
    try { await onSubmit(form); }
    catch (e) {
      setErr(e.message === "ALREADY_SUBMITTED"
        ? "⚠ You already submitted for this match!"
        : "⚠ Submission failed. Try again.");
      setBusy(false);
    }
  };

  if (match?.status === "locked" || match?.status === "ended") {
    const isEnded = match.status === "ended";
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} className="pixbg">
        <div className={`card-${isEnded ? "pink" : "blue"} up`} style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>{isEnded ? "🏆" : "⏸"}</div>
          <div className={isEnded ? "gpink" : "gblue"} style={{ fontFamily: PF, fontSize: 12, marginBottom: 14 }}>
            {isEnded ? "MATCH OVER!" : "MATCH STARTED!"}
          </div>
          <div className={isEnded ? "pxdiv" : "pxdiv-b"} />
          <div style={{ fontFamily: PF, fontSize: 8, color: C.dim, lineHeight: 2.4 }}>
            {isEnded
              ? "Check the big screen\nfor the final leaderboard!"
              : "Predictions are locked.\nWatch the big screen!"}
          </div>
          <div className="blink ggold" style={{ fontFamily: PF, fontSize: 7, marginTop: 20 }}>
            ▶ WATCH THE BIG SCREEN
          </div>
        </div>
      </div>
    );
  }

  if (submitted) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} className="pixbg">
      <div className="card-pink up" style={{ maxWidth: 380, width: "100%", textAlign: "center" }}>
        <CricketScene animate />
        <div className="gpink glow" style={{ fontFamily: PF, fontSize: 14, margin: "18px 0 12px" }}>LOCKED IN!</div>
        <div className="pxdiv" />
        <div style={{ fontFamily: PF, fontSize: 8, color: C.dim, lineHeight: 2.6 }}>
          Your prediction is set.<br />May the best fan win! 🏏
        </div>
        <div className="blink ggold" style={{ fontFamily: PF, fontSize: 7, marginTop: 20 }}>
          ▶ WATCH THE BIG SCREEN FOR RESULTS
        </div>
      </div>
    </div>
  );

  return (
    <div className="pixbg" style={{ minHeight: "100vh", paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ textAlign: "center", padding: "32px 20px 24px" }}>
        <CricketScene />
        <div className="gpink glow" style={{ fontFamily: PF, fontSize: 18, letterSpacing: 3, margin: "20px 0 10px" }}>
          PREDICT
        </div>
        <div className="ggold" style={{ fontFamily: PF, fontSize: 9, marginBottom: 14 }}>
          {match?.name || "Tonight's Match"}
        </div>
        <Badge status={match?.status || "open"} />
      </div>

      <div style={{ maxWidth: 440, margin: "0 auto", padding: "0 20px" }}>

        {/* Nickname */}
        <div className="fg">
          <label className="lbl">YOUR NAME / NICKNAME</label>
          <input placeholder="CricketKing69, RoyalSniper…" value={form.nickname} onChange={sf("nickname")} maxLength={20} />
        </div>

        {/* ── TEAM SELECTOR ── */}
        <div className="fg">
          <label className="lbl">🏟 I AM SUPPORTING…</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {/* Team 1 button */}
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, team: "team1" }))}
              style={{
                fontFamily: PF, fontSize: 7, padding: "18px 8px", cursor: "pointer",
                border: form.team === "team1" ? `3px solid ${C.pink}` : `3px solid ${C.border}`,
                background: form.team === "team1" ? C.pink + "33" : C.card,
                color: form.team === "team1" ? C.pink : C.dim,
                boxShadow: form.team === "team1" ? `0 0 18px ${C.pink}55, 4px 4px 0 ${C.pinkD}` : "none",
                textAlign: "center", lineHeight: 2.2, transition: "all .15s",
                textShadow: form.team === "team1" ? `0 0 10px ${C.pink}` : "none",
              }}>
              {form.team === "team1" ? "✅" : "🏏"}<br />
              <span style={{ fontSize: 8 }}>{t1}</span>
            </button>

            {/* Team 2 button */}
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, team: "team2" }))}
              style={{
                fontFamily: PF, fontSize: 7, padding: "18px 8px", cursor: "pointer",
                border: form.team === "team2" ? `3px solid ${C.blue}` : `3px solid ${C.border}`,
                background: form.team === "team2" ? C.blue + "22" : C.card,
                color: form.team === "team2" ? C.blue : C.dim,
                boxShadow: form.team === "team2" ? `0 0 18px ${C.blue}55, 4px 4px 0 ${C.blueD}` : "none",
                textAlign: "center", lineHeight: 2.2, transition: "all .15s",
                textShadow: form.team === "team2" ? `0 0 10px ${C.blue}` : "none",
              }}>
              {form.team === "team2" ? "✅" : "🏏"}<br />
              <span style={{ fontSize: 8 }}>{t2}</span>
            </button>
          </div>
          {/* Loyalty badge shown after selection */}
          {form.team && (
            <div className="up" style={{
              marginTop: 10, padding: "8px 14px", textAlign: "center",
              fontFamily: PF, fontSize: 7, letterSpacing: 1,
              background: form.team === "team1" ? C.pink + "18" : C.blue + "18",
              border: `2px solid ${form.team === "team1" ? C.pink : C.blue}44`,
              color: form.team === "team1" ? C.pink : C.blue,
            }}>
              ⚡ {form.team === "team1" ? t1 : t2} FAN LOCKED
            </div>
          )}
        </div>
        <div className="card fg">
          <div className="gblue" style={{ fontFamily: PF, fontSize: 8, marginBottom: 16 }}>🏏 FINAL SCORE PREDICTION</div>

          {/* Team 1 */}
          <label className="lbl" style={{ color: C.pink }}>{t1}</label>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 14 }}>
            <div><label className="lbl">RUNS</label>
              <input type="number" min="0" max="400" placeholder="180" value={form.t1r} onChange={sf("t1r")} /></div>
            <div><label className="lbl">WICKETS</label>
              <select value={form.t1w} onChange={sf("t1w")}>
                {[...Array(11)].map((_, i) => <option key={i} value={i}>{i}</option>)}
              </select></div>
          </div>

          {/* VS */}
          <div style={{ textAlign: "center", fontFamily: PF, fontSize: 12, color: C.gold, letterSpacing: 6, margin: "4px 0 14px" }}>VS</div>

          {/* Team 2 */}
          <label className="lbl" style={{ color: C.blue }}>{t2}</label>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
            <div><label className="lbl">RUNS</label>
              <input type="number" min="0" max="400" placeholder="165" value={form.t2r} onChange={sf("t2r")} /></div>
            <div><label className="lbl">WICKETS</label>
              <select value={form.t2w} onChange={sf("t2w")}>
                {[...Array(11)].map((_, i) => <option key={i} value={i}>{i}</option>)}
              </select></div>
          </div>
        </div>

        {/* MOM */}
        <div className="fg">
          <label className="lbl">🏅 MAN OF THE MATCH</label>
          <input placeholder="e.g. Sanju Samson" value={form.mom} onChange={sf("mom")} maxLength={40} />
        </div>

        {err && <div className="err">{err}</div>}

        <button className="btn btn-pink" style={{ width: "100%", fontSize: 10, padding: "16px 0", marginBottom: 16 }}
          onClick={submit} disabled={busy || match?.status !== "open"}>
          {busy ? "SUBMITTING…" : "🏏 LOCK IN PREDICTION"}
        </button>

        <div style={{ fontFamily: PF, fontSize: 6, color: C.dim, textAlign: "center", lineHeight: 2.6 }}>
          One submission per device · No takebacks<br />
          Top fans crowned on the big screen 🏆
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  PIXEL CONFETTI  (fires on #1 reveal)
// ─────────────────────────────────────────────────────────────
function Confetti() {
  const pieces = [
    { color: C.gold, anim: "cf0", delay: 0, size: 10 },
    { color: C.pink, anim: "cf1", delay: .15, size: 8 },
    { color: C.blue, anim: "cf2", delay: .05, size: 12 },
    { color: C.green, anim: "cf3", delay: .2, size: 8 },
    { color: C.gold, anim: "cf4", delay: .1, size: 10 },
    { color: C.pink, anim: "cf5", delay: .25, size: 6 },
    { color: C.blue, anim: "cf0", delay: .3, size: 8 },
    { color: C.green, anim: "cf1", delay: .08, size: 10 },
    { color: C.gold, anim: "cf2", delay: .18, size: 6 },
    { color: C.pink, anim: "cf3", delay: .35, size: 12 },
    { color: C.blue, anim: "cf4", delay: .12, size: 8 },
    { color: C.gold, anim: "cf5", delay: .22, size: 10 },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1000, overflow: "hidden" }}>
      {[...Array(6)].map((_, col) =>
        pieces.map((p, i) => (
          <div key={`${col}-${i}`} style={{
            position: "absolute",
            left: `${10 + col * 16}%`,
            top: `${-5 + (i % 3) * 2}%`,
            width: p.size, height: p.size,
            background: p.color,
            animation: `${p.anim} ${1.8 + i * .15}s ease-in ${p.delay + col * .06}s both`,
          }} />
        ))
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  BIG SCREEN VIEW
// ─────────────────────────────────────────────────────────────
function BigScreen({ match, predictions }) {
  const list = Object.values(predictions || {});
  const total = list.length;

  // Win prediction %
  const t1wins = list.filter(p => { const [r1] = (p.team1Score || "0/0").split("/"); const [r2] = (p.team2Score || "0/0").split("/"); return +r1 > +r2; }).length;
  const t1pct = total ? Math.round(t1wins / total * 100) : 50;
  const t2pct = 100 - t1pct;

  // Fan loyalty
  const t1fans = list.filter(p => p.team === "team1").length;
  const t2fans = list.filter(p => p.team === "team2").length;
  const fanTotal = t1fans + t2fans || 1;
  const t1fanPct = Math.round(t1fans / fanTotal * 100);
  const t2fanPct = 100 - t1fanPct;

  // Top 3 — sorted by pts desc, then timestamp asc (earliest = tiebreak winner)
  const top3 = match?.status === "ended"
    ? [...list]
      .map(p => ({ ...p, pts: calcScore(p, match) || 0 }))
      .sort((a, b) => b.pts !== a.pts ? b.pts - a.pts : (a.timestamp || 0) - (b.timestamp || 0))
      .slice(0, 3)
    : [];

  // Reveal step: 0=waiting 1=#3 shown 2=#2 shown 3=#1 shown 4=confetti done
  const [step, setStep] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const prevStatus = useRef(match?.status);

  useEffect(() => {
    // Reset reveal whenever match transitions back to open/locked
    if (match?.status !== "ended") { setStep(0); setShowConfetti(false); return; }
    // Auto-start reveal when match first becomes "ended"
    if (prevStatus.current !== "ended" && match?.status === "ended") {
      setStep(0); setShowConfetti(false);
      const t1 = setTimeout(() => setStep(1), 2200);   // #3 after 2.2s
      const t2 = setTimeout(() => setStep(2), 5400);   // #2 after 5.4s
      const t3 = setTimeout(() => setStep(3), 9000);   // #1 after 9s
      const t4 = setTimeout(() => setShowConfetti(true), 9200); // confetti
      const t5 = setTimeout(() => setShowConfetti(false), 12000); // confetti off
      return () => [t1, t2, t3, t4, t5].forEach(clearTimeout);
    }
    // If already ended on mount (page refresh), jump straight to full reveal
    if (match?.status === "ended" && step === 0) setStep(3);
  }, [match?.status]);

  useEffect(() => { prevStatus.current = match?.status; });

  // Podium card layout: [1]=left(#2), [0]=center(#1), [2]=right(#3)
  const podiumOrder = [1, 0, 2];   // render order for 3-column podium
  const podiumH = [100, 70, 50]; // pedestal heights in px for #1,#2,#3
  const podiumStep = [3, 2, 1];    // which step triggers each to appear

  const rankLabel = ["🥇", "🥈", "🥉"];
  const rankColor = [C.gold, "#C0C0C0", "#CD7F32"];
  const rankSize = [22, 16, 14];

  return (
    <div className="scanlines pixbg" style={{ minHeight: "100vh", padding: "20px 24px 40px", fontFamily: PF }}>
      {showConfetti && <Confetti />}

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div className="gpink glow" style={{ fontSize: 18, letterSpacing: 4, marginBottom: 5 }}>🏏 PREDICT THE MATCH</div>
        <div className="ggold" style={{ fontSize: 9, marginBottom: 10, letterSpacing: 2 }}>{match?.name || ""}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Badge status={match?.status || "open"} />
          <span style={{ fontSize: 6, color: C.dim }}>{total} predictions</span>
        </div>
      </div>

      {/* Cricket scene (hide during reveal to save space) */}
      {match?.status !== "ended" && (
        <div style={{ marginBottom: 16 }}><CricketScene animate={match?.status === "open"} /></div>
      )}

      {/* Live stats bars */}
      {total > 0 && match?.status !== "ended" && (
        <div style={{ maxWidth: 700, margin: "0 auto 20px" }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 7 }}>
              <span className="gpink">📊 {match?.team1} wins {t1pct}%</span>
              <span className="gblue">{t2pct}% {match?.team2} wins</span>
            </div>
            <div style={{ height: 14, background: "#111", border: `3px solid ${C.border}`, display: "flex", overflow: "hidden" }}>
              <div style={{ width: `${t1pct}%`, background: `linear-gradient(90deg,${C.pinkD},${C.pink})`, transition: "width 1s" }} />
              <div style={{ width: `${t2pct}%`, background: `linear-gradient(90deg,${C.blue},${C.blueD})`, transition: "width 1s" }} />
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 7 }}>
              <span style={{ color: C.pink }}>❤️ {match?.team1} fans <span style={{ color: C.white, fontSize: 9 }}>{t1fans}</span> <span style={{ color: C.dim }}>({t1fanPct}%)</span></span>
              <span style={{ color: C.blue }}><span style={{ color: C.dim }}>({t2fanPct}%)</span> <span style={{ color: C.white, fontSize: 9 }}>{t2fans}</span> {match?.team2} fans 💙</span>
            </div>
            <div style={{ height: 10, background: "#111", border: `2px solid ${C.border}`, display: "flex", overflow: "hidden" }}>
              <div style={{ width: `${t1fanPct}%`, background: `repeating-linear-gradient(45deg,${C.pink},${C.pink} 4px,${C.pinkD} 4px,${C.pinkD} 8px)`, transition: "width 1s" }} />
              <div style={{ width: `${t2fanPct}%`, background: `repeating-linear-gradient(45deg,${C.blue},${C.blue} 4px,${C.blueD} 4px,${C.blueD} 8px)`, transition: "width 1s" }} />
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          LEADERBOARD — dramatic podium reveal
          ═══════════════════════════════════════════════════ */}
      {match?.status === "ended" && top3.length > 0 && (
        <div style={{ maxWidth: 780, margin: "0 auto" }}>

          {/* Real result strip */}
          {match.realScore && (
            <div style={{ textAlign: "center", fontSize: 7, color: C.dim, marginBottom: 20, lineHeight: 2.4 }}>
              FINAL RESULT &nbsp;·&nbsp;
              {match.team1} <span className="gpink" style={{ fontSize: 9 }}>{match.realScore.team1}</span>
              {" vs "}
              {match.team2} <span className="gblue" style={{ fontSize: 9 }}>{match.realScore.team2}</span>
              {match.realMOM && <> &nbsp;·&nbsp; MOM: <span className="ggold">{match.realMOM}</span></>}
            </div>
          )}

          {/* Suspense countdown text */}
          {step === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div className="ggold blink" style={{ fontSize: 14, letterSpacing: 4 }}>CALCULATING…</div>
              <div style={{ fontSize: 7, color: C.dim, marginTop: 16 }}>Checking {total} predictions…</div>
            </div>
          )}

          {step === 1 && top3[2] && (
            <div style={{ textAlign: "center", marginBottom: 10 }}>
              <div style={{
                fontFamily: PF, fontSize: 9, color: C.dim, letterSpacing: 4,
                animation: "suspense .8s ease-out both", marginBottom: 6
              }}>
                THIRD PLACE…
              </div>
            </div>
          )}
          {step === 2 && top3[1] && (
            <div style={{ textAlign: "center", marginBottom: 10 }}>
              <div style={{
                fontFamily: PF, fontSize: 9, color: "#C0C0C0", letterSpacing: 4,
                animation: "suspense .8s ease-out both", marginBottom: 6
              }}>
                RUNNER UP…
              </div>
            </div>
          )}
          {step >= 3 && top3[0] && (
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div className="goldglow" style={{
                fontFamily: PF, fontSize: 14, letterSpacing: 5,
                animation: "suspense 1s ease-out both"
              }}>
                🏆 AND THE WINNER IS…
              </div>
            </div>
          )}

          {/* ── PODIUM ── */}
          {step >= 1 && (
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 16, marginTop: 10 }}>
              {podiumOrder.map((rankIdx) => {
                const p = top3[rankIdx];
                const revealAt = podiumStep[rankIdx];
                const visible = step >= revealAt;
                if (!p) return null;
                const isWinner = rankIdx === 0;
                const pedH = podiumH[rankIdx];
                const col = rankColor[rankIdx];
                const sz = rankSize[rankIdx];
                const teamCol = p.team === "team1" ? C.pink : p.team === "team2" ? C.blue : C.dim;
                const teamName = p.team === "team1" ? match?.team1 : p.team === "team2" ? match?.team2 : null;

                return (
                  <div key={rankIdx} style={{ flex: 1, maxWidth: isWinner ? 260 : 210, display: "flex", flexDirection: "column", alignItems: "center" }}>

                    {/* Card — drops in from above */}
                    {visible && (
                      <div className="drop" style={{
                        width: "100%", padding: isWinner ? "20px 16px" : "14px 12px",
                        background: isWinner ? `linear-gradient(135deg,${C.gold}22,${C.goldD}44)` : C.card,
                        border: `${isWinner ? 4 : 3}px solid ${col}`,
                        boxShadow: isWinner
                          ? `0 0 40px ${C.gold}55, 6px 6px 0 ${C.goldD}, 0 0 80px ${C.gold}22`
                          : `4px 4px 0 ${col}66`,
                        textAlign: "center", position: "relative",
                        animation: isWinner
                          ? "winner .7s cubic-bezier(.22,.68,0,1.2) both"
                          : "drop .6s cubic-bezier(.22,.68,0,1.2) both",
                      }}>
                        {/* Rank medal */}
                        <div style={{ fontSize: sz, marginBottom: 8, filter: isWinner ? "drop-shadow(0 0 12px gold)" : "none" }}>
                          {rankLabel[rankIdx]}
                        </div>

                        {/* Nickname */}
                        <div style={{
                          fontFamily: PF, fontSize: isWinner ? 11 : 8,
                          color: isWinner ? C.gold : C.white,
                          textShadow: isWinner ? `0 0 14px ${C.gold}` : "none",
                          marginBottom: 10, wordBreak: "break-all", lineHeight: 1.8,
                          animation: isWinner ? "goldglow 2s ease-in-out infinite" : "none",
                        }}>
                          {p.nickname}
                        </div>

                        {/* Team badge */}
                        {teamName && (
                          <div style={{
                            fontFamily: PF, fontSize: 5, padding: "3px 7px", marginBottom: 10, display: "inline-block",
                            background: teamCol + "22", border: `2px solid ${teamCol}55`, color: teamCol,
                          }}>
                            {teamName} FAN
                          </div>
                        )}

                        {/* Score prediction */}
                        <div style={{ fontFamily: PF, fontSize: 7, color: C.dim, marginBottom: 4, lineHeight: 2 }}>
                          <span className="gpink">{p.team1Score}</span>
                          <span style={{ margin: "0 6px", color: C.dim }}>vs</span>
                          <span className="gblue">{p.team2Score}</span>
                        </div>

                        {/* MOM */}
                        <div style={{ fontFamily: PF, fontSize: 6, color: C.dim, marginBottom: 10 }}>
                          🏅 {p.mom}
                        </div>

                        {/* Points */}
                        <div style={{
                          fontFamily: PF, fontSize: isWinner ? 18 : 13, color: col,
                          textShadow: `0 0 12px ${col}`,
                        }}>
                          {p.pts}<span style={{ fontSize: 7, color: C.dim }}> pts</span>
                        </div>

                        {/* Winner crown pixels */}
                        {isWinner && (
                          <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 12 }}>
                            {[C.pink, C.gold, C.blue, C.gold, C.pink].map((c, i) => (
                              <div key={i} style={{
                                width: 8, height: 8, background: c,
                                animation: `blink ${.6 + i * .15}s step-end infinite`
                              }} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pedestal */}
                    <div style={{
                      width: "100%", height: pedH,
                      background: isWinner
                        ? `linear-gradient(180deg,${C.gold}88,${C.goldD})`
                        : `linear-gradient(180deg,${col}44,${col}22)`,
                      border: `3px solid ${col}`,
                      borderBottom: "none",
                      boxShadow: `inset 0 0 20px ${col}22`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transformOrigin: "bottom",
                      animation: visible ? `riseped .5s ease-out both` : "none",
                    }}>
                      <span style={{
                        fontFamily: PF, fontSize: isWinner ? 14 : 10, color: col,
                        textShadow: `0 0 8px ${col}`, transform: "rotate(-90deg)", whiteSpace: "nowrap"
                      }}>
                        #{rankIdx + 1}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tiebreak note */}
          {step >= 3 && (
            <div className="up" style={{ textAlign: "center", marginTop: 20, fontFamily: PF, fontSize: 6, color: C.dim, lineHeight: 2.2 }}>
              Tiebreaker: earliest submission wins · Scored out of 80 pts
            </div>
          )}
        </div>
      )}

      {/* Prediction wall (open/locked) */}
      {match?.status !== "ended" && (
        <div style={{ maxWidth: 1100, margin: "0 auto", columns: "3 auto", columnGap: 12 }}>
          {list.slice(-60).reverse().map((p, i) => (
            <div key={i} className="card-blue slide"
              style={{ marginBottom: 10, breakInside: "avoid", fontSize: 7, animationDelay: `${(i % 12) * .05}s` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <div className="gpink" style={{ fontSize: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  ⚡ {p.nickname}
                </div>
                {p.team && (
                  <span style={{
                    fontFamily: PF, fontSize: 5, padding: "2px 5px", marginLeft: 6, flexShrink: 0,
                    background: p.team === "team1" ? C.pink + "33" : C.blue + "22",
                    color: p.team === "team1" ? C.pink : C.blue,
                    border: `1px solid ${p.team === "team1" ? C.pink : C.blue}66`,
                  }}>
                    {p.team === "team1" ? match?.team1 || "T1" : match?.team2 || "T2"}
                  </span>
                )}
              </div>
              <div style={{ color: C.white, marginBottom: 3 }}>{match?.team1}: <span className="gpink">{p.team1Score}</span></div>
              <div style={{ color: C.white, marginBottom: 3 }}>{match?.team2}: <span className="gblue">{p.team2Score}</span></div>
              <div className="ggold">🏅 {p.mom}</div>
            </div>
          ))}
          {total === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div className="gblue blink" style={{ fontSize: 10 }}>Waiting for predictions…</div>
            </div>
          )}
        </div>
      )}

      {/* ── QR CODE (fixed bottom-right, visible when open or locked) ── */}
      {(match?.status === "open" || match?.status === "locked") && (
        <div style={{
          position: "fixed", bottom: 20, right: 20,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          zIndex: 100,
        }}>
          <div style={{
            padding: 10,
            background: "#07071F",
            border: `3px solid ${match?.status === "open" ? C.pink : C.gold}`,
            boxShadow: `0 0 20px ${match?.status === "open" ? C.pink : C.gold}44, 4px 4px 0 ${match?.status === "open" ? C.pinkD : C.goldD}`,
          }}>
            <QRCodeSVG
              value="https://predict-the-match.vercel.app"
              size={110}
              bgColor="#07071F"
              fgColor={match?.status === "open" ? C.pink : C.gold}
              level="M"
            />
          </div>
          <div
            className={match?.status === "open" ? "blink gpink" : "blink ggold"}
            style={{ fontFamily: PF, fontSize: 6, letterSpacing: 1, textAlign: "center" }}
          >
            {match?.status === "open" ? "▶ SCAN TO PREDICT" : "⏸ MATCH IN PROGRESS"}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  ADMIN PANEL
// ─────────────────────────────────────────────────────────────
function AdminPanel({ match, predictions, onMatchUpdate }) {
  const [token, setToken] = useState(null);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [mf, setMf] = useState({
    name: match?.name || "", team1: match?.team1 || "Rajasthan Royals", team2: match?.team2 || "",
    r1: "", w1: "5", r2: "", w2: "7", mom: "",
  });
  const [msg, setMsg] = useState({ text: "", ok: true });
  const [resetModal, setResetModal] = useState(false);
  const [resetInput, setResetInput] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const total = Object.keys(predictions || {}).length;
  const sf = k => e => setMf(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (!token) {
      setMf(f => ({ ...f, name: match?.name || f.name, team1: match?.team1 || f.team1, team2: match?.team2 || f.team2 }));
    }
  }, [match, token]);

  const notify = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg({ text: "", ok: true }), 3500); };

  const login = async () => {
    setLoginErr(""); setLoginBusy(true);
    try {
      const t = await adminLogin(email, pw);
      setToken(t);
      setTimeout(async () => { try { const nt = await adminLogin(email, pw); setToken(nt); } catch { } }, 55 * 60 * 1000);
    } catch (e) {
      setLoginErr(/INVALID|WRONG|NOT_FOUND/i.test(e.message) ? "⚠ Wrong email or password." : `⚠ ${e.message}`);
    }
    setLoginBusy(false);
  };

  const update = async (data) => {
    const next = { ...match, ...data };
    try { await fbWrite("match", next, token); onMatchUpdate(next); notify("✓ Saved!"); }
    catch (e) { notify(`⚠ ${/permission/i.test(e.message) ? "Session expired — re-login." : e.message}`, false); if (/permission/i.test(e.message)) setToken(null); }
  };

  const reset = async () => {
    setResetBusy(true);
    try {
      await fbWrite("submissions", null, token);
      const fresh = { status: "open", name: mf.name, team1: mf.team1, team2: mf.team2, realScore: null, realMOM: null };
      await fbWrite("match", fresh, token);
      onMatchUpdate(fresh);
      setMf(f => ({ ...f, r1: "", w1: "5", r2: "", w2: "7", mom: "" }));
      setResetModal(false); setResetInput("");
      notify(`✓ Reset! Ready for ${fresh.name}`);
    } catch (e) { notify(`⚠ Reset failed: ${e.message}`, false); }
    setResetBusy(false);
  };

  // Login screen
  if (!token) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} className="pixbg">
      <div className="card-pink up" style={{ maxWidth: 360, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔐</div>
          <div className="gpink" style={{ fontFamily: PF, fontSize: 12, marginBottom: 6 }}>ADMIN</div>
          <div style={{ fontFamily: PF, fontSize: 6, color: C.dim }}>Password verified server-side — never in source code</div>
        </div>
        <div className="fg">
          <label className="lbl">EMAIL</label>
          <input type="email" placeholder="admin@example.com" value={email}
            onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} />
        </div>
        <div className="fg">
          <label className="lbl">PASSWORD</label>
          <input type="password" placeholder="••••••••" value={pw}
            onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} />
        </div>
        {loginErr && <div className="err">{loginErr}</div>}
        <button className="btn btn-pink" style={{ width: "100%" }} onClick={login} disabled={loginBusy}>
          {loginBusy ? "LOGGING IN…" : "LOGIN"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="pixbg" style={{ minHeight: "100vh", padding: "24px 20px 60px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div className="gpink" style={{ fontFamily: PF, fontSize: 12, marginBottom: 8 }}>ADMIN PANEL</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Badge status={match?.status || "open"} />
          <span className="ggold" style={{ fontFamily: PF, fontSize: 7 }}>{total} predictions</span>
        </div>
      </div>

      <div style={{ maxWidth: 540, margin: "0 auto" }}>
        {msg.text && <div className={msg.ok ? "ok" : "err"}>{msg.text}</div>}

        {/* Match Setup */}
        <div className="card fg">
          <div className="gblue" style={{ fontFamily: PF, fontSize: 8, marginBottom: 14 }}>⚙ MATCH SETUP</div>
          <div className="fg"><label className="lbl">Match Title</label>
            <input placeholder="RR vs MI · IPL 2025" value={mf.name} onChange={sf("name")} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div><label className="lbl">Team 1 Name</label><input value={mf.team1} onChange={sf("team1")} /></div>
            <div><label className="lbl">Team 2 Name</label><input value={mf.team2} onChange={sf("team2")} /></div>
          </div>
          <button className="btn btn-blue" style={{ width: "100%" }}
            onClick={() => update({ name: mf.name, team1: mf.team1, team2: mf.team2 })}>
            SAVE MATCH INFO
          </button>
        </div>

        {/* Controls */}
        <div className="card fg">
          <div className="gblue" style={{ fontFamily: PF, fontSize: 8, marginBottom: 14 }}>🎮 MATCH CONTROLS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
            <button className="btn btn-blue" onClick={() => update({ status: "open" })}>▶ OPEN</button>
            <button className="btn btn-gold" onClick={() => update({ status: "locked" })}>⏸ LOCK</button>
            <button className="btn btn-red" onClick={() => update({ status: "ended" })}>🏁 END</button>
          </div>
          <div style={{ fontFamily: PF, fontSize: 6, color: C.dim, lineHeight: 2.4 }}>
            OPEN = fans predict &nbsp;|&nbsp; LOCK = match started &nbsp;|&nbsp; END = show leaderboard
          </div>
        </div>

        {/* Reveal Result */}
        <div className="card-pink fg">
          <div className="gpink" style={{ fontFamily: PF, fontSize: 8, marginBottom: 14 }}>🏆 REVEAL REAL RESULT</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            {[["team1", "r1", "w1"], ["team2", "r2", "w2"]].map(([tk, rk, wk], i) => (
              <div key={i}>
                <label className="lbl" style={{ color: i === 0 ? C.pink : C.blue }}>{mf[tk] || `Team ${i + 1}`}</label>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 6 }}>
                  <div><label className="lbl">Runs</label>
                    <input type="number" placeholder={i === 0 ? "183" : "160"} value={mf[rk]} onChange={sf(rk)} /></div>
                  <div><label className="lbl">Wkts</label>
                    <select value={mf[wk]} onChange={sf(wk)}>
                      {[...Array(11)].map((_, i) => <option key={i} value={i}>{i}</option>)}
                    </select></div>
                </div>
              </div>
            ))}
          </div>
          <div className="fg"><label className="lbl">Man of the Match (exact spelling!)</label>
            <input placeholder="e.g. Sanju Samson" value={mf.mom} onChange={sf("mom")} /></div>
          <button className="btn btn-gold" style={{ width: "100%" }}
            onClick={() => update({ status: "ended", realScore: { team1: `${mf.r1}/${mf.w1}`, team2: `${mf.r2}/${mf.w2}` }, realMOM: mf.mom })}>
            🏆 REVEAL ON BIG SCREEN
          </button>
        </div>

        {/* Reset */}
        <div className="card fg" style={{ border: `3px solid #FF4400`, boxShadow: `4px 4px 0 #882200` }}>
          <div style={{ fontFamily: PF, fontSize: 8, color: "#FF4400", marginBottom: 6 }}>⚠ NEXT MATCH RESET</div>
          <div style={{ fontFamily: PF, fontSize: 6, color: C.dim, lineHeight: 2.4, marginBottom: 14 }}>
            Wipes all predictions, unlocks all devices. Use between matches.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div><label className="lbl">Next Team 1</label><input placeholder="e.g. RR" value={mf.team1} onChange={sf("team1")} /></div>
            <div><label className="lbl">Next Team 2</label><input placeholder="e.g. CSK" value={mf.team2} onChange={sf("team2")} /></div>
          </div>
          <div className="fg"><label className="lbl">Next Match Title</label>
            <input placeholder="RR vs CSK · IPL 2025" value={mf.name} onChange={sf("name")} /></div>
          <button className="btn btn-red" style={{ width: "100%" }}
            onClick={() => { setResetModal(true); setResetInput(""); }}>
            🗑 RESET FOR NEXT MATCH
          </button>
        </div>

        {/* Quick links */}
        <div className="card fg">
          <div className="gblue" style={{ fontFamily: PF, fontSize: 8, marginBottom: 12 }}>🔗 QUICK LINKS</div>
          {[["Fan page — share this", "#fan"], ["Big screen — projector", "#bigscreen"], ["Admin — keep private", "#admin"]].map(([l, h]) => (
            <div key={h} style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: PF, fontSize: 6, color: C.dim, marginBottom: 4 }}>{l}</div>
              <div className="gblue" style={{ fontFamily: PF, fontSize: 6, wordBreak: "break-all" }}>
                {window.location.origin}/{h}
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center" }}>
          <button className="btn btn-red" style={{ fontSize: 6, padding: "8px 14px" }} onClick={() => setToken(null)}>
            LOGOUT
          </button>
        </div>
      </div>

      {/* Reset Modal */}
      {resetModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.9)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 24
        }}>
          <div className="card up" style={{ maxWidth: 400, width: "100%", border: `4px solid #FF4400`, boxShadow: `6px 6px 0 #882200` }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
              <div style={{ fontFamily: PF, fontSize: 11, color: "#FF4400", letterSpacing: 2 }}>CONFIRM RESET</div>
            </div>
            <div style={{ height: 3, background: "repeating-linear-gradient(90deg,#FF4400 0 8px,transparent 8px 16px)", margin: "14px 0" }} />
            <div style={{ fontFamily: PF, fontSize: 7, color: C.dim, lineHeight: 2.6, textAlign: "center", marginBottom: 16 }}>
              This will permanently delete<br />
              <span style={{ color: C.pink, fontSize: 11 }}>{total}</span> predictions<br />
              and unlock all devices.<br />
              <span style={{ color: C.gold }}>Cannot be undone.</span>
            </div>
            <div style={{
              background: "#0A0A38", border: `2px solid ${C.border}`, padding: "10px 14px", marginBottom: 16,
              fontFamily: PF, fontSize: 7, color: C.white, lineHeight: 2.4
            }}>
              Next: <span className="ggold">{mf.name || "—"}</span><br />
              <span style={{ color: C.pink }}>{mf.team1 || "—"}</span>
              <span style={{ color: C.dim }}> vs </span>
              <span style={{ color: C.blue }}>{mf.team2 || "—"}</span>
            </div>
            <div className="fg">
              <label className="lbl" style={{ color: "#FF4400" }}>Type RESET to confirm</label>
              <input placeholder="RESET" value={resetInput}
                onChange={e => setResetInput(e.target.value.toUpperCase())}
                style={{ borderColor: resetInput === "RESET" ? C.green : "#FF4400" }} autoFocus />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button className="btn btn-blue" onClick={() => { setResetModal(false); setResetInput(""); }} disabled={resetBusy}>
                ✕ CANCEL
              </button>
              <button className="btn btn-red" disabled={resetInput !== "RESET" || resetBusy} onClick={reset}>
                {resetBusy ? "…" : "✓ CONFIRM"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  ROOT
// ─────────────────────────────────────────────────────────────
const DEFAULT_MATCH = {
  status: "open", name: "RR vs MI · IPL 2025",
  team1: "Rajasthan Royals", team2: "Mumbai Indians",
};
// Demo predictions for preview
const DEMO_PREDS = {
  dev1: { nickname: "CricketKing", team: "team1", team1Score: "185/6", team2Score: "162/9", mom: "Sanju Samson" },
  dev2: { nickname: "BounceHunter", team: "team2", team1Score: "171/8", team2Score: "175/5", mom: "Rohit Sharma" },
  dev3: { nickname: "SixMachine", team: "team1", team1Score: "192/4", team2Score: "158/10", mom: "Riyan Parag" },
  dev4: { nickname: "PitchPerfect", team: "team2", team1Score: "168/7", team2Score: "170/6", mom: "Hardik Pandya" },
  dev5: { nickname: "RoyalBlood", team: "team1", team1Score: "200/3", team2Score: "155/10", mom: "Sanju Samson" },
  dev6: { nickname: "MumbaiMadness", team: "team2", team1Score: "160/9", team2Score: "188/4", mom: "Rohit Sharma" },
};

export default function App() {
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = STYLES;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  // View routing
  const getView = () => {
    const h = window.location.hash;
    if (h === "#bigscreen") return "bigscreen";
    if (h === "#admin") return "admin";
    return "fan";
  };
  const [view, setView] = useState(getView);
  useEffect(() => {
    const h = () => setView(getView());
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);

  const [match, setMatch] = useState(DEFAULT_MATCH);
  const [preds, setPreds] = useState(DEMO_PREDS);
  const [submitted, setSubmitted] = useState(false);

  // Firebase polling (3s)
  useEffect(() => {
    const poll = async () => {
      const m = await fbRead("match");
      const p = await fbRead("submissions");
      if (m) setMatch(m);
      if (p) setPreds(p);
    };
    poll();
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, []);

  const handleSubmit = async (form) => {
    await submitPrediction(form);
    setSubmitted(true);
  };

  // Preview nav (not shown on actual deployment — views accessed via URL hash)
  const isPreview = true;

  return (
    <>
      {/* ── Preview nav (remove for production) ── */}
      {isPreview && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 10000,
          background: "#000", borderBottom: `3px solid ${C.border}`, display: "flex", gap: 0
        }}>
          {[["📱 FAN PAGE", "fan"], ["📺 BIG SCREEN", "bigscreen"], ["🔐 ADMIN", "admin"]].map(([l, v]) => (
            <button key={v} className={`nav-tab${view === v ? " active" : ""}`}
              onClick={() => { window.location.hash = v; setView(v); }}>{l}</button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: PF, fontSize: 6, color: C.dim, padding: "0 12px", display: "flex", alignItems: "center" }}>
            {Object.keys(preds).length} PREDICTIONS
          </div>
        </div>
      )}
      <div style={{ paddingTop: isPreview ? 38 : 0 }}>
        {view === "fan" && <FanView match={match} submitted={submitted} onSubmit={handleSubmit} />}
        {view === "bigscreen" && <BigScreen match={match} predictions={preds} />}
        {view === "admin" && <AdminPanel match={match} predictions={preds} onMatchUpdate={setMatch} />}
      </div>
    </>
  );
}

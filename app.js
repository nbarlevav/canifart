/* ============================================================
   CAN I FART? — App Logic
   ============================================================ */

'use strict';

// ============================================================
// STATE
// ============================================================
const STATE = {
  location:   null,
  people:     null,
  social:     null,
  urgency:    null,
  food:       [],      // multi-select
  noise:      null,
  confidence: 50,      // slider 0-100
  escape:     null,
  devices:    [],      // multi-select
  mealHours:  2,       // slider 0-8
};

// ============================================================
// SCORE CONFIG — all weights
// ============================================================
const SCORE_CONFIG = {
  location: {
    home_alone:      -35,
    car_windows_down:-25,
    car_windows_up:  -10,
    gym:             -5,
    library:         +10,
    office:          +15,
    doctors:         +20,
    airplane:        +25,
    first_date:      +30,
    church:          +30,
    elevator:        +35,
    meeting:         +35,
  },
  people: {
    alone:  -30,
    few:    0,
    group:  +15,
    crowd:  +30,
  },
  social: {
    friends:  -10,
    family:   -5,
    strangers: +5,
    partner:  +15,
    boss:     +25,
  },
  urgency: {
    low:  -10,
    med:  +10,
    high: +25,
  },
  food: {
    nothing:    -5,
    fastfood:   +5,
    carbonated: +8,
    dairy:      +12,
    beans:      +20,
  },
  noise: {
    jackhammer: -25,
    loud:       -15,
    conversation: 0,
    quiet:      +10,
    silent:     +25,
  },
  escape: {
    yes: -10,
    no:  +15,
  },
  devices: {
    none:        0,
    alexa:       +8,
    google:      +8,
    meeting_mic: +20,
    cameras:     +5,
  },
};

// ============================================================
// SCORING ENGINE
// ============================================================
function calculateScore(state, overrideHour = null) {
  let score = 50;
  const factors = {};

  // Location
  if (state.location && SCORE_CONFIG.location[state.location] !== undefined) {
    const mod = SCORE_CONFIG.location[state.location];
    score += mod;
    factors.location = mod;
  }

  // People nearby
  if (state.people && SCORE_CONFIG.people[state.people] !== undefined) {
    const mod = SCORE_CONFIG.people[state.people];
    score += mod;
    factors.people = mod;
  }

  // Social context
  if (state.social && SCORE_CONFIG.social[state.social] !== undefined) {
    const mod = SCORE_CONFIG.social[state.social];
    score += mod;
    factors.social = mod;
  }

  // Urgency
  if (state.urgency && SCORE_CONFIG.urgency[state.urgency] !== undefined) {
    const mod = SCORE_CONFIG.urgency[state.urgency];
    score += mod;
    factors.urgency = mod;
  }

  // Food (multi-select, cap additive at +35)
  if (state.food && state.food.length > 0) {
    let foodMod = state.food.reduce((sum, f) => sum + (SCORE_CONFIG.food[f] || 0), 0);
    foodMod = Math.min(foodMod, 35);
    score += foodMod;
    factors.food = foodMod;
  }

  // Noise
  if (state.noise && SCORE_CONFIG.noise[state.noise] !== undefined) {
    const mod = SCORE_CONFIG.noise[state.noise];
    score += mod;
    factors.noise = mod;
  }

  // Confidence slider: 0% → +20, 100% → -15
  const confMod = 20 - (state.confidence / 100) * 35;
  score += confMod;
  factors.confidence = confMod;

  // Escape route
  if (state.escape && SCORE_CONFIG.escape[state.escape] !== undefined) {
    const mod = SCORE_CONFIG.escape[state.escape];
    score += mod;
    factors.escape = mod;
  }

  // Smart devices (multi-select, skip 'none')
  if (state.devices && state.devices.length > 0) {
    const devMod = state.devices
      .filter(d => d !== 'none')
      .reduce((sum, d) => sum + (SCORE_CONFIG.devices[d] || 0), 0);
    score += devMod;
    factors.devices = devMod;
  }

  // Time since last meal
  const mealH = state.mealHours;
  let mealMod = 0;
  if (mealH < 0.5)      mealMod = +20;
  else if (mealH < 1)   mealMod = +15;
  else if (mealH < 2)   mealMod = +10;
  else if (mealH < 4)   mealMod = 0;
  else if (mealH < 6)   mealMod = -5;
  else                  mealMod = -10;
  score += mealMod;
  factors.meal = mealMod;

  // Time of day (auto-detected or overridden for chart)
  const hour = overrideHour !== null ? overrideHour : new Date().getHours();
  let timeMod = 0;
  if (hour >= 6 && hour < 9)        timeMod = +10;
  else if (hour >= 9 && hour < 12)   timeMod = +5;
  else if (hour >= 12 && hour < 18)  timeMod = 0;
  else if (hour >= 18 && hour < 22)  timeMod = -5;
  else                               timeMod = -15;
  score += timeMod;
  factors.timeOfDay = timeMod;

  score = Math.max(0, Math.min(100, Math.round(score)));

  // Find top risk factor (highest positive modifier)
  const topFactor = Object.entries(factors)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)[0];

  return { score, topFactor, factors };
}

// ============================================================
// VERDICT
// ============================================================
const VERDICTS = {
  yes:     { label: 'GO FOR IT',            emoji: '✅', cssClass: 'verdict--yes' },
  caution: { label: 'PROCEED WITH CAUTION', emoji: '😬', cssClass: 'verdict--caution' },
  hold:    { label: 'HOLD IT',              emoji: '😰', cssClass: 'verdict--hold' },
  no:      { label: 'ABSOLUTELY NOT',       emoji: '🚫', cssClass: 'verdict--no' },
};

function getVerdict(score) {
  if (score <= 30) return VERDICTS.yes;
  if (score <= 55) return VERDICTS.caution;
  if (score <= 75) return VERDICTS.hold;
  return VERDICTS.no;
}

// ============================================================
// FUNNY COPY — REASONING TEXT
// ============================================================
function buildReasoning(state, score) {
  const parts = [];

  // Build situational description
  const locLabels = {
    home_alone: "you're home alone",
    car_windows_down: "you're in your car with windows down",
    car_windows_up: "you're in your car with windows up",
    gym: "you're at the gym",
    library: "you're in a library",
    office: "you're in the office",
    doctors: "you're at the doctor's office",
    airplane: "you're on a plane",
    first_date: "you're on a first date",
    church: "you're in a house of worship",
    elevator: "you're in an elevator",
    meeting: "you're in an office meeting",
  };

  if (state.location) parts.push(locLabels[state.location] || '');

  if (state.people === 'crowd') parts.push('surrounded by a crowd');
  else if (state.people === 'group') parts.push('with a group of people nearby');
  else if (state.people === 'alone') parts.push('completely alone');

  if (state.social === 'boss') parts.push('your boss is within range');
  if (state.social === 'partner') parts.push('your partner is right there');

  if (state.food.includes('beans') && state.food.includes('dairy')) {
    parts.push('you had beans AND dairy');
  } else if (state.food.includes('beans')) {
    parts.push('you had beans/broccoli');
  } else if (state.food.includes('dairy')) {
    parts.push('you had dairy');
  }

  if (state.devices.includes('meeting_mic')) parts.push('a meeting microphone is live');
  if (state.devices.includes('alexa') || state.devices.includes('google')) {
    parts.push('smart speakers are listening');
  }

  if (state.noise === 'silent') parts.push('the room is dead silent');
  if (state.noise === 'jackhammer') parts.push('there is jackhammer-level noise nearby');

  // Punchlines by scenario
  const punchlines = {
    // High danger combos
    elevator_beans_boss: "Elevator. Beans. Boss. This is not a drill. Clench with everything you have.",
    airplane_silent: "Recycled air. Trapped passengers. Zero escape route. You would be a war criminal.",
    meeting_mic: "That microphone will broadcast you to everyone on the call. Their faces will haunt you forever.",
    first_date: "There is no algorithm on earth that makes this acceptable. Zero. None.",
    church: "God is watching. So is everyone in the pew. Find salvation in the bathroom.",
    // Safe combos
    home_alone: "You are home alone with no witnesses. This is your birthright. Release with pride.",
    jackhammer_cover: "The ambient noise will provide excellent cover. Nature intended this moment.",
    // Generic by score range
    yes_generic: "All systems green. Rip it. You have earned this.",
    caution_boss: "Your boss is within range. Do you feel lucky? The algorithm is sweating.",
    caution_generic: "Technically possible. Spiritually questionable. Physically inevitable.",
    hold_generic: "The risk assessment module is sweating. Wait for a better moment — it is coming.",
    no_generic: "Every fiber of our algorithmic being is telling you no. This is a hard, firm, forever no.",
    critical_generic: "Your body has staged a coup. The situation is beyond software intervention. Move. Now.",
  };

  let punchline = '';

  if (state.devices.includes('meeting_mic') && score > 55) {
    punchline = punchlines.meeting_mic;
  } else if (state.location === 'elevator' && state.food.includes('beans') && state.social === 'boss') {
    punchline = punchlines.elevator_beans_boss;
  } else if (state.location === 'airplane' && state.noise === 'silent') {
    punchline = punchlines.airplane_silent;
  } else if (state.location === 'first_date' && score > 50) {
    punchline = punchlines.first_date;
  } else if (state.location === 'church' && score > 50) {
    punchline = punchlines.church;
  } else if (state.location === 'home_alone' && score < 30) {
    punchline = punchlines.home_alone;
  } else if (state.noise === 'jackhammer' && score < 30) {
    punchline = punchlines.jackhammer_cover;
  } else if (state.urgency === 'high' && score > 55) {
    punchline = punchlines.critical_generic;
  } else if (score <= 30) {
    punchline = punchlines.yes_generic;
  } else if (score <= 55) {
    punchline = state.social === 'boss' ? punchlines.caution_boss : punchlines.caution_generic;
  } else if (score <= 75) {
    punchline = punchlines.hold_generic;
  } else {
    punchline = punchlines.no_generic;
  }

  // Build natural sentence
  let desc = '';
  if (parts.length > 0) {
    desc = capitalize(parts[0]);
    if (parts.length > 1) {
      desc += ', ' + parts.slice(1, -1).join(', ');
      if (parts.length > 2) desc += ', and ' + parts[parts.length - 1];
      else if (parts.length === 2) desc += ' and ' + parts[1];
    }
    desc += '. ';
  }

  return desc + punchline;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============================================================
// BEST TIME CALCULATION
// ============================================================
function getBestTime(state) {
  let bestHour = 0;
  let bestScore = Infinity;

  for (let h = 0; h < 24; h++) {
    const { score } = calculateScore(state, h);
    if (score < bestScore) {
      bestScore = score;
      bestHour = h;
    }
  }

  return formatHour(bestHour);
}

function formatHour(h) {
  const period = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${period}`;
}

// ============================================================
// TOP RISK FACTOR LABEL
// ============================================================
const FACTOR_LABELS = {
  location:   'Location',
  people:     'People Nearby',
  social:     'Social Context',
  urgency:    'Urgency',
  food:       'Food',
  noise:      'Noise Level',
  confidence: 'Low Confidence',
  escape:     'No Escape Route',
  devices:    'Listening Devices',
  meal:       'Recent Meal',
  timeOfDay:  'Time of Day',
};

// ============================================================
// SVG GAUGE UPDATE
// ============================================================
const GAUGE_ARC_LENGTH = 263.89;
let previousScore = 0;

function updateGauge(score) {
  const filled = (score / 100) * GAUGE_ARC_LENGTH;
  const fillPath = document.getElementById('gaugeFill');
  fillPath.setAttribute('stroke-dasharray', `${filled} ${GAUGE_ARC_LENGTH}`);

  if (score <= 30) {
    fillPath.setAttribute('stroke', 'url(#grad-green)');
  } else if (score <= 55) {
    fillPath.setAttribute('stroke', 'url(#grad-yellow)');
  } else if (score <= 75) {
    // Orange — blend yellow/red by animating between them. Use red gradient with lower opacity feel.
    fillPath.setAttribute('stroke', 'url(#grad-yellow)');
  } else {
    fillPath.setAttribute('stroke', 'url(#grad-red)');
  }

  animateNumber('scoreNumber', previousScore, score, 600);
  previousScore = score;
}

function animateNumber(elId, from, to, duration) {
  const el = document.getElementById(elId);
  if (!el) return;

  // Skip animation when page is hidden (background tab — rAF is throttled)
  if (document.hidden) {
    el.textContent = Math.round(to);
    return;
  }

  const start = performance.now();
  const diff  = to - from;

  function step(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
    el.textContent = Math.round(from + diff * eased);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

// ============================================================
// UI UPDATE
// ============================================================
let prevVerdictKey = null;

function updateUI() {
  const { score, topFactor } = calculateScore(STATE);
  const verdict = getVerdict(score);

  // Confetti when verdict flips TO 'yes'
  const verdictKey = score <= 30 ? 'yes' : score <= 55 ? 'caution' : score <= 75 ? 'hold' : 'no';
  if (verdictKey === 'yes' && prevVerdictKey !== 'yes' && prevVerdictKey !== null) {
    launchConfetti();
  }
  prevVerdictKey = verdictKey;
  const reasoning = hasAnyInput() ? buildReasoning(STATE, score) : 'Tell us where you are and what you ate...';

  // Gauge
  updateGauge(score);

  // Verdict
  const verdictBox = document.getElementById('verdictBox');
  verdictBox.className = 'verdict ' + verdict.cssClass;
  verdictBox.classList.add('verdict-pop');
  setTimeout(() => verdictBox.classList.remove('verdict-pop'), 350);

  document.getElementById('verdictEmoji').textContent = verdict.emoji;
  document.getElementById('verdictText').textContent = hasAnyInput() ? verdict.label : 'Fill in your situation below';

  // Reasoning
  document.getElementById('reasoningText').textContent = reasoning;

  // Best time banner
  const banner = document.getElementById('bestTimeBanner');
  if (hasAnyInput() && score > 30) {
    const best = getBestTime(STATE);
    document.getElementById('bestTime').textContent = best;
    banner.style.display = 'block';
  } else {
    banner.style.display = 'none';
  }

  // CRITICAL state
  if (STATE.urgency === 'high') {
    document.body.classList.add('state-critical');
  } else {
    document.body.classList.remove('state-critical');
  }

  // Top risk factor card
  const topRiskEl = document.getElementById('topRisk');
  if (topFactor) {
    topRiskEl.textContent = FACTOR_LABELS[topFactor[0]] || topFactor[0];
  } else {
    topRiskEl.textContent = score > 0 ? 'None detected' : '--';
  }

  // Render chart
  renderChart();
}

function hasAnyInput() {
  return STATE.location || STATE.people || STATE.social || STATE.urgency ||
    STATE.food.length > 0 || STATE.noise || STATE.escape ||
    STATE.devices.length > 0;
}

// ============================================================
// CANVAS CHART
// ============================================================

// Meal-time bonus: post-meal danger spikes at typical meal hours
// Creates 3 distinct peaks regardless of user input — shows when
// most people are most at risk throughout the day
function mealTimeBonus(h) {
  const breakfast = Math.max(0, 10 - Math.abs(h - 8.5) * 4.5);  // peaks ~8:30am
  const lunch     = Math.max(0, 13 - Math.abs(h - 13)  * 4.0);  // peaks ~1pm
  const dinner    = Math.max(0, 16 - Math.abs(h - 19)  * 3.5);  // peaks ~7pm
  return Math.min(28, breakfast + lunch + dinner);
}

// Smooth Catmull-Rom curve through a list of {x,y} points
function drawSmoothCurve(ctx, pts) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
}

// Score → color
function scoreColor(s, alpha = 1) {
  if (s <= 30)  return `rgba(74,222,128,${alpha})`;
  if (s <= 55)  return `rgba(251,191,36,${alpha})`;
  if (s <= 75)  return `rgba(251,146,60,${alpha})`;
  return `rgba(248,113,113,${alpha})`;
}

// Tooltip state
let chartHoverHour = null;

function renderChart() {
  const canvas = document.getElementById('safetyChart');
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const dpr  = window.devicePixelRatio || 1;
  canvas.width  = (rect.width || 640) * dpr;
  canvas.height = 150 * dpr;
  canvas.style.height = '150px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W      = canvas.width / dpr;
  const H      = 150;
  const PAD_L  = 32;
  const PAD_R  = 12;
  const PAD_T  = 14;
  const PAD_B  = 28;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  // Generate 24h scores: base score + meal-time natural spike overlay
  const scores = Array.from({ length: 24 }, (_, h) => {
    const base  = calculateScore(STATE, h).score;
    const bonus = mealTimeBonus(h);
    return Math.min(100, Math.round(base + bonus));
  });

  const minScore = Math.min(...scores);
  const bestHour = scores.indexOf(minScore);

  function xOf(h) { return PAD_L + (h / 23) * chartW; }
  function yOf(s) { return PAD_T + chartH - (s / 100) * chartH; }

  const pts = scores.map((s, h) => ({ x: xOf(h), y: yOf(s) }));

  ctx.clearRect(0, 0, W, H);

  // ── Horizontal grid lines ──────────────────────────────────
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth   = 1;
  [25, 50, 75].forEach(s => {
    ctx.beginPath();
    ctx.moveTo(PAD_L, yOf(s));
    ctx.lineTo(PAD_L + chartW, yOf(s));
    ctx.stroke();
  });

  // ── Danger zone shading (above 75) ────────────────────────
  const dangerY = yOf(75);
  const dangerFill = ctx.createLinearGradient(0, PAD_T, 0, dangerY);
  dangerFill.addColorStop(0,   'rgba(248,113,113,0.18)');
  dangerFill.addColorStop(1,   'rgba(248,113,113,0.04)');
  ctx.fillStyle = dangerFill;
  ctx.fillRect(PAD_L, PAD_T, chartW, dangerY - PAD_T);

  // ── Safe zone shading (below 30) ──────────────────────────
  const safeY = yOf(30);
  const safeFill = ctx.createLinearGradient(0, safeY, 0, PAD_T + chartH);
  safeFill.addColorStop(0,  'rgba(74,222,128,0.04)');
  safeFill.addColorStop(1,  'rgba(74,222,128,0.15)');
  ctx.fillStyle = safeFill;
  ctx.fillRect(PAD_L, safeY, chartW, PAD_T + chartH - safeY);

  // ── Filled area under curve ────────────────────────────────
  ctx.save();
  drawSmoothCurve(ctx, pts);
  ctx.lineTo(pts[pts.length - 1].x, PAD_T + chartH);
  ctx.lineTo(pts[0].x, PAD_T + chartH);
  ctx.closePath();
  const areaGrad = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + chartH);
  areaGrad.addColorStop(0,   'rgba(248,113,113,0.25)');
  areaGrad.addColorStop(0.4, 'rgba(251,191,36,0.14)');
  areaGrad.addColorStop(1,   'rgba(74,222,128,0.06)');
  ctx.fillStyle = areaGrad;
  ctx.fill();
  ctx.restore();

  // ── Colored line (segment-by-segment) ─────────────────────
  for (let i = 0; i < pts.length - 1; i++) {
    const mid = (scores[i] + scores[i + 1]) / 2;
    ctx.beginPath();
    ctx.moveTo(pts[i].x, pts[i].y);
    // Simple quadratic to next point for smoothness
    const cpx = (pts[i].x + pts[i + 1].x) / 2;
    const cpy = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(cpx, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    ctx.strokeStyle = scoreColor(mid, 0.9);
    ctx.lineWidth   = 2.5;
    ctx.lineJoin    = 'round';
    ctx.stroke();
  }

  // ── Zone labels ────────────────────────────────────────────
  ctx.font      = '9px Inter, sans-serif';
  ctx.fillStyle = 'rgba(248,113,113,0.5)';
  ctx.textAlign = 'left';
  ctx.fillText('DANGER', PAD_L + 4, PAD_T + 10);

  ctx.fillStyle = 'rgba(74,222,128,0.5)';
  ctx.fillText('SAFE', PAD_L + 4, PAD_T + chartH - 4);

  // ── Meal-time annotations ──────────────────────────────────
  const mealPeaks = [
    { h: 9,  label: '🍳' },
    { h: 13, label: '🥪' },
    { h: 19, label: '🍽️' },
  ];
  ctx.font      = '11px serif';
  ctx.textAlign = 'center';
  mealPeaks.forEach(({ h, label }) => {
    const x = xOf(h);
    const y = yOf(scores[h]);
    // Tiny drop line
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x, PAD_T + chartH);
    ctx.stroke();
    ctx.setLineDash([]);
    // Emoji above peak
    ctx.fillText(label, x, y - 8);
  });

  // ── Best hour dot ──────────────────────────────────────────
  const bx = xOf(bestHour);
  const by = yOf(scores[bestHour]);
  // Glow ring
  ctx.beginPath();
  ctx.arc(bx, by, 9, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(74,222,128,0.18)';
  ctx.fill();
  // Dot
  ctx.beginPath();
  ctx.arc(bx, by, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#4ade80';
  ctx.fill();
  ctx.strokeStyle = 'white';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // ── Current time marker ────────────────────────────────────
  const now = new Date().getHours();
  const nx  = xOf(now);
  ctx.beginPath();
  ctx.setLineDash([4, 4]);
  ctx.moveTo(nx, PAD_T);
  ctx.lineTo(nx, PAD_T + chartH);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);
  // "NOW" label
  ctx.font      = '8px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.textAlign = 'center';
  ctx.fillText('NOW', nx, PAD_T - 2);

  // ── X-axis labels ──────────────────────────────────────────
  ctx.font      = '9.5px Inter, sans-serif';
  ctx.fillStyle = 'rgba(148,163,184,0.7)';
  ctx.textAlign = 'center';
  [0, 6, 12, 18, 23].forEach(h => {
    const label = h === 0 ? '12AM' : h === 12 ? '12PM' : h === 23 ? '11PM' : `${h % 12}${h < 12 ? 'AM' : 'PM'}`;
    ctx.fillText(label, xOf(h), H - 8);
  });

  // ── Y-axis ticks ───────────────────────────────────────────
  ctx.textAlign  = 'right';
  ctx.fillStyle  = 'rgba(148,163,184,0.45)';
  ctx.font       = '8.5px Inter, sans-serif';
  [0, 50, 100].forEach(s => {
    ctx.fillText(s, PAD_L - 4, yOf(s) + 3);
  });

  // ── Hover tooltip ──────────────────────────────────────────
  if (chartHoverHour !== null) {
    const hh = chartHoverHour;
    const hx = xOf(hh);
    const hy = yOf(scores[hh]);
    const s  = scores[hh];

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(hx, PAD_T);
    ctx.lineTo(hx, PAD_T + chartH);
    ctx.strokeStyle = scoreColor(s, 0.6);
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hover dot
    ctx.beginPath();
    ctx.arc(hx, hy, 4, 0, Math.PI * 2);
    ctx.fillStyle   = scoreColor(s, 1);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Tooltip box
    const ttLabel = `${formatHour(hh)} — ${s}%`;
    ctx.font = 'bold 10px Inter, sans-serif';
    const ttW = ctx.measureText(ttLabel).width + 16;
    const ttH = 20;
    let ttX = hx - ttW / 2;
    let ttY = hy - ttH - 8;
    ttX = Math.max(PAD_L, Math.min(ttX, PAD_L + chartW - ttW));
    ttY = Math.max(PAD_T, ttY);

    ctx.fillStyle   = 'rgba(15,12,41,0.92)';
    ctx.strokeStyle = scoreColor(s, 0.7);
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(ttX, ttY, ttW, ttH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle  = 'white';
    ctx.textAlign  = 'center';
    ctx.fillText(ttLabel, ttX + ttW / 2, ttY + 13);
  }

  // ── Update badge ───────────────────────────────────────────
  document.getElementById('chartBestTime').textContent = `Best: ${formatHour(bestHour)}`;
}

// Attach mousemove / touch for chart tooltip
function initChartInteraction() {
  const canvas = document.getElementById('safetyChart');
  if (!canvas) return;

  function hoverAtX(clientX) {
    const rect   = canvas.getBoundingClientRect();
    const PAD_L  = 32;
    const PAD_R  = 12;
    const chartW = rect.width - PAD_L - PAD_R;
    const relX   = clientX - rect.left - PAD_L;
    const h      = Math.round((relX / chartW) * 23);
    chartHoverHour = Math.max(0, Math.min(23, h));
    renderChart();
  }

  canvas.addEventListener('mousemove', e => hoverAtX(e.clientX));
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    hoverAtX(e.touches[0].clientX);
  }, { passive: false });
  canvas.addEventListener('mouseleave', () => { chartHoverHour = null; renderChart(); });
  canvas.addEventListener('touchend',   () => { chartHoverHour = null; renderChart(); });
}

// ============================================================
// AUTO-DETECT — noise via microphone
// ============================================================
async function detectAmbientNoise() {
  const btn = document.getElementById('detectNoiseBtn');
  btn.classList.add('detecting');
  btn.querySelector('.detect-label').textContent = 'Listening...';

  try {
    const stream   = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const actx     = new AudioContext();
    const source   = actx.createMediaStreamSource(stream);
    const analyser = actx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    await new Promise(r => setTimeout(r, 1800)); // sample for 1.8s

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;

    stream.getTracks().forEach(t => t.stop());
    actx.close();

    let noiseVal;
    if      (avg < 8)  noiseVal = 'silent';
    else if (avg < 20) noiseVal = 'quiet';
    else if (avg < 40) noiseVal = 'conversation';
    else if (avg < 65) noiseVal = 'loud';
    else               noiseVal = 'jackhammer';

    // Apply to STATE and select the pill
    selectPill('noiseGroup', noiseVal);
    STATE.noise = noiseVal;
    updateUI();

    const noiseLabels = { silent: '🔇 Dead silent', quiet: '🤫 Quiet hum', conversation: '🗣️ Conversational', loud: '🎵 Loud music', jackhammer: '🔨 Very loud' };
    addDetectedTag(`🎙️ ${noiseLabels[noiseVal]}`, false);

    btn.classList.remove('detecting');
    btn.classList.add('done');
    btn.querySelector('.detect-label').textContent = 'Noise detected';
  } catch (err) {
    btn.classList.remove('detecting');
    btn.querySelector('.detect-label').textContent = 'Noise level';
    addDetectedTag('🎙️ Mic access denied', true);
  }
}

// ============================================================
// AUTO-DETECT — people nearby via Bluetooth
// ============================================================
async function detectNearbyDevices() {
  const btn = document.getElementById('detectPeopleBtn');
  btn.classList.add('detecting');
  btn.querySelector('.detect-label').textContent = 'Scanning...';

  if (!navigator.bluetooth) {
    btn.classList.remove('detecting');
    btn.querySelector('.detect-label').textContent = 'Nearby devices';
    addDetectedTag('📡 Bluetooth unavailable', true);
    return;
  }

  try {
    const available = await navigator.bluetooth.getAvailability();
    if (!available) throw new Error('off');

    // getDevices() returns previously granted devices — crude but fun proxy for "not alone"
    let count = 0;
    if (navigator.bluetooth.getDevices) {
      const devices = await navigator.bluetooth.getDevices();
      count = devices.length;
    }

    // Map paired device count to people estimate (rough heuristic)
    let peopleVal;
    if      (count === 0) peopleVal = 'alone';
    else if (count <= 2)  peopleVal = 'few';
    else if (count <= 5)  peopleVal = 'group';
    else                  peopleVal = 'crowd';

    selectPill('peopleGroup', peopleVal);
    STATE.people = peopleVal;
    updateUI();

    const peopleLabels = { alone: 'Alone detected', few: '1–2 people est.', group: 'Group est.', crowd: 'Crowd est.' };
    addDetectedTag(`📡 ${peopleLabels[peopleVal]}`, false);

    btn.classList.remove('detecting');
    btn.classList.add('done');
    btn.querySelector('.detect-label').textContent = 'Scan done';
  } catch (err) {
    btn.classList.remove('detecting');
    btn.querySelector('.detect-label').textContent = 'Nearby devices';
    addDetectedTag('📡 BT scan unavailable', true);
  }
}

function addDetectedTag(text, isError) {
  const container = document.getElementById('detectedTags');
  const tag = document.createElement('span');
  tag.className = 'detected-tag' + (isError ? ' error' : '');
  tag.textContent = text;
  container.appendChild(tag);
}

function selectPill(groupId, val) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('[data-val]').forEach(b => {
    b.classList.toggle('selected', b.dataset.val === val);
  });
}

// ============================================================
// SMART DEFAULTS — pre-fill neutral state on load
// ============================================================
function setSmartDefaults() {
  const hour = new Date().getHours();

  // Urgency: default to "can wait"
  STATE.urgency = 'low';
  selectPill('urgencyGroup', 'low');

  // People: default to "few" (statistically most common)
  STATE.people = 'few';
  selectPill('peopleGroup', 'few');

  // Noise: default to "conversation"
  STATE.noise = 'conversation';
  selectPill('noiseGroup', 'conversation');

  // Escape route: optimistic default
  STATE.escape = 'yes';
  selectPill('escapeGroup', 'yes');

  // Meal hours: auto-infer from time of day
  // Post-breakfast: 7-10am → 0.5-2h since meal
  // Post-lunch: 12-15pm → 0.5-2h since meal
  // Post-dinner: 18-21pm → 0.5-2h since meal
  // Otherwise: assume ~4h since last meal (inter-meal)
  let inferredMealHours;
  if (hour >= 7 && hour <= 10) {
    inferredMealHours = Math.max(0.5, hour - 7 + 0.5); // 0.5–3.5h
  } else if (hour >= 12 && hour <= 15) {
    inferredMealHours = Math.max(0.5, hour - 12 + 0.5);
  } else if (hour >= 18 && hour <= 21) {
    inferredMealHours = Math.max(0.5, hour - 18 + 0.5);
  } else {
    inferredMealHours = 4; // between meals
  }
  STATE.mealHours = inferredMealHours;
  const mealSlider = document.getElementById('mealSlider');
  if (mealSlider) mealSlider.value = Math.min(8, inferredMealHours);
  const mealVal = document.getElementById('mealVal');
  if (mealVal) mealVal.textContent = inferredMealHours < 1 ? `${Math.round(inferredMealHours * 60)}min` : `${inferredMealHours}h`;
}

// ============================================================
// CONFETTI
// ============================================================
function launchConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:500;';
  document.body.appendChild(canvas);
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const COLORS = ['#4ade80','#fbbf24','#6366f1','#f87171','#34d399','#a78bfa','#38bdf8'];
  const particles = Array.from({ length: 90 }, () => ({
    x:  Math.random() * canvas.width,
    y:  -10 - Math.random() * 40,
    vx: (Math.random() - 0.5) * 5,
    vy: Math.random() * 3.5 + 1.5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    w:  Math.random() * 10 + 4,
    h:  Math.random() * 5  + 3,
    rot: Math.random() * 360,
    rotV: (Math.random() - 0.5) * 8,
  }));

  const ctx = canvas.getContext('2d');
  let frame = 0;

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    particles.forEach(p => {
      p.x   += p.vx;
      p.y   += p.vy;
      p.vy  += 0.08;
      p.rot += p.rotV;
      if (p.y < canvas.height + 20) alive = true;

      const alpha = Math.max(0, 1 - p.y / (canvas.height * 0.85));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    frame++;
    if (alive && frame < 220) requestAnimationFrame(tick);
    else canvas.remove();
  }

  requestAnimationFrame(tick);
}

// ============================================================
// SHARE RESULT
// ============================================================
async function shareResult() {
  const { score } = calculateScore(STATE);
  const verdict   = getVerdict(score);

  const locMap = {
    home_alone:'home alone', car_windows_down:'in the car (windows down)',
    car_windows_up:'in the car (windows up)', gym:'at the gym',
    library:'in a library', office:'at the office',
    doctors:"at the doctor's", airplane:'on a plane',
    first_date:'on a first date', church:'at church',
    elevator:'in an elevator', meeting:'in a meeting',
  };
  const where = STATE.location ? locMap[STATE.location] : 'somewhere';
  const text  = `Can I Fart? says: ${verdict.label} ${verdict.emoji}\nDanger score: ${score}% — I'm ${where}.\ncanifart.com 💨`;

  try {
    if (navigator.share) {
      await navigator.share({ title: 'Can I Fart?', text });
    } else {
      await navigator.clipboard.writeText(text);
      showToast('✅ Copied to clipboard!');
    }
  } catch {
    showToast('📋 Could not share');
  }
}

// ============================================================
// TOAST
// ============================================================
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 2200);
}

// ============================================================
// FART ROULETTE
// ============================================================
function rollRoulette() {
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  STATE.location = pick(Object.keys(SCORE_CONFIG.location));
  STATE.people   = pick(Object.keys(SCORE_CONFIG.people));
  STATE.social   = pick(Object.keys(SCORE_CONFIG.social));
  STATE.urgency  = pick(Object.keys(SCORE_CONFIG.urgency));
  STATE.noise    = pick(Object.keys(SCORE_CONFIG.noise));
  STATE.escape   = pick(['yes', 'no']);

  // Random food combo (0–2 items)
  const allFoods = Object.keys(SCORE_CONFIG.food);
  const foodCount = Math.floor(Math.random() * 3);
  STATE.food = [];
  for (let i = 0; i < foodCount; i++) {
    const f = pick(allFoods);
    if (!STATE.food.includes(f)) STATE.food.push(f);
  }

  // Random meal time + confidence
  STATE.mealHours  = Math.round(Math.random() * 8 * 2) / 2;
  STATE.confidence = Math.floor(Math.random() * 101);

  // Sync all pill UIs
  selectPill('locationGroup', STATE.location);
  selectPill('peopleGroup',   STATE.people);
  selectPill('socialGroup',   STATE.social);
  selectPill('urgencyGroup',  STATE.urgency);
  selectPill('noiseGroup',    STATE.noise);
  selectPill('escapeGroup',   STATE.escape);

  document.querySelectorAll('#foodGroup [data-val]').forEach(b => {
    b.classList.toggle('selected', STATE.food.includes(b.dataset.val));
  });

  // Sync sliders
  const mealSlider = document.getElementById('mealSlider');
  const mealVal    = document.getElementById('mealVal');
  mealSlider.value = STATE.mealHours;
  mealVal.textContent = STATE.mealHours < 1 ? `${Math.round(STATE.mealHours * 60)}min` : `${STATE.mealHours}h`;

  const confSlider = document.getElementById('confidenceSlider');
  const confVal    = document.getElementById('confVal');
  confSlider.value = STATE.confidence;
  confVal.textContent = `${STATE.confidence}%`;

  // Scroll to result
  document.getElementById('resultCard').scrollIntoView({ behavior: 'smooth', block: 'center' });

  updateUI();
}

// ============================================================
// FUN FACTS
// ============================================================
const FUN_FACTS = [
  'The average person farts 14 times a day — whether they admit it or not.',
  'Farts travel at approximately 10 km/h (6 mph). You cannot outrun it.',
  "Women's farts are actually smellier — higher concentration of hydrogen sulfide.",
  'Holding it in is harmless. The gas just gets reabsorbed and exits later anyway.',
  'Farts are flammable. Methane and hydrogen are both combustible gases. Do not test this.',
  "The word 'fart' dates back to at least 1386 — Geoffrey Chaucer used it in The Canterbury Tales.",
  'Astronauts on the ISS must be cautious — farts accumulate in a sealed environment with recycled air.',
  'Termites are the largest natural producers of methane gas on Earth, per body weight.',
  'Some people fart in their sleep without ever knowing. You may already be a hero.',
  'The loudness of a fart is determined by the tightness of the sphincter and gas velocity.',
  'Fear of farting in public has an actual name: flatulophobia.',
  'Corn, beans, and dairy are the holy trinity of fart fuel. You have been warned.',
];

let factIndex = Math.floor(Math.random() * FUN_FACTS.length);

function initFunFacts() {
  const el = document.getElementById('funFactText');
  if (!el) return;

  function show() {
    el.style.animation = 'none';
    el.offsetHeight; // reflow to restart animation
    el.style.animation = '';
    el.textContent = FUN_FACTS[factIndex % FUN_FACTS.length];
    factIndex++;
  }

  show();
  setInterval(show, 8000);

  // Click to advance
  document.getElementById('funFact').addEventListener('click', () => {
    show();
    clearInterval(); // won't fully reset timer but that's fine
  });
}

// ============================================================
// PILL GROUPS — event wiring
// ============================================================
function initPills() {
  const groups = document.querySelectorAll('[data-param]');

  groups.forEach(group => {
    const param = group.dataset.param;
    const isMulti = group.dataset.multi === 'true';

    group.addEventListener('click', e => {
      const btn = e.target.closest('[data-val]');
      if (!btn) return;
      const val = btn.dataset.val;

      if (isMulti) {
        // Toggle multi-select
        if (btn.classList.contains('selected')) {
          btn.classList.remove('selected');
          STATE[param] = STATE[param].filter(v => v !== val);
        } else {
          btn.classList.add('selected');
          if (!STATE[param].includes(val)) STATE[param].push(val);
        }
      } else {
        // Single-select
        group.querySelectorAll('[data-val]').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        STATE[param] = val;
      }

      updateUI();
    });
  });
}

// ============================================================
// SLIDERS
// ============================================================
function initSliders() {
  const confSlider = document.getElementById('confidenceSlider');
  const confVal    = document.getElementById('confVal');
  confSlider.addEventListener('input', () => {
    STATE.confidence = parseInt(confSlider.value, 10);
    confVal.textContent = `${STATE.confidence}%`;
    updateUI();
  });

  const mealSlider = document.getElementById('mealSlider');
  const mealVal    = document.getElementById('mealVal');
  mealSlider.addEventListener('input', () => {
    STATE.mealHours = parseFloat(mealSlider.value);
    const h = STATE.mealHours;
    mealVal.textContent = h < 1 ? `${Math.round(h * 60)}min` : `${h}h`;
    updateUI();
  });
}

// ============================================================
// STAT CARDS — time of day + fake counters
// ============================================================
function initStatCards() {
  const hour = new Date().getHours();

  const timeLabels = [
    'Late Night', 'Late Night', 'Late Night', 'Late Night',
    'Early AM',   'Early AM',   'Morning',    'Morning',
    'Morning',    'Mid-Morning','Mid-Morning', 'Late Morning',
    'Noon',       'Afternoon',  'Afternoon',  'Afternoon',
    'Late Arvo',  'Evening',    'Evening',    'Evening',
    'Night',      'Night',      'Night',      'Late Night',
  ];

  document.getElementById('timeOfDay').textContent = timeLabels[hour] || '--';

  // Simulated counters (fun fake stats)
  const base = 10000 + Math.floor(Math.random() * 5000);
  const approved = Math.floor(base * 0.28);
  document.getElementById('totalCount').textContent = base.toLocaleString();
  document.getElementById('approvedCount').textContent = approved.toLocaleString();
}

// ============================================================
// RESIZE HANDLER — re-render chart on resize
// ============================================================
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderChart, 150);
});

// ============================================================
// INIT
// ============================================================
function init() {
  setSmartDefaults();  // pre-fill neutral values before wiring events
  initPills();
  initSliders();
  initStatCards();
  initChartInteraction();

  // Auto-detect buttons
  document.getElementById('detectNoiseBtn').addEventListener('click', detectAmbientNoise);
  document.getElementById('detectPeopleBtn').addEventListener('click', detectNearbyDevices);

  // New feature buttons
  document.getElementById('shareBtn').addEventListener('click', shareResult);
  document.getElementById('rouletteBtn').addEventListener('click', rollRoulette);

  // Fun facts ticker
  initFunFacts();

  // Initial UI render with smart defaults
  updateUI();
}

document.addEventListener('DOMContentLoaded', init);

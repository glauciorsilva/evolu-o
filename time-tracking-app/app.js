(() => {
  'use strict';

  const HOURLY_RATE = 8.5;
  const NIGHT_MULTIPLIER = 1.2;
  const NIGHT_START_HOUR = 22;
  const STORAGE_KEY = 'ponto-ganhos-state-v1';

  const STATUS = {
    IDLE: 'idle',
    WORKING: 'working',
    BREAK: 'break',
    WORKING2: 'working2',
    FINISHED: 'finished',
  };

  const BUTTON_CONFIG = {
    [STATUS.IDLE]: { label: 'Iniciar Expediente', action: 'start' },
    [STATUS.WORKING]: { label: 'Marcar Intervalo', action: 'break' },
    [STATUS.BREAK]: { label: 'Encerrar Intervalo', action: 'resume' },
    [STATUS.WORKING2]: { label: 'Encerrar Expediente', action: 'end' },
    [STATUS.FINISHED]: { label: 'Expediente encerrado', action: 'finished' },
  };

  const EVENT_LABELS = {
    start: 'Início do expediente',
    break_start: 'Início do intervalo',
    break_end: 'Fim do intervalo',
    end: 'Fim do expediente',
  };

  const els = {
    statusBadge: document.getElementById('status-badge'),
    earningsValue: document.getElementById('earnings-value'),
    timerValue: document.getElementById('timer-value'),
    punchBtn: document.getElementById('punch-btn'),
    resetBtn: document.getElementById('reset-btn'),
    timeline: document.getElementById('timeline'),
    normalHours: document.getElementById('normal-hours'),
    nightHours: document.getElementById('night-hours'),
    todayLabel: document.getElementById('today-label'),
  };

  /** @type {{status: string, events: Array<{type: string, at: number}>}} */
  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { status: STATUS.IDLE, events: [] };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.events)) {
        return { status: STATUS.IDLE, events: [] };
      }
      return parsed;
    } catch (err) {
      return { status: STATUS.IDLE, events: [] };
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function currentNextAction() {
    return BUTTON_CONFIG[state.status]?.action ?? 'start';
  }

  const TRANSITIONS = {
    start: { from: STATUS.IDLE, to: STATUS.WORKING, event: 'start' },
    break: { from: STATUS.WORKING, to: STATUS.BREAK, event: 'break_start' },
    resume: { from: STATUS.BREAK, to: STATUS.WORKING2, event: 'break_end' },
    end: { from: STATUS.WORKING2, to: STATUS.FINISHED, event: 'end' },
  };

  function handlePunch() {
    const action = currentNextAction();
    const transition = TRANSITIONS[action];
    if (!transition || state.status !== transition.from) return;

    state.status = transition.to;
    state.events.push({ type: transition.event, at: Date.now() });
    saveState();
    render();
  }

  function handleReset() {
    state = { status: STATUS.IDLE, events: [] };
    saveState();
    render();
  }

  /**
   * Builds worked intervals (excluding break time) from the recorded events.
   * If the shift is still open (working/resumed), the last interval's end
   * is left as `null`, meaning "until now".
   */
  function buildWorkIntervals(events) {
    const intervals = [];
    let openStart = null;

    for (const ev of events) {
      if (ev.type === 'start' || ev.type === 'break_end') {
        openStart = ev.at;
      } else if (ev.type === 'break_start' || ev.type === 'end') {
        if (openStart !== null) {
          intervals.push({ start: openStart, end: ev.at });
          openStart = null;
        }
      }
    }

    if (openStart !== null) {
      intervals.push({ start: openStart, end: null });
    }

    return intervals;
  }

  /**
   * Splits a [start, end) interval at every daily 22:00 and 00:00 boundary
   * so each resulting chunk falls entirely inside, or entirely outside,
   * the +20% night window (22h-24h local time), even across midnight.
   */
  function splitAtNightBoundaries(start, end) {
    const points = new Set([start, end]);
    const dayCursor = new Date(start);
    dayCursor.setHours(0, 0, 0, 0);

    while (dayCursor.getTime() < end) {
      const nightStart = new Date(dayCursor);
      nightStart.setHours(NIGHT_START_HOUR, 0, 0, 0);
      const nextMidnight = new Date(dayCursor);
      nextMidnight.setDate(nextMidnight.getDate() + 1);
      nextMidnight.setHours(0, 0, 0, 0);

      const nightStartMs = nightStart.getTime();
      const nextMidnightMs = nextMidnight.getTime();

      if (nightStartMs > start && nightStartMs < end) points.add(nightStartMs);
      if (nextMidnightMs > start && nextMidnightMs < end) points.add(nextMidnightMs);

      dayCursor.setDate(dayCursor.getDate() + 1);
    }

    const sorted = Array.from(points).sort((a, b) => a - b);
    const segments = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      segments.push([sorted[i], sorted[i + 1]]);
    }
    return segments;
  }

  function isNightSegment(segStart, segEnd) {
    const midpoint = new Date((segStart + segEnd) / 2);
    return midpoint.getHours() >= NIGHT_START_HOUR;
  }

  function computeTotals(intervals, now) {
    let normalMs = 0;
    let nightMs = 0;

    for (const interval of intervals) {
      const end = interval.end ?? now;
      if (end <= interval.start) continue;

      for (const [segStart, segEnd] of splitAtNightBoundaries(interval.start, end)) {
        const duration = segEnd - segStart;
        if (isNightSegment(segStart, segEnd)) {
          nightMs += duration;
        } else {
          normalMs += duration;
        }
      }
    }

    const normalHours = normalMs / 3_600_000;
    const nightHours = nightMs / 3_600_000;
    const earnings = normalHours * HOURLY_RATE + nightHours * HOURLY_RATE * NIGHT_MULTIPLIER;

    return { normalMs, nightMs, earnings };
  }

  function formatCurrency(value) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatHoursMinutes(ms) {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${String(minutes).padStart(2, '0')}min`;
  }

  function formatClockDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
  }

  function formatClockTime(ts) {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function totalElapsedMs(intervals, now) {
    return intervals.reduce((acc, { start, end }) => acc + ((end ?? now) - start), 0);
  }

  function renderTimeline() {
    els.timeline.innerHTML = '';
    for (const ev of state.events) {
      const row = document.createElement('div');
      row.className = 'timeline__item';
      row.innerHTML = `<span>${EVENT_LABELS[ev.type] ?? ev.type}</span><span>${formatClockTime(ev.at)}</span>`;
      els.timeline.appendChild(row);
    }
  }

  function renderHeaderDate() {
    const firstEvent = state.events[0];
    const reference = firstEvent ? new Date(firstEvent.at) : new Date();
    els.todayLabel.textContent = reference.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    });
  }

  function render() {
    const now = Date.now();
    const intervals = buildWorkIntervals(state.events);
    const { normalMs, nightMs, earnings } = computeTotals(intervals, now);
    const elapsedMs = totalElapsedMs(intervals, now);

    els.statusBadge.dataset.state = state.status;
    els.statusBadge.textContent = statusLabel(state.status);

    els.earningsValue.textContent = formatCurrency(earnings);
    els.timerValue.textContent = formatClockDuration(elapsedMs);
    els.normalHours.textContent = formatHoursMinutes(normalMs);
    els.nightHours.textContent = formatHoursMinutes(nightMs);

    const config = BUTTON_CONFIG[state.status];
    els.punchBtn.textContent = config.label;
    els.punchBtn.dataset.action = config.action;
    els.punchBtn.disabled = state.status === STATUS.FINISHED;
    els.resetBtn.hidden = state.status !== STATUS.FINISHED;

    renderTimeline();
    renderHeaderDate();
  }

  function statusLabel(status) {
    switch (status) {
      case STATUS.IDLE: return 'Pronto para iniciar';
      case STATUS.WORKING: return 'Trabalhando';
      case STATUS.BREAK: return 'Em intervalo';
      case STATUS.WORKING2: return 'Trabalhando';
      case STATUS.FINISHED: return 'Expediente encerrado';
      default: return '';
    }
  }

  function isTicking() {
    return state.status === STATUS.WORKING || state.status === STATUS.WORKING2;
  }

  els.punchBtn.addEventListener('click', handlePunch);
  els.resetBtn.addEventListener('click', handleReset);

  render();

  // Live tick: only the display refreshes here, state never auto-transitions
  // (e.g. crossing midnight never ends the shift on its own).
  setInterval(() => {
    if (isTicking()) render();
    else renderHeaderDate();
  }, 1000);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (!isStandalone) {
    document.getElementById('install-hint').hidden = false;
  }
})();

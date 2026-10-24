import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const SEED_PATH = path.join(ROOT, 'data', 'seed-feed.json');
const PORT = Number(process.env.PORT || 8787);
const FEED_URL = process.env.FEED_URL || 'https://codex-reset.com/api/feed';
const TIMELINE_URL = process.env.TIMELINE_URL || 'https://codex-reset.com/api/timeline';
const RADAR_URL = process.env.RADAR_URL || 'https://codex-reset-radar.pages.dev/';
const CACHE_MS = Number(process.env.CACHE_MS || 120_000);

let cache = { value: null, fetchedAt: 0, promise: null };

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sortNewest(items) {
  return [...items].sort((a, b) => (toDate(b.at || b.announced_at || b.date)?.getTime() || 0) - (toDate(a.at || a.announced_at || a.date)?.getTime() || 0));
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function formatUtc(date) {
  return date ? date.toISOString() : null;
}

function textOf(item) {
  return String(item?.text || item?.summary || '').replace(/&amp;/g, '&').trim();
}

function isBanked(text) {
  return /\bbanked\b|on[- ]demand|credit(?:ed|s)?\s+(?:to|into)|reset\s+card/i.test(text);
}

function isVerifiedResetEvent(event) {
  const status = String(event?.reset_verification_status || '').toLowerCase();
  const source = String(event?.source || '').toLowerCase();
  const sourceLabel = String(event?.source_label || '').toLowerCase();
  if (status === 'pending' || source.includes('operator-observed') || sourceLabel.includes('awaiting')) return false;
  return event?.confirmed === true || String(event?.confidence || '').toLowerCase() === 'high' || source.includes('archive');
}

function isMeaningfulResetEvent(event) {
  const text = textOf(event);
  return isVerifiedResetEvent(event) || String(event?.observation_result || '').toLowerCase() === 'reset_observed' || isResetClaim(text);
}

function isResetClaim(text) {
  return /\breset(?:s|ed|ting)?\b/i.test(text) && !/ask(?:ed)?\s+(?:tibo|for)\s+a\s+reset|demand\s+a\s+reset/i.test(text);
}

function hasConcreteTiming(text) {
  return /\b(?:today|tomorrow|tonight|within\s+(?:the\s+next\s+)?\d+\s+hours?|in\s+\d+\s+hours?|before\s+\d|by\s+(?:eod|end\s+of\s+day)|landing|lands|arriv(?:e|es|ed)|next\s+\d+\s+(?:hours?|days?))\b/i.test(text);
}

function classifyTweet(tweet) {
  const text = textOf(tweet);
  const normalizedKind = String(tweet?.kind || '').toLowerCase();
  const banked = isBanked(text) || normalizedKind.includes('banked');
  const timing = hasConcreteTiming(text);
  // Timing-only replies can refer to a normal product ship. They are kept in
  // the live feed, but never become a reset signal without explicit reset
  // wording in the same public post.
  const reset = isResetClaim(text) && !banked;
  const explicitFuture = reset && /\b(?:will|going\s+to|tomorrow|today|by\s+eod|within|next)\b/i.test(text);
  const concrete = reset && timing;
  let signal = 'context';
  if (concrete) signal = 'strong';
  else if (explicitFuture) signal = 'watch';
  else if (reset) signal = 'reset';
  if (banked) signal = 'banked';
  return { ...tweet, text, banked, reset, timing, concrete, explicitFuture, signal };
}

function extractPstTime(text) {
  const match = text.match(/(?:before|by|at|around)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(PST|PT|UTC)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3].toLowerCase();
  if (meridiem === 'pm' && hour !== 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  return { hour, minute, timezone: (match[4] || 'PST').toUpperCase() };
}

function inferWindow(signal) {
  if (!signal) return null;
  const at = toDate(signal.at || signal.declared_at);
  if (!at) return null;
  const text = signal.text;
  const timing = extractPstTime(text);
  const target = new Date(at);
  if (/\btomorrow\b/i.test(text)) target.setUTCDate(target.getUTCDate() + 1);
  else if (!/\btoday\b|\btonight\b/i.test(text)) target.setUTCDate(target.getUTCDate() + 1);

  if (timing) {
    const offsetHours = timing.timezone === 'UTC' ? 0 : 8;
    const utcHour = timing.hour + offsetHours;
    target.setUTCHours(utcHour, timing.minute, 0, 0);
    const start = new Date(target);
    const end = new Date(target);
    if (/\bbefore\b|\bby\b/i.test(text)) start.setUTCHours(Math.max(0, utcHour - 2));
    else start.setUTCHours(Math.max(0, utcHour - 1));
    return { start: formatUtc(start), end: formatUtc(end), label: `${timing.hour}:${String(timing.minute).padStart(2, '0')} ${timing.timezone}` };
  }

  const hoursMatch = text.match(/(?:within|next|in)\s+(?:the\s+next\s+)?(\d+)\s+hours?/i);
  if (hoursMatch) {
    const end = new Date(at.getTime() + Number(hoursMatch[1]) * 3600_000);
    return { start: formatUtc(at), end: formatUtc(end), label: `未来 ${hoursMatch[1]} 小时` };
  }
  if (/\bby\s+(?:eod|end\s+of\s+day)\b/i.test(text)) {
    const end = new Date(target);
    end.setUTCHours(7, 0, 0, 0);
    return { start: formatUtc(at), end: formatUtc(end), label: '当天结束前' };
  }
  return { start: formatUtc(at), end: formatUtc(new Date(at.getTime() + 24 * 3600_000)), label: '未来 24 小时' };
}

function normalizeFeed(raw, source) {
  const tweets = Array.isArray(raw?.tweets) ? raw.tweets : [];
  const upstreamEvents = Array.isArray(raw?.events) ? raw.events : [];
  const normalizedTweets = sortNewest(tweets.map(item => ({
    id: String(item.id || `${item.at}-${item.text}`),
    text: textOf(item),
    at: formatUtc(toDate(item.at || item.declared_at || item.created_at)),
    url: item.url || `https://x.com/thsottiaux/status/${item.id || ''}`,
    isReply: Boolean(item.is_reply),
    kind: item.kind || null,
    candidate: Boolean(item.reset_verification_candidate) || String(item.kind || '').toLowerCase() === 'candidate',
    likes: Number(item.likes || 0),
    replies: Number(item.replies || 0),
    reposts: Number(item.reposts || 0)
  })));
  const classified = normalizedTweets.map(classifyTweet);

  const eventRows = upstreamEvents
    .filter(event => String(event.type || '').toLowerCase() === 'reset' && !isBanked(textOf(event)) && isMeaningfulResetEvent(event))
    .map(event => ({
      id: String(event.id),
      at: formatUtc(toDate(event.effective_at || event.announced_at || event.date)),
      text: textOf(event),
      url: event.url || null,
      source: event.source_label || event.source || '公开记录',
      confidence: event.confidence || 'medium',
      status: isVerifiedResetEvent(event) ? 'verified' : 'observed'
    }))
    .filter(event => event.at);

  const eventResets = upstreamEvents
    .filter(event => String(event.type || '').toLowerCase() === 'reset' && !isBanked(textOf(event)) && isVerifiedResetEvent(event))
    .map(event => ({
      id: String(event.id),
      at: formatUtc(toDate(event.effective_at || event.announced_at || event.date)),
      text: textOf(event),
      url: event.url || null,
      source: event.source_label || event.source || '公开记录',
      confidence: event.confidence || 'medium'
    }))
    .filter(event => event.at);

  const tweetResets = classified
    .filter(tweet => tweet.reset && !tweet.banked && !tweet.isReply && !tweet.candidate && tweet.kind === 'reset')
    .map(tweet => ({ id: tweet.id, at: tweet.at, text: tweet.text, url: tweet.url, source: 'Tibo 动态', confidence: 'high' }));

  // Event rows and tweet rows can describe the same reset. Collapse events
  // that land within one operational propagation window (8 hours), keeping
  // the richer event row when both sources are present.
  const observedTimeline = [];
  for (const item of [...eventRows].sort((a, b) => new Date(a.at) - new Date(b.at))) {
    const previous = observedTimeline.at(-1);
    if (previous && new Date(item.at) - new Date(previous.at) < 8 * 3600_000) {
      if (previous.status === 'observed' && item.status === 'verified') observedTimeline[observedTimeline.length - 1] = item;
      continue;
    }
    observedTimeline.push(item);
  }

  const resets = [];
  for (const item of [...eventResets, ...tweetResets].sort((a, b) => new Date(a.at) - new Date(b.at))) {
    const previous = resets.at(-1);
    if (previous && new Date(item.at) - new Date(previous.at) < 8 * 3600_000) {
      if (previous.source === 'Tibo 动态' && item.source !== 'Tibo 动态') resets[resets.length - 1] = item;
      continue;
    }
    resets.push(item);
  }
  const intervals = resets.slice(1).map((item, index) => (new Date(item.at) - new Date(resets[index].at)) / 86400000).filter(value => value > 0 && value < 60);
  const recentIntervals = intervals.slice(-8);
  const latestReset = resets.at(-1) || null;
  const latestSignal = classified.find(item => (item.concrete || item.signal === 'watch') && !item.candidate && (!latestReset || new Date(item.at) > new Date(latestReset.at))) || null;
  const baselineDays = median(recentIntervals) || mean(recentIntervals) || 3;
  const p24 = 1 - Math.exp(-1 / baselineDays);
  const p48 = 1 - Math.exp(-2 / baselineDays);
  const hasStrong = Boolean(latestSignal?.concrete);
  const hasWatch = Boolean(latestSignal && !latestSignal.concrete);
  const probability24 = hasStrong ? 0.93 : hasWatch ? 0.83 : Math.min(0.95, p24);
  const probability48 = hasStrong ? 0.98 : hasWatch ? 0.93 : Math.min(0.99, p48);
  const signalWindow = inferWindow(latestSignal);
  const historicalPrediction = latestReset ? new Date(new Date(latestReset.at).getTime() + baselineDays * 86400000) : null;
  const predictedAt = signalWindow?.start || (historicalPrediction && historicalPrediction.getTime() > Date.now() ? formatUtc(historicalPrediction) : null);
  const confidence = hasStrong ? 'high' : hasWatch ? 'medium' : 'low';

  return {
    source,
    stale: Boolean(raw?.stale),
    fetchedAt: formatUtc(toDate(raw?.fetched_at)) || new Date().toISOString(),
    profile: raw?.profile || { handle: 'thsottiaux', name: 'Tibo' },
    latestSignal: latestSignal ? {
      id: latestSignal.id,
      text: latestSignal.text,
      at: latestSignal.at,
      url: latestSignal.url,
      type: latestSignal.signal,
      window: signalWindow
    } : null,
    timeline: observedTimeline.slice(-24).reverse(),
    historyDates: observedTimeline.map(item => ({ date: item.at.slice(0, 10), status: item.status, text: item.text, url: item.url })),
    latestObservedAt: observedTimeline.at(-1)?.at || null,
    recentPosts: classified.slice(0, 16).map(item => ({
      id: item.id, text: item.text, at: item.at, url: item.url, type: item.signal, isReply: item.isReply,
      likes: item.likes, replies: item.replies, reposts: item.reposts
    })),
    forecast: {
      probability24: Math.round(probability24 * 100),
      probability48: Math.round(probability48 * 100),
      confidence,
      confidenceLabel: confidence === 'high' ? '强信号' : confidence === 'medium' ? '中等' : '低（仅历史）',
      predictedAt,
      baselineDays: Number(baselineDays.toFixed(1)),
      medianDays: recentIntervals.length ? Number(median(recentIntervals).toFixed(1)) : null,
      sampleSize: recentIntervals.length,
      lastResetAt: latestReset?.at || null,
      signalBasis: hasStrong ? 'strong' : hasWatch ? 'watch' : 'history',
      caveat: '这是基于公开动态和历史记录的概率估计，不是 OpenAI 的承诺。'
    },
    meta: {
      feedPosts: classified.length,
      resetEvents: resets.length,
      intervalDays: recentIntervals.map(value => Number(value.toFixed(2))),
      upstreamEventCount: upstreamEvents.length
    }
  };
}

async function readSeed() {
  if (!existsSync(SEED_PATH)) return { tweets: [], events: [] };
  return JSON.parse(await readFile(SEED_PATH, 'utf8'));
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'codex-reset-radar/0.1' }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'codex-reset-radar/0.1' }, signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function stripTags(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function loadCrossSource() {
  try {
    const html = await fetchText(RADAR_URL);
    const spotlightDay = html.match(/t28-spotlight[\s\S]{0,300}?Day\s+(\d+)\b/i)?.[1];
    const noticeDay = html.match(/site-day(\d+)-notice/i)?.[1];
    const dayMatches = [...html.matchAll(/Day\s+(\d+)\b/gi)].map(match => Number(match[1])).filter(Number.isFinite);
    const resetMatch = html.match(/本次重置已完成[^<]{0,180}/i);
    const day = Number(spotlightDay || noticeDay || (dayMatches.length ? Math.max(...dayMatches) : 0)) || null;
    const officialEvidencePending = /尚未核实官方完成帖/.test(html);
    return {
      name: 'Codex 雷达站',
      url: RADAR_URL,
      status: 'fresh',
      role: 'cross-check',
      day,
      note: {
        zh: day ? `页面当前标记 Day ${day}；Day 18 的完成时间未知${officialEvidencePending ? '，官方证据仍待确认' : ''}，不直接改变概率。` : '页面可访问；未提取到明确 Day 标记。',
        en: day ? `Page currently shows Day ${day}; the Day 18 completion time is unknown${officialEvidencePending ? ' and official evidence is still pending' : ''}; it is not a probability input.` : 'Page reachable; no clear Day marker was extracted.'
      },
      resetNotice: stripTags(resetMatch?.[0] || '') || null
    };
  } catch (error) {
    return {
      name: 'Codex 雷达站', url: RADAR_URL, status: 'unavailable', role: 'cross-check', day: null,
      note: { zh: '交叉站点暂时不可访问；不影响主 feed。', en: 'Cross-check site unavailable; primary feed is still used.' },
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function loadTimelineSource() {
  try {
    const timeline = await fetchJson(TIMELINE_URL);
    const events = Array.isArray(timeline?.events) ? timeline.events : [];
    const pending = events.filter(event => String(event.reset_verification_status || '').toLowerCase() === 'pending').length;
    const verified = events.filter(isVerifiedResetEvent).length;
    return {
      name: 'Codex Reset timeline',
      url: TIMELINE_URL,
      status: 'fresh',
      role: 'validation',
      note: {
        zh: `最新时间线 ${events.length} 条；${verified} 条已确认/归档，${pending} 条待确认记录不计入模型。`,
        en: `${events.length} timeline events; ${verified} confirmed/archive events used, ${pending} pending rows excluded.`
      },
      updatedAt: timeline.updated_at || null
    };
  } catch (error) {
    return {
      name: 'Codex Reset timeline', url: TIMELINE_URL, status: 'unavailable', role: 'validation',
      note: { zh: '时间线接口暂时不可访问；不会使用未校验记录。', en: 'Timeline endpoint unavailable; unverified rows are excluded.' },
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function loadState(force = false) {
  const fresh = cache.value && Date.now() - cache.fetchedAt < CACHE_MS;
  if (!force && fresh) return cache.value;
  if (cache.promise) return cache.promise;
  cache.promise = (async () => {
    try {
      const [raw, timelineCheck, radarCheck] = await Promise.all([fetchJson(FEED_URL), loadTimelineSource(), loadCrossSource()]);
      const value = normalizeFeed(raw, `公开 feed · ${new URL(FEED_URL).hostname}`);
      value.sourceChecks = [
        { name: 'Codex Reset feed', url: FEED_URL, status: 'fresh', role: 'primary', note: { zh: '只把已确认/归档事件纳入历史样本。', en: 'Only confirmed/archive events enter the historical sample.' } },
        timelineCheck,
        radarCheck
      ];
      value.validation = { note: { zh: '两站点都显示 Day 18 已完成，但实际时间未知且官方证据待确认；因此不把这条记录当作精确时间或实时预告。', en: 'Both sites show Day 18 completed, but the actual time is unknown and official evidence is pending; it is not treated as an exact timestamp or live promise.' } };
      cache = { value, fetchedAt: Date.now(), promise: null };
      return value;
    } catch (error) {
      const seed = await readSeed();
      const value = normalizeFeed(seed, '本地种子数据（网络源暂不可用）');
      value.stale = true;
      const [timelineCheck, radarCheck] = await Promise.all([loadTimelineSource(), loadCrossSource()]);
      value.sourceChecks = [
        { name: 'Codex Reset feed', url: FEED_URL, status: 'unavailable', role: 'primary', note: { zh: '主 feed 不可用，当前使用本地种子数据。', en: 'Primary feed unavailable; using local seed data.' } },
        timelineCheck,
        radarCheck
      ];
      value.validation = { note: { zh: '网络源不可用，当前只展示本地种子数据。', en: 'Network sources unavailable; showing local seed data only.' } };
      value.error = error instanceof Error ? error.message : String(error);
      cache = { value, fetchedAt: Date.now(), promise: null };
      return value;
    }
  })();
  try { return await cache.promise; } finally { cache.promise = null; }
}

async function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, { 'content-type': MIME['.json'], 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body) });
  response.end(body);
}

async function serveStatic(response, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (!filePath.startsWith(path.resolve(PUBLIC_DIR)) || !existsSync(filePath)) return false;
  const body = await readFile(filePath);
  const extension = path.extname(filePath);
  response.writeHead(200, { 'content-type': MIME[extension] || 'application/octet-stream', 'cache-control': 'no-cache' });
  response.end(body);
  return true;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  try {
    if (url.pathname === '/health') return sendJson(response, 200, { ok: true, service: 'codex-reset-radar' });
    if (url.pathname === '/api/state') return sendJson(response, 200, await loadState(false));
    if (url.pathname === '/api/refresh' && request.method === 'POST') return sendJson(response, 200, await loadState(true));
    if (request.method === 'GET' && await serveStatic(response, url.pathname)) return;
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  } catch (error) {
    await sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, () => {
  console.log(`Codex Reset Radar running at http://localhost:${PORT}`);
  console.log(`Feed source: ${FEED_URL}`);
});


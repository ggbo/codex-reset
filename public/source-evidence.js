export const DEFAULT_URLS = {
  radar: 'https://codex-reset-radar.pages.dev/',
  watch: 'https://crw.warpnav.com/',
  tracker: 'https://reset-tracker.com/',
  digest: 'https://limitdigest.com/resets/codex/log/'
};

const names = { radar: 'Codex 雷达站', watch: 'Codex Reset Watch', tracker: 'Reset Tracker', digest: 'LimitDigest' };
const textOf = value => String(value || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(?:39|x27);/g, "'").replace(/\s+/g, ' ').trim();
const iso = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const postId = url => String(url || '').match(/^https:\/\/(?:x|twitter)\.com\/thsottiaux\/status\/(\d+)(?:[?#/]|$)/i)?.[1] || null;
const dayOf = value => Number(String(value || '').match(/\bday\s*0*(\d+)\b/i)?.[1]) || null;
const completion = text => /\b(?:all\s+(?:reset|propagated)|(?:it(?:'s| is)|reset(?:s)?)\s+(?:is\s+|has\s+been\s+)?(?:done|complete(?:d)?|processed)|have\s+(?:now\s+)?reset|reset\s+all\s+propagated)\b/i.test(text);
const banked = text => /\bbanked\b|reset\s+card|重置卡|储备重置/i.test(text);
const links = html => [...String(html).matchAll(/href="(https:\/\/(?:x|twitter)\.com\/thsottiaux\/status\/\d+)[^\"]*"/gi)].map(match => match[1]);

function parseRadar(html) {
  const days = {};
  const spotlight = html.match(/t28-spotlight[\s\S]{0,300}?Day\s+(\d+)\b/i)?.[1];
  let currentDay = Number(spotlight) || null;
  for (const match of html.matchAll(/<div id="t28-detail-(\d+)"[^>]*>[\s\S]*?<article>([\s\S]*?)<\/article>/gi)) {
    const day = Number(match[1]);
    const article = match[2];
    const at = iso(article.match(/<time[^>]*datetime="([^"]+)"/i)?.[1]);
    if (!at) continue; // Future challenge cells have no published record.
    currentDay = Math.max(currentDay || 0, day);
    const text = textOf(article);
    if (banked(text) || !/已确认重置|重置完成/.test(text)) continue;
    const url = links(article)[0];
    if (!url) continue;
    days[day] = { confirmed: true, at, url, relatedIds: links(article).map(postId), precision: 'post-timestamp' };
  }
  if (!currentDay) throw new Error('No published challenge records');
  return { days, currentDay };
}

function parseWatch(html) {
  const json = html.match(/window\.__CRW_BOOTSTRAP__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/i)?.[1];
  if (!json) throw new Error('Missing tracker data');
  const data = JSON.parse(json);
  const days = {};
  for (const entry of data.history || []) {
    const day = dayOf(entry.id) || dayOf(entry.previousAnnouncement?.text) || dayOf(entry.announcement?.text);
    if (!day || entry.eventType !== 'reset' || banked(entry.resetType) || entry.outcome !== 'as_announced') continue;
    const post = entry.announcement;
    const at = iso(post?.postedAt);
    if (!postId(post?.url) || !at) continue;
    const official = entry.timeBasis === 'confirmation' && completion(post.text);
    days[day] = {
      confirmed: true, at, url: post.url, text: post.text,
      textZh: post.translation || null,
      precision: official ? 'confirmation-post' : 'post-timestamp',
      confirmationId: official ? postId(post.url) : null,
      relatedIds: [post, entry.previousAnnouncement, entry.timingSource].map(item => postId(item?.url)).filter(Boolean)
    };
  }
  return { days, currentDay: dayOf(data.current?.headline), updatedAt: iso(data.current?.updatedAt) };
}

function parseTracker(html) {
  const days = {};
  for (const match of html.matchAll(/<article id="event-codex-[^"]+"[\s\S]*?<\/article>/gi)) {
    const article = match[0];
    if (!/event-kind reset/.test(article)) continue;
    const day = dayOf(textOf(article));
    if (!day || banked(textOf(article))) continue;
    const posts = [...article.matchAll(/<details class="original-post">([\s\S]*?)<\/details>/gi)].map(item => ({
      text: textOf(item[1].match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i)?.[1]),
      url: links(item[1])[0],
      at: iso(item[1].match(/<time[^>]*datetime="([^"]+)"/i)?.[1])
    }));
    const done = posts.find(item => completion(item.text) && item.at && postId(item.url));
    const announcement = posts.find(item => dayOf(item.text) === day && item.at && postId(item.url));
    if (!done && !/Confirmed completion time/i.test(article)) continue;
    const selected = done || announcement;
    if (!selected) continue;
    days[day] = { confirmed: true, ...selected, precision: done ? 'confirmation-post' : 'post-timestamp', confirmationId: done ? postId(done.url) : null, relatedIds: posts.map(item => postId(item.url)).filter(Boolean) };
  }
  if (!Object.keys(days).length) throw new Error('No completed reset records');
  return { days };
}

function parseDigest(html) {
  const days = {};
  for (const match of html.matchAll(/<li id="day-(\d+)"[^>]*class="dr reset"[^>]*>([\s\S]*?)<\/li>/gi)) {
    const text = textOf(match[2]);
    if (banked(text) || !/\b(?:landed|confirmed|all propagated|fully propagated|done|processed)\b/i.test(text)) continue;
    days[Number(match[1])] = { confirmed: true, relatedIds: links(match[2]).map(postId).filter(Boolean) };
  }
  if (!/id="day-\d+"/.test(html)) throw new Error('Missing challenge log');
  return { days };
}

const parsers = { radar: parseRadar, watch: parseWatch, tracker: parseTracker, digest: parseDigest };

function combine(results) {
  const sourceChecks = results.map(result => result.check);
  const allDays = [...new Set(results.flatMap(result => Object.keys(result.days || {}).map(Number)))].sort((a, b) => a - b);
  const validatedResets = [];
  for (const day of allDays) {
    const confirmations = results.filter(result => result.days?.[day]?.confirmed);
    if (confirmations.length < 2) continue;
    const records = confirmations.map(result => result.days[day]);
    const selected = records.find(item => item.precision === 'confirmation-post' && item.text && item.at) || records.find(item => item.text && item.at) || records.find(item => item.at);
    if (!selected || !postId(selected.url) || !iso(selected.at)) continue;
    // The day identifies the challenge; require another source to link a post
    // from the same reset thread before treating matching day numbers as evidence.
    const corroborated = confirmations.filter(result => result.days[day].relatedIds?.some(id => selected.relatedIds?.includes(id)));
    if (corroborated.length < 2) continue;
    validatedResets.push({
      id: `cross-source-day${day}`, day,
      date: selected.at.slice(0, 10), at: selected.at,
      text: selected.text || `Day ${day} reset`, textZh: selected.textZh || null,
      url: selected.url, source: '多站点交叉核验', status: 'verified',
      precision: selected.precision,
      relatedIds: [...new Set(records.flatMap(item => item.relatedIds || []))],
      evidence: corroborated.map(result => result.check.name)
    });
  }
  const recordedDays = results.map(result => result.currentDay).filter(Number.isFinite);
  const currentDay = recordedDays.length ? Math.max(...recordedDays) : null;
  const latest = validatedResets.at(-1);
  const validation = { note: {
    zh: `${currentDay ? `最新公开进展为 Day ${currentDay}。` : ''}${latest ? `Day ${latest.day} 重置已由 ${latest.evidence.length} 个来源交叉核验。` : '暂无新的交叉确认记录。'}显示时间为公开帖子时间，后台精确执行时刻未知。`,
    en: `${currentDay ? `Latest public progress: Day ${currentDay}. ` : ''}${latest ? `Day ${latest.day} reset cross-checked by ${latest.evidence.length} sources. ` : 'No new cross-checked reset records. '}Times refer to public posts; exact backend execution times are unknown.`
  } };
  return { checks: sourceChecks, validatedResets, validation, currentDay };
}

export async function loadCrossSources(overrides = {}, { browser = false } = {}) {
  const urls = { ...DEFAULT_URLS, ...overrides };
  // These sources permit CORS; Tracker remains a build/server source.
  const keys = Object.keys(urls).filter(key => !browser || key !== 'tracker');
  const results = await Promise.all(keys.map(async key => {
    const check = { name: names[key], url: urls[key], role: 'cross-check' };
    try {
      const response = await fetch(urls[key], { cache: 'no-store', signal: AbortSignal.timeout(12_000), ...(browser ? {} : { headers: { 'user-agent': 'codex-reset-radar/0.3' } }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = parsers[key](await response.text());
      return { ...result, check: { ...check, status: 'fresh', updatedAt: result.updatedAt || null } };
    } catch (error) {
      return { days: {}, check: { ...check, status: 'unavailable', error: String(error) } };
    }
  }));
  return combine(results);
}

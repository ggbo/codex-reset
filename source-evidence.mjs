const DEFAULT_URLS = {
  radar: 'https://codex-reset-radar.pages.dev/',
  watch: 'https://crw.warpnav.com/',
  tracker: 'https://reset-tracker.com/',
  digest: 'https://limitdigest.com/resets/codex/log/'
};

function stripTags(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceError(name, url, message) {
  return {
    name,
    url,
    status: 'unavailable',
    role: 'cross-check',
    note: {
      zh: '交叉站点暂时不可访问；不会把未校验内容写入预测。',
      en: 'Cross-check unavailable; unverified content is excluded from the forecast.'
    },
    error: message
  };
}

function parseRadar(html, url) {
  const spotlightDay = html.match(/t28-spotlight[\s\S]{0,300}?Day\s+(\d+)\b/i)?.[1];
  const noticeDay = html.match(/site-day(\d+)-notice/i)?.[1];
  const dayMatches = [...html.matchAll(/Day\s+(\d+)\b/gi)].map(match => Number(match[1])).filter(Number.isFinite);
  const day = Number(spotlightDay || noticeDay || (dayMatches.length ? Math.max(...dayMatches) : 0)) || null;
  const day18Confirmed = /data-day="18"[^>]*(?:已确认重置|reset complete)|Day\s*18[^<]{0,120}(?:重置完成|已确认)/i.test(html);
  const officialEvidencePending = /尚未核实官方完成帖|官方证据轨道仍待确认/.test(html);
  const resetMatch = html.match(/本次重置已完成[^<]{0,180}/i);
  return {
    check: {
      name: 'Codex 雷达站',
      url,
      status: 'fresh',
      role: 'cross-check',
      day,
      note: {
        zh: day ? `页面当前标记 Day ${day}；Day 18 ${day18Confirmed ? '已由站点确认' : '尚未确认'}${officialEvidencePending ? '，但 Tibo 尚未发布独立完成帖' : ''}。` : '页面可访问；未提取到明确 Day 标记。',
        en: day ? `Page currently shows Day ${day}; Day 18 is ${day18Confirmed ? 'confirmed by the site' : 'not confirmed'}${officialEvidencePending ? ', but Tibo has not posted a separate completion update' : ''}.` : 'Page reachable; no clear Day marker was extracted.'
      },
      resetNotice: stripTags(resetMatch?.[0] || '') || null
    },
    evidence: { name: 'Codex 雷达站', day18Confirmed, day }
  };
}

function parseWatch(html, url) {
  let bootstrap = null;
  const match = html.match(/window\.__CRW_BOOTSTRAP__=(\{[\s\S]*?\});<\/script>/i);
  if (match) {
    try { bootstrap = JSON.parse(match[1]); } catch { bootstrap = null; }
  }
  const history = Array.isArray(bootstrap?.history) ? bootstrap.history : [];
  const day18 = history.find(item => /day18/i.test(String(item?.id || '')) || /Day\s*18/i.test(String(item?.scope || item?.announcement?.text || '')));
  const announcement = day18?.announcement || bootstrap?.current?.announcement || null;
  const at = announcement?.postedAt || day18?.targetAt || day18?.recordedAt || null;
  const urlFromPost = announcement?.url || null;
  const day18Confirmed = Boolean(day18 && (day18.outcome === 'as_announced' || bootstrap?.current?.status === 'confirmed'));
  const currentDay = Number(String(bootstrap?.current?.headline || '').match(/Day\s+(\d+)/i)?.[1] || 0) || null;
  return {
    check: {
      name: 'Codex Reset Watch',
      url,
      status: 'fresh',
      role: 'cross-check',
      day: currentDay,
      note: {
        zh: day18Confirmed ? '独立追踪站记录 Day 18 已到账；界面采用 Tibo 原帖时间，后台精确执行时刻仍未知。' : '独立追踪站暂未确认 Day 18。',
        en: day18Confirmed ? 'Independent tracker records Day 18 as landed; the UI uses Tibo’s public post time while the exact backend execution time remains unknown.' : 'Independent tracker has not confirmed Day 18.'
      },
      updatedAt: bootstrap?.current?.updatedAt || null
    },
    evidence: { name: 'Codex Reset Watch', day18Confirmed, at, url: urlFromPost, text: announcement?.text || null, precision: 'post-timestamp' }
  };
}

function parseTracker(html, url) {
  const articles = [...html.matchAll(/<article id="event-codex-[^"]+"[\s\S]*?<\/article>/gi)].map(match => match[0]);
  const day18Article = articles.find(article => /Day\s*18\//i.test(article) && /Confirmed completion time/i.test(article));
  const at = day18Article?.match(/data-time datetime="([^"]+)"/i)?.[1] || null;
  const sourceUrl = day18Article?.match(/href="(https:\/\/x\.com\/thsottiaux\/status\/\d+)"/i)?.[1] || null;
  const day18Confirmed = Boolean(day18Article && at);
  return {
    check: {
      name: 'Reset Tracker',
      url,
      status: 'fresh',
      role: 'cross-check',
      note: {
        zh: day18Confirmed ? '独立追踪站将 Day 18 标为已完成，并给出一个记录时间；该时间仍属于第三方报告。' : '独立追踪站暂未提取到 Day 18 的完成记录。',
        en: day18Confirmed ? 'Independent tracker marks Day 18 complete and reports a timestamp; it remains a third-party report.' : 'Independent tracker did not expose a Day 18 completion record.'
      },
      updatedAt: html.match(/data-receipt-at="([^"]+)"/i)?.[1] || null
    },
    evidence: { name: 'Reset Tracker', day18Confirmed, at, url: sourceUrl, precision: 'reported' }
  };
}

function parseDigest(html, url) {
  const text = stripTags(html);
  const day18Confirmed = /latest was Day 18/i.test(text) && /9 of 19 days were resets/i.test(text);
  return {
    check: {
      name: 'LimitDigest',
      url,
      status: 'fresh',
      role: 'cross-check',
      note: {
        zh: day18Confirmed ? '日志站将 Day 18 列入 19 天中的已重置日期；未提供独立精确完成时刻。' : '日志站暂未确认 Day 18。',
        en: day18Confirmed ? 'Log site includes Day 18 among the resets in the 19-day run; it does not provide an independent exact completion time.' : 'Log site has not confirmed Day 18.'
      }
    },
    evidence: { name: 'LimitDigest', day18Confirmed }
  };
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'codex-reset-radar/0.2' }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

export async function loadCrossSources(overrides = {}) {
  const urls = { ...DEFAULT_URLS, ...overrides };
  const jobs = [
    ['radar', urls.radar, parseRadar],
    ['watch', urls.watch, parseWatch],
    ['tracker', urls.tracker, parseTracker],
    ['digest', urls.digest, parseDigest]
  ];
  const results = await Promise.all(jobs.map(async ([key, url, parser]) => {
    try {
      return parser(await fetchText(url), url);
    } catch (error) {
      const names = { radar: 'Codex 雷达站', watch: 'Codex Reset Watch', tracker: 'Reset Tracker', digest: 'LimitDigest' };
      return { check: sourceError(names[key], url, error instanceof Error ? error.message : String(error)), evidence: { name: names[key], day18Confirmed: false } };
    }
  }));
  const checks = results.map(result => result.check);
  const evidence = results.map(result => result.evidence);
  const confirmations = evidence.filter(item => item.day18Confirmed);
  const watchEvidence = evidence.find(item => item.name === 'Codex Reset Watch' && item.day18Confirmed);
  const trackerEvidence = evidence.find(item => item.name === 'Reset Tracker' && item.day18Confirmed);
  const dateSource = watchEvidence?.at || trackerEvidence?.at || null;
  const date = dateSource ? new Date(dateSource).toISOString().slice(0, 10) : '2026-10-23';
  const validatedResets = confirmations.length >= 2 ? [{
    id: 'cross-source-day18',
    day: 18,
    date,
    at: dateSource ? new Date(dateSource).toISOString() : null,
    text: watchEvidence?.text || 'Day 18 reset confirmed by multiple public trackers; exact backend completion time is not public.',
    url: watchEvidence?.url || trackerEvidence?.url || urls.radar,
    source: '多站点交叉核验',
    status: 'verified',
    precision: watchEvidence?.precision || trackerEvidence?.precision || 'date-only',
    evidence: confirmations.map(item => item.name)
  }] : [];
  const currentDay = checks.find(check => check.name === 'Codex 雷达站')?.day || null;
  const validation = confirmations.length >= 2
    ? {
        note: {
          zh: `当前为 Day ${currentDay || 19}；Day 18 已由 ${confirmations.length} 个公开追踪来源交叉确认。页面显示时间采用 Tibo 原帖的公开时间（10 月 23 日 12:46，北京时间），后台精确执行时刻仍未知。`,
          en: `Current status is Day ${currentDay || 19}; Day 18 is cross-checked by ${confirmations.length} public trackers. The displayed time uses Tibo’s public post timestamp (Oct 23, 04:46 UTC); the exact backend execution time remains unknown.`
        }
      }
    : {
        note: {
          zh: `当前为 Day ${currentDay || 19}；公开来源尚未达到 Day 18 的交叉确认门槛。`,
          en: `Current status is Day ${currentDay || 19}; public sources have not reached the cross-check threshold for Day 18.`
        }
      };
  return { checks, validatedResets, validation, currentDay };
}

export { DEFAULT_URLS };


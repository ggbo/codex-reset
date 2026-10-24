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
  const day17Confirmed = /data-day="17"[^>]*(?:已确认重置|reset complete)|Day\s*17[^<]{0,120}(?:重置完成|已确认)/i.test(html);
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
        zh: day ? `页面当前标记 Day ${day}；Day 17 ${day17Confirmed ? '已确认' : '仍待确认'}，Day 18 ${day18Confirmed ? '已由站点确认' : '尚未确认'}${officialEvidencePending ? '；Tibo 尚未发布独立完成帖' : ''}。` : '页面可访问；未提取到明确 Day 标记。',
        en: day ? `Page currently shows Day ${day}; Day 17 is ${day17Confirmed ? 'confirmed' : 'pending'}, and Day 18 is ${day18Confirmed ? 'confirmed by the site' : 'not confirmed'}${officialEvidencePending ? '; Tibo has not posted a separate completion update' : '.'}` : 'Page reachable; no clear Day marker was extracted.'
      },
      resetNotice: stripTags(resetMatch?.[0] || '') || null
    },
    evidence: { name: 'Codex 雷达站', days: { 17: { confirmed: day17Confirmed }, 18: { confirmed: day18Confirmed } }, day }
  };
}

function findWatchDay(history, day) {
  const pattern = new RegExp(`day${day}\\b`, 'i');
  const textPattern = new RegExp(`Day\\s*${day}\\b`, 'i');
  return history.find(item => pattern.test(String(item?.id || '')) || textPattern.test(String(item?.scope || item?.announcement?.text || '')));
}

function watchDayEvidence(entry, day, fallbackConfirmed = false) {
  const announcement = entry?.announcement || null;
  return {
    confirmed: Boolean(entry && (entry.outcome === 'as_announced' || fallbackConfirmed)),
    at: announcement?.postedAt || entry?.targetAt || entry?.recordedAt || null,
    url: announcement?.url || null,
    text: announcement?.text || null,
    precision: 'post-timestamp'
  };
}

function parseWatch(html, url) {
  let bootstrap = null;
  const match = html.match(/window\.__CRW_BOOTSTRAP__=(\{[\s\S]*?\});<\/script>/i);
  if (match) {
    try { bootstrap = JSON.parse(match[1]); } catch { bootstrap = null; }
  }
  const history = Array.isArray(bootstrap?.history) ? bootstrap.history : [];
  const day17 = findWatchDay(history, 17);
  const day18 = findWatchDay(history, 18) || (bootstrap?.current?.status === 'confirmed' ? { announcement: bootstrap.current.announcement, outcome: 'as_announced' } : null);
  const day17Evidence = watchDayEvidence(day17, 17);
  const day18Evidence = watchDayEvidence(day18, 18, bootstrap?.current?.status === 'confirmed');
  const confirmedDays = [day17Evidence.confirmed ? 17 : null, day18Evidence.confirmed ? 18 : null].filter(Boolean);
  const currentDay = Number(String(bootstrap?.current?.headline || '').match(/Day\s+(\d+)/i)?.[1] || 0) || null;
  return {
    check: {
      name: 'Codex Reset Watch',
      url,
      status: 'fresh',
      role: 'cross-check',
      day: currentDay,
      note: {
        zh: confirmedDays.length ? `独立追踪站记录 Day ${confirmedDays.join('、')} 已到账；界面采用 Tibo 原帖时间，后台精确执行时刻仍未知。` : '独立追踪站暂未确认 Day 17/18。',
        en: confirmedDays.length ? `Independent tracker records Day ${confirmedDays.join(' and ')} as landed; the UI uses Tibo’s public post time while the exact backend execution time remains unknown.` : 'Independent tracker has not confirmed Day 17 or Day 18.'
      },
      updatedAt: bootstrap?.current?.updatedAt || null
    },
    evidence: { name: 'Codex Reset Watch', days: { 17: day17Evidence, 18: day18Evidence } }
  };
}

function parseTracker(html, url) {
  const articles = [...html.matchAll(/<article id="event-codex-[^"]+"[\s\S]*?<\/article>/gi)].map(match => match[0]);
  const findArticle = day => articles.find(article => new RegExp(`Day\\s*${day}\\/`, 'i').test(article) && /Confirmed completion time/i.test(article));
  const extractArticle = article => { const at = article?.match(/data-time datetime="([^"]+)"/i)?.[1] || null; return { confirmed: Boolean(at), at, url: article?.match(/href="(https:\/\/x\.com\/thsottiaux\/status\/\d+)"/i)?.[1] || null, precision: 'reported' }; };
  const day17Evidence = extractArticle(findArticle(17));
  const day18Evidence = extractArticle(findArticle(18));
  const confirmedDays = [day17Evidence.confirmed ? 17 : null, day18Evidence.confirmed ? 18 : null].filter(Boolean);
  return {
    check: {
      name: 'Reset Tracker',
      url,
      status: 'fresh',
      role: 'cross-check',
      note: {
        zh: confirmedDays.length ? `独立追踪站将 Day ${confirmedDays.join('、')} 标为已完成，并给出记录时间；这些时间仍属于第三方报告。` : '独立追踪站暂未提取到 Day 17/18 的完成记录。',
        en: confirmedDays.length ? `Independent tracker marks Day ${confirmedDays.join(' and ')} complete and reports timestamps; they remain third-party reports.` : 'Independent tracker did not expose Day 17 or Day 18 completion records.'
      },
      updatedAt: html.match(/data-receipt-at="([^"]+)"/i)?.[1] || null
    },
    evidence: { name: 'Reset Tracker', days: { 17: day17Evidence, 18: day18Evidence } }
  };
}

function parseDigest(html, url) {
  const text = stripTags(html);
  const day17Confirmed = /Day\s*17[^]{0,500}(?:Landed Oct 22|full reset)/i.test(text);
  const day18Confirmed = /latest was Day 18/i.test(text) && /9 of 19 days were resets/i.test(text);
  return {
    check: {
      name: 'LimitDigest',
      url,
      status: 'fresh',
      role: 'cross-check',
      note: {
        zh: day17Confirmed || day18Confirmed ? `日志站将 Day ${[day17Confirmed ? 17 : null, day18Confirmed ? 18 : null].filter(Boolean).join('、')} 列入已重置日期；未提供独立精确完成时刻。` : '日志站暂未确认 Day 17/18。',
        en: day17Confirmed || day18Confirmed ? `Log site includes Day ${[day17Confirmed ? 17 : null, day18Confirmed ? 18 : null].filter(Boolean).join(' and ')} among the resets; it does not provide an independent exact completion time.` : 'Log site has not confirmed Day 17 or Day 18.'
      }
    },
    evidence: { name: 'LimitDigest', days: { 17: { confirmed: day17Confirmed }, 18: { confirmed: day18Confirmed } } }
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
      return { check: sourceError(names[key], url, error instanceof Error ? error.message : String(error)), evidence: { name: names[key], days: { 17: { confirmed: false }, 18: { confirmed: false } } } };
    }
  }));
  const checks = results.map(result => result.check);
  const evidence = results.map(result => result.evidence);
  const validatedResets = [];
  const daySummariesZh = [];
  const daySummariesEn = [];
  for (const day of [17, 18]) {
    const confirmations = evidence.filter(item => item.days?.[day]?.confirmed);
    const watchEvidence = evidence.find(item => item.name === 'Codex Reset Watch' && item.days?.[day]?.confirmed)?.days?.[day];
    const trackerEvidence = evidence.find(item => item.name === 'Reset Tracker' && item.days?.[day]?.confirmed)?.days?.[day];
    if (confirmations.length < 2) {
      daySummariesZh.push(`Day ${day} 尚未达到交叉确认门槛`);
      daySummariesEn.push(`Day ${day} has not reached the cross-check threshold`);
      continue;
    }
    const dateSource = watchEvidence?.at || trackerEvidence?.at || null;
    const fallbackDate = day === 17 ? '2026-10-22' : '2026-10-23';
    validatedResets.push({
      id: `cross-source-day${day}`,
      day,
      date: dateSource ? new Date(dateSource).toISOString().slice(0, 10) : fallbackDate,
      at: dateSource ? new Date(dateSource).toISOString() : null,
      text: watchEvidence?.text || `Day ${day} reset confirmed by multiple public trackers; exact backend completion time is not public.`,
      url: watchEvidence?.url || trackerEvidence?.url || urls.radar,
      source: '多站点交叉核验',
      status: 'verified',
      precision: watchEvidence?.precision || trackerEvidence?.precision || 'date-only',
      evidence: confirmations.map(item => item.name)
    });
    daySummariesZh.push(`Day ${day} 已由 ${confirmations.length} 个来源确认`);
    daySummariesEn.push(`Day ${day} is confirmed by ${confirmations.length} sources`);
  }
  const currentDay = checks.find(check => check.name === 'Codex 雷达站')?.day || null;
  const validation = validatedResets.length
    ? {
        note: {
          zh: `当前为 Day ${currentDay || 19}；${daySummariesZh.join('；')}。页面显示时间采用对应 Tibo 原帖的公开时间，后台精确执行时刻仍未知。`,
          en: `Current status is Day ${currentDay || 19}; ${daySummariesEn.join('; ')}. Displayed times use the corresponding Tibo post timestamps; exact backend execution times remain unknown.`
        }
      }
    : {
        note: {
          zh: `当前为 Day ${currentDay || 19}；公开来源尚未达到 Day 17/18 的交叉确认门槛。`,
          en: `Current status is Day ${currentDay || 19}; public sources have not reached the cross-check threshold for Day 17 or Day 18.`
        }
      };
  return { checks, validatedResets, validation, currentDay };
}

export { DEFAULT_URLS };


import { loadCrossSources } from './source-evidence.js?v=20261025';

const $ = selector => document.querySelector(selector);

const copy = {
    zh: {
    refresh: '刷新数据 ↻', heroTitle: '下一次 Codex<br /><em>重置会在什么时候？</em>', heroSubtitle: '抓取 Tibo 的公开动态，识别明确重置信号，再用最近的历史节奏给出一个透明的时间窗口。', disclaimer: '概率是公开信息的统计估计，不是 OpenAI 的承诺，也不是账号级用量查询。', currentJudgement: '当前判断', confidence: '模型置信度', next24: '未来 24 小时', next48: '未来 48 小时', latestSignal: '最新信号', cadenceTitle: '最近的重置节奏', shorter: '更近', longer: '更久', medianInterval: '最近中位间隔', sample: '当前样本', lastReset: '最近一次', whyTitle: '为什么这样判断', openTibo: '打开 @thsottiaux ↗', publicLog: '公开记录', utcDisplay: '按 UTC 显示', recentPosts: '最近动态', classifier: '分类器 v0.1', historyTitle: '历史重置日期', historyNote: '绿色：已确认或多站点交叉确认 · 橙色：已观察但待确认', historyVerified: '已确认 / 交叉确认', historyObserved: '已观察，待确认', methodTitle: '这不是黑箱倒计时', step1: '抓取公开动态', step1small: 'feed → 结构化帖子', step2: '识别重置语义', step2small: '区分重置、预告和 banked', step3: '计算历史基线', step3small: '最近 8 个完整间隔', footerIndependent: '独立社区工具 · 不代表 OpenAI', footerSource: '数据源：@thsottiaux 公开动态 · ', reference: '参考 codex-reset.com', strong: '强信号', watch: '预告', reset: '重置', banked: 'banked', context: '动态', low: '低（仅历史）', medium: '中等', high: '强信号', noSignal: '无明确信号', noResetSignal: '暂无重置信号', history: '历史基线', signalBasisStrong: 'Tibo 明确给出了重置时间窗口', signalBasisWatch: 'Tibo 提到即将重置，但没有完整时间', signalBasisHistory: '最近重置间隔的历史节奏', historicalEstimate: '历史估计 · 非官方预告', samples: n => `样本 ${n} 次`, baseline: n => `基线 ${n} 天`, caveat: '这是基于公开动态和历史记录的概率估计，不是 OpenAI 的承诺。', noWindow: '暂无可用窗口', waitMore: '等待更多公开记录', noRecentSignal: '最近 7 天没有新的明确预告', noQuote: '暂无新的明确重置预告。模型此时只使用历史节奏。', noRecords: '暂无公开记录', noPosts: '暂无动态', insufficient: '样本不足，等待更多已确认重置。', events: n => `${n} 条重置记录`, hoursAgo: n => `${n} 小时前`, daysAgo: n => `${n.toFixed(1)} 天前`, reply: '回复', post: '主帖'
  },
  en: {
    refresh: 'Refresh ↻', heroTitle: 'When will Codex<br /><em>reset next?</em>', heroSubtitle: "Track Tibo's public posts, classify reset signals, and turn recent cadence into a transparent time window.", disclaimer: 'A probability estimate from public evidence — not an OpenAI promise and not account-level usage telemetry.', currentJudgement: 'CURRENT READ', confidence: 'MODEL CONFIDENCE', next24: 'NEXT 24 HOURS', next48: 'NEXT 48 HOURS', latestSignal: 'LATEST SIGNAL', cadenceTitle: 'Recent reset cadence', shorter: 'SHORTER', longer: 'LONGER', medianInterval: 'Recent median gap', sample: 'Current sample', lastReset: 'Last reset', whyTitle: 'Why this read', openTibo: 'Open @thsottiaux ↗', publicLog: 'Public log', utcDisplay: 'UTC timestamps', recentPosts: 'Recent posts', classifier: 'classifier v0.1', historyTitle: 'Reset history', historyNote: 'Green: confirmed or cross-checked · Orange: observed, awaiting confirmation', historyVerified: 'confirmed / cross-checked', historyObserved: 'observed, pending', methodTitle: 'This is not a black-box countdown', step1: 'Fetch public posts', step1small: 'feed → structured posts', step2: 'Classify reset language', step2small: 'reset, promise, banked', step3: 'Build a historical baseline', step3small: 'up to 8 complete gaps', footerIndependent: 'Independent community tool · not OpenAI', footerSource: 'Source: public @thsottiaux posts · ', reference: 'reference codex-reset.com', strong: 'STRONG', watch: 'WATCH', reset: 'RESET', banked: 'BANKED', context: 'POST', low: 'Low (history only)', medium: 'Medium', high: 'Strong signal', noSignal: 'NO LIVE SIGNAL', noResetSignal: 'NO RESET SIGNAL', history: 'HISTORICAL BASELINE', signalBasisStrong: 'Tibo gave a concrete reset window', signalBasisWatch: 'Tibo mentioned a future reset without a full window', signalBasisHistory: 'Recent reset cadence', historicalEstimate: 'historical estimate · no official promise', samples: n => `${n} samples`, baseline: n => `${n}d baseline`, caveat: 'A probability estimate from public posts and history — not an OpenAI promise.', noWindow: 'No active window', waitMore: 'Waiting for more public records', noRecentSignal: 'No clear new promise in the last 7 days', noQuote: 'No clear reset promise right now. The model is using historical cadence only.', noRecords: 'No public records yet', noPosts: 'No posts yet', insufficient: 'Not enough samples; waiting for more confirmed resets.', events: n => `${n} reset records`, hoursAgo: n => `${n}h ago`, daysAgo: n => `${n.toFixed(1)}d ago`, reply: 'reply', post: 'post'
  }
};

Object.assign(copy.zh, { todayReset: '今日重置已确认', confirmedReset: '重置已确认', noNextReset: '下一次暂无重置信号', confirmationTime: '公开记录时间' });
Object.assign(copy.en, { todayReset: 'RESET CONFIRMED TODAY', confirmedReset: 'RESET CONFIRMED', noNextReset: 'No signal for the next reset', confirmationTime: 'Public record time' });

let lang = localStorage.getItem('codex-reset-radar-lang') || ((navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en');
if (!copy[lang]) lang = 'en';
const t = key => copy[lang][key] ?? key;

const tweetTranslations = [
  ['Day 20/ Rest and reset', '第 20 天 / 休息一下，重置额度。'],
  ['By midnight PST', '太平洋标准时间午夜前。'],
  ['It is all propagated. Enjoy some mad codexing tomorrow. Fun week ahead too.', '已经全部生效了。明天尽情用 Codex 大干一场吧，接下来的一周也会很有意思。'],
  ['Not a real improvement, put the reset in the bag', '这算不上真正的改进，把重置安排上吧。'],
  ['Landing tomorrow before 10am PST together with a small ship.', '明天太平洋时间上午 10 点前上线，同时发布一个小功能。'],
  ['Lands tomorrow before 10am PST.', '明天太平洋时间上午 10 点前上线。'],
  ['Day 18/ Decisions API is GA, OpenResponses joined the Linux Foundation, we shipped some performance improvements and Uber is going all-in on codex & work. But yes… that’s a reset!', '第 18 天 / Decisions API 正式可用，OpenResponses 加入 Linux 基金会，我们还发布了一些性能改进，Uber 也全面投入 Codex 和 Work。不过，是的……这就是一次重置！'],
  ['Day 17/ Bet you thought we forgot, but no, it’s reset day today.\n\nAlso good time to remind you to get Daybreak Blue access, it only takes 15 mins and you don’t want to have to do it in the middle of an incident.', '第 17 天 / 你以为我们忘了，但没有，今天就是重置日。\n\n顺便提醒一下，现在适合开通 Daybreak Blue，用时只要 15 分钟；你不会想在事故处理中途才去开通。'],
  ['Nevermind, we’re still cooking... and reset. Enjoy.', '没事，我们还在持续推进……并且重置了。享受吧。'],
  ['Day 15 of the 28-day ship-or-reset series: hours after “We’re cooked”, Tibo posted the global reset: “Nevermind, we’re still cooking... and reset. Enjoy.”', '28 天发布或重置系列第 15 天：在“我们要完了”几个小时后，Tibo 发布了全局重置：“没事，我们还在持续推进……并且重置了。享受吧。”'],
  ['People have escaped the TL and are asking me for resets on the street now. I’ll make little cards to hand out', '大家已经从时间线里跑出来，在街上向我索要重置了。我会做一些小卡片发给大家。'],
  ['Day 13/ Le limit reset', '第 13 天 / 重置限额'],
  ['Day 10 of the 28-day ship-or-reset series: the global reset promised to land “within the next 2 hours” arrived at 06:13 UTC on our checks; Tibo: “Done and dusted.”', '28 天发布或重置系列第 10 天：承诺“未来 2 小时内”到达的全局重置，在我们的检查中于 UTC 06:13 生效；Tibo：“完成，搞定。”'],
  ['Day 8/ Reset', '第 8 天 / 重置'],
  ['Day 6/ Reset', '第 6 天 / 重置'],
  ['Full reset for Codex and ChatGPT Work users, picked by community vote in the 28-day ship-or-reset series: “the reset has been processed. Enjoy!”', '28 天发布或重置系列根据社区投票，为 Codex 和 ChatGPT Work 用户完成全量重置：“重置已处理。享受吧！”'],
  ['Global reset for all paid ChatGPT accounts, promised the evening before after GPT-6.1 Sol’s slow start and confirmed that afternoon: “Reset all propagated. Enjoy.”', '为所有付费 ChatGPT 账号执行全局重置；GPT-6.1 Sol 启动缓慢后前一晚作出承诺，并在当天下午确认：“重置已全部生效。享受吧。”'],
  ['Reset for every paid Codex and ChatGPT Work user, promised after a brief disruption and confirmed fully propagated that evening: “Resets all propagated. That will be all.”', '为所有付费 Codex 和 ChatGPT Work 用户重置；短暂中断后作出承诺，并在当晚确认已全部生效：“重置已全部传播完成。就这样。”'],
  ['Reset for every paid Codex and ChatGPT Work user, announced with that morning\'s Astra quality update and confirmed fully propagated: “Reset all propagated. Sweet dreams.”', '随当日上午的 Astra 质量更新宣布，为所有付费 Codex 和 ChatGPT Work 用户重置，并确认已全部生效：“重置已全部传播完成。晚安。”'],
  ['Global reset landed around 01:34 UTC, seen in usage meters before any announcement; Tibo confirmed at 04:05 UTC: “All reset for everyone. Enjoy the week with Astra.”', '全局重置约在 UTC 01:34 生效，在公告前就已从用量计量器中观察到；Tibo 于 UTC 04:05 确认：“所有人都已重置。享受 Astra 的这一周。”'],
  ['25M active users: to celebrate, usage reset for every paid ChatGPT Work and Codex subscription — the reset promised for 6pm PT the previous day.', '活跃用户达到 2500 万：为庆祝这一里程碑，所有付费 ChatGPT Work 和 Codex 订阅的用量都已重置；前一天承诺的时间是太平洋时间下午 6 点。'],
  ['On codex cli updates. We\'ve added reusable prompt presets, inline model and permission settings, and enterprise MCP sign-in. We\'ve also fixed failures when resuming long sessions and added Windows corporate-proxy authentication.\n\nSurprisingly the CLI has grown 2X in usage since devday.', '关于 Codex CLI 更新：我们加入了可复用的提示词预设、内联模型与权限设置，以及企业 MCP 登录；还修复了长会话恢复失败，并增加 Windows 企业代理认证。\n\n令人意外的是，自 DevDay 以来 CLI 的使用量增长了 2 倍。'],
  ['Fully included in the Pro plan, doesn\'t draw on your weekly usage.', 'Pro 套餐已完整包含，不会消耗每周用量。'],
  ['I demand a reset', '我要一个重置。'],
  ['is this true', '这是真的吗？']
];

function translateText(value) {
  if (lang !== 'zh') return value;
  const match = tweetTranslations.filter(([source]) => value.includes(source)).sort((a, b) => b[0].length - a[0].length)[0];
  if (match) return value.replace(match[0], match[1]);
  const prefixMatch = tweetTranslations.find(([source]) => source.length > 70 && value.startsWith(source.slice(0, 70)));
  return prefixMatch ? `${prefixMatch[1]}…` : value;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function applyLanguage() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const value = t(element.dataset.i18n);
    if (value.includes('<')) element.innerHTML = value; else element.textContent = value;
  });
  $('#language-button').textContent = lang === 'zh' ? 'EN' : '中文';
  $('#refresh-button').textContent = t('refresh');
}

const toDate = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; };
const toIso = value => toDate(value)?.toISOString() || null;
const textOf = item => String(item?.text || item?.summary || '').replace(/&amp;/g, '&').trim();
const sortNewest = items => [...items].sort((a, b) => (toDate(b.at || b.announced_at || b.date)?.getTime() || 0) - (toDate(a.at || a.announced_at || a.date)?.getTime() || 0));
const median = values => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const i = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2; };
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const isBanked = text => /\bbanked\b|on[- ]demand|credit(?:ed|s)?\s+(?:to|into)|reset\s+card/i.test(text);
const isVerifiedResetEvent = event => { const status = String(event?.reset_verification_status || '').toLowerCase(); const source = String(event?.source || '').toLowerCase(); const sourceLabel = String(event?.source_label || '').toLowerCase(); if (status === 'pending' || source.includes('operator-observed') || sourceLabel.includes('awaiting')) return false; return event?.confirmed === true || String(event?.confidence || '').toLowerCase() === 'high' || source.includes('archive'); };
const isMeaningfulResetEvent = event => isVerifiedResetEvent(event) || String(event?.observation_result || '').toLowerCase() === 'reset_observed' || isResetClaim(textOf(event));
const isResetClaim = text => /\breset(?:s|ed|ting)?\b/i.test(text) && !/ask(?:ed)?\s+(?:tibo|for)\s+a\s+reset|demand\s+a\s+reset/i.test(text);
const hasConcreteTiming = text => /\b(?:today|tomorrow|tonight|within\s+(?:the\s+next\s+)?\d+\s+hours?|in\s+\d+\s+hours?|before\s+\d|by\s+(?:eod|end\s+of\s+day)|landing|lands|arriv(?:e|es|ed)|next\s+\d+\s+(?:hours?|days?))\b/i.test(text);

function classifyTweet(tweet) {
  const text = textOf(tweet); const kind = String(tweet?.kind || '').toLowerCase(); const banked = isBanked(text) || kind.includes('banked'); const timing = hasConcreteTiming(text); const reset = (isResetClaim(text) || kind === 'reset') && !banked; const completed = tweet.completed === true; const explicitFuture = !completed && reset && /\b(?:will|going\s+to|tomorrow|today|by\s+eod|within|next)\b/i.test(text); const concrete = !completed && reset && timing;
  let signal = 'context'; if (concrete) signal = 'strong'; else if (explicitFuture) signal = 'watch'; else if (reset) signal = 'reset'; if (banked) signal = 'banked'; return { ...tweet, text, banked, reset, timing, concrete, explicitFuture, signal };
}

function extractPstTime(text) {
  const match = text.match(/(?:before|by|at|around)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(PST|PT|UTC)?/i); if (!match) return null;
  let hour = Number(match[1]); const minute = Number(match[2] || 0); const meridiem = match[3].toLowerCase(); if (meridiem === 'pm' && hour !== 12) hour += 12; if (meridiem === 'am' && hour === 12) hour = 0; return { hour, minute, timezone: (match[4] || 'PST').toUpperCase() };
}

function inferWindow(signal) {
  if (!signal) return null; const at = toDate(signal.at || signal.declared_at); if (!at) return null; const text = signal.text; const timing = extractPstTime(text); const target = new Date(at); if (/\btomorrow\b/i.test(text) || !/\btoday\b|\btonight\b/i.test(text)) target.setUTCDate(target.getUTCDate() + 1);
  if (timing) { const utcHour = timing.hour + (timing.timezone === 'UTC' ? 0 : 8); target.setUTCHours(utcHour, timing.minute, 0, 0); const start = new Date(target); const end = new Date(target); start.setUTCHours(Math.max(0, utcHour - (/\bbefore\b|\bby\b/i.test(text) ? 2 : 1))); return { start: start.toISOString(), end: end.toISOString(), label: `${timing.hour}:${String(timing.minute).padStart(2, '0')} ${timing.timezone}` }; }
  const hoursMatch = text.match(/(?:within|next|in)\s+(?:the\s+next\s+)?(\d+)\s+hours?/i); if (hoursMatch) return { start: at.toISOString(), end: new Date(at.getTime() + Number(hoursMatch[1]) * 3600_000).toISOString(), label: lang === 'zh' ? `未来 ${hoursMatch[1]} 小时` : `next ${hoursMatch[1]} hours` }; return { start: at.toISOString(), end: new Date(at.getTime() + 24 * 3600_000).toISOString(), label: lang === 'zh' ? '未来 24 小时' : 'next 24 hours' };
}

function normalizeFeed(raw, source = 'public feed', validatedResets = []) {
  const tweets = Array.isArray(raw?.tweets) ? raw.tweets : [];
  const upstreamEvents = Array.isArray(raw?.events) ? raw.events : [];
  const normalizedTweets = sortNewest(tweets.map(item => ({ id: String(item.id || `${item.at}-${item.text}`), text: textOf(item), at: toIso(item.at || item.declared_at || item.created_at), url: item.url || `https://x.com/thsottiaux/status/${item.id || ''}`, isReply: Boolean(item.is_reply), kind: item.kind || null, candidate: Boolean(item.reset_verification_candidate) || String(item.kind || '').toLowerCase() === 'candidate', likes: Number(item.likes || 0), replies: Number(item.replies || 0), reposts: Number(item.reposts || 0) })));
  const completedPosts = validatedResets.filter(item => item.at && item.text).map(item => ({ id: String(item.url?.match(/status\/(\d+)/)?.[1] || item.id), at: item.at, text: item.text, textZh: item.textZh, url: item.url, kind: 'reset', completed: true }));
  const completedIds = new Set(completedPosts.map(item => item.id));
  const classified = sortNewest([...normalizedTweets.filter(item => !completedIds.has(item.id)), ...completedPosts]).map(classifyTweet);
  const crossIds = new Set(validatedResets.flatMap(item => item.relatedIds || [item.url?.match(/status\/(\d+)/)?.[1]]).filter(Boolean));
  const eventRows = upstreamEvents.filter(event => !crossIds.has(String(event.id)) && String(event.type || '').toLowerCase() === 'reset' && !isBanked(textOf(event)) && isMeaningfulResetEvent(event)).map(event => ({ id: String(event.id), at: toIso(event.effective_at || event.announced_at || event.date), text: textOf(event), url: event.url || null, source: event.source_label || event.source || 'public log', confidence: event.confidence || 'medium', status: isVerifiedResetEvent(event) ? 'verified' : 'observed' })).filter(event => event.at);
  const eventResets = upstreamEvents.filter(event => !crossIds.has(String(event.id)) && String(event.type || '').toLowerCase() === 'reset' && !isBanked(textOf(event)) && isVerifiedResetEvent(event)).map(event => ({ id: String(event.id), at: toIso(event.effective_at || event.announced_at || event.date), text: textOf(event), url: event.url || null, source: event.source_label || event.source || 'public log', confidence: event.confidence || 'medium' })).filter(event => event.at);
  const tweetResets = classified.filter(tweet => tweet.reset && !tweet.banked && !tweet.isReply && !tweet.candidate && tweet.kind === 'reset').map(tweet => ({ id: tweet.id, at: tweet.at, text: tweet.text, url: tweet.url, source: 'Tibo post', confidence: 'high' }));
  const crossSourceRows = validatedResets.filter(item => item.at).map(item => ({ id: item.id, at: toIso(item.at), text: item.text, textZh: item.textZh, url: item.url, source: item.source || 'cross-source check', confidence: 'medium', status: 'verified', precision: item.precision || 'reported' })).filter(item => item.at);
  const observedTimeline = [];
  for (const item of [...eventRows, ...crossSourceRows].sort((a, b) => new Date(a.at) - new Date(b.at))) { const previous = observedTimeline.at(-1); if (previous && new Date(item.at) - new Date(previous.at) < 8 * 3600_000) { if (previous.status === 'observed' && item.status === 'verified') observedTimeline[observedTimeline.length - 1] = item; continue; } observedTimeline.push(item); }
  const resets = [];
  for (const item of [...eventResets, ...tweetResets, ...crossSourceRows].sort((a, b) => new Date(a.at) - new Date(b.at))) { const previous = resets.at(-1); if (previous && new Date(item.at) - new Date(previous.at) < 8 * 3600_000) { if (previous.source === 'Tibo post' && item.source !== 'Tibo post') resets[resets.length - 1] = item; continue; } resets.push(item); }
  const intervals = resets.slice(1).map((item, index) => (new Date(item.at) - new Date(resets[index].at)) / 86400000).filter(value => value > 0 && value < 60); const recentIntervals = intervals.slice(-8); const latestReset = resets.at(-1) || null; const latestSignal = classified.find(item => (item.concrete || item.signal === 'watch') && !item.candidate && (!latestReset || new Date(item.at) > new Date(latestReset.at))) || null; const baselineDays = median(recentIntervals) || mean(recentIntervals) || 3; const p24 = 1 - Math.exp(-1 / baselineDays); const p48 = 1 - Math.exp(-2 / baselineDays); const strong = Boolean(latestSignal?.concrete); const watch = Boolean(latestSignal && !latestSignal.concrete); const probability24 = strong ? .93 : watch ? .83 : Math.min(.95, p24); const probability48 = strong ? .98 : watch ? .93 : Math.min(.99, p48); const signalWindow = inferWindow(latestSignal); const historicalPrediction = latestReset ? new Date(new Date(latestReset.at).getTime() + baselineDays * 86400000) : null; const predictedAt = signalWindow?.start || (historicalPrediction && historicalPrediction.getTime() > Date.now() ? historicalPrediction.toISOString() : null); const confidence = strong ? 'high' : watch ? 'medium' : 'low';
  return { source, stale: Boolean(raw?.stale), fetchedAt: toIso(raw?.fetched_at) || new Date().toISOString(), profile: raw?.profile || { handle: 'thsottiaux', name: 'Tibo' }, latestSignal: latestSignal ? { id: latestSignal.id, text: latestSignal.text, at: latestSignal.at, url: latestSignal.url, type: latestSignal.signal, window: signalWindow } : null, timeline: observedTimeline.slice(-24).reverse(), historyDates: [...observedTimeline.map(item => ({ date: item.at.slice(0, 10), status: item.status, text: item.text, url: item.url })), ...validatedResets.filter(item => item.date).map(item => ({ date: item.date, status: 'verified', text: item.text, url: item.url }))], latestObservedAt: [...observedTimeline, ...crossSourceRows].sort((a, b) => new Date(a.at) - new Date(b.at)).at(-1)?.at || null, recentPosts: classified.slice(0, 16).map(item => ({ id: item.id, text: item.text, textZh: item.textZh, at: item.at, url: item.url, type: item.signal, isReply: item.isReply, likes: item.likes, replies: item.replies, reposts: item.reposts })), forecast: { probability24: Math.round(probability24 * 100), probability48: Math.round(probability48 * 100), confidence, predictedAt, baselineDays: Number(baselineDays.toFixed(1)), medianDays: recentIntervals.length ? Number(median(recentIntervals).toFixed(1)) : null, sampleSize: recentIntervals.length, lastResetAt: latestReset?.at || null, lastResetPrecision: latestReset?.precision || 'reported', signalBasis: strong ? 'strong' : watch ? 'watch' : 'history', caveat: t('caveat') }, meta: { feedPosts: classified.length, resetEvents: resets.length, intervalDays: recentIntervals.map(value => Number(value.toFixed(2))), crossSourceResets: validatedResets.length }, sourceChecks: raw?.sourceChecks || [] };
}

function relativeTime(iso) { if (!iso) return '—'; const diff = (Date.now() - new Date(iso).getTime()) / 86400000; return diff < 1 ? t('hoursAgo')(Math.max(1, Math.round(diff * 24))) : t('daysAgo')(diff); }
function formatDate(iso) { if (!iso) return '—'; return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' }).format(new Date(iso)); }
function formatForecast(iso) { if (!iso) return t('noWindow'); return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' }).format(new Date(iso)); }
function typeLabel(type) { return t(type) || (lang === 'zh' ? '动态' : 'POST'); }
function basisLabel(basis) { return basis === 'strong' ? t('signalBasisStrong') : basis === 'watch' ? t('signalBasisWatch') : t('signalBasisHistory'); }
function confidenceLabel(level) { return t(level) || level; }

function renderHistoryCalendar(state) {
  const entries = new Map();
  for (const item of state.historyDates || []) {
    const current = entries.get(item.date);
    if (!current || (current.status === 'observed' && item.status === 'verified')) entries.set(item.date, item);
  }
  const latest = toDate(state.latestObservedAt) || new Date();
  const start = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), latest.getUTCDate() - 60));
  const months = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), 1));
  while (cursor <= endMonth) { months.push(new Date(cursor)); cursor.setUTCMonth(cursor.getUTCMonth() + 1); }
  const weekdays = lang === 'zh' ? ['日', '一', '二', '三', '四', '五', '六'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  $('#history-calendar').innerHTML = months.map(month => {
    const year = month.getUTCFullYear(); const monthIndex = month.getUTCMonth(); const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay(); const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const cells = []; for (let i = 0; i < firstWeekday; i++) cells.push('<span class="history-day empty"></span>');
    for (let day = 1; day <= days; day++) { const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const item = entries.get(date); const status = item?.status || ''; const title = item ? `${date} · ${status === 'verified' ? t('historyVerified') : t('historyObserved')}` : date; cells.push(`<span class="history-day ${status}" title="${escapeHtml(title)}">${day}</span>`); }
    const label = new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(month);
    return `<div class="history-month"><h3>${label}</h3><div class="history-weekdays">${weekdays.map(day => `<span>${day}</span>`).join('')}</div><div class="history-days">${cells.join('')}</div></div>`;
  }).join('');
}

function render(state) {
  const { forecast, latestSignal, timeline, recentPosts, meta } = state; const checks = state.sourceChecks || []; $('#source-status').textContent = state.stale ? (lang === 'zh' ? '本地降级数据' : 'local fallback') : (checks.length ? `${checks.filter(check => check.status === 'fresh').length}/${checks.length} ${lang === 'zh' ? '来源已核对' : 'sources checked'}` : state.source); $('#forecast-basis').textContent = basisLabel(forecast.signalBasis); $('#forecast-time').textContent = formatForecast(forecast.predictedAt); $('#forecast-meta').textContent = forecast.predictedAt ? (forecast.signalBasis === 'history' ? t('historicalEstimate') : `${lang === 'zh' ? '北京时间' : 'local time'} · ${relativeTime(forecast.predictedAt)}`) : t('waitMore'); $('#confidence').textContent = confidenceLabel(forecast.confidence); $('#probability-24').textContent = forecast.probability24; $('#probability-48').textContent = forecast.probability48; $('#meter-24').style.width = `${forecast.probability24}%`; $('#meter-48').style.width = `${forecast.probability48}%`; $('#range-24').textContent = `${t('samples')(forecast.sampleSize)} · ${t('baseline')(forecast.baselineDays)}`; $('#range-48').textContent = t('caveat'); $('#median-days').textContent = forecast.medianDays ? `${forecast.medianDays}${lang === 'zh' ? ' 天' : 'd'}` : '—'; $('#sample-size').textContent = `${forecast.sampleSize}${lang === 'zh' ? ' 次' : ''}`; $('#last-reset').textContent = relativeTime(forecast.lastResetAt); $('#cadence-note').textContent = meta.resetEvents ? t('events')(meta.resetEvents) : t('waitMore'); $('#signal-type').textContent = latestSignal ? typeLabel(latestSignal.type) : t('noSignal'); $('#signal-title').textContent = latestSignal ? typeLabel(latestSignal.type) : t('history'); $('#signal-date').textContent = latestSignal ? formatDate(latestSignal.at) : t('noRecentSignal'); $('#signal-text').textContent = translateText(latestSignal?.text || t('noQuote')); $('#signal-link').href = latestSignal?.url || 'https://x.com/thsottiaux'; $('#method-copy').textContent = state.validation?.note?.[lang] || t('caveat'); if (!latestSignal && forecast.signalBasis === 'history') { $('#forecast-time').textContent = t('noResetSignal'); $('#forecast-meta').textContent = t('waitMore'); } renderHistoryCalendar(state);
  const latestVerified = timeline.find(item => item.status === 'verified');
  const beijingDay = value => new Date(new Date(value).getTime() + 8 * 3600_000).toISOString().slice(0, 10);
  if (!latestSignal && latestVerified && beijingDay(latestVerified.at) === beijingDay(new Date())) {
    $('#forecast-basis').textContent = t('confirmedReset');
    $('#forecast-time').textContent = t('todayReset');
    $('#forecast-meta').textContent = `${formatDate(latestVerified.at)} · ${t('noNextReset')}`;
    $('#signal-type').textContent = t('confirmedReset');
    $('#signal-title').textContent = t('confirmedReset');
    $('#signal-date').textContent = formatDate(latestVerified.at);
    $('#signal-text').textContent = (lang === 'zh' && latestVerified.textZh ? latestVerified.textZh : translateText(latestVerified.text));
    $('#signal-link').href = latestVerified.url;
  }
  const intervals = meta.intervalDays || []; const chart = $('#cadence-chart'); chart.innerHTML = intervals.length ? intervals.map((days, index) => `<div class="bar-wrap"><div class="bar" style="height:${Math.max(11, Math.min(100, days / Math.max(...intervals) * 100))}%" data-label="${days}d"></div><small>#${index + 1}</small></div>`).join('') : `<div class="empty">${t('insufficient')}</div>`;
  $('#timeline').innerHTML = timeline.length ? timeline.map(item => `<div class="timeline-item"><time>${formatDate(item.at)}</time><span class="timeline-pin ${escapeHtml(item.status || '')}"></span><div><a class="timeline-summary" href="${escapeHtml(item.url || '#')}" target="_blank" rel="noreferrer">${escapeHtml((lang === 'zh' && item.textZh ? item.textZh : translateText(item.text || t('reset'))))}</a><small class="post-meta">${item.status === 'verified' ? t('historyVerified') : t('historyObserved')}</small></div></div>`).join('') : `<div class="empty">${t('noRecords')}</div>`;
  $('#posts').innerHTML = recentPosts.length ? recentPosts.slice(0, 8).map(post => `<article class="post"><div class="post-top"><span class="post-tag ${escapeHtml(post.type)}">${typeLabel(post.type)}</span><span class="post-meta">${formatDate(post.at)}</span></div><div class="post-text">${escapeHtml((lang === 'zh' && post.textZh ? post.textZh : translateText(post.text)))}</div><span class="post-meta">${post.isReply ? t('reply') : t('post')} · @thsottiaux</span></article>`).join('') : `<div class="empty">${t('noPosts')}</div>`;
}

let loading = false;
let lastState = null;
async function fetchJson(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000), ...options });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function load(force = false) {
  if (loading) return;
  loading = true;
  const button = $('#refresh-button'); button.disabled = true; button.textContent = lang === 'zh' ? '读取中…' : 'Loading…';
  try {
    const staticMode = !/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    let state;
    if (staticMode) {
      const [feedResult, snapshotResult, liveResult] = await Promise.allSettled([
        fetchJson('https://codex-reset.com/api/feed'),
        fetchJson(`./source-check.json?t=${Date.now()}`),
        loadCrossSources({}, { browser: true })
      ]);
      const snapshot = snapshotResult.status === 'fulfilled' ? snapshotResult.value : {};
      const live = liveResult.status === 'fulfilled' ? liveResult.value : null;
      const records = new Map();
      for (const item of [...(snapshot.validatedResets || []), ...(lastState?.validatedResets || []), ...(live?.validatedResets || [])]) {
        const previous = records.get(item.id);
        if (previous?.precision === 'confirmation-post' && item.precision !== 'confirmation-post') continue;
        records.set(item.id, item);
      }
      // Retain previously confirmed history when an upstream is temporarily unavailable.
      const checks = new Map((snapshot.sourceChecks || []).map(item => [item.name, item]));
      for (const check of live?.checks || []) checks.set(check.name, check);
      const fallback = feedResult.status !== 'fulfilled';
      const raw = fallback ? await fetchJson('./feed.json') : feedResult.value;
      state = normalizeFeed(raw, 'public feed · codex-reset.com', [...records.values()]);
      state.validatedResets = [...records.values()];
      state.stale ||= fallback || (live?.checks.filter(check => check.status === 'fresh').length || 0) < 2;
      state.sourceChecks = [...checks.values()];
      const liveLatestDay = live?.validatedResets.at(-1)?.day || 0;
      const snapshotLatestDay = snapshot.validatedResets?.at(-1)?.day || 0;
      state.validation = liveLatestDay >= snapshotLatestDay && liveLatestDay ? live.validation : snapshot.validation;
    } else {
      state = await fetchJson(force ? '/api/refresh' : '/api/state', { method: force ? 'POST' : 'GET' });
    }
    lastState = state;
    render(state);
    $('#source-status').title = `${lang === 'zh' ? '最近检查' : 'Last checked'}: ${formatDate(new Date().toISOString())}`;
  } catch (error) {
    if (lastState) render({ ...lastState, stale: true });
    $('#source-status').textContent = lang === 'zh' ? '更新失败，将自动重试' : 'Update failed; retrying automatically';
  } finally {
    loading = false;
    button.disabled = false; button.textContent = t('refresh');
  }
}

$('#language-button').addEventListener('click', () => { lang = lang === 'zh' ? 'en' : 'zh'; localStorage.setItem('codex-reset-radar-lang', lang); applyLanguage(); if (lastState) render(lastState); else load(); });
$('#refresh-button').addEventListener('click', () => load(true));
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
setInterval(() => { if (!document.hidden) load(); }, 60_000);
applyLanguage(); load();

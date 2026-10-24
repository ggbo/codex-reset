import { writeFile } from 'node:fs/promises';

const radarUrl = process.env.RADAR_URL || 'https://codex-reset-radar.pages.dev/';
const feedUrl = process.env.FEED_URL || 'https://codex-reset.com/api/feed';
const timelineUrl = process.env.TIMELINE_URL || 'https://codex-reset.com/api/timeline';

function stripTags(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function isVerifiedResetEvent(event) {
  const status = String(event?.reset_verification_status || '').toLowerCase();
  const source = String(event?.source || '').toLowerCase();
  const sourceLabel = String(event?.source_label || '').toLowerCase();
  if (status === 'pending' || source.includes('operator-observed') || sourceLabel.includes('awaiting')) return false;
  return event?.confirmed === true || String(event?.confidence || '').toLowerCase() === 'high' || source.includes('archive');
}

async function main() {
  const checks = [{
    name: 'Codex Reset feed', url: feedUrl, status: 'fresh', role: 'primary',
    note: { zh: '只把已确认/归档事件纳入历史样本。', en: 'Only confirmed/archive events enter the historical sample.' }
  }];
  let validation = { note: { zh: '等待两站点校验。', en: 'Waiting for cross-source validation.' } };
  try {
    const timeline = await fetch(timelineUrl, { headers: { 'user-agent': 'codex-reset-radar-static-build/0.1' }, signal: AbortSignal.timeout(10_000) }).then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); });
    const events = Array.isArray(timeline.events) ? timeline.events : [];
    const pending = events.filter(event => String(event.reset_verification_status || '').toLowerCase() === 'pending').length;
    const verified = events.filter(isVerifiedResetEvent).length;
    checks.push({ name: 'Codex Reset timeline', url: timelineUrl, status: 'fresh', role: 'validation', note: { zh: `最新时间线 ${events.length} 条；${verified} 条已确认/归档，${pending} 条待确认记录不计入模型。`, en: `${events.length} timeline events; ${verified} confirmed/archive events used, ${pending} pending rows excluded.` }, updatedAt: timeline.updated_at || null });
  } catch (error) {
    checks.push({ name: 'Codex Reset timeline', url: timelineUrl, status: 'unavailable', role: 'validation', note: { zh: '时间线接口暂时不可访问；不会使用未校验记录。', en: 'Timeline endpoint unavailable; unverified rows are excluded.' }, error: String(error) });
  }
  try {
    const response = await fetch(radarUrl, { headers: { 'user-agent': 'codex-reset-radar-static-build/0.1' }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const spotlightDay = html.match(/t28-spotlight[\s\S]{0,300}?Day\s+(\d+)\b/i)?.[1];
    const noticeDay = html.match(/site-day(\d+)-notice/i)?.[1];
    const dayMatches = [...html.matchAll(/Day\s+(\d+)\b/gi)].map(match => Number(match[1])).filter(Number.isFinite);
    const day = Number(spotlightDay || noticeDay || (dayMatches.length ? Math.max(...dayMatches) : 0)) || null;
    const resetMatch = html.match(/本次重置已完成[^<]{0,180}/i);
    const officialEvidencePending = /尚未核实官方完成帖/.test(html);
    checks.push({
      name: 'Codex 雷达站', url: radarUrl, status: 'fresh', role: 'cross-check', day,
      note: { zh: day ? `页面当前标记 Day ${day}；Day 18 的完成时间未知${officialEvidencePending ? '，官方证据仍待确认' : ''}，不直接改变概率。` : '页面可访问；未提取到明确 Day 标记。', en: day ? `Page currently shows Day ${day}; the Day 18 completion time is unknown${officialEvidencePending ? ' and official evidence is still pending' : ''}; it is not a probability input.` : 'Page reachable; no clear Day marker was extracted.' },
      resetNotice: stripTags(resetMatch?.[0] || '') || null
    });
  } catch (error) {
    checks.push({ name: 'Codex 雷达站', url: radarUrl, status: 'unavailable', role: 'cross-check', day: null, note: { zh: '交叉站点暂时不可访问；不影响主 feed。', en: 'Cross-check site unavailable; primary feed is still used.' }, error: String(error) });
  }
  validation = { note: { zh: '两站点都显示 Day 18 已完成，但实际时间未知且官方证据待确认；因此不把这条记录当作精确时间或实时预告。', en: 'Both sites show Day 18 completed, but the actual time is unknown and official evidence is pending; it is not treated as an exact timestamp or live promise.' } };
  await writeFile('public/source-check.json', JSON.stringify({ generated_at: new Date().toISOString(), sourceChecks: checks, validation }, null, 2));
  console.log(`Wrote ${checks.length} source checks to public/source-check.json`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });


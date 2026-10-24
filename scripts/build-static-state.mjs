import { writeFile } from 'node:fs/promises';

const radarUrl = process.env.RADAR_URL || 'https://codex-reset-radar.pages.dev/';
const feedUrl = process.env.FEED_URL || 'https://codex-reset.com/api/feed';

function stripTags(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function main() {
  const checks = [{
    name: 'Codex Reset feed', url: feedUrl, status: 'fresh', role: 'primary',
    note: { zh: '结构化公开动态与重置事件，参与预测计算。', en: 'Structured public posts and reset events used by the forecast.' }
  }];
  try {
    const response = await fetch(radarUrl, { headers: { 'user-agent': 'codex-reset-radar-static-build/0.1' }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const spotlightDay = html.match(/t28-spotlight[\s\S]{0,300}?Day\s+(\d+)\b/i)?.[1];
    const noticeDay = html.match(/site-day(\d+)-notice/i)?.[1];
    const dayMatches = [...html.matchAll(/Day\s+(\d+)\b/gi)].map(match => Number(match[1])).filter(Number.isFinite);
    const day = Number(spotlightDay || noticeDay || (dayMatches.length ? Math.max(...dayMatches) : 0)) || null;
    const resetMatch = html.match(/本次重置已完成[^<]{0,180}/i);
    checks.push({
      name: 'Codex 雷达站', url: radarUrl, status: 'fresh', role: 'cross-check', day,
      note: { zh: day ? `页面当前标记 Day ${day}；仅作交叉参考，不直接改变概率。` : '页面可访问；未提取到明确 Day 标记。', en: day ? `Page currently shows Day ${day}; cross-check only, not a probability input.` : 'Page reachable; no clear Day marker was extracted.' },
      resetNotice: stripTags(resetMatch?.[0] || '') || null
    });
  } catch (error) {
    checks.push({ name: 'Codex 雷达站', url: radarUrl, status: 'unavailable', role: 'cross-check', day: null, note: { zh: '交叉站点暂时不可访问；不影响主 feed。', en: 'Cross-check site unavailable; primary feed is still used.' }, error: String(error) });
  }
  await writeFile('public/source-check.json', JSON.stringify({ generated_at: new Date().toISOString(), sourceChecks: checks }, null, 2));
  console.log(`Wrote ${checks.length} source checks to public/source-check.json`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });


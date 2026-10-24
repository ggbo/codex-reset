import { writeFile } from 'node:fs/promises';
import { loadCrossSources } from '../source-evidence.mjs';

const radarUrl = process.env.RADAR_URL || 'https://codex-reset-radar.pages.dev/';
const watchUrl = process.env.WATCH_URL || 'https://crw.warpnav.com/';
const trackerUrl = process.env.TRACKER_URL || 'https://reset-tracker.com/';
const digestUrl = process.env.DIGEST_URL || 'https://limitdigest.com/resets/codex/log/';
const feedUrl = process.env.FEED_URL || 'https://codex-reset.com/api/feed';
const timelineUrl = process.env.TIMELINE_URL || 'https://codex-reset.com/api/timeline';

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
    note: { zh: '只把 feed 中已确认/归档事件，以及多站点交叉确认的记录纳入历史样本。', en: 'Only confirmed/archive feed events and cross-checked records enter the historical sample.' }
  }];
  let timelineCheck;
  try {
    const timeline = await fetch(timelineUrl, { headers: { 'user-agent': 'codex-reset-radar-static-build/0.2' }, signal: AbortSignal.timeout(10_000) }).then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); });
    const events = Array.isArray(timeline.events) ? timeline.events : [];
    const pending = events.filter(event => String(event.reset_verification_status || '').toLowerCase() === 'pending').length;
    const verified = events.filter(isVerifiedResetEvent).length;
    timelineCheck = { name: 'Codex Reset timeline', url: timelineUrl, status: 'fresh', role: 'validation', note: { zh: `最新时间线 ${events.length} 条；${verified} 条已确认/归档，${pending} 条待确认记录不计入模型。`, en: `${events.length} timeline events; ${verified} confirmed/archive events used, ${pending} pending rows excluded.` }, updatedAt: timeline.updated_at || null };
  } catch (error) {
    timelineCheck = { name: 'Codex Reset timeline', url: timelineUrl, status: 'unavailable', role: 'validation', note: { zh: '时间线接口暂时不可访问；不会使用未校验记录。', en: 'Timeline endpoint unavailable; unverified rows are excluded.' }, error: String(error) };
  }
  const crossSources = await loadCrossSources({ radar: radarUrl, watch: watchUrl, tracker: trackerUrl, digest: digestUrl });
  checks.push(timelineCheck, ...crossSources.checks);
  await writeFile('public/source-check.json', JSON.stringify({
    generated_at: new Date().toISOString(),
    sourceChecks: checks,
    validation: crossSources.validation,
    validatedResets: crossSources.validatedResets
  }, null, 2));
  console.log(`Wrote ${checks.length} source checks and ${crossSources.validatedResets.length} cross-source resets to public/source-check.json`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });


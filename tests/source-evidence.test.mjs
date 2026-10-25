import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCrossSources } from '../source-evidence.mjs';

const post = (id, text, postedAt = '2026-10-25T06:06:16Z') => ({ url: `https://x.com/thsottiaux/status/${id}`, text, postedAt });
const urls = { radar: 'https://fixtures.test/radar', watch: 'https://fixtures.test/watch', tracker: 'https://fixtures.test/tracker', digest: 'https://fixtures.test/digest' };
const watchHtml = history => `<script>window.__CRW_BOOTSTRAP__=${JSON.stringify({ current: { headline: 'Day 20 usage reset has landed', status: 'confirmed' }, history })};</script>`;
const radarHtml = (day, confirmed = true) => `<p class="t28-spotlight">Day ${day}</p><div id="t28-detail-${day}" class="t28-detail"><article><h3>Day ${day}：${confirmed ? '重置完成 · 站长确认' : '重置已宣布，完成待确认'}</h3><p>${confirmed ? '站长已确认' : '尚无完成确认'}</p><time datetime="2026-10-25T03:39:31Z"></time><a href="https://x.com/thsottiaux/status/2114200152701575656">原帖</a></article></div>`;
const day20 = { id: 'reset-2026-10-25-day20-confirmed', eventType: 'reset', resetType: 'reset', outcome: 'as_announced', timeBasis: 'confirmation', announcement: post('2114237083652882932', 'It is all propagated. Enjoy some mad codexing tomorrow.'), previousAnnouncement: post('2114200152701575656', 'Day 20/ Rest and reset', '2026-10-25T03:39:31Z'), timingSource: post('2114200291319124163', 'By midnight PST', '2026-10-25T03:40:04Z') };

async function load(pages) {
  const original = globalThis.fetch;
  globalThis.fetch = async url => new Response(pages[new URL(url).pathname.slice(1)] || '', { status: 200 });
  try { return await loadCrossSources(urls); } finally { globalThis.fetch = original; }
}

test('automatically confirms Day 20 and uses its completion post, not the announcement', async () => {
  const state = await load({ radar: radarHtml(20), watch: watchHtml([day20]) });
  const event = state.validatedResets.find(item => item.day === 20);
  assert.ok(event, 'new days must not be restricted to 17/18');
  assert.equal(event.at, '2026-10-25T06:06:16.000Z');
  assert.equal(event.url, day20.announcement.url);
  assert.equal(event.precision, 'confirmation-post');
  assert.equal(state.currentDay, 20);
});

test('supports future days without code edits', async () => {
  const entry = { ...day20, id: 'reset-day27-confirmed', previousAnnouncement: post('2114200152701575656', 'Day 27/ Reset') };
  const state = await load({ radar: radarHtml(27), watch: watchHtml([entry]) });
  assert.equal(state.validatedResets[0]?.day, 27);
});

test('one observer and an announcement do not establish a completed reset', async () => {
  const state = await load({ radar: radarHtml(20, false), watch: watchHtml([{ ...day20, outcome: 'unverified', timeBasis: 'announcement' }]) });
  assert.equal(state.validatedResets.length, 0);
});

test('current confirmation cannot promote an older unverified history entry', async () => {
  const state = await load({ radar: radarHtml(20), watch: watchHtml([{ ...day20, outcome: 'unverified', timeBasis: 'announcement' }]) });
  assert.equal(state.validatedResets.length, 0);
});

test('banked grants and missing dates cannot enter full reset history', async () => {
  const banked = await load({ radar: radarHtml(20), watch: watchHtml([{ ...day20, resetType: 'banked' }]) });
  assert.equal(banked.validatedResets.length, 0);
  const missing = await load({ radar: '', watch: watchHtml([{ ...day20, announcement: { ...day20.announcement, postedAt: null } }]) });
  assert.equal(missing.validatedResets.length, 0);
});

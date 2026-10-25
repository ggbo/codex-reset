import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const code = (await readFile(new URL('../public/app.js', import.meta.url), 'utf8'))
  .replace(/^import[^\n]+\n/, '')
  .replace(/applyLanguage\(\); load\(\);\s*$/, '');
const time = new Date().toISOString();
const done = { id: 'cross-source-day20', day: 20, date: time.slice(0, 10), at: time, text: 'It is all propagated. Enjoy some mad codexing tomorrow. Fun week ahead too.', url: 'https://x.com/thsottiaux/status/2114237083652882932', relatedIds: ['2114200152701575656', '2114200291319124163', '2114237083652882932'], status: 'verified', precision: 'confirmation-post' };
const feed = { tweets: [{ id: '2114200152701575656', text: 'Day 20/ Rest and reset', at: time, kind: 'other' }], events: [{ id: '2114200291319124163', type: 'reset', summary: 'By midnight PST', announced_at: time, source: 'operator-observed', reset_verification_status: 'pending', observation_result: 'reset_observed' }] };

function page({ networkFails = false } = {}) {
  const nodes = new Map();
  const timers = [];
  const listeners = {};
  const calls = [];
  let live = { checks: [{ name: 'Watch', status: 'fresh' }, { name: 'Radar', status: 'fresh' }], validatedResets: [done], validation: { note: { zh: '测试校验', en: 'Test validation' } } };
  const selector = key => {
    if (!nodes.has(key)) nodes.set(key, { textContent: '', style: {}, innerHTML: '', addEventListener() {} });
    return nodes.get(key);
  };
  const context = vm.createContext({
    document: { querySelector: selector, querySelectorAll: () => [], documentElement: {}, hidden: false, addEventListener: (key, fn) => { listeners[key] = fn; } },
    navigator: { language: 'zh-CN' }, localStorage: { getItem: () => null, setItem() {} },
    location: { hostname: 'ggbo.github.io' }, AbortSignal,
    setInterval: (fn, ms) => { timers.push({ fn, ms }); },
    loadCrossSources: async () => live,
    fetch: async url => {
      calls.push(url);
      if (networkFails && String(url).includes('api/feed')) throw new Error('offline');
      const result = String(url).includes('source-check.json') ? { sourceChecks: [], validatedResets: [] } : feed;
      return { ok: true, json: async () => result };
    },
    console
  });
  vm.runInContext(code, context);
  return { context, selector, timers, listeners, calls, setLive: value => { live = value; } };
}

test('live cross-check confirms today without waiting for the static snapshot', async () => {
  const { context, selector } = page();
  await vm.runInContext('load()', context);
  assert.equal(selector('#forecast-time').textContent, '今日重置已确认');
  assert.match(selector('#signal-text').textContent, /已经全部生效/);
  assert.match(selector('#timeline').innerHTML, /timeline-pin verified/);
  assert.doesNotMatch(selector('#timeline').innerHTML, /By midnight PST/);
  assert.equal(vm.runInContext('lastState.latestSignal', context), null, 'completed text mentioning tomorrow must not become a new promise');
  assert.equal(vm.runInContext('lastState.forecast.lastResetAt', context), time);
  assert.equal(vm.runInContext('lastState.recentPosts[0].type', context), 'reset');
});

test('ordinary history without a new signal keeps the requested no-signal headline', () => {
  const { context, selector } = page();
  vm.runInContext("render(normalizeFeed({tweets:[],events:[]}, 'test'))", context);
  assert.equal(selector('#forecast-time').textContent, '暂无重置信号');
});

test('refreshes every minute and when returning to the tab', async () => {
  const { context, timers, listeners, calls } = page();
  assert.equal(timers[0].ms, 60_000);
  await vm.runInContext('load()', context);
  timers[0].fn();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.filter(url => String(url).includes('api/feed')).length, 2);
  listeners.visibilitychange();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.filter(url => String(url).includes('api/feed')).length, 3);
  vm.runInContext('document.hidden = true', context);
  timers[0].fn();
  assert.equal(calls.filter(url => String(url).includes('api/feed')).length, 3);
});

test('published feed snapshot is used and labelled stale when primary feed fails', async () => {
  const { context, calls } = page({ networkFails: true });
  await vm.runInContext('load()', context);
  assert.ok(calls.includes('./feed.json'));
  assert.equal(vm.runInContext('lastState.stale', context), true);
  assert.equal(vm.runInContext('lastState.timeline[0].status', context), 'verified');
});

test('temporary source failures cannot roll back a newly confirmed live reset', async () => {
  const { context, setLive } = page();
  await vm.runInContext('load()', context);
  setLive({ checks: [], validatedResets: [] });
  await vm.runInContext('load()', context);
  assert.equal(vm.runInContext('lastState.forecast.lastResetAt', context), time);
  assert.equal(vm.runInContext('lastState.timeline[0].status', context), 'verified');
  assert.equal(vm.runInContext('lastState.stale', context), true);
});

test('new completion posts can use source translations without a hardcoded sentence', () => {
  const { context, selector } = page();
  context.futureEvent = { ...done, text: 'A new completion wording from a future public post.', textZh: '新动态的来源中文译文。' };
  vm.runInContext("render(normalizeFeed({tweets:[],events:[]}, 'test', [futureEvent]))", context);
  assert.equal(selector('#signal-text').textContent, '新动态的来源中文译文。');
  assert.match(selector('#posts').innerHTML, /新动态的来源中文译文/);
});

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const source = readFileSync(path.join(root, 'linuxdo-wecom.user.js'), 'utf8');
const metadata = readFileSync(path.join(root, 'linuxdo-wecom.meta.js'), 'utf8');
const updateCode = source.slice(source.indexOf('  // 保留 @grant none'), source.indexOf('  /* ============================== 脚本更新结束'));
assert.ok(updateCode.length > 0, 'update module was found');
const publishedVersion = source.match(/^\/\/ @version\s+(\S+)/m)[1];
const newerVersion = `${Number(publishedVersion.split('.')[0]) + 1}.0.0`;
const metadataFor = (version) => metadata.replace(/^(\/\/ @version\s+)\S+/m, `$1${version}`);

function harness() {
  const storage = new Map();
  const timers = new Map();
  const state = { calls: [], notices: [], now: 1800000000000, mode: 'im', other: false, blockedStorage: false, node: null };
  const context = vm.createContext({
    AbortController, Map,
    Date: class extends Date { static now() { return state.now; } },
    setTimeout(fn) { const id = Symbol(); timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    localStorage: {
      getItem(key) { if (state.blockedStorage) throw Error('denied'); return storage.get(key) || null; },
      setItem(key, value) { if (state.blockedStorage) throw Error('denied'); storage.set(key, value); }
    },
    document: {
      visibilityState: 'visible',
      querySelector() { return state.node; }
    },
    getViewMode: () => state.mode,
    otherThemeActive: () => state.other,
    fetch: async (...args) => {
      state.calls.push(args);
      return state.respond(...args);
    },
    recordNotice(type, version) {
      state.notices.push({ type, version });
      state.node = { dataset: { version: type === 'available' ? version : '' }, remove() { state.node = null; } };
    }
  });
  state.respond = async () => ({ ok: true, text: async () => metadataFor(newerVersion) });
  vm.runInContext(updateCode, context);
  vm.runInContext('showUpdateNotice = (state, version = "") => recordNotice(state, version);', context);
  return { state, storage, timers, context, run: (js) => vm.runInContext(js, context), check: (manual = false) => context.checkForScriptUpdate(manual) };
}

test('release metadata, runtime version and fixed endpoints stay synchronized', () => {
  const h = harness();
  assert.equal(metadata.trim(), source.split('// ==/UserScript==')[0].trim() + '\n// ==/UserScript==');
  assert.equal(h.run('SCRIPT_VERSION'), publishedVersion);
  for (const [header, constant] of [['updateURL', 'SCRIPT_UPDATE_URL'], ['downloadURL', 'SCRIPT_DOWNLOAD_URL'], ['homepageURL', 'SCRIPT_REPOSITORY_URL']]) {
    assert.equal(source.match(new RegExp(`^// @${header}\\s+(\\S+)`, 'm'))[1], h.run(constant));
  }
  assert.match(source, /\/\/ @grant\s+none/);
  assert.ok(readFileSync(path.join(root, 'README.md'), 'utf8').includes(`当前版本：**${publishedVersion}**`));
});

test('numeric comparison handles 0.5.10 > 0.5.9, padding, equality and downgrade', () => {
  const { context } = harness();
  for (const [a, b, result] of [['0.5.10', '0.5.9', 1], ['1.0', '1.0.0', 0], ['2.0', '10.0', -1], ['0.5.9', '0.5.10', -1], ['1.0.0.1', '1.0', 1]]) {
    assert.equal(context.compareScriptVersions(a, b), result);
  }
});

test('runtime version prefers GM_info, with fallback for plain injection', () => {
  const h = harness();
  assert.equal(h.context.currentScriptVersion(), publishedVersion);
  h.context.GM_info = { script: { version: '12.1.0' } };
  assert.equal(h.context.currentScriptVersion(), '12.1.0');
  h.context.GM_info.script.version = '<img src=x>';
  assert.equal(h.context.currentScriptVersion(), publishedVersion);
});

test('metadata validates identity and numeric versions without executing payloads', () => {
  const { context } = harness();
  assert.equal(context.parseUpdateMetadata(metadata.replace(/\n/g, '\r\n')), publishedVersion);
  assert.equal(context.parseUpdateMetadata(metadata + '\nthrow Error("never execute")'), publishedVersion);
  for (const invalid of ['<html>503</html>', metadata.replace('Linux DO · 企业微信 IM 外观', 'Other script'), metadata.replace('https://linux.do/', 'https://example.com/'), metadataFor('1.0-beta'), metadataFor('<script>'), metadataFor('999999999999999999.1'), metadata.replace('// ==/UserScript==', '')]) {
    assert.throws(() => context.parseUpdateMetadata(invalid));
  }
});

test('new version notifies once, omits credentials, caches across calls and page instances', async () => {
  const h = harness();
  await h.check();
  assert.equal(h.state.notices[0].type, 'available');
  assert.equal(h.state.notices[0].version, newerVersion);
  const [url, options] = h.state.calls[0];
  assert.ok(url.startsWith(h.run('SCRIPT_UPDATE_URL') + '?t='));
  assert.equal(options.credentials, 'omit');
  assert.equal(options.referrerPolicy, 'no-referrer');
  assert.equal(options.cache, 'no-store');
  assert.equal(h.timers.size, 0);
  await h.check();
  assert.equal(h.state.calls.length, 1);
  assert.equal(h.state.notices.length, 1);
  const next = harness();
  for (const [key, value] of h.storage) next.storage.set(key, value);
  await next.check();
  assert.equal(next.state.calls.length, 0);
  assert.equal(next.state.notices[0].type, 'available');
  h.state.now += 6 * 3600000;
  await h.check();
  assert.equal(h.state.calls.length, 2);
});

test('equal/older remote versions are silent automatically, explicit manually', async () => {
  for (const version of [publishedVersion, '0.0']) {
    const h = harness();
    h.state.respond = async () => ({ ok: true, text: async () => metadataFor(version) });
    await h.check();
    assert.equal(h.state.notices.length, 0);
    await h.check(true);
    assert.equal(h.state.notices.at(-1).type, 'latest');
    assert.equal(h.state.calls.length, 2);
  }
});

test('manual check bypasses success cache and 24-hour dismissal', async () => {
  const h = harness();
  h.run(`writeUpdateState(UPDATE_DISMISS_KEY, { version: '${newerVersion}', dismissedAt: Date.now() })`);
  await h.check();
  assert.equal(h.state.notices.length, 0);
  await h.check(true);
  assert.equal(h.state.notices.at(-1).type, 'available');
  assert.equal(h.state.calls.length, 2);
});

test('dismissal expires and does not suppress a different newer version', async () => {
  const h = harness();
  h.run(`writeUpdateState(UPDATE_DISMISS_KEY, { version: '${newerVersion}', dismissedAt: Date.now() })`);
  await h.check();
  assert.equal(h.state.notices.length, 0);
  h.state.now += 24 * 3600000;
  await h.check();
  assert.equal(h.state.notices.at(-1).type, 'available');
  h.state.node = null;
  h.state.notices = [];
  h.run("writeUpdateState(UPDATE_DISMISS_KEY, { version: '0.0', dismissedAt: Date.now() })");
  await h.check();
  assert.equal(h.state.notices.at(-1).type, 'available');
});

for (const failure of ['network', 'http', 'metadata']) {
  test(`${failure} failure stays silent, backs off, and offers manual error feedback`, async () => {
    const h = harness();
    h.state.respond = async () => {
      if (failure === 'network') throw Error('offline or CSP');
      return { ok: failure !== 'http', status: 503, text: async () => 'not metadata' };
    };
    await h.check();
    await h.check();
    assert.equal(h.state.notices.length, 0);
    assert.equal(h.state.calls.length, 1);
    assert.equal(h.timers.size, 0);
    h.state.now += 15 * 60000;
    await h.check();
    assert.equal(h.state.calls.length, 2);
    await h.check(true);
    assert.equal(h.state.notices.at(-1).type, 'error');
    assert.equal(h.state.calls.length, 3);
  });
}

test('timeout aborts request, clears timer, and leaves UI usable', async () => {
  const h = harness();
  h.state.respond = (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(Error('aborted'))));
  const pending = h.check(true);
  [...h.timers.values()][0]();
  await pending;
  assert.equal(h.state.notices.at(-1).type, 'error');
  assert.equal(h.timers.size, 0);
});

test('concurrent checks share one request', async () => {
  const h = harness();
  let resolve;
  h.state.respond = () => new Promise((done) => { resolve = done; });
  const first = h.check();
  const second = h.check(true);
  assert.equal(h.state.calls.length, 1);
  resolve({ ok: true, text: async () => metadataFor(newerVersion) });
  await Promise.all([first, second]);
  assert.equal(h.state.notices.at(-1).type, 'available');
});

test('blocked/corrupt storage uses safe defaults and in-memory throttling', async () => {
  const h = harness();
  h.storage.set(h.run('UPDATE_CACHE_KEY'), '{broken');
  await h.check();
  assert.equal(h.state.notices.at(-1).type, 'available');
  const denied = harness();
  denied.state.blockedStorage = true;
  await denied.check();
  await denied.check();
  assert.equal(denied.state.calls.length, 1);
  denied.state.node = null;
  denied.state.notices = [];
  denied.run(`writeUpdateState(UPDATE_DISMISS_KEY, { version: '${newerVersion}', dismissedAt: Date.now() })`);
  await denied.check();
  assert.equal(denied.state.notices.length, 0);
});

test('hidden tabs, native view, and competing themes do not auto-fetch', async () => {
  const h = harness();
  h.context.document.visibilityState = 'hidden';
  await h.check();
  h.context.document.visibilityState = 'visible';
  h.state.mode = 'native';
  await h.check();
  h.state.mode = 'im';
  h.state.other = true;
  await h.check();
  assert.equal(h.state.calls.length, 0);
});

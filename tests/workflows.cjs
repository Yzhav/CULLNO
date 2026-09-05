const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
// 既存TypeScriptをNodeで検証する。ブラウザーや新しいテスト依存は不要。
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  module._compile(output, filename);
};
global.window = { electronAPI: { saveSession: async () => {} } };
const { useSessionStore: store, buildFlatItems } = require('../src/stores/useSessionStore.ts');
const { buildFilmSegments } = require('../src/utils/burstUtils.ts');
const { THUMBNAIL_WIDTHS, PREVIEW_PRESETS } = require('../src/types/index.ts');
function photo(name, picked = false) {
  return { filePath: '/qa/' + name, baseName: name, fileSize: 10, modifiedAt: 0,
    timestamp: new Date(0), burstIndex: 0, picked, trashed: false };
}
function group(id, images) { return { id, images, representative: images[0], isSingle: images.length === 1 }; }
function reset(images, groups = images.map(img => group(img.baseName, [img]))) {
  store.setState({ ...store.getInitialState(), images, groups, totalSize: images.length * 10 });
  store.temporal.getState().clear();
}
async function run() {
  const keep = photo('keep.tga', true), drop = photo('drop.tga'), hidden = photo('hidden.png');
  reset([keep, drop, hidden], [group('burst', [keep, drop]), group('single', [hidden])]);
  store.setState({ currentIndex: 0, filterPickedOnly: true, extensionFilter: 'tga' });
  store.getState().requestDeleteUnpicked();
  assert.deepEqual(store.getState().pendingDeletePaths, [drop.filePath, hidden.filePath], 'gold picks survive; filters and collapsed bursts do not hide delete targets');
  const later = photo('later.tga');
  store.setState(s => ({ images: [...s.images, later], groups: [...s.groups, group('later', [later])], totalSize: 40 }));
  store.getState().requestDeleteUnpicked();
  assert.deepEqual(store.getState().pendingDeletePaths, [drop.filePath, hidden.filePath], 'new photos must not enter the confirmation snapshot');
  let calls = 0, release;
  window.electronAPI.moveToTrash = paths => {
    calls++;
    return new Promise(resolve => { release = () => resolve(paths.map(path => ({ path, success: path !== hidden.filePath }))); });
  };
  const firstDelete = store.getState().confirmDelete();
  await store.getState().confirmDelete();
  store.getState().cancelDelete();
  assert.equal(calls, 1, 'repeated Enter cannot start a second delete');
  assert.notEqual(store.getState().pendingDeletePaths, null, 'cannot cancel an in-flight move');
  release(); await firstDelete;
  assert.deepEqual(store.getState().images.map(i => i.filePath), [keep.filePath, hidden.filePath, later.filePath]);
  assert.deepEqual(store.getState().pendingDeletePaths, [hidden.filePath], 'only failed moves remain for retry');
  assert.equal(store.getState().totalSize, 30);
  assert.equal(store.temporal.getState().pastStates.length, 0, 'Undo must not resurrect files moved to trash');
  window.electronAPI.moveToTrash = async paths => paths.map(path => ({ path, success: true }));
  await store.getState().confirmDelete();
  assert.deepEqual(store.getState().images.map(i => i.filePath), [keep.filePath, later.filePath]);
  assert.equal(store.getState().pendingDeletePaths, null);
  reset([keep]); store.getState().requestDeleteUnpicked();
  assert.equal(store.getState().pendingDeletePaths, null, 'all picked is a no-op');
  reset([drop]); store.getState().requestDeleteUnpicked();
  window.electronAPI.moveToTrash = async () => { throw Error('disk unavailable'); };
  await assert.rejects(store.getState().confirmDelete(), /disk unavailable/);
  store.getState().cancelDelete();
  assert.equal(store.getState().pendingDeletePaths, null, 'failure releases the delete lock');

  const a = group('A', [photo('A0'), photo('A1')]);
  const b = group('B', [photo('B0'), photo('B1')]);
  const flat = buildFlatItems([a, b], ['__all__']);
  assert.deepEqual(flat.map(item => item.burstPosition), [1, 2, 1, 2]);
  const segments = buildFilmSegments(flat);
  assert.deepEqual(segments.map(s => s.groupId), ['A', 'B'], 'adjacent bursts retain separate borders');
  assert.deepEqual(segments.map(s => s.items.length), [2, 2]);
  reset([...a.images, ...b.images], [a, b]);
  store.setState({ expandedGroupIds: ['__all__'], currentIndex: 1 });
  store.getState().collapseBurst();
  assert.deepEqual(store.getState().expandedGroupIds, ['B']);
  assert.equal(store.getState().currentIndex, 0);
  store.setState({ expandedGroupIds: ['__all__'] });
  store.getState().toggleBurstExpand('B');
  assert.deepEqual(store.getState().expandedGroupIds, ['A']);
  assert.deepEqual(PREVIEW_PRESETS.map(p => THUMBNAIL_WIDTHS[p.size]), [1920, 2560, 3840]);
  console.log('PASS: unpicked snapshot, gold protection, partial failure/retry, repeat guard, undo, burst boundaries/collapse, preview presets');
}
run().catch(error => { console.error(error); process.exitCode = 1; });

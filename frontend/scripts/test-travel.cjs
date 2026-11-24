const { execFileSync } = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), 'src/app/features/motor/travel-demo.ts', '--module', 'commonjs', '--target', 'ES2022', '--outDir', '.test-output', '--skipLibCheck'], { cwd: root, stdio: 'inherit' });
const { TravelDemo } = require(path.join(root, '.test-output/features/motor/travel-demo.js'));

function mapTravel(demo) {
  demo.execute('home');
  for (let poll = 0; poll < 10; poll++) demo.execute('estado');
  return demo.execute('estado');
}

test('blocks unreferenced and out-of-range commands; maps both ends and reaches 0 percent', () => {
  const demo = new TravelDemo();
  assert.throws(() => demo.execute('target', { percent: '50' }));
  const mapped = mapTravel(demo);
  assert.equal(mapped.referenced, true);
  assert.equal(mapped.travelSteps, 400);
  assert.equal(mapped.positionPercent, 100);
  assert.equal(mapped.limitMinimum, false);
  assert.equal(mapped.limitMaximum, false);
  for (const percent of ['-1', '101', 'NaN', 'Infinity']) assert.throws(() => demo.execute('target', { percent }));
  demo.execute('target', { percent: '0' });
  for (let poll = 0; poll < 10; poll++) demo.execute('estado');
  assert.equal(demo.execute('estado').positionPercent, 0);
});

test('stopping during mapping or motion invalidates the map and prevents further movement', () => {
  const demo = new TravelDemo();
  demo.execute('home');
  assert.equal(demo.execute('stop').referenced, false);
  mapTravel(demo);
  demo.execute('target', { percent: '20' });
  const stopped = demo.execute('stop');
  assert.equal(stopped.moving, false);
  assert.equal(stopped.travelSteps, 0);
  assert.throws(() => demo.execute('target', { percent: '30' }));
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const extensionFiles = [
  path.join(__dirname, '../../extension-demo-dev/background.js'),
  path.join(__dirname, '../../extension-demo-beta/background.js')
];

for (const extensionFile of extensionFiles) {
  const source = fs.readFileSync(extensionFile, 'utf8');
  const implementation = source.match(/const SUMMARY_FEEDBACK_INTERVAL_MS[\s\S]*?\n}(?=\n\nfunction escapeHtml)/);
  assert.ok(implementation, `Could not find feedback scheduling code in ${extensionFile}`);

  let stored = {};
  let now = 1;
  const context = {
    Date: { now: () => now },
    Math,
    Number,
    chrome: {
      storage: {
        local: {
          get(defaults, callback) {
            callback({ ...defaults, ...stored });
          },
          set(value, callback) {
            stored = { ...stored, ...value };
            callback?.();
          }
        }
      }
    }
  };
  vm.runInNewContext(implementation[0], context, { filename: extensionFile });

  const run = () => {
    let visible;
    context.planSummaryFeedbackPrompt((result) => { visible = result; });
    return visible;
  };

  assert.equal(run(), false, 'first summary must not show feedback');
  now += 1;
  assert.equal(run(), false, 'second summary must not show feedback');
  now += 1;
  assert.equal(run(), true, 'third summary must show feedback');

  for (let count = 4; count <= 13; count += 1) {
    now += 1;
    assert.equal(run(), false, `summary ${count} must respect the 14-day cooldown`);
  }

  now += 14 * 24 * 60 * 60 * 1000;
  assert.equal(run(), true, 'the next eligible summary must show feedback after the cooldown');
}

console.log('Summary feedback schedule behaves correctly in Dev and Beta extension sources.');

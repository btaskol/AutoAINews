const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const workerPath = new URL('../src/index.js', `file://${__filename}`).pathname;
let workerSource = fs.readFileSync(workerPath, 'utf8');
workerSource = workerSource.replace(/export default \{[\s\S]*$/, '');

const context = vm.createContext({
  URL,
  URLSearchParams,
  Math,
  JSON,
  console,
  btoa: value => Buffer.from(value, 'binary').toString('base64'),
  atob: value => Buffer.from(value, 'base64').toString('binary')
});

vm.runInContext(`${workerSource}\nglobalThis.renderAuthPageForTest = renderMinimalAuthPage;`, context);
const html = context.renderAuthPageForTest('https://dev.brieflykeep.com', '', false, '', {}, '/dashboard');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);

assert.ok(scripts.length >= 2, 'The authentication page should contain its callback scripts.');
for (const script of scripts) {
  new vm.Script(script, { filename: 'generated-auth-page.js' });
}

console.log('Generated authentication page scripts parse successfully.');

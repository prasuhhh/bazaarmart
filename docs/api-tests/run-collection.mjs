// Runs the exported Thunder Client collection in order and checks every status code.
// node docs/api-tests/run-collection.mjs http://localhost:5000/api admin@example.com 'admin-password'
// Needs a seeded development database, OTP_MOCK=true and NODE_ENV not set to production.
// It creates and removes test data; one cancelled and one guest order remain.
// The rate-limit folder uses up the OTP limit, so wait 10 minutes between runs.
import { readFileSync } from 'node:fs';

const [baseUrl, adminEmail, adminPassword] = process.argv.slice(2);
if (!baseUrl || !adminEmail || !adminPassword) {
  console.error('Usage: node docs/api-tests/run-collection.mjs <baseUrl> <adminEmail> <adminPassword>');
  process.exit(2);
}

const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const { folders, requests } = read('./thunder-collection_BazaarMart.json');
const { data } = read('./thunder-environment_BazaarMart.json');

const variables = Object.fromEntries(data.map(({ name, value }) => [name, value]));
Object.assign(variables, { baseUrl, adminEmail, adminPassword });
const fill = text => text.replace(/\{\{(\w+)\}\}/g, (_match, name) => variables[name] ?? '');
const dig = (json, path) => path.split('.').slice(1).reduce((value, key) => value?.[key], json);

const codes = {};
let failures = 0;

for (const folder of folders) {
  for (const request of requests.filter(entry => entry.containerId === folder._id)) {
    const expected = Number(request.tests.find(test => test.type === 'res-code').value);
    const body = request.body && fill(request.body.raw);
    const response = await fetch(fill(request.url), {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers.map(({ name, value }) => [name, fill(value)])),
        ...(body && { 'Content-Type': 'application/json' })
      },
      body
    });
    const json = await response.json().catch(() => null);

    codes[response.status] = (codes[response.status] ?? 0) + 1;
    for (const test of request.tests.filter(entry => entry.type === 'set-env-var')) {
      variables[test.value.replace(/[{}]/g, '')] = dig({ json }, `x.json.${test.custom.slice('json.'.length)}`);
    }
    if (response.status !== expected) {
      failures += 1;
      console.log(`FAIL  ${folder.name} / ${request.name}: got ${response.status}. ${json?.message ?? ''}`);
    }
  }
}

const summary = Object.keys(codes).sort().map(code => `${code}×${codes[code]}`).join('  ');
console.log(`${requests.length - failures}/${requests.length} requests returned the expected status.`);
console.log(`Status codes seen: ${summary}`);
process.exit(failures ? 1 : 0);

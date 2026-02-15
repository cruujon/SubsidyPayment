import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const metadataPath = resolve(process.cwd(), 'mcp-server/app-metadata.json');
assert.ok(existsSync(metadataPath), 'mcp-server/app-metadata.json is required');

const raw = readFileSync(metadataPath, 'utf8');
const json = JSON.parse(raw);

assert.equal(typeof json.appName, 'string');
assert.ok(json.appName.length > 0, 'appName is required');

assert.equal(typeof json.description, 'string');
assert.ok(json.description.length > 0, 'description is required');

assert.equal(typeof json.category, 'string');
assert.ok(json.category.length > 0, 'category is required');

assert.equal(typeof json.privacyPolicyUrl, 'string');
assert.ok(json.privacyPolicyUrl.startsWith('http'), 'privacyPolicyUrl must be URL');

assert.equal(typeof json.termsOfServiceUrl, 'string');
assert.ok(json.termsOfServiceUrl.startsWith('http'), 'termsOfServiceUrl must be URL');

assert.equal(typeof json.icon, 'object');
assert.equal(typeof json.icon.format, 'string');
assert.equal(typeof json.icon.size, 'string');
assert.equal(typeof json.icon.notes, 'string');

console.log('task-10.2 app metadata checks passed');

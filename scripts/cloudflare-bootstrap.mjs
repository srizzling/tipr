#!/usr/bin/env node
// One-time Cloudflare bootstrap. Run it with a broad "setup" token; it creates what this project needs and keeps the
// setup token out of the project entirely.
//
//   CLOUDFLARE_SETUP_TOKEN=... node scripts/cloudflare-bootstrap.mjs [--github] [--rotate] [--dry-run] [--list-groups]
//
// The setup token needs, on the account: "Account API Tokens: Edit" (to create the tokens) and "Workers R2 Storage: Edit"
// (to create the bucket). It is only used here. The script then creates:
//   1. a private R2 bucket for OpenTofu state,
//   2. R2 keys that can only read and write that bucket (the key id is the token id, the secret is its SHA-256, as R2 expects),
//   3. a narrow API token with only "Pages Write", used by OpenTofu and by the release workflow's deploy step.
// and writes infra/.env (mode 600, git-ignored) and infra/backend.hcl (git-ignored). With --github it also stores the Pages
// token and the account id as secrets of the `production` environment on GitHub. Secrets are never printed.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INFRA = join(ROOT, 'infra');
const ENV_PATH = join(INFRA, '.env');
const API = 'https://api.cloudflare.com/client/v4';
const BUCKET = 'thisispodracing-tfstate';
const REPO = 'srizzling/tipr';
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const rotate = args.has('--rotate');

const say = (m) => console.log(m);
const fail = (m) => {
  console.error(`\nerror: ${m}`);
  process.exit(1);
};

const setupToken = process.env.CLOUDFLARE_SETUP_TOKEN;
if (!setupToken) fail('set CLOUDFLARE_SETUP_TOKEN (a token with "Account API Tokens: Edit" and "Workers R2 Storage: Edit").');

async function cf(method, path, body) {
  if (dryRun && method !== 'GET') return { status: 200, success: true, result: { id: 'dry-run', value: 'dry-run' } };
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${setupToken}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...json, success: res.ok && json.success !== false };
}
const explain = (r) => (r.errors?.length ? r.errors.map((e) => `${e.message}${e.code ? ` (${e.code})` : ''}`).join('; ') : `HTTP ${r.status}`);

// ---- account
let account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!account) {
  const r = await cf('GET', '/accounts');
  if (!r.success) fail(`could not list accounts: ${explain(r)}`);
  if (r.result.length !== 1) fail(`this token sees ${r.result.length} accounts; set CLOUDFLARE_ACCOUNT_ID to pick one.`);
  account = r.result[0].id;
}
say(`account: ${account}`);

const verify = await cf('GET', `/accounts/${account}/tokens/verify`);
if (!verify.success) fail(`the setup token was not accepted for this account: ${explain(verify)}`);
say(`setup token: ${verify.result?.status ?? 'ok'}`);

const groups = await cf('GET', `/accounts/${account}/tokens/permission_groups`);
if (!groups.success) fail(`could not list permission groups: ${explain(groups)}. The setup token needs "Account API Tokens: Edit".`);
if (args.has('--list-groups')) {
  for (const g of groups.result.filter((x) => /pages|r2/i.test(x.name))) say(`${g.name}  [${(g.scopes ?? []).join(', ')}]`);
  process.exit(0);
}
const group = (name) => {
  const g = groups.result.find((x) => x.name === name);
  if (!g) fail(`Cloudflare has no permission group named "${name}". Run with --list-groups to see the names.`);
  return { id: g.id };
};

// ---- existing local state
const parseEnv = () =>
  Object.fromEntries(
    (existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '')
      .split('\n')
      .filter((l) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
const env = parseEnv();

// ---- 1. state bucket
const existing = await cf('GET', `/accounts/${account}/r2/buckets/${BUCKET}`);
if (existing.success) {
  say(`bucket ${BUCKET}: already exists`);
} else {
  const r = await cf('POST', `/accounts/${account}/r2/buckets`, { name: BUCKET });
  if (!r.success) fail(`could not create bucket ${BUCKET}: ${explain(r)}. The token needs "Workers R2 Storage: Edit", and R2 must be enabled on the account.`);
  say(`bucket ${BUCKET}: ${dryRun ? 'would be created' : 'created'}`);
}

// ---- 2. bucket-scoped R2 keys
let r2 = { id: env.AWS_ACCESS_KEY_ID, secret: env.AWS_SECRET_ACCESS_KEY };
if (r2.id && r2.secret && !rotate) {
  say('R2 keys: already in infra/.env (use --rotate to replace them)');
} else {
  const made = await cf('POST', `/accounts/${account}/tokens`, {
    name: `thisispodracing terraform state (${BUCKET})`,
    policies: [
      {
        effect: 'allow',
        resources: { [`com.cloudflare.edge.r2.bucket.${account}_default_${BUCKET}`]: '*' },
        permission_groups: [group('Workers R2 Storage Bucket Item Write')],
      },
    ],
  });
  if (!made.success) fail(`could not create the R2 keys: ${explain(made)}`);
  r2 = { id: made.result.id, secret: createHash('sha256').update(made.result.value).digest('hex') };
  say(`R2 keys: ${dryRun ? 'would be created' : 'created'}, limited to ${BUCKET}`);
}

// ---- 3. narrow Pages token
let pagesToken = env.CLOUDFLARE_API_TOKEN;
if (pagesToken && !rotate) {
  say('Pages token: already in infra/.env (use --rotate to replace it)');
} else {
  const made = await cf('POST', `/accounts/${account}/tokens`, {
    name: 'thisispodracing pages deploy',
    policies: [{ effect: 'allow', resources: { [`com.cloudflare.api.account.${account}`]: '*' }, permission_groups: [group('Pages Write')] }],
  });
  if (!made.success) fail(`could not create the Pages token: ${explain(made)}`);
  pagesToken = made.result.value;
  say(`Pages token: ${dryRun ? 'would be created' : 'created'}, with only "Pages Write"`);
}

if (dryRun) {
  say('\n(dry run: nothing was written)');
  process.exit(0);
}

// ---- write local files (secrets stay in git-ignored files, mode 600)
const merged = { ...env, CLOUDFLARE_API_TOKEN: pagesToken, CLOUDFLARE_ACCOUNT_ID: account, AWS_ACCESS_KEY_ID: r2.id, AWS_SECRET_ACCESS_KEY: r2.secret };
const header = '# Written by scripts/cloudflare-bootstrap.mjs. Git-ignored. The setup token is deliberately NOT kept here.\n';
writeFileSync(ENV_PATH, header + Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
chmodSync(ENV_PATH, 0o600);
writeFileSync(join(INFRA, 'backend.hcl'), `endpoints = { s3 = "https://${account}.r2.cloudflarestorage.com" }\n`);
say('wrote infra/.env (mode 600) and infra/backend.hcl');

// ---- GitHub secrets for the release workflow
if (args.has('--github')) {
  for (const [name, value] of [['CLOUDFLARE_API_TOKEN', pagesToken], ['CLOUDFLARE_ACCOUNT_ID', account]]) {
    // The value goes in on stdin, never on the command line.
    execFileSync('gh', ['secret', 'set', name, '--env', 'production', '--repo', REPO], { input: value, stdio: ['pipe', 'ignore', 'inherit'] });
    say(`GitHub secret ${name}: set on the production environment`);
  }
}
say('\ndone. Delete or rotate the setup token when you no longer need it.');

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { scryptSync, webcrypto } from 'node:crypto'

const SCRYPT_N = 32_768
const SCRYPT_R = 8
const SCRYPT_P = 3
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024
const args = new Set(process.argv.slice(2))
const remote = args.has('--remote')
const local = args.has('--local')
const developmentSeed = args.has('--dev')

if (remote === local) {
  throw new Error('Choose exactly one target: --local or --remote.')
}

const requiredEnvironmentValue = (name) => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for production provisioning.`)
  return value
}

const values = developmentSeed
  ? {
      partner1Email: 'partner.one@example.test',
      partner1Password: 'LocalOnly-Partner-One!2026',
      partner1Name: 'Partner One',
      partner2Email: 'partner.two@example.test',
      partner2Password: 'LocalOnly-Partner-Two!2026',
      partner2Name: 'Partner Two',
      title: 'Our Corner',
      startDate: '2025-08-20',
      timezone: 'Europe/London',
    }
  : {
      partner1Email: requiredEnvironmentValue('PARTNER_1_EMAIL').toLowerCase(),
      partner1Password: requiredEnvironmentValue('PARTNER_1_PASSWORD'),
      partner1Name: requiredEnvironmentValue('PARTNER_1_NAME'),
      partner2Email: requiredEnvironmentValue('PARTNER_2_EMAIL').toLowerCase(),
      partner2Password: requiredEnvironmentValue('PARTNER_2_PASSWORD'),
      partner2Name: requiredEnvironmentValue('PARTNER_2_NAME'),
      title: requiredEnvironmentValue('RELATIONSHIP_TITLE'),
      startDate: requiredEnvironmentValue('RELATIONSHIP_START_DATE'),
      timezone: process.env.RELATIONSHIP_TIMEZONE?.trim() || 'Europe/London',
    }

if (values.partner1Email === values.partner2Email) throw new Error('The two account emails must be different.')
if (values.partner1Password.length < 14 || values.partner2Password.length < 14) {
  throw new Error('Each password must contain at least 14 characters.')
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(values.startDate)) {
  throw new Error('RELATIONSHIP_START_DATE must use YYYY-MM-DD.')
}

const bytesToBase64Url = (bytes) => Buffer.from(bytes).toString('base64url')
const hashPassword = async (password) => {
  const salt = webcrypto.getRandomValues(new Uint8Array(16))
  const hash = scryptSync(password, salt, 32, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAX_MEMORY,
  })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${bytesToBase64Url(salt)}$${bytesToBase64Url(hash)}`
}

const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`
const [partner1Hash, partner2Hash] = await Promise.all([
  hashPassword(values.partner1Password),
  hashPassword(values.partner2Password),
])
const now = Date.now()
const sql = `
PRAGMA foreign_keys = ON;
INSERT INTO users (id, email, display_name, password_hash, active, created_at, updated_at)
VALUES ('partner-1', ${sqlString(values.partner1Email)}, ${sqlString(values.partner1Name)}, ${sqlString(partner1Hash)}, 1, ${now}, ${now})
ON CONFLICT(id) DO UPDATE SET
  email = excluded.email,
  display_name = excluded.display_name,
  password_hash = excluded.password_hash,
  active = 1,
  updated_at = excluded.updated_at;

INSERT INTO users (id, email, display_name, password_hash, active, created_at, updated_at)
VALUES ('partner-2', ${sqlString(values.partner2Email)}, ${sqlString(values.partner2Name)}, ${sqlString(partner2Hash)}, 1, ${now}, ${now})
ON CONFLICT(id) DO UPDATE SET
  email = excluded.email,
  display_name = excluded.display_name,
  password_hash = excluded.password_hash,
  active = 1,
  updated_at = excluded.updated_at;

INSERT INTO relationships (
  id, title, start_date, timezone, partner_1_user_id, partner_2_user_id, created_at, updated_at
) VALUES (
  'primary', ${sqlString(values.title)}, ${sqlString(values.startDate)}, ${sqlString(values.timezone)},
  'partner-1', 'partner-2', ${now}, ${now}
)
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  start_date = excluded.start_date,
  timezone = excluded.timezone,
  partner_1_user_id = excluded.partner_1_user_id,
  partner_2_user_id = excluded.partner_2_user_id,
  updated_at = excluded.updated_at;
`

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'our-corner-provision-'))
const sqlPath = join(temporaryDirectory, 'provision.sql')
try {
  await writeFile(sqlPath, sql, { encoding: 'utf8', mode: 0o600 })
  const wranglerPath = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url))
  const wranglerArgs = [
    wranglerPath,
    'd1',
    'execute',
    'our-corner-db',
    remote ? '--remote' : '--local',
    '--file',
    sqlPath,
    ...(remote && args.has('--env') ? ['--env', 'production'] : []),
  ]
  const result = spawnSync(process.execPath, wranglerArgs, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Wrangler exited with status ${result.status ?? 'unknown'}.`)
  console.log(`Provisioned exactly two ${developmentSeed ? 'fake local' : 'production'} accounts without printing credentials.`)
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}

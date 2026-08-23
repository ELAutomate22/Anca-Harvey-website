import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations')

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            APP_ENV: 'test',
            ALLOWED_ORIGIN: 'https://our-corner.test',
            API_ORIGIN: 'https://our-corner.test',
            TMDB_API_READ_TOKEN: 'test-only-tmdb-token',
            TEST_MIGRATIONS: migrations,
          },
        },
      }),
    ],
    test: {
      include: ['worker/**/*.test.ts'],
      setupFiles: ['./worker/test/setup.ts'],
    },
  }
})

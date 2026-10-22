import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const backend = fileURLToPath(new URL('../Backend-Flask', import.meta.url));
const python = process.env.MOVIE_TEST_PYTHON || join(backend, 'myenv', 'Scripts', 'python.exe');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  expect: { timeout: 10000 },
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5175', channel: 'chrome', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    { command: `"${python}" -m flask --app app run --host 127.0.0.1 --port 5051 --no-reload`, cwd: backend, url: 'http://127.0.0.1:5051/health', timeout: 60000 },
    { command: 'npm run dev -- --port 5175', env: { VITE_API_URL: 'http://127.0.0.1:5051' }, url: 'http://127.0.0.1:5175', timeout: 30000 },
  ],
});

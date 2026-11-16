import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/demo',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: 4,
    reporter: 'list',
    use: { baseURL: 'http://127.0.0.1:4180/mvvm-dom/', trace: 'retain-on-failure' },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
        { name: 'firefox', use: { browserName: 'firefox', viewport: { width: 1440, height: 1000 } } },
        { name: 'webkit', use: { browserName: 'webkit', viewport: { width: 1440, height: 1000 } } },
        { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'webkit' } }
    ],
    webServer: { command: 'node scripts/serve-demo.mjs', url: 'http://127.0.0.1:4180/mvvm-dom/', reuseExistingServer: false }
});

import { test, expect } from '@playwright/test';

const searchBox = page => page.getByRole('combobox', { name: 'Search movie titles, genres, or themes' });

test('discovery renders without errors and fits the viewport', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.movie-card')).toHaveCount(12);
  await expect(page.getByRole('heading', { name: /Worth your watch/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('discover.png'), fullPage: true });
});

test('partial franchise search returns relevant films', async ({ page }, testInfo) => {
  await page.goto('/');
  await searchBox(page).fill('harry potter');
  await searchBox(page).press('Enter');
  await expect(page.getByRole('heading', { name: /Picks for.*harry potter/ })).toBeVisible();
  await expect(page.locator('.movie-card')).toHaveCount(12);
  const titles = await page.locator('.movie-title').allTextContents();
  expect(titles.slice(0, 5).every(title => title.startsWith('Harry Potter'))).toBe(true);
  expect(titles).not.toContain('Epic Movie');
  await page.screenshot({ path: testInfo.outputPath('harry-potter.png'), fullPage: true });
});

test('autocomplete works with keyboard selection', async ({ page }) => {
  await page.goto('/');
  await searchBox(page).fill('interstel');
  await expect(page.getByRole('listbox')).toBeVisible();
  await searchBox(page).press('ArrowDown');
  await searchBox(page).press('Enter');
  await expect(page.getByRole('heading', { name: /Picks for.*Interstellar/ })).toBeVisible();
  await expect(page.locator('.movie-card').first()).toBeVisible();
  expect(await page.locator('.movie-title').allTextContents()).not.toContain('Interstellar');
});

test('watchlist persists and movie details can find similar films', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.movie-card')).toHaveCount(12);
  const title = await page.locator('.movie-title').first().textContent();
  await page.locator('.save-button').first().click();
  await page.getByRole('button', { name: /My watchlist/ }).click();
  await expect(page.locator('.movie-card')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: /My watchlist/ }).click();
  await expect(page.locator('.movie-card')).toHaveCount(1);
  await page.locator('.movie-title').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Find similar films' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Picks for/ })).toBeVisible();
  await expect(page.locator('.movie-card').first()).toBeVisible();
  expect(await page.locator('.movie-title').allTextContents()).not.toContain(title);
});

test('genre and rating filters work together', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.movie-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Sci-fi', exact: true }).click();
  await page.getByRole('combobox', { name: 'Minimum movie rating' }).selectOption('7');
  await expect(page.getByRole('button', { name: 'Sci-fi', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.movie-card').first()).toBeVisible();
  const ratings = await page.locator('.rating-badge').allTextContents();
  expect(ratings.every(rating => Number(rating) >= 7)).toBe(true);
});

test('unknown searches can return to discovery', async ({ page }) => {
  await page.goto('/');
  await searchBox(page).fill('zzzxxyyqnotaword');
  await searchBox(page).press('Enter');
  await expect(page.getByRole('heading', { name: 'A different direction, perhaps?' })).toBeVisible();
  await page.getByRole('button', { name: 'Explore films' }).click();
  await expect(page.locator('.movie-card')).toHaveCount(12);
});

test('network failures show a recoverable error', async ({ page }) => {
  await page.route('**/movies?**', route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.unroute('**/movies?**');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.movie-card')).toHaveCount(12);
});

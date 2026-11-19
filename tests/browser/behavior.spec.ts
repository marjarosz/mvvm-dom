import { expect, test } from '@playwright/test';
import type {} from './fixture/main';

test.beforeEach(async ({ page }) => {

  await page.goto('/');
  await page.waitForFunction(() => !!window.mvvmHarness);

});

test('factory resolves a template by ID without moving it', async ({ page }) => {

  await page.evaluate(() => window.mvvmHarness.factoryView());
  await expect(page.locator('#fixture > strong')).toHaveText('Factory');
  await expect(page.locator('#browser-factory-template')).toHaveCount(1);
  await page.evaluate(() => window.mvvmHarness.setTitle());
  await expect(page.locator('#fixture > strong')).toHaveText('After');
  await page.evaluate(() => window.mvvmHarness.dispose());
  await expect(page.locator('#fixture > strong')).toHaveCount(0);

});

test('collection commands update native disabled when row parameters change', async ({ page }) => {

  await page.evaluate(() => window.mvvmHarness.commandAvailability());
  const buttons = page.locator('#fixture button');
  await expect(buttons.nth(0)).toBeDisabled();
  await expect(buttons.nth(1)).toBeEnabled();
  await buttons.nth(1).click();
  await page.evaluate(() => window.mvvmHarness.updateCommandRow());
  await expect(buttons.nth(0)).toBeEnabled();
  await buttons.nth(0).click();
  expect(await page.evaluate(() => window.mvvmHarness.state.commands)).toBe(2);

});

test('text updates preserve the focused input and selection', async ({ page }) => {

  await page.evaluate(() => window.mvvmHarness.focus());
  const input = page.locator('#editor'); await input.focus();
  await input.evaluate((node: HTMLInputElement) => node.setSelectionRange(2, 4));
  await page.evaluate(() => window.mvvmHarness.setTitle());
  await expect(input).toBeFocused(); await expect(input).toHaveValue('abcdef');
  expect(await input.evaluate((node: HTMLInputElement) => [node.selectionStart, node.selectionEnd])).toEqual([2, 4]);
  await expect(page.locator('label')).toContainText('After');

});

test('collection updates and reordering preserve rows, focus, and selection', async ({ page }) => {

  await page.evaluate(() => window.mvvmHarness.collection());
  const rows = page.locator('li');
  const second = rows.nth(1);
  const input = second.locator('input');
  await input.focus();
  await input.evaluate((node: HTMLInputElement) => node.setSelectionRange(2, 4));
  await second.evaluate(node => { (node as HTMLElement).dataset.marker = 'original'; });
  await page.evaluate(() => window.mvvmHarness.updateCollection());
  await expect(second.locator('span')).toHaveText('Updated');
  await expect(input).toBeFocused();
  await page.evaluate(() => window.mvvmHarness.reverseCollection());
  const moved = rows.first();
  await expect(moved).toHaveAttribute('data-marker', 'original');
  await expect(moved.locator('input')).toBeFocused();
  expect(await moved.locator('input').evaluate((node: HTMLInputElement) => [node.selectionStart, node.selectionEnd])).toEqual([2, 4]);

});

test('native ResizeObserver reports layout changes and stops after disposal', async ({ page }) => {

  await page.evaluate(() => window.mvvmHarness.resize());
  await expect.poll(() => page.evaluate(() => window.mvvmHarness.state.widths.includes(100))).toBe(true);
  await page.locator('#measured').evaluate((node: HTMLElement) => { node.style.width = '180px'; });
  await expect.poll(() => page.evaluate(() => window.mvvmHarness.state.widths.includes(180))).toBe(true);
  const count = await page.evaluate(() => { window.mvvmHarness.dispose(); return window.mvvmHarness.state.widths.length; });
  await page.locator('#measured').evaluate((node: HTMLElement) => { node.style.width = '240px'; });
  // Two paint opportunities allow delivery of a native observer notification.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(await page.evaluate(() => window.mvvmHarness.state.widths.length)).toBe(count);

});

test('native scrolling updates the view model', async ({ page }) => {

  await page.evaluate(() => window.mvvmHarness.scroll());
  await page.locator('#scroll').evaluate(node => { node.scrollTop = 120; });
  await expect.poll(() => page.evaluate(() => window.mvvmHarness.position())).toBe(120);

});

test('multiple selects synchronize values and option records with native selection', async ({ page }) => {

  await page.evaluate(() => window.mvvmHarness.multipleSelect());
  const values = page.locator('#multiple-values');
  const records = page.locator('#multiple-options');
  await expect(values).toHaveValues(['a', 'c']);
  await expect(records).toHaveValues(['a', 'c']);
  await page.evaluate(() => window.mvvmHarness.replaceMultipleOptions());
  await expect(values).toHaveValues(['c']);
  expect((await page.evaluate(() => window.mvvmHarness.multipleState())).selected).toEqual(['c']);
  await values.selectOption(['b', 'c']);
  await records.selectOption(['b', 'c']);

  expect(await page.evaluate(() => window.mvvmHarness.multipleState())).toEqual({
    selected: ['b', 'c'],
    records: [
      { value: 'a', label: 'A', isSelected: false },
      { value: 'b', label: 'B', isSelected: true },
      { value: 'c', label: 'C', isSelected: true }
    ]
  });

});

test('native form submission invokes the command without navigation', async ({ page }) => {

  await page.evaluate(() => window.mvvmHarness.submit());
  await page.locator('#field').fill('Anna'); await page.locator('#field').press('Enter');
  await expect.poll(() => page.evaluate(() => window.mvvmHarness.state.commands)).toBe(1);
  await expect(page).toHaveURL('http://127.0.0.1:4179/');

});

test('local keyboard shortcuts preserve typing and prevent matching native actions', async ({ page }) => {

  await page.evaluate(() => window.mvvmHarness.keyboard());
  const input = page.locator('#keyboard');
  await input.focus();
  await input.pressSequentially('abc');
  await expect(input).toHaveValue('abc');
  await input.press('Control+s');
  await input.press('Control+Shift+s');
  await input.press('Enter');
  expect(await page.evaluate(() => window.mvvmHarness.state.keys)).toEqual([['s', 'Ctrl'], ['Enter']]);
  await expect(input).toHaveValue('abc');
  await expect(page).toHaveURL('http://127.0.0.1:4179/');
  await page.evaluate(() => window.mvvmHarness.dispose());

});

test('drop preserves a native DataTransfer file payload', async ({ page }) => {

  await page.evaluate(() => window.mvvmHarness.drop());

  await page.evaluate(() => {
    
    const dataTransfer = new DataTransfer(); dataTransfer.items.add(new File(['contents'], 'sample.txt', { type: 'text/plain' }));
    document.querySelector('#drop')!.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));

  });

  expect(await page.evaluate(() => window.mvvmHarness.state.dropped)).toEqual(['sample.txt']);
});


for (const empty of [null, undefined]) {
  test('display nullish uses none while empty string restores CSS: ' + String(empty), async ({ page }) => {
    await page.evaluate(value => window.mvvmHarness.emptyDisplay(value), empty);
    const panel = page.locator('#empty-display');
    await expect(panel).toHaveCSS('display', 'none');
    await expect(panel).toHaveCSS('opacity', '0.35');
    await expect(panel).toHaveCSS('color', 'rgb(255, 0, 0)');
    await page.evaluate(() => window.mvvmHarness.setDisplay(''));
    await expect(panel).toHaveCSS('display', 'grid');
    expect(await panel.evaluate(el => el.style.display)).toBe('');
    await page.evaluate(() => window.mvvmHarness.setDisplay(true));
    await expect(panel).toHaveCSS('display', 'block');
    await page.evaluate(value => window.mvvmHarness.setDisplay(value), empty);
    await expect(panel).toHaveCSS('display', 'none');
    await expect(panel).toHaveCSS('opacity', '0.35');
    await page.evaluate(() => window.mvvmHarness.dispose());
  });
}

for (const empty of [null, undefined, '']) {
  test('empty style restores stylesheet color and respects property ownership: ' + String(empty), async ({ page }) => {
    await page.evaluate(value => window.mvvmHarness.emptyStyle(value), empty);
    const named = page.locator('#named-style'), whole = page.locator('#whole-style');
    await expect(named).toHaveCSS('color', 'rgb(0, 128, 0)');
    await expect(named).toHaveCSS('opacity', '0.35');
    await expect(named).toHaveCSS('display', 'none');
    await expect(whole).toHaveAttribute('style', '');
    await expect(whole).toHaveCSS('color', 'rgb(0, 128, 0)');
    await expect(whole).toHaveCSS('opacity', '1');
    await expect(whole).toHaveCSS('display', 'grid');
    await page.evaluate(() => window.mvvmHarness.setStyle('blue'));
    await expect(named).toHaveCSS('color', 'rgb(0, 0, 255)');
    await expect(whole).toHaveCSS('color', 'rgb(0, 0, 255)');
    await page.evaluate(value => window.mvvmHarness.setStyle(value), empty);
    await expect(named).toHaveCSS('color', 'rgb(0, 128, 0)');
    await expect(named).toHaveCSS('opacity', '0.35');
    await expect(named).toHaveCSS('display', 'none');
    await expect(whole).toHaveAttribute('style', '');
    await page.evaluate(() => window.mvvmHarness.dispose());
  });
}

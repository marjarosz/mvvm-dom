import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {

    await page.goto('./');
    await expect(page.locator('#projectHost .task-item')).toHaveCount(4);

});

test('lab combines two-axis scrolling and model-driven dimensions', async ({ page }, testInfo) => {

    const lab = page.locator('#labHost');
    const scroll = lab.getByRole('region', { name: 'Two-axis scroll panel' });
    await expect(page.locator('#layout')).toHaveCount(0);
    await lab.getByRole('button', { name: 'Move / reset scroll' }).click();
    await expect(lab.locator('#lab-scroll-position')).toHaveText('X: 160 px · Y: 180 px');
    expect(await scroll.evaluate(el => [el.scrollLeft, el.scrollTop])).toEqual([160, 180]);
    await scroll.evaluate(el => { el.scrollTo(80, 90); });
    await expect(lab.locator('#lab-scroll-position')).toHaveText('X: 80 px · Y: 90 px');
    await lab.getByRole('button', { name: 'Move / reset scroll' }).click();
    await expect(lab.locator('#lab-scroll-position')).toHaveText('X: 0 px · Y: 0 px');
    await lab.getByRole('button', { name: 'Change width', exact: true }).click();
    await lab.getByRole('button', { name: 'Change height', exact: true }).click();
    await expect(lab.locator('.dimensions-demo')).toHaveCSS('width', '240px');
    await expect(lab.locator('.dimensions-demo')).toHaveCSS('height', '140px');
    await lab.screenshot({ path: testInfo.outputPath('lab.png'), scale: 'css' });
    await page.locator('[data-reset=lab]').click();
    await expect(lab.locator('.dimensions-demo')).toHaveCSS('width', '180px');
    await expect(lab.locator('.dimensions-demo')).toHaveCSS('height', '80px');

});

test('ArrayObserver moves existing views and disposes removed panel models', async ({ page }, testInfo) => {

    const host = page.locator('#workPanelsHost');
    const panels = host.locator('.work-panel');
    const first = panels.filter({ has: page.getByRole('heading', { name: 'Panel 1', exact: true }) });
    await first.getByLabel('Panel note').fill('Keep my state');
    await first.getByRole('button', { name: 'Increment', exact: true }).click();
    const originalNode = await first.elementHandle();
    await host.getByRole('button', { name: 'Reverse panels' }).click();
    await expect(panels.last().getByRole('heading')).toHaveText('Panel 1');
    expect(await panels.last().evaluate((node, original) => node === original, originalNode)).toBe(true);
    await expect(first.getByLabel('Panel note')).toHaveValue('Keep my state');
    await expect(first.locator('.panel-counter strong')).toHaveText('1');
    await expect(panels.first().locator('.panel-counter strong')).toHaveText('0');
    await host.getByRole('button', { name: 'Add panel', exact: true }).click();
    await expect(panels).toHaveCount(3);
    await host.screenshot({ path: testInfo.outputPath('view-panels.png') });
    await first.getByRole('button', { name: 'Remove panel', exact: true }).click();
    await expect(panels).toHaveCount(2);
    await expect(host.locator('.panel-lifecycle')).toContainText('1 models disposed');
    await host.getByRole('button', { name: 'Remove all panels' }).click();
    await expect(panels).toHaveCount(0);
    await expect(host.locator('.panel-lifecycle')).toContainText('3 models disposed');
    await expect(host.locator('.empty-state')).toBeVisible();
    await page.locator('[data-reset=collections]').click();
    await expect(panels).toHaveCount(2);
    await expect(host.locator('.panel-lifecycle')).toContainText('0 models disposed');
    await expect(panels.first().getByLabel('Panel note')).toHaveValue('');

});

test('production page mounts every example without browser errors or horizontal overflow', async ({ page }, testInfo) => {

    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.reload();
    await expect(page.locator('#labHost input')).toHaveCount(4);
    await expect(page.locator('.inspector')).toHaveCount(0);

    for (const id of ['form', 'text', 'tasks', 'tags', 'cmds', 'valid', 'conv', 'custom', 'drag', 'life']) {

        await expect(page.locator(`#${id}Host`)).not.toBeEmpty();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('showcase.png'), fullPage: true, scale: 'css' });

});

test('workspace filters tasks and resets an empty search', async ({ page }) => {

    const project = page.locator('#project');
    await project.getByRole('searchbox', { name: 'Search tasks' }).fill('keyboard');
    await expect(project.locator('.task-item')).toHaveCount(1);
    await project.getByRole('searchbox').fill('');
    await project.getByLabel('Filter status').selectOption('Done');
    await expect(project.locator('.task-item')).toHaveCount(1);
    await project.getByLabel('Filter status').selectOption('All');
    await expect(project.locator('.task-item')).toHaveCount(4);
    await project.getByRole('searchbox').fill('no matching task');
    await expect(project.locator('.empty-state')).toBeVisible();
    await expect(project.locator('.task-item')).toHaveCount(0);
    await project.getByRole('button', { name: 'Reset demo' }).click();
    await expect(project.getByRole('searchbox')).toHaveValue('');
    await expect(project.locator('.task-item')).toHaveCount(4);

});

test('workspace validates, saves and deletes a new task', async ({ page }) => {

    const project = page.locator('#project');
    await project.getByRole('button', { name: '+ New task' }).click();
    await project.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.locator('#task-name-error')).toContainText('at least 3');
    await project.getByLabel('Task name', { exact: true }).fill('Ship the demo');
    await project.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(project.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
    await expect(project.locator('.task-item')).toHaveCount(5);
    await expect(project.getByRole('dialog', { name: 'Edit task', exact: true })).not.toBeVisible();
    await expect(project.locator('.workspace-notice')).toContainText('Saved for this session');
    await project.getByRole('button', { name: /Ship the demo/ }).click();
    await project.getByRole('button', { name: 'Delete task', exact: true }).click();
    await project.getByRole('button', { name: 'Delete permanently', exact: true }).click();
    await expect(project.locator('.task-item')).toHaveCount(4);
    await expect(project.locator('dialog[open]')).toHaveCount(0);
    await expect(project.getByRole('button', { name: /Ship the demo/ })).toHaveCount(0);
    // Keep a real background-control click after both dialogs close.
    await project.getByRole('button', { name: 'Reset demo' }).click();
    await expect(project.locator('.task-item')).toHaveCount(4);

});

test('selected row edits the model and updates aggregate progress', async ({ page }) => {

    const project = page.locator('#project');
    await project.getByRole('button', { name: /Test keyboard navigation/ }).click();
    await expect(project.getByLabel('Task name', { exact: true })).toHaveValue('Test keyboard navigation');
    await project.locator('.task-editor').getByLabel('Status', { exact: true }).selectOption('Done');
    await project.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(project.locator('.progress-caption strong')).toHaveText('50%');
    await expect(project.getByRole('button', { name: /Test keyboard navigation/ })).toContainText('Done');

});

test('source, reset, native commands and accessible drag alternative work', async ({ page }) => {

    await page.locator('#forms summary').click();
    await expect(page.locator('#forms pre').first()).toContainText('data-bind');
    await expect(page.locator('#forms pre').last()).toContainText('class FormDemoModel');
    await page.locator('#forms summary').click();
    await page.locator('#formHost input').first().fill('Changed');
    await page.locator('[data-reset="forms"]').click();
    await expect(page.locator('#formHost input').first()).toHaveValue('Anna');
    await page.getByRole('button', { name: 'Add chip one', exact: true }).click();
    await expect(page.locator('#dragHost .dropzone .chip')).toHaveText('chip one');
    await page.locator('[data-reset="drag"]').click();
    await expect(page.locator('#dragHost .dropzone .chip')).toHaveCount(0);
    await page.locator('#labHost').getByPlaceholder('Try me').fill('hello');
    await page.locator('#labHost').getByPlaceholder('Try me').press('Enter');
    await expect(page.locator('#labHost [role="status"]')).toContainText('keydown');

});

test('shared model survives detach and view disposal, reset releases it', async ({ page }) => {

    const life = page.locator('#lifecycle');
    await life.getByRole('button', { name: 'bump', exact: true }).first().click();
    await expect(life.locator('#lifeHost .chip')).toHaveText(['live counter: 1', 'live counter: 1']);
    await life.getByRole('button', { name: 'Detach', exact: true }).click();
    await expect(life.locator('#lifeHost')).toBeEmpty();
    await life.getByRole('button', { name: 'Reattach', exact: true }).click();
    await expect(life.locator('#lifeHost .chip')).toHaveText(['live counter: 1', 'live counter: 1']);
    await life.getByRole('button', { name: 'Dispose views', exact: true }).click();
    await life.getByRole('button', { name: 'Mount views', exact: true }).click();
    await expect(life.locator('#lifeHost .chip')).toHaveText(['live counter: 1', 'live counter: 1']);
    await page.locator('[data-reset="lifecycle"]').click();
    await expect(life.locator('#lifeHost .chip')).toHaveText(['live counter: 0', 'live counter: 0']);

});

test('theme persists, hash links reload and mobile menu is keyboard accessible', async ({ page }, testInfo) => {

    const before = await page.locator('html').getAttribute('data-theme');
    await page.locator('.theme-button').click();
    const after = await page.locator('html').getAttribute('data-theme');
    expect(after).not.toBe(before);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', after!);

    if (testInfo.project.name === 'mobile') {

        const menuButton = page.locator('.menu-button');
        await menuButton.focus();
        await menuButton.press('Enter');
        await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('#section-nav')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
        await expect(menuButton).toBeFocused();
        await menuButton.press('Enter');
        await expect(page.locator('#section-nav')).toBeVisible();
    }

    await page.locator('#section-nav a[href="#validation"]').click();
    await expect(page).toHaveURL(/#validation$/);
    await page.reload();
    await expect(page.locator('#validHost input')).toHaveCount(3);
    await expect(page.locator('#validation')).toBeInViewport();
});

test('programmatic remount during modal save cancels the previous model', async ({ page }) => {

    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.locator('#project').getByRole('button', { name: '+ New task' }).click();
    await page.locator('#project').getByLabel('Task name', { exact: true }).fill('Cancelled task');
    await page.locator('#project').getByRole('button', { name: 'Save changes', exact: true }).click();
    // Simulate a host remount while the modal makes background controls inert.
    await page.locator('[data-reset="project"]').evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.locator('#project .task-item')).toHaveCount(4);
    await page.waitForTimeout(800);
    await expect(page.locator('#project .task-item')).toHaveCount(4);
    expect(errors).toEqual([]);

});

test('workspace tabs support keyboard navigation and preserve search state', async ({ page }) => {

    const project = page.locator('#project');
    await project.getByRole('searchbox').fill('keyboard');
    const tasks = project.getByRole('tab', { name: /^Tasks/ });
    await tasks.focus();
    await tasks.press('ArrowRight');
    await expect(project.getByRole('tab', { name: 'Overview', exact: true })).toBeFocused();
    await expect(project.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(project.getByRole('tabpanel', { name: 'Overview', exact: true })).toBeVisible();
    await expect(project.getByRole('searchbox')).not.toBeVisible();
    await page.keyboard.press('End');
    await expect(project.getByRole('tabpanel', { name: 'Activity', exact: true })).toContainText('Workspace ready');
    await page.keyboard.press('Home');
    await expect(project.getByRole('searchbox')).toHaveValue('keyboard');
    await expect(project.locator('.task-item')).toHaveCount(1);

});

test('modal traps focus, cancels drafts and restores focus to its opener', async ({ page }, testInfo) => {

    const project = page.locator('#project');
    const row = project.getByRole('button', { name: /Design the component library/ });
    await row.focus();
    await row.click();
    const dialog = project.getByRole('dialog', { name: 'Edit task', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Task name', { exact: true })).toBeFocused();
    await dialog.getByLabel('Task name', { exact: true }).fill('Unsaved draft');

    for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab');
        expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }

    await page.screenshot({ path: testInfo.outputPath('task-modal.png'), scale: 'css' });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(row).toBeFocused();
    await row.click();
    await expect(dialog.getByLabel('Task name', { exact: true })).toHaveValue('Design the component library');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await row.click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(2, 2);
    await expect(dialog).not.toBeVisible();

});

test('delete confirmation can be dismissed and successful saves appear in Activity', async ({ page }) => {

    const project = page.locator('#project');
    await project.getByRole('button', { name: /Design the component library/ }).click();
    await project.getByRole('button', { name: 'Delete task', exact: true }).click();
    const confirmation = project.getByRole('dialog', { name: 'Delete this task?', exact: true });
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole('button', { name: 'Keep task' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(confirmation).not.toBeVisible();
    await expect(project.getByRole('dialog', { name: 'Edit task', exact: true })).toBeVisible();
    await project.getByLabel('Task name', { exact: true }).fill('Updated design');
    await project.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(project.getByRole('button', { name: 'Saving…', exact: true })).toBeVisible();
    await expect(project.locator('.task-modal')).not.toBeVisible();
    await project.getByRole('tab', { name: 'Activity', exact: true }).click();
    await expect(project.locator('.activity-list li').first()).toContainText('Updated design');

});

test('small phones and tablets keep content inside the viewport with source expanded', async ({ page }) => {

    for (const width of [320, 768]) {

        await page.setViewportSize({ width, height: 900 });
        await page.locator('#lab summary').click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.locator('#lab summary').click();
        
    }
});

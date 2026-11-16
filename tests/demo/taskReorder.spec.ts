import { test, expect, type Page } from '@playwright/test';

const rows = (page: Page) => page.locator('#projectHost .task-item');
const row = (page: Page, id: number) => page.locator(`#projectHost [data-task-id="${id}"]`);

async function order(page: Page, ids: number[]) {

    await expect.poll(() => rows(page).evaluateAll(elements => elements.map(el => Number(el.getAttribute('data-task-id'))))).toEqual(ids);
}

test.beforeEach(async ({ page }) => {

    await page.goto('./');
    await expect(rows(page)).toHaveCount(4);

});

test('keyboard and buttons reorder model-backed rows without opening the editor', async ({ page }) => {

    const original = await row(page, 2).elementHandle();
    const grip = row(page, 2).getByRole('button', { name: 'Reorder task', exact: true });
    await grip.focus();
    await grip.press('Alt+ArrowUp');
    await order(page, [2, 1, 3, 4]);
    expect(await row(page, 2).evaluate((el, old) => el === old, original)).toBe(true);
    await expect(grip).toBeFocused();
    await grip.press('Alt+ArrowUp');
    await order(page, [2, 1, 3, 4]);
    await row(page, 2).getByRole('button', { name: 'Move task down' }).click();
    await order(page, [1, 2, 3, 4]);
    await expect(page.locator('#project .task-modal')).not.toBeVisible();
    await row(page, 2).locator('.task-open').click();
    await page.locator('#project').getByLabel('Task name', { exact: true }).fill('Moved task still works');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(row(page, 2)).toContainText('Moved task still works');
    await order(page, [1, 2, 3, 4]);

});

test('filtered moves preserve hidden tasks and single-result moves are no-ops', async ({ page }) => {

    const project = page.locator('#project');
    await project.getByLabel('Filter status').selectOption('To do');
    await order(page, [3, 4]);
    await row(page, 4).getByRole('button', { name: 'Move task up' }).click();
    await order(page, [4, 3]);
    await project.getByLabel('Filter status').selectOption('All');
    await order(page, [1, 2, 4, 3]);
    await project.getByRole('searchbox').fill('keyboard');
    await expect(rows(page)).toHaveCount(1);
    await rows(page).getByRole('button', { name: 'Move task down' }).click();
    await project.getByRole('searchbox').fill('');
    await order(page, [1, 2, 4, 3]);

});

test('native dragging moves a task after the target and retains its DOM node', async ({ page }, info) => {

    test.skip(info.project.name === 'mobile', 'Touch uses the move buttons tested separately.');
    const original = await row(page, 1).elementHandle();
    const target = row(page, 4);
    const box = await target.boundingBox();
    await row(page, 1).locator('.task-grip').dragTo(target, { targetPosition: { x: 100, y: box!.height - 4 } });
    await order(page, [2, 3, 4, 1]);
    expect(await row(page, 1).evaluate((el, old) => el === old, original)).toBe(true);
    await expect(page.locator('[data-drop-position], [data-dragging]')).toHaveCount(0);
    await expect(page.locator('#project .task-modal')).not.toBeVisible();

});

test('cancel, foreign drops and disposal never leave a stale drag session', async ({ page }) => {

    await page.evaluate(() => {
        const source = document.querySelector('#projectHost .task-grip')!;
        const target = document.querySelector('#projectHost [data-task-id="4"]')!;
        const transfer = new DataTransfer();
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });

    await expect(row(page, 4)).toHaveAttribute('data-drop-position', 'before');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-drop-position], [data-dragging]')).toHaveCount(0);
    await row(page, 4).evaluate(el => el.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: new DataTransfer() })));
    await order(page, [1, 2, 3, 4]);

    await page.evaluate(() => {
        const transfer = new DataTransfer();
        document.querySelector('#projectHost .task-grip')!.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
        (document.querySelector('[data-reset="project"]') as HTMLButtonElement).click();
        document.querySelector('#projectHost [data-task-id="4"]')!.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
    });
    
    await order(page, [1, 2, 3, 4]);
    await expect(page.locator('[data-drop-position], [data-dragging]')).toHaveCount(0);
    await row(page, 1).getByRole('button', { name: 'Move task down' }).click();
    await order(page, [2, 1, 3, 4]);
});

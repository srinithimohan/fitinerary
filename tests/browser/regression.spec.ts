import { expect, test, type Page } from '@playwright/test';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGD8AAAAASUVORK5CYII=', 'base64');
const clothing = { id: 'item-1', name: 'Linen shirt', category: 'Tops', imagePath: 'user-a/shirt.png', image: '/fixture.png' };

async function isolate(page: Page) {
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin !== 'http://127.0.0.1:4173') return route.abort('blockedbyclient');
    if (new URL(route.request().url()).pathname === '/fixture.png') return route.fulfill({ contentType: 'image/png', body: png });
    return route.continue();
  });
}

test.beforeEach(async ({ page }) => { await isolate(page); });

test('closet loads, filters, edits, and deletes an existing image', async ({ page }) => {
  let items = [clothing];
  await page.route('**/api/clothing**', async (route) => {
    const request = route.request();
    if (request.method() === 'PATCH') {
      items = [{ ...items[0], ...request.postDataJSON() }];
      return route.fulfill({ json: items[0] });
    }
    if (request.method() === 'DELETE') {
      expect(new URL(request.url()).searchParams.get('id')).toBe(clothing.id);
      items = [];
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({ json: items });
  });
  await page.goto('/');
  await expect(page.getByRole('img', { name: 'Linen shirt' })).toBeVisible();
  await page.getByPlaceholder('search your closet...').fill('missing');
  await expect(page.getByText('no clothing found')).toBeVisible();
  await page.getByPlaceholder('search your closet...').fill('');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('form input').fill('Travel shirt');
  await page.getByRole('button', { name: 'save changes' }).click();
  await expect(page.getByRole('img', { name: 'Travel shirt' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('no clothing found')).toBeVisible();
});

test('single-image upload sends metadata and preserves retry input after a server error', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/clothing', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [] });
    expect(route.request().method()).toBe('POST');
    const body = route.request().postDataBuffer()!.toString();
    expect(body).toContain('name="file"; filename="shirt.png"');
    expect(body).toContain('Holiday shirt');
    attempts++;
    return attempts === 1
      ? route.fulfill({ status: 500, json: { error: 'Storage unavailable' } })
      : route.fulfill({ status: 201, json: { ...clothing, name: 'Holiday shirt', category: 'All' } });
  });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'shirt.png', mimeType: 'image/png', buffer: png });
  await page.getByPlaceholder('White linen shirt').fill('Holiday shirt');
  await page.getByRole('button', { name: 'Add to Closet' }).click();
  await expect(page.getByText('Storage unavailable')).toBeVisible();
  await expect(page.getByPlaceholder('White linen shirt')).toHaveValue('Holiday shirt');
  await page.getByRole('button', { name: 'Add to Closet' }).click();
  await expect(page.getByRole('img', { name: 'Holiday shirt' })).toBeVisible();
  expect(attempts).toBe(2);
});

test('deletion failure keeps the clothing card visible', async ({ page }) => {
  await page.route('**/api/clothing**', (route) => route.fulfill(route.request().method() === 'DELETE'
    ? { status: 500, json: { error: 'Deletion unavailable' } }
    : { json: [clothing] }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Deletion unavailable')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Linen shirt' })).toBeVisible();
});

test('direct board upload saves multipart data and exports a real PNG canvas', async ({ page }) => {
  await page.route('**/api/clothing', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/boards', async (route) => {
    expect(route.request().method()).toBe('POST');
    const body = route.request().postDataBuffer()!.toString();
    expect(body).toContain('name="file-0"');
    expect(body).toContain('"hasUpload":true');
    return route.fulfill({ status: 201, json: { id: 'board-1', name: 'Trip' } });
  });
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept(dialog.type() === 'prompt' ? 'Trip' : undefined);
  });
  await page.goto('/?view=board');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'shirt.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('img', { name: 'Outfit item' })).toHaveCount(1);
  await page.getByRole('button', { name: 'save board' }).click();
  await expect.poll(() => dialogs).toContain('"Trip" saved successfully!');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'export image' }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toMatch(/\.png$/);
  const stream = await exported.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  await page.getByRole('button', { name: 'clear board' }).click();
  await expect(page.getByRole('img', { name: 'Outfit item' })).toHaveCount(0);
});

test('existing board loads and saves snapshot references using PATCH', async ({ page }) => {
  await page.route('**/api/clothing', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/boards/board-1', (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataBuffer()!.toString();
      expect(body).toContain('user-a/board-snapshots/board-1/saved.png');
      expect(body).toContain('"hasUpload":false');
      return route.fulfill({ json: { id: 'board-1', name: 'Trip' } });
    }
    return route.fulfill({ json: { id: 'board-1', name: 'Trip', items: [{ position: 0, clothingItemId: null, image: '/fixture.png', imagePath: 'user-a/board-snapshots/board-1/saved.png' }] } });
  });
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept(dialog.type() === 'prompt' ? 'Trip' : undefined);
  });
  await page.goto('/?view=board&boardId=board-1');
  await expect(page.getByText('Editing')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Outfit item' })).toHaveCount(1);
  await page.getByRole('button', { name: 'save board' }).click();
  await expect.poll(() => dialogs).toContain('"Trip" updated successfully!');
});

test('closet selection adds an item once and saves its clothing reference', async ({ page }) => {
  await page.route('**/api/clothing', (route) => route.fulfill({ json: [clothing] }));
  await page.route('**/api/boards', (route) => {
    const body = route.request().postDataBuffer()!.toString();
    expect(body).toContain('"clothingItemId":"item-1"');
    expect(body).toContain('"hasUpload":false');
    expect(body).not.toContain('name="file-');
    return route.fulfill({ json: { id: 'board-1', name: 'Trip' } });
  });
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept(dialog.type() === 'prompt' ? 'Trip' : undefined);
  });
  await page.goto('/?view=board');
  await page.getByRole('button', { name: 'add from closet' }).click();
  const choice = page.getByRole('button', { name: /Linen shirt/ });
  await choice.click();
  await choice.click();
  await expect(page.getByRole('img', { name: 'Outfit item' })).toHaveCount(1);
  await page.getByRole('button', { name: 'save board' }).click();
  await expect.poll(() => dialogs).toContain('"Trip" saved successfully!');
});

test('saved boards load and delete with confirmation', async ({ page }) => {
  await page.route('**/api/clothing', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/past-boards', (route) => route.fulfill({ json: [{ id: 'board-1', name: 'Trip', isPublic: false, createdAt: '2026-01-01T00:00:00Z', items: [] }] }));
  await page.route('**/api/boards/board-1', (route) => {
    expect(route.request().method()).toBe('DELETE');
    return route.fulfill({ json: { success: true } });
  });
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/?view=past');
  await page.getByRole('button', { name: /Trip/ }).click();
  await page.getByRole('button', { name: 'Delete Board' }).click();
  await expect(page.getByRole('button', { name: /Trip/ })).toHaveCount(0);
});

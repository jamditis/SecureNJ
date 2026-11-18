/**
 * End-to-end smoke test. Run it with `npm run e2e`.
 *
 * It builds the app with no STUN server, serves that build, and starts a
 * local signaling server. Two separate browser profiles act as two members
 * of one space. The test fails if:
 * - the app does not render,
 * - the two members do not sync over WebRTC,
 * - a member with a wrong passphrase can see the data,
 * - the page makes an HTTP request or opens a WebSocket to a host other
 *   than this computer,
 * - the browser reports an error (which includes a request that the content
 *   security policy blocks),
 * - two tools of one group share a room, or the passphrase is stored,
 * - safety alerts are written to the device,
 * - "clear from this browser" keeps the connection open or keeps data,
 * - the app does not open with no connection after the first visit,
 * - "erase all data" leaves a database, a stored value, a cached file, or a
 *   service worker in the browser,
 * - an invite link holds the passphrase or does not fill in the space,
 * - in Arabic, the page is not right to left, the sidebar is not on the
 *   right, a page scrolls sideways, or the whiteboard mirrors a line.
 *
 * - a WebRTC connection is made with a STUN or TURN server, although the
 *   build under test sets none.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import * as Y from 'yjs';

const APP_PORT = 4173;
const SIGNALING_PORT = 4444;
const SIGNALING_URL = `ws://127.0.0.1:${SIGNALING_PORT}`;
const GROUP = { name: 'Smoke test', passphrase: 'correct horse battery staple smoke' };

const LOCAL_HOSTS = ['127.0.0.1', 'localhost', ''];

const problems = [];
/** The WebSockets that each page opened, to check that they close. */
const sockets = new Map();

async function openMember(browser, appUrl, label) {
  const context = await browser.newContext({ acceptDownloads: true });
  // Record the STUN and TURN servers of each WebRTC connection that the page makes.
  await context.addInitScript(() => {
    const Original = window.RTCPeerConnection;
    window.iceServersSeen = [];
    window.RTCPeerConnection = function (config) {
      window.iceServersSeen.push(config && config.iceServers ? config.iceServers : 'browser default');
      return new Original(config);
    };
    window.RTCPeerConnection.prototype = Original.prototype;
  });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`${label} console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`${label} error: ${error.message}`));
  page.on('request', (request) => {
    const { hostname } = new URL(request.url());
    if (!LOCAL_HOSTS.includes(hostname)) problems.push(`${label} external request: ${request.url()}`);
  });
  sockets.set(page, []);
  page.on('websocket', (socket) => {
    const { hostname } = new URL(socket.url());
    if (!LOCAL_HOSTS.includes(hostname)) problems.push(`${label} external WebSocket: ${socket.url()}`);
    const entry = { open: true };
    sockets.get(page).push(entry);
    socket.on('close', () => {
      entry.open = false;
    });
  });
  await page.goto(appUrl);
  await page.getByRole('heading', { name: 'Tools for local resilience' }).waitFor();
  return page;
}

async function openTool(page, name) {
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
  await page.getByRole('heading', { name, level: 2 }).waitFor();
}

/** Opens the room of one tool. Each tool has its own room, so each needs the passphrase. */
async function openRoom(page, tool, passphrase = GROUP.passphrase) {
  await openTool(page, tool);
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Open room' }) });
  if ((await form.getByLabel('Group name').inputValue()) === '') await form.getByLabel('Group name').fill(GROUP.name);
  await form.locator('input[type=password]').fill(passphrase);
  await form.getByLabel('Signaling servers').fill(SIGNALING_URL);
  await form.getByRole('button', { name: 'Open room' }).click();
  await page.getByRole('button', { name: 'Room settings' }).waitFor({ timeout: 30_000 });
}

async function workOnThisDevice(page, tool) {
  await openTool(page, tool);
  await page.getByRole('button', { name: 'Use on this device only, with no room' }).click();
}

const spaceDatabases = (page) =>
  page.evaluate(async () => (await indexedDB.databases()).map((db) => db.name).filter((name) => !['snj-local', 'snj-private'].includes(name)));

async function main() {
  const signaling = spawn(process.execPath, ['node_modules/y-webrtc/bin/server.js'], {
    env: { ...process.env, PORT: String(SIGNALING_PORT) },
    stdio: 'ignore',
  });
  // An empty value turns STUN off. Peers on this computer connect without it.
  process.env.VITE_ICE_SERVERS = '';
  const outDir = await mkdtemp(join(tmpdir(), 'snj-e2e-build-'));
  await build({ build: { outDir, emptyOutDir: true }, logLevel: 'error' });
  const server = await preview({ build: { outDir }, preview: { port: APP_PORT, strictPort: true, host: '127.0.0.1' } });
  const appUrl = `http://127.0.0.1:${APP_PORT}/`;
  // Without this flag the browser hides local addresses behind mDNS names,
  // which do not resolve in a container.
  const browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });

  try {
    console.log('1. With no room: a tool saves data on the device, but safety alerts are never saved');
    const solo = await openMember(browser, appUrl, 'solo');
    await workOnThisDevice(solo, 'Mutual aid board');
    await solo.getByRole('button', { name: 'New post' }).click();
    await solo.getByLabel('Title').fill('Local only post');
    await solo.getByRole('button', { name: 'Save' }).click();
    await solo.getByText('Local only post').waitFor();
    await workOnThisDevice(solo, 'Safety alerts');
    await solo.getByRole('button', { name: 'Report activity' }).click();
    await solo.getByLabel('Location').fill('Local only street');
    await solo.getByRole('button', { name: 'Send the report' }).click();
    await solo.getByText('Local only street').waitFor();
    await solo.reload();
    await solo.getByRole('button', { name: 'Use on this device only, with no room' }).click();
    await solo.getByText('No reports').waitFor();
    await workOnThisDevice(solo, 'Mutual aid board');
    await solo.getByText('Local only post').waitFor();

    assert.equal(await solo.evaluate(() => document.querySelector('main').spellcheck), false, 'spell check must be off, as the page about limits says');

    console.log('1b. The app opens with no connection after the first visit');
    await solo.evaluate(() => navigator.serviceWorker.ready);
    await solo.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await solo.context().setOffline(true);
    await solo.reload();
    await solo.getByRole('button', { name: 'Use on this device only, with no room' }).click();
    await solo.getByText('Local only post').waitFor();
    await solo.context().setOffline(false);

    console.log('1c. The language switch changes the text and is saved');
    await solo.getByLabel('Language').selectOption('es');
    await solo.getByRole('heading', { name: 'Tablero de ayuda mutua', level: 2 }).waitFor();
    assert.equal(await solo.evaluate(() => document.documentElement.lang), 'es');
    await solo.reload();
    // The address keeps the page, so a reload opens the same tool.
    await solo.getByRole('heading', { name: 'Tablero de ayuda mutua', level: 2 }).waitFor();
    await solo.getByLabel('Idioma').selectOption('en');
    await solo.getByRole('heading', { name: 'Mutual aid board', level: 2 }).waitFor();

    console.log('1d. "Erase all data" removes the data, the offline copy, and the service worker');
    // A different site on the same web origin has its own data. The erase must not touch it.
    await solo.evaluate(async () => {
      localStorage.setItem('other-app.key', 'keep');
      await caches.open('other-app-cache');
      // The site that this app replaces left a cache with this prefix.
      await caches.open('securenj-331fc8e428a0');
      await new Promise((resolve) => {
        indexedDB.open('other-app-db').onsuccess = (event) => {
          event.target.result.close();
          resolve();
        };
      });
    });
    await solo.getByRole('button', { name: 'Data on this device' }).click();
    await solo.getByRole('button', { name: 'Erase all data' }).click();
    await solo.getByRole('button', { name: 'Erase now. I cannot undo this.' }).click();
    await solo.getByText('The data of the app is erased from this browser.').waitFor();
    const erased = await solo.evaluate(async () => ({
      databases: (await indexedDB.databases()).map((db) => db.name),
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
      caches: await caches.keys(),
      workers: (await navigator.serviceWorker.getRegistrations()).length,
    }));
    assert.deepEqual(
      erased,
      { databases: ['other-app-db'], local: ['other-app.key'], session: [], caches: ['other-app-cache'], workers: 0 },
      'erase must remove all data of this app and no data of a different site',
    );

    console.log('2. Two members open the room of one tool and sync over WebRTC');
    const ana = await openMember(browser, appUrl, 'ana');
    const ben = await openMember(browser, appUrl, 'ben');
    await openRoom(ana, 'Safety alerts');
    await openRoom(ben, 'Safety alerts');
    await ana.getByText('Smoke test · peers: 1').waitFor({ timeout: 30_000 });
    await ana.getByRole('button', { name: 'Report activity' }).click();
    await ana.getByLabel('Location').fill('Broad St and Market St');
    await ana.getByLabel('Activity', { exact: true }).fill('Two vehicles stop cars');
    await ana.getByRole('button', { name: 'Send the report' }).click();
    await ben.getByText('Broad St and Market St').waitFor({ timeout: 15_000 });

    for (const page of [ana, ben]) {
      const seen = await page.evaluate(() => window.iceServersSeen);
      assert.ok(seen.length > 0, 'the members must connect over WebRTC');
      assert.deepEqual(seen.filter((servers) => servers.length !== 0), [], 'a build with no STUN server must contact no STUN server');
    }

    console.log('2b. The passphrase and the group name are not stored, and safety alerts are not written to the device');
    const stored = await ana.evaluate(async () => ({
      text: JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }),
      databases: (await indexedDB.databases()).map((db) => db.name),
    }));
    assert.ok(!stored.text.includes('horse') && !stored.text.includes(GROUP.name), 'the passphrase and the group name must not be stored');
    assert.deepEqual(stored.databases.sort(), ['snj-local', 'snj-private'], 'the room of safety alerts must have no database');

    console.log('3. A confirmation from the second member reaches the reporter');
    await ana.getByText('Not confirmed: one report only').waitFor();
    assert.ok(await ana.getByRole('button', { name: 'I see it too' }).isDisabled(), 'a reporter cannot confirm their own report');
    await ben.getByRole('button', { name: 'I see it too' }).click();
    await ana.getByText('Confirmed by other members: 1').waitFor({ timeout: 15_000 });

    console.log('4. A member with the wrong passphrase gets a different, empty room');
    const eve = await openMember(browser, appUrl, 'eve');
    await openRoom(eve, 'Safety alerts', 'a wrong set of words for this group');
    await eve.waitForTimeout(5_000);
    assert.equal(await eve.getByText('Broad St and Market St').count(), 0, 'a wrong passphrase must not show the data');
    await eve.getByText('No reports').waitFor();

    console.log('5. A second tool needs its own room, and it syncs there');
    await openTool(ana, 'Whiteboard');
    await ana.getByRole('button', { name: 'Open room' }).waitFor();
    assert.equal(await ana.getByLabel('Drawing surface').count(), 0, 'an open room of one tool must not open a different tool');
    await openRoom(ana, 'Whiteboard');
    await openRoom(ben, 'Whiteboard');
    await ana.getByLabel('Drawing surface').scrollIntoViewIfNeeded();
    const box = await ana.getByLabel('Drawing surface').boundingBox();
    await ana.mouse.move(box.x + 50, box.y + 50);
    await ana.mouse.down();
    await ana.mouse.move(box.x + 200, box.y + 120, { steps: 10 });
    await ana.mouse.up();
    await ben.getByRole('button', { name: 'Clear the board' }).and(ben.locator(':enabled')).waitFor({ timeout: 15_000 });
    assert.equal((await spaceDatabases(ana)).length, 1, 'the whiteboard room has one database, and the alerts room has none');

    console.log('6. The exported event page opens with no network and decrypts');
    await openTool(ana, 'Event coordinator');
    await ana.getByLabel('Event title').fill('Know your rights night');
    await ana.getByLabel('Date and time').fill('Tuesday, 6 PM');
    await ana.getByLabel('Location').fill('Library, room 2');
    await ana.locator('form input[type=password]').fill('river tulip nine window');
    const [download] = await Promise.all([
      ana.waitForEvent('download'),
      ana.getByRole('button', { name: 'Save the encrypted page' }).click(),
    ]);
    // A participant opens the file from the device, so the test does the same.
    const exportedPath = join(await mkdtemp(join(tmpdir(), 'snj-e2e-')), 'secure-event.html');
    await download.saveAs(exportedPath);
    const exported = await readFile(exportedPath, 'utf8');
    assert.ok(!exported.includes('Know your rights night'), 'the exported file must not hold the event as plain text');
    const offline = await browser.newContext({ offline: true });
    const viewer = await offline.newPage();
    viewer.on('pageerror', (error) => problems.push(`viewer error: ${error.message}`));
    viewer.on('console', (message) => {
      if (message.type() === 'error') problems.push(`viewer console: ${message.text()}`);
    });
    await viewer.goto(pathToFileURL(exportedPath).href);
    await viewer.getByPlaceholder('Passphrase').fill('river tulip nine window');
    await viewer.getByRole('button', { name: 'Unlock' }).click();
    await viewer.getByRole('heading', { name: 'Know your rights night' }).waitFor({ timeout: 15_000 });

    console.log('6a. Notes that are not saved are not lost through the back button without a question');
    await openTool(ana, 'Witness notes');
    await ana.locator('main textarea').first().fill('Two agents at the door at 6 AM');
    ana.once('dialog', (dialog) => dialog.dismiss());
    await ana.goBack();
    await ana.waitForTimeout(500);
    assert.equal(await ana.locator('main textarea').first().inputValue(), 'Two agents at the door at 6 AM', 'the notes must stay when the person answers no');
    ana.once('dialog', (dialog) => dialog.accept());
    await ana.goBack();
    await ana.getByRole('heading', { name: 'Event coordinator', level: 2 }).waitFor();

    console.log('6b. An invite link fills in the group, and the new member needs only the passphrase');
    await openTool(ben, 'Safety alerts');
    await ben.getByRole('button', { name: 'Room settings' }).click();
    assert.equal(await ben.getByRole('button', { name: 'Save a backup' }).count(), 0, 'safety alerts must have no backup, which would write them to the device');
    const inviteLink = await ben.getByLabel('Invite link').inputValue();
    assert.ok(!inviteLink.includes('horse'), 'the invite must not hold the passphrase');
    await ben.getByRole('img', { name: 'Code for the camera of a phone' }).waitFor();
    await ben.getByRole('button', { name: 'Close' }).click();
    const cy = await openMember(browser, inviteLink, 'cy');
    assert.ok(!cy.url().includes('join='), 'the invite must be removed from the address');
    await openTool(cy, 'Safety alerts');
    const inviteForm = cy.locator('form').filter({ has: cy.getByRole('button', { name: 'Open room' }) });
    assert.equal(await inviteForm.getByLabel('Group name').inputValue(), GROUP.name);
    assert.equal(await inviteForm.getByLabel('Signaling servers').inputValue(), SIGNALING_URL);
    await inviteForm.locator('input[type=password]').fill(GROUP.passphrase);
    await inviteForm.getByRole('button', { name: 'Open room' }).click();
    await cy.getByText('Broad St and Market St').waitFor({ timeout: 30_000 });

    console.log('7. A saved room comes back after a reload with the passphrase, and "clear" removes it');
    await openRoom(ana, 'Mutual aid board');
    await ana.getByRole('button', { name: 'New post' }).click();
    await ana.getByLabel('Title').fill('Ride to the clinic');
    await ana.getByRole('button', { name: 'Save' }).click();
    await ana.getByText('Ride to the clinic').waitFor();
    // The browser database writes after the change.
    await ana.waitForTimeout(500);
    await ana.reload();
    // The reload closed the old connections. Count only the connections of the new page.
    sockets.set(ana, []);
    await ana.getByRole('button', { name: 'Open room' }).waitFor();
    assert.equal(await ana.getByText('Ride to the clinic').count(), 0, 'after a reload the room is closed until the member types the passphrase');
    await openRoom(ana, 'Mutual aid board');
    await ana.getByText('Ride to the clinic').waitFor();
    assert.ok(sockets.get(ana).some((socket) => socket.open), 'a member of a room has a connection to the signaling server');

    ana.once('dialog', (dialog) => dialog.accept());
    await ana.getByRole('button', { name: 'Room settings' }).click();
    await ana.getByRole('button', { name: 'Clear from this browser' }).click();
    await ana.getByRole('button', { name: 'Open room' }).waitFor();
    const deadline = Date.now() + 10_000;
    while (sockets.get(ana).some((socket) => socket.open)) {
      assert.ok(Date.now() < deadline, 'the signaling connection is open after the member left the last room');
      await ana.waitForTimeout(200);
    }
    const left = await ana.evaluate(async () => ({
      databases: (await indexedDB.databases()).map((db) => db.name),
      memberKeys: Object.keys(localStorage).filter((key) => key.startsWith('snj.member.snj-') && key !== 'snj.member.snj-local'),
      registry: localStorage.getItem('snj.databases'),
    }));
    // The whiteboard room was open before the reload. Its database stays: the member did not clear it.
    assert.equal(left.databases.filter((name) => !['snj-local', 'snj-private'].includes(name)).length, 1, 'the database of the cleared room must be deleted');
    assert.equal(left.memberKeys.length, 1, 'the member ID of the cleared room must be deleted');
    assert.equal(JSON.parse(left.registry).length, 1, 'the cleared room must be removed from the list of databases');

    // This section is last, so the Arabic UI does not change the sections before it.
    // Its selectors do not use text: the Arabic text file can be incomplete.
    console.log('8. In Arabic the layout is right to left, with no sideways scroll, and the whiteboard does not mirror');
    const rtl = await openMember(browser, appUrl, 'rtl');
    await rtl.setViewportSize({ width: 1280, height: 800 });
    await rtl.locator('nav select:has(option[lang="ar"])').selectOption('ar');
    await rtl.waitForFunction(() => document.documentElement.dir === 'rtl');
    assert.equal(await rtl.evaluate(() => document.documentElement.lang), 'ar');
    // The sidebar slides. Measure after the slide ends.
    const settled = () => rtl.waitForFunction(() => document.getAnimations().length === 0);
    await settled();
    const sidebar = await rtl.getByRole('navigation').boundingBox();
    const content = await rtl.locator('main').boundingBox();
    assert.ok(sidebar.x >= content.x + content.width - 1, 'in Arabic the sidebar must be on the right of the main area');
    assert.ok(sidebar.x + sidebar.width <= 1280 + 1, 'in Arabic the sidebar must be inside the window');
    const pages = ['dashboard', 'phone-tree', 'family-plan', 'supply-inventory'];
    for (const [width, height] of [
      [1280, 800],
      [390, 844],
    ]) {
      await rtl.setViewportSize({ width, height });
      for (const name of pages) {
        await rtl.evaluate((hash) => {
          window.location.hash = hash;
        }, `#/${name}`);
        await rtl.locator('main h2').first().waitFor();
        await settled();
        const size = await rtl.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
        assert.ok(size.scroll <= size.client, `#/${name} at ${width} px must not scroll sideways in Arabic (${size.scroll} > ${size.client})`);
      }
    }
    await rtl.setViewportSize({ width: 1280, height: 800 });
    await rtl.evaluate(() => {
      window.location.hash = '#/whiteboard';
    });
    // The room form has two buttons of its own: "open room" and "use on this device only".
    await rtl.locator('main form > button[type=button]').click();
    const board = rtl.locator('main canvas');
    await board.scrollIntoViewIfNeeded();
    const area = await board.boundingBox();
    await rtl.mouse.move(area.x + area.width * 0.1, area.y + area.height * 0.3);
    await rtl.mouse.down();
    await rtl.mouse.move(area.x + area.width * 0.3, area.y + area.height * 0.6, { steps: 10 });
    await rtl.mouse.up();
    // The browser database writes after the change.
    await rtl.waitForTimeout(500);
    const updates = await rtl.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open('snj-local');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const all = db.transaction('updates').objectStore('updates').getAll();
            all.onsuccess = () => {
              db.close();
              resolve(all.result.map((update) => Array.from(update)));
            };
            all.onerror = () => reject(all.error);
          };
        }),
    );
    const boardDoc = new Y.Doc();
    for (const update of updates) Y.applyUpdate(boardDoc, Uint8Array.from(update));
    const strokes = [...boardDoc.getMap('strokes').values()];
    assert.equal(strokes.length, 1, 'the line drawn in Arabic must be stored');
    const xs = strokes[0].points.filter((_, index) => index % 2 === 0);
    assert.ok(xs.length > 1 && xs.every((x) => x > 0.05 && x < 0.5), `a line in the left third must be stored on the left (${xs.join(', ')})`);
    await rtl.locator('nav select').selectOption('en');
    await rtl.waitForFunction(() => document.documentElement.dir === 'ltr');

    assert.deepEqual(problems, [], 'the browser reported problems');
    console.log('Smoke test passed.');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.httpServer.close(resolve));
    signaling.kill();
  }
}

main().catch((error) => {
  console.error(error);
  if (problems.length > 0) console.error('Browser problems:\n' + problems.join('\n'));
  process.exit(1);
});

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
 * - "leave and delete" keeps the connection open or keeps data on the device,
 * - the app does not open with no connection after the first visit,
 * - "erase all data" leaves a database, a stored value, a cached file, or a
 *   service worker in the browser,
 * - an invite link holds the passphrase or does not fill in the space.
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

const APP_PORT = 4173;
const SIGNALING_PORT = 4444;
const SIGNALING_URL = `ws://127.0.0.1:${SIGNALING_PORT}`;
const SPACE = { name: 'Smoke test', passphrase: 'correct horse battery staple smoke' };

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

async function joinSpace(page, passphrase) {
  await page.getByRole('button', { name: 'Create or join a space' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Space name').fill(SPACE.name);
  await dialog.locator('input[type=password]').fill(passphrase);
  await dialog.getByLabel('Signaling servers').fill(SIGNALING_URL);
  await dialog.getByRole('button', { name: 'Open the space' }).click();
  await page.getByRole('heading', { name: /^Space: Smoke test/ }).waitFor();
}

async function openTool(page, name) {
  await page.getByRole('navigation').getByRole('button', { name }).click();
  await page.getByRole('heading', { name, level: 2 }).waitFor();
}

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
    console.log('1. Local mode: data stays on the device and survives a reload');
    const solo = await openMember(browser, appUrl, 'solo');
    await openTool(solo, 'Safety alerts');
    await solo.getByRole('button', { name: 'Report activity' }).click();
    await solo.getByLabel('Location').fill('Local only street');
    await solo.getByRole('button', { name: 'Send the report' }).click();
    await solo.getByText('Local only street').waitFor();
    await solo.reload();
    await openTool(solo, 'Safety alerts');
    await solo.getByText('Local only street').waitFor();

    console.log('1b. The app opens with no connection after the first visit');
    await solo.evaluate(() => navigator.serviceWorker.ready);
    await solo.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await solo.context().setOffline(true);
    await solo.reload();
    await openTool(solo, 'Safety alerts');
    await solo.getByText('Local only street').waitFor();
    await solo.context().setOffline(false);

    console.log('1c. The language switch changes the text and is saved');
    await solo.getByLabel('Language').selectOption('es');
    await solo.getByRole('heading', { name: 'Alertas de seguridad', level: 2 }).waitFor();
    assert.equal(await solo.evaluate(() => document.documentElement.lang), 'es');
    await solo.reload();
    await solo.getByRole('navigation').getByRole('button', { name: 'Alertas de seguridad' }).waitFor();
    await solo.getByLabel('Idioma').selectOption('en');
    await solo.getByRole('heading', { name: 'Tools for local resilience' }).waitFor();

    console.log('1d. "Erase all data" removes the data, the offline copy, and the service worker');
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
    assert.deepEqual(erased, { databases: [], local: [], session: [], caches: [], workers: 0 }, 'erase must leave nothing in the browser');

    console.log('2. Two members join one space and sync over WebRTC');
    const ana = await openMember(browser, appUrl, 'ana');
    const ben = await openMember(browser, appUrl, 'ben');
    await joinSpace(ana, SPACE.passphrase);
    await joinSpace(ben, SPACE.passphrase);
    await ana.getByRole('heading', { name: /peers: 1/ }).waitFor({ timeout: 30_000 });

    await openTool(ana, 'Safety alerts');
    await openTool(ben, 'Safety alerts');
    await ana.getByRole('button', { name: 'Report activity' }).click();
    await ana.getByLabel('Location').fill('Broad St and Market St');
    await ana.getByLabel('Activity', { exact: true }).fill('Two vehicles stop cars');
    await ana.getByRole('button', { name: 'Send the report' }).click();
    await ben.getByText('Broad St and Market St').waitFor({ timeout: 15_000 });
    assert.equal(await ben.getByText('Local only street').count(), 0, 'local data must not go into the space');

    for (const page of [ana, ben]) {
      const seen = await page.evaluate(() => window.iceServersSeen);
      assert.ok(seen.length > 0, 'the members must connect over WebRTC');
      assert.deepEqual(seen.filter((servers) => servers.length !== 0), [], 'a build with no STUN server must contact no STUN server');
    }

    console.log('3. A confirmation from the second member reaches the reporter');
    await ana.getByText('Not confirmed: one report only').waitFor();
    assert.ok(await ana.getByRole('button', { name: 'I see it too' }).isDisabled(), 'a reporter cannot confirm their own report');
    await ben.getByRole('button', { name: 'I see it too' }).click();
    await ana.getByText('Confirmed by other members: 1').waitFor({ timeout: 15_000 });

    console.log('4. A member with the wrong passphrase gets a different, empty space');
    const eve = await openMember(browser, appUrl, 'eve');
    await joinSpace(eve, 'a wrong passphrase for this space');
    await openTool(eve, 'Safety alerts');
    await eve.waitForTimeout(5_000);
    assert.equal(await eve.getByText('Broad St and Market St').count(), 0, 'a wrong passphrase must not show the data');
    await eve.getByText('No reports').waitFor();

    console.log('5. The whiteboard syncs a line');
    await openTool(ana, 'Whiteboard');
    await openTool(ben, 'Whiteboard');
    const box = await ana.getByLabel('Drawing surface').boundingBox();
    await ana.mouse.move(box.x + 50, box.y + 50);
    await ana.mouse.down();
    await ana.mouse.move(box.x + 200, box.y + 120, { steps: 10 });
    await ana.mouse.up();
    await ben.getByRole('button', { name: 'Clear the board' }).and(ben.locator(':enabled')).waitFor({ timeout: 15_000 });

    console.log('6. The exported event page opens with no network and decrypts');
    await openTool(ana, 'Event coordinator');
    await ana.getByLabel('Event title').fill('Know your rights night');
    await ana.getByLabel('Date and time').fill('Tuesday, 6 PM');
    await ana.getByLabel('Location').fill('Library, room 2');
    await ana.locator('form input[type=password]').fill('event passphrase for smoke');
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
    await viewer.getByPlaceholder('Passphrase').fill('event passphrase for smoke');
    await viewer.getByRole('button', { name: 'Unlock' }).click();
    await viewer.getByRole('heading', { name: 'Know your rights night' }).waitFor({ timeout: 15_000 });

    console.log('6b. An invite link fills in the space, and the new member needs only the passphrase');
    await ben.getByRole('navigation').getByRole('button', { name: /Smoke test/ }).click();
    const inviteLink = await ben.getByLabel('Invite link').inputValue();
    assert.ok(!inviteLink.includes(encodeURIComponent(SPACE.passphrase)) && !inviteLink.includes('horse'), 'the invite must not hold the passphrase');
    await ben.getByRole('img', { name: 'Code for the camera of a phone' }).waitFor();
    await ben.getByRole('button', { name: 'Close' }).click();
    const cy = await openMember(browser, inviteLink, 'cy');
    const inviteDialog = cy.getByRole('dialog');
    assert.equal(await inviteDialog.getByLabel('Space name').inputValue(), SPACE.name);
    assert.equal(await inviteDialog.getByLabel('Signaling servers').inputValue(), SIGNALING_URL);
    assert.ok(!cy.url().includes('join='), 'the invite must be removed from the address');
    await inviteDialog.locator('input[type=password]').fill(SPACE.passphrase);
    await inviteDialog.getByRole('button', { name: 'Open the space' }).click();
    await openTool(cy, 'Safety alerts');
    await cy.getByText('Broad St and Market St').waitFor({ timeout: 30_000 });

    console.log('7. Leave and delete: the connection closes and the device keeps no data of the space');
    assert.ok(sockets.get(ana).some((socket) => socket.open), 'a member of a space has a connection to the signaling server');
    await ana.getByRole('navigation').getByRole('button', { name: /Smoke test/ }).click();
    await ana.getByRole('button', { name: 'Leave the space' }).click();
    await ana.getByRole('heading', { name: 'You work on this device only' }).waitFor();
    const deadline = Date.now() + 10_000;
    while (sockets.get(ana).some((socket) => socket.open)) {
      assert.ok(Date.now() < deadline, 'the signaling connection is open after the member left');
      await ana.waitForTimeout(200);
    }
    const left = await ana.evaluate(async () => ({
      databases: (await indexedDB.databases()).map((db) => db.name),
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    }));
    assert.deepEqual(left.databases.filter((name) => !['snj-local', 'snj-private'].includes(name)), [], 'the space database must be deleted');
    assert.deepEqual(left.local.filter((key) => key !== 'snj.member.snj-local'), [], 'the member ID and the name of the space must be deleted');
    assert.deepEqual(left.session, [], 'the passphrase must be deleted');
    // Ben is still connected to Cy only.
    await ben.getByRole('navigation').getByText('Connected peers: 1').waitFor({ timeout: 40_000 });

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

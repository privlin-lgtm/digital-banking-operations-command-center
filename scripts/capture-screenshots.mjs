#!/usr/bin/env node
/**
 * Portfolio capture script for the README: a fixed set of PNG screenshots
 * plus one silent walkthrough of the main incident flow. Re-runnable from
 * a clean checkout once the stack is up and seeded (see docs/screenshots
 * section of the README for the exact sequence).
 *
 * Requires the web app, API, and a seeded database already running —
 * this script only drives a browser against them, it doesn't start or
 * seed anything itself.
 *
 * Usage: node scripts/capture-screenshots.mjs [--video-only|--screenshots-only]
 * Env:   WEB_URL (default http://localhost:3000)
 *        API_DOCS_URL (default http://localhost:4000/api/v1/docs)
 *        SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (default the seed.ts operator)
 */

import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCREENSHOT_DIR = path.join(ROOT, 'docs', 'screenshots');
const VIDEO_TMP_DIR = path.join(ROOT, 'docs', '.video-tmp');
const VIDEO_OUT = path.join(ROOT, 'docs', 'walkthrough.mp4');

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';
const API_DOCS_URL = process.env.API_DOCS_URL ?? 'http://localhost:4000/api/v1/docs';
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'oscar.d@example.net';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!Admin1';

const VIEWPORT = { width: 1440, height: 900 };

const args = new Set(process.argv.slice(2));
const doScreenshots = !args.has('--video-only');
const doVideo = !args.has('--screenshots-only');

// Dark theme throughout — it's the app's only theme (no light/dark toggle
// exists), so "pick one and use it everywhere" is decided for us.
const SCREENS = [
  {
    name: 'incident-command',
    path: '/overview',
    waitFor: 'text=ACTIVE INCIDENTS',
    why: 'The landing screen after login: open incidents, firing alerts, service health, and severity mix in one view — the actual command view an operator works from.',
  },
  {
    name: 'incident-triage-queue',
    path: '/incidents',
    waitFor: 'table tbody tr',
    why: 'The full incident backlog (57 rows of real seeded history) with severity/status/commander columns — shows this is a working queue, not a mockup with three rows.',
  },
  {
    name: 'sla-error-budget',
    path: '/sla',
    waitFor: 'table tbody tr',
    why: 'Real breach data against target: actual-vs-target percentages and a visual budget bar, not just a green checkmark.',
  },
  {
    name: 'runbook-catalog',
    path: '/runbooks',
    waitFor: 'table tbody tr',
    why: 'Eleven approved response procedures with their trigger conditions — shows the platform ties automation to specific, readable thresholds.',
  },
  {
    name: 'service-fleet-health',
    path: '/services',
    waitFor: 'table tbody tr',
    why: 'The 12-service catalog with tier and ownership — the fleet this whole platform exists to operate, at a glance.',
  },
];

async function login(page) {
  await page.goto(WEB_URL, { waitUntil: 'networkidle' });
  const emailField = page.getByLabel('Email');
  await emailField.fill('');
  await emailField.fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/overview', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

async function shoot(page, dir, screen) {
  await page.goto(`${WEB_URL}${screen.path}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(screen.waitFor, { timeout: 15000 });
  await page.waitForTimeout(300); // let any post-mount transition settle
  const file = path.join(dir, `${screen.name}.png`);
  await page.screenshot({ path: file });
  return file;
}

async function captureScreenshots(browser) {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: 'dark' });
  const page = await context.newPage();

  await login(page);

  const written = [];
  for (const screen of SCREENS) {
    written.push(await shoot(page, SCREENSHOT_DIR, screen));
  }

  await page.goto(API_DOCS_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=BankOps Control Center API', { timeout: 15000 });
  await page.waitForTimeout(300);
  const swaggerFile = path.join(SCREENSHOT_DIR, 'api-reference.png');
  await page.screenshot({ path: swaggerFile });
  written.push(swaggerFile);

  await context.close();
  return written;
}

async function captureWalkthrough(browser) {
  await mkdir(VIDEO_TMP_DIR, { recursive: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: 'dark',
    recordVideo: { dir: VIDEO_TMP_DIR, size: VIEWPORT },
  });
  const page = await context.newPage();

  await page.waitForTimeout(2000); // let the viewer read the sign-in screen
  await login(page);
  await page.waitForTimeout(8000); // command overview

  await page.getByRole('link', { name: 'Incidents' }).click();
  await page.waitForSelector('table tbody tr');
  await page.waitForTimeout(7000); // full triage queue

  // Narrow to P2s an operator would triage first — the seeded queue has
  // real P2 rows (closed and the one active ACK), so this never empties out.
  await page.getByRole('combobox').nth(1).selectOption('P2');
  await page.waitForSelector('table tbody tr');
  await page.waitForTimeout(6000);
  await page.getByRole('combobox').nth(1).selectOption('');
  await page.waitForTimeout(2000);

  await page.getByRole('link', { name: 'Alerts' }).click();
  await page.waitForSelector('table tbody tr');
  await page.waitForTimeout(7000);

  await page.getByRole('link', { name: 'SLA' }).click();
  await page.waitForSelector('table tbody tr');
  await page.waitForTimeout(7000);

  await page.getByRole('link', { name: 'Runbooks' }).click();
  await page.waitForSelector('table tbody tr');
  await page.waitForTimeout(7000);

  await page.getByRole('link', { name: 'Services' }).click();
  await page.waitForSelector('table tbody tr');
  await page.waitForTimeout(7000);

  await page.getByRole('link', { name: 'Overview' }).click();
  await page.waitForSelector('text=ACTIVE INCIDENTS');
  await page.waitForTimeout(5000);

  const video = page.video();
  await context.close();
  const rawPath = await video.path();

  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    rawPath,
    '-vf',
    'fps=12,scale=1280:-2',
    '-vcodec',
    'libx264',
    '-crf',
    '32',
    '-preset',
    'veryslow',
    '-an',
    '-movflags',
    '+faststart',
    VIDEO_OUT,
  ]);

  await rm(VIDEO_TMP_DIR, { recursive: true, force: true });
  const { size } = await stat(VIDEO_OUT);
  return { file: VIDEO_OUT, sizeMB: (size / (1024 * 1024)).toFixed(2) };
}

async function main() {
  const browser = await chromium.launch();
  try {
    if (doScreenshots) {
      const files = await captureScreenshots(browser);
      console.log('Screenshots written:');
      for (const f of files) console.log(`  ${path.relative(ROOT, f)}`);
    }
    if (doVideo) {
      const { file, sizeMB } = await captureWalkthrough(browser);
      console.log(`Walkthrough written: ${path.relative(ROOT, file)} (${sizeMB} MB)`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

#!/usr/bin/env node
/**
 * Optional local analytics collector for RoastLord launch testing.
 * Run: node scripts/analytics-collector.js
 * Set in index.html or local-dev-key.js: window.RL_ANALYTICS_URL = 'http://localhost:8787/event';
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8787;
const LOG = path.join(__dirname, '..', 'analytics-events.jsonl');
const SUMMARY = path.join(__dirname, '..', 'analytics-summary.json');

function loadSummary() {
  try {
    return JSON.parse(fs.readFileSync(SUMMARY, 'utf8'));
  } catch {
    return { days: {}, totalEvents: 0 };
  }
}

function saveSummary(s) {
  fs.writeFileSync(SUMMARY, JSON.stringify(s, null, 2));
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loadSummary(), null, 2));
    return;
  }

  if (req.method === 'POST' && req.url === '/event') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try {
        const evt = JSON.parse(body);
        fs.appendFileSync(LOG, body.trim() + '\n');
        const summary = loadSummary();
        summary.totalEvents += 1;
        const day = evt.day || new Date().toISOString().slice(0, 10);
        if (!summary.days[day]) {
          summary.days[day] = { sessions: 0, roasts: 0, shares: 0, referrals: 0, devices: [] };
        }
        const d = summary.days[day];
        if (evt.deviceId && !d.devices.includes(evt.deviceId)) {
          d.devices.push(evt.deviceId);
          if (evt.event === 'session') d.sessions += 1;
        }
        if (evt.event === 'roast') d.roasts += 1;
        if (evt.event === 'share') d.shares += 1;
        if (evt.event === 'referral' || evt.event === 'referral_join') d.referrals += 1;
        saveSummary(summary);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`[analytics] collector http://localhost:${PORT}/event`);
  console.log(`[analytics] stats    http://localhost:${PORT}/stats`);
});
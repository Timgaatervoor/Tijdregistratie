import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MobileModeProvider, useMobileMode } from '../src/hooks/useMobileMode';
import { StartStationView } from '../src/components/views/StartStationView';
import { FinishStationView } from '../src/components/views/FinishStationView';
import { ShootingStationView } from '../src/components/views/ShootingStationView';

function withStorage(values: Record<string, string>, action: () => void, unavailable = false) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => { if (unavailable) throw new Error('Storage blocked'); return values[key] ?? null; } },
  });
  try { action(); } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

test('mobile preferences migrate shooting mode and tolerate missing, malformed or blocked storage', () => {
  const cases = [
    { values: {}, expected: { start: false, shooting: false, finish: false } },
    { values: { shooting_simple_mode: 'true' }, expected: { start: false, shooting: true, finish: false } },
    { values: { station_mobile_modes: '{broken' }, expected: { start: false, shooting: false, finish: false } },
    { values: { station_mobile_modes: '{"start":true,"shooting":"true","finish":true}' }, expected: { start: true, shooting: false, finish: true } },
    { values: { shooting_simple_mode: 'true', station_mobile_modes: '{"start":false,"shooting":false,"finish":false}' }, expected: { start: false, shooting: false, finish: false } },
  ];
  for (const { values, expected } of cases) {
    withStorage(values, () => {
      function Probe() { assert.deepEqual(useMobileMode().modes, expected); return null; }
      renderToStaticMarkup(React.createElement(MobileModeProvider, null, React.createElement(Probe)));
    });
  }
  withStorage({}, () => {
    function Probe() { assert.deepEqual(useMobileMode().modes, { start: false, shooting: false, finish: false }); return null; }
    renderToStaticMarkup(React.createElement(MobileModeProvider, null, React.createElement(Probe)));
  }, true);
});

test('all three stations render the saved phone view and keep an exit available without race data', () => {
  withStorage({ station_mobile_modes: '{"start":true,"shooting":true,"finish":true}' }, () => {
    const common = { categories: [], participants: [], event: null, onRefresh() {} };
    const views = [
      React.createElement(StartStationView, { ...common, waves: [], timingRecords: [] }),
      React.createElement(FinishStationView, { ...common, waves: [], timingRecords: [] }),
      React.createElement(ShootingStationView, { ...common, shootingResults: [], raceProfiles: [] }),
    ];
    for (const [index, view] of views.entries()) {
      const html = renderToStaticMarkup(React.createElement(MobileModeProvider, null, view));
      assert.ok(html.includes(`aria-label="Gsm-modus ${['Start', 'Finish', 'Schieten'][index]}"`));
      assert.ok(html.includes('Gewone weergave'));
      if (index === 0) assert.match(html, /Geen startgroepen/);
      if (index === 1) {
        assert.match(html, /Finish nu vastleggen/);
        assert.match(html, /Noodtijd: onbekende loper/);
      }
    }
  });
});

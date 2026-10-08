'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function element() {
  const attrs = {}, handlers = {}, classes = new Set();
  return {
    attrs, dataset: {}, textContent: '', innerHTML: '',
    classList: {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      contains: name => classes.has(name),
      toggle(name, force) {
        if (force === undefined ? !classes.has(name) : force) classes.add(name);
        else classes.delete(name);
      }
    },
    setAttribute(name, value) { attrs[name] = String(value); },
    getAttribute(name) { return attrs[name] ?? null; },
    addEventListener(name, handler) { (handlers[name] ||= []).push(handler); },
    dispatch(name, event = {}) { for (const fn of handlers[name] || []) fn(event); },
    focus() { this.focusCount = (this.focusCount || 0) + 1; },
    scrollIntoView() { this.scrollCount = (this.scrollCount || 0) + 1; },
    querySelector() { return null; }
  };
}

function setupApp(hash = '#home') {
  const app = element(), header = element(), menu = element();
  const nav = element(), firstLink = element(), skipLink = element();
  const documentHandlers = {};
  const ids = { app, siteHeader: header, menuButton: menu, mainNav: nav };
  nav.querySelector = () => firstLink;
  const plan = new Set();
  const EB = {
    pages: {
      home: () => '<h1>Home</h1>', events: () => '<h1>Events</h1>',
      details: () => '<h1>Details</h1>', sell: () => '<h1>Sell</h1>',
      insights: () => '<h1>Insights</h1>', notFound: () => '<h1>404</h1>'
    },
    events: [], testimonials: [],
    storage: {
      togglePlan(id) {
        if (plan.has(id)) { plan.delete(id); return false; }
        plan.add(id); return true;
      }
    },
    ui: { updateFavoriteCount() {}, showToast() {} }
  };
  const win = {
    EventBoard: EB, location: { hash, href: 'http://localhost:8000/' + hash },
    scrollTo() {}, scrollY: 0, addEventListener() {}
  };
  const doc = {
    getElementById: id => ids[id] || null,
    querySelector: selector => selector === '.skip-link' ? skipLink : null,
    querySelectorAll: () => [],
    addEventListener(name, handler) { (documentHandlers[name] ||= []).push(handler); }
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, 'js/app.js'), 'utf8'),
    { window: win, document: doc, navigator: {}, URLSearchParams, FormData,
      setInterval: () => 1, clearInterval() {} },
    { filename: 'js/app.js' }
  );
  function documentEvent(name, event) {
    for (const handler of documentHandlers[name] || []) handler(event);
  }
  return { app, menu, nav, firstLink, skipLink, win, plan, documentEvent };
}

test('mobile menu opens with correct ARIA and keyboard focus', () => {
  const { menu, nav, firstLink } = setupApp();
  menu.dispatch('click');
  assert.equal(nav.classList.contains('open'), true);
  assert.equal(menu.getAttribute('aria-expanded'), 'true');
  assert.equal(menu.getAttribute('aria-label'), 'إغلاق القائمة');
  assert.equal(firstLink.focusCount, 1);
});

test('Escape closes menu and restores focus to its button', () => {
  const { menu, nav, documentEvent } = setupApp();
  menu.dispatch('click');
  documentEvent('keydown', { key: 'Escape' });
  assert.equal(nav.classList.contains('open'), false);
  assert.equal(menu.getAttribute('aria-expanded'), 'false');
  assert.equal(menu.getAttribute('aria-label'), 'فتح القائمة');
  assert.equal(menu.focusCount, 1);
});

test('skip link focuses main without navigating to #app or 404', () => {
  const { app, skipLink, win } = setupApp('#events');
  let prevented = false;
  skipLink.dispatch('click', { preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(win.location.hash, '#events');
  assert.equal(app.focusCount, 2);
  assert.equal(app.scrollCount, 1);
  assert.notEqual(app.innerHTML, '<h1>404</h1>');
});

test('plan toggle updates ARIA on add and remove', () => {
  const { documentEvent, plan } = setupApp();
  const button = element();
  button.dataset = { action: 'toggle-plan', eventId: '7' };
  const click = { target: { closest: () => button } };
  documentEvent('click', click);
  assert.equal(plan.has(7), true);
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(button.getAttribute('aria-label'), 'إزالة الفعالية من خطتي');
  documentEvent('click', click);
  assert.equal(plan.has(7), false);
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(button.getAttribute('aria-label'), 'إضافة الفعالية إلى خطتي');
});

test('event details initialize plan ARIA from saved state', () => {
  const event = {
    id: 7, slug: 'example', category: 'فن', eventType: 'ورشة',
    title: 'فعالية', summary: 'ملخص', description: 'تفاصيل',
    image: 'image.webp', dateLabel: 'غدًا', time: '10:00',
    venue: 'المدينة', price: 'مجاني', audience: 'الكل',
    format: 'حضوري', organizer: 'المنظم', distance: 'قريب', highlights: []
  };
  const saved = new Set([7]);
  const EB = {
    pages: {}, events: [event], storage: { getPlans: () => [...saved] },
    analytics: { metricsFor: () => ({ plans: 1, views: 3 }) }
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, 'js/pages/details.js'), 'utf8'),
    { window: { EventBoard: EB } }
  );
  const selected = EB.pages.details('example');
  assert.match(selected, /aria-pressed="true"/);
  assert.match(selected, /aria-label="إزالة الفعالية من خطتي"/);
  saved.clear();
  const unselected = EB.pages.details('example');
  assert.match(unselected, /aria-pressed="false"/);
  assert.match(unselected, /aria-label="إضافة الفعالية إلى خطتي"/);
});

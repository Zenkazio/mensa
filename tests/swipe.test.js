import { dietaryCategory, mealTitleCodes, matchesMealFilters, cleanMealName } from '../meal-filters.js';

const output = document.querySelector('#output');
const frame = document.querySelector('#preview');
const wait = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));
function assert(condition, label) {
  if (!condition) throw new Error(label);
}
function pass(label) { output.textContent += `\nPASS: ${label}`; }
const doc = () => frame.contentDocument;
const win = () => frame.contentWindow;
async function ready() {
  for (let i = 0; i < 300; i++) {
    if (doc()?.querySelector('.cafeteria-chip') &&
        doc().querySelector('#menus')?.getAttribute('aria-busy') === 'false') return;
    await wait();
  }
  throw Error('Menus did not finish loading');
}

try {
  assert(cleanMealName({ name: 'Feurige Pilzpfanne (A, D), dazu Couscous' }) === 'Feurige Pilzpfanne, dazu Couscous',
    'Removing allergen codes preserves punctuation spacing');
  assert([...mealTitleCodes({ name: 'Pasta (A, A1, D) (2; 27) (A) (Z9)' })].join(',') === 'A,A1,D,2,27,Z9',
    'Code parser deduplicates complete letter/numeric lists and supports unknown provider codes');
  assert(!mealTitleCodes({ name: 'Vitamin A mit Reis (200 g) (nach Wahl) (-) ()' }).size,
    'Code parser ignores prose, quantities, empty lists and uncoded letters');
  assert(!mealTitleCodes({ name: null }).size, 'Missing title is safe');
  assert(dietaryCategory({ notes: ['Menü ist vegetarisch', 'Menü ist vegan'] }) === 'vegan',
    'Vegan classification takes priority');
  assert(dietaryCategory({ notes: [' Menü ist vegetarisch '] }) === 'vegetarian' &&
    dietaryCategory({ notes: [null, 'Menü ist vegan möglich'] }) === 'meat', 'Exact provider dietary labels only');
  assert(matchesMealFilters({ name: 'Pasta (A1)', notes: ['Menü ist vegan'] }, new Set(['vegan']), new Set(['A'])),
    'Pure filter uses whole codes, not substrings');
  pass('Provider classification and title-code parser boundary cases');

  const [html, css] = await Promise.all([
    fetch('../index.html').then((response) => response.text()),
    fetch('../styles.css').then((response) => response.text())
  ]);
  const fixtures = `
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Linux; Android 14)', configurable: true });
    const NativeDate = window.Date;
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : ['2026-10-22T10:00:00Z'])); }
      static now() { return new NativeDate('2026-10-22T10:00:00Z').getTime(); }
    };
    Object.defineProperty(window, 'localStorage', { value: {
      getItem() { return '[2]'; }, setItem() {}
    }});
    window.testRequests = [];
    window.fetch = async (url) => {
      window.testRequests.push(url);
      const meal = (id) => ({
        id, name: id === 1 ? 'Long meal description '.repeat(100) : 'Meal ' + id,
        notes: ['Menü ist vegan', ...Array(30).fill('Allergen note')],
        category: 'Tagesgericht', prices: {Studierende: 2.35, Bedienstete: 4.9}
      });
      const evening = (id, vegan) => ({
        ...meal(id), name: 'Abendangebot: Meal ' + id + ({90:' (A, A1, 2)',91:' (D)',92:' (A1, G)'}[id] || ''),
        notes: vegan ? ['Menü ist vegan'] : []
      });
      const data = url.endsWith('/canteens')
        ? [{id:1,name:'Selected A',address:'Bergstraße 51, 01069 Dresden'},{id:2,name:'Hidden B'},{id:3,name:'Selected C'}]
        : url.includes('/canteens/1/') ? [
          meal(1),meal(2),meal(3),meal(4),{...evening(90,true),notes:['Menü ist vegan','Glutenhaltiges Getreide (A)','Weizen (A1)','mit Konservierungsstoff (2)']},
          {...evening(91,false),notes:[null,42,'Menü ist vegan möglich']},
          {...evening(92,false),notes:[' Menü ist vegetarisch ']}
        ] : [meal(5)];
      return new Response(JSON.stringify(data), {status:200,headers:{'Content-Type':'application/json'}});
    };
  `;
  const load = async (fixture = fixtures) => {
    const previous = doc();
    frame.srcdoc = html.replace('<head>', `<head><base href="${new URL('../', location.href)}"><script>${fixture}<\/script>`)
      .replace('<link rel="stylesheet" href="./styles.css">', `<style>${css.replace(/^@import.*$/m, '')}</style>`);
    for (let i = 0; i < 300; i++) {
      if (doc() !== previous && doc()?.querySelector('.cafeteria-chip')) {
        await ready();
        return;
      }
      await wait();
    }
    throw Error('App did not initialize');
  };
  await load();
  assert(doc().querySelector('#results-summary')?.textContent.includes('Gerichte'), 'App initialized in Tom-View');
  assert(!doc().querySelector('#meal-picker') && !doc().querySelector('#meal-slot'), 'Removed dialogs stay gone');
  assert(doc().querySelectorAll('#menus .meal-card').length === 5, 'Five midday meals are shown in the continuous view');
  assert(doc().querySelectorAll('.day-button').length === 5, 'Mobile shows five date tabs');
  const todayTab = doc().querySelector('.day-button.is-today');
  const accentProbe = doc().createElement('span');
  accentProbe.style.color = 'var(--accent)';
  doc().body.append(accentProbe);
  assert(todayTab.getAttribute('aria-pressed') === 'true' &&
    win().getComputedStyle(todayTab).borderTopColor === win().getComputedStyle(accentProbe).color,
    'Today uses the active theme accent border even when selected');
  accentProbe.remove();
  assert(!win().testRequests.some((url) => url.includes('/canteens/2/')), 'Hidden cafeteria excluded');
  pass('Default Tom-View, hidden cafeteria and mobile weekday strip');

  const content = doc().querySelector('.meal-content');
  assert(win().getComputedStyle(content).overflowY === 'hidden', 'Browse cards are not scroll containers');
  assert(content.scrollHeight <= content.clientHeight + 1, 'Preview fits inside card');
  const previewCard = doc().querySelector('#menus .meal-preview');
  previewCard.focus();
  previewCard.dispatchEvent(new (win()).KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  const detail = doc().querySelector('.picker-detail');
  assert(detail.open && detail.querySelector('.meal-name').textContent.length > 1000, 'Full description accessible');
  assert(detail.querySelectorAll('li').length === 31, 'All notes accessible');
  for (const [width, height] of [[600, 900], [1200, 400]]) {
    const image = doc().createElement('img');
    image.alt = 'Test meal';
    image.src = 'data:image/svg+xml,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#A0D7B8"/></svg>`
    );
    detail.querySelector('.meal-photo').replaceChildren(image);
    await image.decode();
    const rect = image.getBoundingClientRect();
    assert(Math.abs(rect.width / rect.height - width / height) < .01, 'Full photo preserves natural aspect ratio');
    assert(Math.abs(detail.querySelector('.meal-photo').getBoundingClientRect().height - rect.height) < 1, 'Full photo is not cropped by its container');
    assert(win().getComputedStyle(image).transform === 'none', 'Details photo has no cropping hover zoom');
  }
  detail.querySelector('button').click();
  await wait();
  for (const target of [previewCard.querySelector('.meal-photo'), previewCard.querySelector('.meal-name'), previewCard]) {
    target.click();
    assert(detail.open, 'Photo, text and card background open the details popup');
    detail.querySelector('.picker-close').click();
  }
  pass('Full uncropped portrait/landscape photos; card-wide and keyboard details access');

  const requestCount = win().testRequests.length;
  assert(previewCard.querySelector('.selected-price').textContent.includes('2,35'), 'Student price selected by default');
  doc().querySelector('input[name="price-category"][value="employee"]').click();
  assert([...doc().querySelectorAll('#menus .meal-prices')].every((price) =>
    price.children.length === 1 && price.textContent.includes('4,90') && price.textContent.includes('Bediensteter')
  ), 'Only employee price shown on each meal');
  doc().querySelector('input[name="price-category"][value="guest"]').click();
  assert([...doc().querySelectorAll('#menus .meal-prices')].every((price) =>
    price.textContent === 'Keine Preisangabe'
  ), 'Missing guest price does not fall back to another category');
  assert(win().testRequests.length === requestCount, 'Price changes require no API requests');
  doc().querySelector('input[name="price-category"][value="employee"]').click();
  pass('Exclusive category prices, missing-price state and no extra API requests');

  const eveningSwitch = doc().querySelector('#evening-switch');
  eveningSwitch.checked = true;
  eveningSwitch.dispatchEvent(new (win()).Event('change'));
  await ready();
  const eveningName = (id) => `Abendangebot: Meal ${id}${{90:' (A, A1, 2)',91:' (D)',92:' (A1, G)'}[id]}`.replace(/\s*\([^()]*\)/g, '').trim();
  assert(doc().querySelectorAll('#menus .meal-name').length === 3, 'Evening switch shows only evening meals');
  assert(doc().querySelector('.meal-name').textContent === eveningName(90), 'Tom-View contains evening dish');
  const veganBadge = doc().querySelector('.diet-badge:not(.vegetarian)');
  const vegetarianBadge = doc().querySelector('.diet-badge.vegetarian');
  assert(veganBadge?.getAttribute('aria-label') === 'Vegan' && veganBadge.querySelector('svg') &&
    veganBadge.textContent.trim() === '', 'Vegan card uses a compact icon-only badge');
  assert(vegetarianBadge?.getAttribute('aria-label') === 'Vegetarisch' && vegetarianBadge.querySelector('svg') &&
    vegetarianBadge.textContent.trim() === '', 'Vegetarian card uses a compact icon-only badge');
  assert(veganBadge.getBoundingClientRect().width <= 22 && vegetarianBadge.getBoundingClientRect().width <= 22,
    'Dietary badges stay small');
  assert(doc().querySelectorAll('#dietary-filter input:checked').length === 3, 'All three meal groups selected initially');
  assert(doc().querySelectorAll('#dietary-filter input[type="checkbox"] + span svg[aria-hidden="true"]').length === 3,
    'Each independently selectable meal group has a decorative icon');
  for (const input of doc().querySelectorAll('#dietary-filter input')) {
    assert(input.nextElementSibling.textContent.trim() === '', 'Dietary buttons display symbols only');
    assert(input.getAttribute('aria-label') === input.parentElement.title, 'Icon-only controls retain accessible names and tooltips');
  }
  const requestsBeforeDietChanges = win().testRequests.length;
  const diets = [
    [[], []], [['meat'], [91]], [['vegetarian'], [92]], [['vegan'], [90]],
    [['meat','vegetarian'], [91,92]], [['meat','vegan'], [90,91]],
    [['vegetarian','vegan'], [90,92]], [['meat','vegetarian','vegan'], [90,91,92]]
  ];
  for (const [selected, ids] of diets) {
    for (const input of doc().querySelectorAll('#dietary-filter input')) {
      if (input.checked !== selected.includes(input.value)) input.click();
    }
    await ready();
    const mode = selected.join('/') || 'none';
    const names = [...doc().querySelectorAll('#menus .meal-name')].map((name) => name.textContent);
    assert(JSON.stringify(names) === JSON.stringify(ids.map(eveningName)), `Diet ${mode} filters the browser correctly`);
    assert(doc().querySelector('#evening-switch').checked, `Diet ${mode} preserves evening filter`);
    assert(doc().querySelector('input[name="price-category"]:checked').value === 'employee', `Diet ${mode} preserves price category`);
    if (!ids.length) {
      assert(doc().querySelector('#menus .message'), 'Empty selection shows a clear message');
      assert(!doc().querySelector('#dietary-filter input:checked'), 'Empty selection is not silently reset');
    }
  }
  assert(win().testRequests.length === requestsBeforeDietChanges, 'All dietary modes reuse cached raw menus');
  doc().querySelector('.filter-panel').open = true;
  const chooseCode = async (code) => {
    const input = doc().querySelector(`#additive-options input[data-code="${code}"]`);
    assert(input, `Code ${code} offered`);
    input.focus();
    input.click();
    await ready();
    assert(doc().activeElement.dataset.code === code, 'Code selection retains keyboard focus');
  };
  const currentNames = () => [...doc().querySelectorAll('#menus .meal-name')].map((node) => node.textContent);
  assert(doc().querySelector('#additive-options input[data-code="A"]').parentElement.textContent.includes('Glutenhaltiges Getreide'),
    'Code descriptions come from provider notes');
  await chooseCode('A');
  assert(JSON.stringify(currentNames()) === JSON.stringify([91,92].map(eveningName)), 'A exclusion does not match A1 by substring');
  await chooseCode('D');
  assert(JSON.stringify(currentNames()) === JSON.stringify([eveningName(92)]), 'Multiple code exclusions combine');
  await chooseCode('A1');
  assert(doc().querySelector('#menus .message'), 'All excluded meals show the empty state');
  doc().querySelector('#clear-additives').click();
  await ready();
  assert(currentNames().length === 3, 'Reset restores all meals');
  await chooseCode('2');
  assert(JSON.stringify(currentNames()) === JSON.stringify([91,92].map(eveningName)), 'Numeric additive codes supported');
  doc().querySelector('.cafeteria-chip[data-id="1"]').click();
  await ready();
  assert(doc().querySelector('#additive-options input[data-code="2"]').checked, 'Excluded code retained when cafeteria is hidden');
  doc().querySelector('#clear-additives').click();
  doc().querySelector('.cafeteria-chip[data-id="1"]').click();
  await ready();
  assert(win().testRequests.length === requestsBeforeDietChanges, 'Additive changes reuse raw cached menus');
  for (const width of [320,390,768,1200]) {
    frame.width = width;
    await wait(100);
    assert(doc().documentElement.scrollWidth <= width, `Dietary controls fit ${width}px viewport`);
    const controls = [...doc().querySelectorAll('.quick-filters > fieldset,.quick-filters > .meal-period')];
    for (let i = 0; i < controls.length; i++) {
      for (let j = i + 1; j < controls.length; j++) {
        const a = controls[i].getBoundingClientRect(), b = controls[j].getBoundingClientRect();
        assert(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, `Filter controls do not overlap at ${width}px`);
      }
    }
  }
  frame.width = 390;
  await wait(100);
  doc().querySelector('.cafeteria-chip[data-id="1"]').click();
  await ready();
  assert(doc().querySelector('#menus .message'), 'No meals after the only matching cafeteria is hidden');
  doc().querySelector('.cafeteria-chip[data-id="1"]').click();
  await ready();
  pass('All eight dietary multiselect combinations, exact/numeric additive exclusions, reset/focus, cached menus, responsive controls and empty states');

  // Curated daily-repeat list: reload with a cafeteria named like the real one and a
  // dish carrying the curated title, so canteen-plus-title matching is exercised.
  const repeatFixtures = fixtures
    .replace("name:'Selected A'", "name:'Neue Mensa'")
    .replace('meal(1),meal(2),meal(3),meal(4),',
      "meal(1),meal(2),meal(3),meal(4),{...meal(7),name:'Kleines Softeis in der Waffel (A, A1)'},");
  await load(repeatFixtures);
  const repeatInput = () => doc().querySelector('#repeat-options input[data-key="neue-mensa-softeis"]');
  const repeatNames = () => [...doc().querySelectorAll('#menus .meal-name')].map((node) => node.textContent);
  assert(doc().querySelectorAll('#repeat-options input').length === 4, 'Four curated repeat dishes are offered');
  assert([...doc().querySelectorAll('#repeat-options input')].every((input) => input.checked),
    'Curated repeats are shown by default');
  assert(repeatNames().some((name) => name.startsWith('Kleines Softeis')), 'Daily repeat is in the grid');
  repeatInput().click();
  await ready();
  assert(!repeatNames().some((name) => name.startsWith('Kleines Softeis')), 'Unchecked repeat is hidden');
  assert(doc().querySelector('#filter-status').textContent.includes('1 wiederkehrendes Gericht'),
    'Collapsed filter summary reports the hidden repeat');
  assert(doc().querySelector('#results-summary').textContent.includes('1 wiederkehrendes Gericht'),
    'Result summary reports the hidden repeat');
  doc().querySelector('#reset-repeats').click();
  await ready();
  assert(repeatInput().checked && repeatNames().some((name) => name.startsWith('Kleines Softeis')),
    'Reset shows the repeat again');
  pass('Curated daily-repeat list hides and restores one dish per cafeteria');

  const reducedMotionRule = [...doc().styleSheets[0].cssRules].find(
    (rule) => rule.conditionText === '(prefers-reduced-motion: reduce)'
  );
  reducedMotionRule.media.mediaText = 'all';
  const daySurface = doc().querySelector('#day-viewport');
  const dayGrid = doc().querySelector('#week-days');
  const translation = (target) => new (win().DOMMatrixReadOnly)(win().getComputedStyle(target).transform).m41;
  function pointer(target, type, x, y = 100) {
    return target.dispatchEvent(new (win().PointerEvent)(type, {
      pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0,
      clientX: x, clientY: y, bubbles: true, cancelable: true
    }));
  }
  let dayCaptured = false;
  daySurface.setPointerCapture = () => { dayCaptured = true; };
  daySurface.hasPointerCapture = () => dayCaptured;
  daySurface.releasePointerCapture = () => { dayCaptured = false; };
  const firstDate = () => dayGrid.firstElementChild.dataset.date;
  const shiftISO = (iso, count) => {
    const date = new Date(iso + 'T12:00:00Z');
    for (let i = 0; i < Math.abs(count);) {
      date.setUTCDate(date.getUTCDate() + Math.sign(count));
      if (![0, 6].includes(date.getUTCDay())) i++;
    }
    return date.toISOString().slice(0, 10);
  };
  const settleDays = async () => {
    daySurface.getAnimations({ subtree: true }).forEach((animation) => animation.finish());
    await wait();
  };
  const originalFirst = firstDate();
  const originalSelection = doc().querySelector('#date-input').value;
  const requestsBeforeDateBrowsing = win().testRequests.length;
  pointer(dayGrid.firstElementChild, 'pointerdown', 150);
  assert(!dayCaptured, 'Date tap does not capture pointer prematurely');
  pointer(daySurface, 'pointermove', 70);
  assert(dayCaptured && Math.abs(translation(dayGrid) + 80) < 1, 'Date strip follows finger and captures horizontal drag');
  pointer(daySurface, 'pointerup', 70);
  await settleDays();
  assert(firstDate() === shiftISO(originalFirst, 5), 'Left date swipe advances five weekdays');
  doc().querySelector('#next-week').click();
  await settleDays();
  assert(firstDate() === shiftISO(originalFirst, 6), 'Next arrow advances only one day');
  doc().querySelector('#previous-week').click();
  await settleDays();
  assert(firstDate() === shiftISO(originalFirst, 5), 'Previous arrow moves back one day');
  pointer(dayGrid.firstElementChild, 'pointerdown', 150);
  pointer(daySurface, 'pointermove', 230);
  pointer(daySurface, 'pointerup', 230);
  await settleDays();
  assert(firstDate() === originalFirst, 'Right date swipe returns five days');
  for (const kind of ['short', 'cancel', 'vertical']) {
    pointer(dayGrid.firstElementChild, 'pointerdown', 150);
    pointer(daySurface, 'pointermove', kind === 'short' ? 140 : kind === 'vertical' ? 145 : 70, kind === 'vertical' ? 200 : 100);
    pointer(daySurface, kind === 'cancel' ? 'pointercancel' : 'pointerup', kind === 'short' ? 140 : kind === 'vertical' ? 145 : 70, kind === 'vertical' ? 200 : 100);
    await settleDays();
    assert(firstDate() === originalFirst, `${kind} gesture does not change dates`);
  }
  assert(doc().querySelector('#date-input').value === originalSelection &&
    win().testRequests.length === requestsBeforeDateBrowsing, 'Browsing date strip leaves menu selection and API requests unchanged');
  const tappedDate = dayGrid.firstElementChild.dataset.date;
  pointer(dayGrid.firstElementChild, 'pointerdown', 150);
  pointer(dayGrid.firstElementChild, 'pointerup', 150);
  dayGrid.firstElementChild.click();
  await ready();
  assert(doc().querySelector('#date-input').value === tappedDate, 'Date buttons remain tappable after swiping');
  pass('Date strip tracks finger; swipes move five weekdays, arrows one; taps, cancellation and vertical gestures preserved');
  reducedMotionRule.media.mediaText = '(prefers-reduced-motion: reduce)';

  const dateInput = doc().querySelector('#date-input');
  for (const date of ['2026-10-24', '2026-10-25', '2026-10-26']) {
    dateInput.value = date;
    dateInput.dispatchEvent(new (win()).Event('change'));
    await ready();
    const days = doc().querySelectorAll('.day-button');
    assert(dateInput.value === '2026-10-26', 'Weekend selections advance to Monday');
    assert(days.length === 5, 'Five weekday tabs after weekend selection');
    assert([...days].every((day) => ![0, 6].includes(new Date(day.dataset.date + 'T12:00:00Z').getUTCDay())), 'No weekend tabs');
    assert([...days].filter((day) => day.getAttribute('aria-pressed') === 'true').length === 1, 'Selected weekday remains visible');
  }
  dateInput.value = '2026-10-23';
  dateInput.dispatchEvent(new (win()).Event('change'));
  await ready();
  for (let i = 0; i < 5; i++) {
    doc().querySelector('#next-week').click();
    await settleDays();
  }
  assert(firstDate() === '2026-10-26', 'Mobile arrows skip Saturday and Sunday');
  assert([...dayGrid.children].every((day) =>
    ![0, 6].includes(new Date(day.dataset.date + 'T12:00:00Z').getUTCDay())), 'Mobile strip remains weekday-only across week boundary');
  doc().querySelector('#previous-week').click();
  await settleDays();
  assert(firstDate() === '2026-10-23', 'Reverse arrow skips back from Monday to Friday');
  pass('Weekday-only navigation, weekend date-picker normalization, forward/reverse weekend skipping');

  const defaultCases = [
    ['2026-01-15T13:59:59Z', '2026-01-15', false],
    ['2026-01-15T14:00:00Z', '2026-01-15', true],
    ['2026-01-15T17:59:59Z', '2026-01-15', true],
    ['2026-01-15T18:00:00Z', '2026-01-16', false],
    ['2026-07-15T12:59:59Z', '2026-07-15', false],
    ['2026-07-15T13:00:00Z', '2026-07-15', true],
    ['2026-07-15T16:59:59Z', '2026-07-15', true],
    ['2026-07-15T17:00:00Z', '2026-07-16', false],
    ['2026-12-31T18:00:00Z', '2027-01-01', false],
    ['2028-02-28T18:00:00Z', '2028-02-29', false],
    ['2026-03-28T18:00:00Z', '2026-03-30', false],
    ['2026-10-24T17:00:00Z', '2026-10-26', false],
    ['2026-01-16T18:00:00Z', '2026-01-19', false],
    ['2026-01-17T10:00:00Z', '2026-01-19', false],
    ['2026-01-18T10:00:00Z', '2026-01-19', false],
    ['2026-07-15T22:00:00Z', '2026-07-16', false]
  ];
  const savedFixture = fixtures.replace("getItem() { return '[2]'; }, setItem() {}", `
      getItem(key) { return ({'mensa-hidden-canteens-v1':'[]', 'mensa-dietary-filters-v1':'[]', 'mensa-excluded-codes-v1':'["A1"]', 'mensa-price-category-v1':'guest'})[key] ?? null; },
      setItem(key, value) { window.savedPreferences[key] = value; }
    `).replace('window.testRequests = [];', 'window.savedPreferences = {}; window.testRequests = [];');
  await load(savedFixture);
  assert(!doc().querySelector('#dietary-filter input:checked'), 'Empty dietary selection is restored');
  assert(doc().querySelector('input[name="price-category"]:checked').value === 'guest', 'Price category is restored');
  assert(doc().querySelector('#additive-options input[data-code="A1"]')?.checked, 'Excluded code is restored even when absent from meals');
  doc().querySelector('#dietary-filter input[value="vegan"]').click();
  doc().querySelector('input[name="price-category"][value="employee"]').click();
  doc().querySelector('#clear-additives').click();
  assert(win().savedPreferences['mensa-dietary-filters-v1'] === '["vegan"]', 'Dietary changes are saved');
  assert(win().savedPreferences['mensa-price-category-v1'] === 'employee', 'Price changes are saved');
  assert(win().savedPreferences['mensa-excluded-codes-v1'] === '[]', 'Clearing exclusions is saved');
  for (const [instant, expectedDate, expectedEvening] of defaultCases) {
    await load(fixtures.replaceAll('2026-10-22T10:00:00Z', instant));
    assert(doc().querySelector('#date-input')?.value === expectedDate, `Default date at ${instant}`);
    assert(doc().querySelector('#evening-switch')?.checked === expectedEvening, `Default meal period at ${instant}`);
    assert(win().testRequests.some((url) => url.includes(`/days/${expectedDate}/meals`)), `Requested menu date at ${instant}`);
  }
  pass('Berlin defaults at 15:00/19:00, winter/summer time, year/leap-day/DST/weekend rollover and midnight');
  output.textContent += '\n\nAll tests passed. Physical-device touch testing remains a separate check.';
  document.title = 'PASS — Browse regression tests';
} catch (error) {
  output.textContent += `\nFAIL: ${error.message}`;
  document.title = 'FAIL — Browse regression tests';
  console.error(error);
}

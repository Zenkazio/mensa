# mensa.

A static, German-language menu browser for the cafeterias operated by Studentenwerk Dresden. No backend, API key, build step, or package installation is required.

## Run locally

Serve this directory with any static HTTP server, for example:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000. Do not open `index.html` as a `file://` URL; browsers can restrict JavaScript modules on local files.

To test on a phone connected to the same Wi-Fi network, bind the server to the local network:

```sh
python3 -m http.server 8006 --bind 0.0.0.0
```

Open `http://<computer-LAN-IP>:8006` on the phone (not `localhost`). Allow local-network access through the computer's firewall if prompted. This exposes the served directory to devices on the local network; stop the server when finished and do not forward this port to the internet.

### Nix

The repository ships a flake for a reproducible dev shell, build and test run. The site itself still has no build step; the package is just the deployable file set.

```sh
nix develop                              # chromium, node, python, nixfmt
nix develop -c tests/browser-tests.sh    # headless browser regression checks
nix run                                  # serve the built site on :8000
PORT=8006 BIND=0.0.0.0 nix run           # serve to the local network (phone testing)
nix build                                # ./result/share/mensa = deployable files
nix flake check                          # build + browser checks, the CI gate
nix fmt flake.nix
```

`nix flake check` runs all four `/tests` pages in headless Chromium against the built package, so a file missing from the deploy list fails the check.

## Deploy

Publish `index.html`, `styles.css`, `app.js`, `theme.js`, `meal-filters.js`, `swipe.js`, `calendar.js`, and `favicon.svg` together on any HTTPS static host (including GitHub Pages). All asset paths are relative, so subdirectory deployments work.

Development and testing happen in a local checkout on the desktop (`~/Projects/mensa`). Production runs on the Raspberry Pi, served from `/var/www/mensa`; publishing is a push here followed by a pull on the Pi:

```sh
git push origin main
ssh pi 'cd /var/www/mensa && git pull'
```

## Data and scope

- Cafeterias and dated menus are fetched directly in the browser from https://api.studentenwerk-dresden.de/openmensa/v2. The official API permits cross-origin requests.
- The initial date is today before 19:00 and tomorrow from 19:00 in `Europe/Berlin`, advanced to Monday if it falls on a weekend. Week navigation and the date picker request menus for the chosen date; unpublished dates show an explicit empty state. A Saturday or Sunday entered in the native date picker also advances to Monday.
- The date strip shows five weekdays, never Saturday or Sunday. On mobile, swipe horizontally to browse five weekdays forward/back, or use the arrows to shift the strip by one weekday. Browsing does not request menus until a date is tapped. Desktop shows Monday–Friday with week arrows. Today has an accent-colored border even when selected; date animations respect reduced motion.
- Cafeteria visibility is saved in local storage on the visitor’s device. All cafeterias are selected initially. One compact “Filter” disclosure holds both the canteen chips and the allergen codes; its summary line shows how many canteens remain selected and how many codes are hidden, so the panel stays informative while collapsed.
- The header’s sun/moon button toggles dark mode. Without a saved choice, the theme follows the browser’s `prefers-color-scheme`, including changes while the page is open. A manual choice is saved locally under `mensa-theme-v1` and takes priority on later visits. Switching also works if storage is blocked; removing that stored preference restores system-following mode. Theme changes synchronize across tabs. The theme is applied before loading the stylesheet to avoid a light-theme flash.
- The Mittag/Abend switch separates lunch from evening meals. An `Abendangebot` prefix in the API category or meal name identifies evening meals. At page opening, defaults use `Europe/Berlin` (including daylight saving time): before 15:00, today's lunch; 15:00–18:59, today's evening menu; from 19:00, tomorrow's lunch menu. Any weekend date advances to Monday. Manual changes remain selected across date/filter changes, but are not persisted across reloads or overridden by a timer.
- The three icon buttons “Fleisch/Fisch”, “Vegetarisch”, and “Vegan” are independent checkbox selections. All start selected unless a previous selection is saved in local storage; selected groups combine using OR, and selecting none shows an explicit empty state. Vegan and vegetarian are separate groups: exact provider vegan notes take priority, then exact vegetarian notes. Dishes without either label belong to “Fleisch/Fisch”; this fallback is not proof that they contain meat. No classification is inferred from meal names or ingredients.
- The “Wiederkehrende Gerichte” section of the Filter panel lists the dishes the Studentenwerk publishes on every weekday, curated from the week of 9–13 November 2026 (KW46) for Mensa Siedepunkt, Neue Mensa and Alte Mensa only. The API has no “recurring” flag, so each entry is matched by cafeteria name plus a distinctive phrase of the dish title (`repeatedDishes` in `meal-filters.js`); the phrase must stay narrow, because Siedepunkt also served a plain “Blumenkohlschnitzel” dish that week as a normal daily meal. Every entry starts checked, and clearing its checkbox hides that dish from every day. Hidden entries are saved locally under `mensa-hidden-repeats-v1` and reported in both summary lines; “Alle anzeigen” restores them. Add further dishes only after inspecting a week’s data.
- The “Allergene & Zusatzstoffe” section of the Filter panel offers every code found in parenthesized lists in the loaded meal titles, with descriptions taken from provider notes where available. Selecting a code excludes dishes carrying that exact code (A does not automatically match A1); numeric additive codes are also supported. Excluding several codes hides a dish if any match. Reset clears all exclusions. Selected exclusions remain removable if they are absent from another date/cafeteria. Options use raw loaded menus, not already filtered results, so exclusions cannot hide their own controls.
- Dietary groups and code exclusions combine with date, cafeteria and Mittag/Abend filters for the menu grid. Dietary selections and code exclusions persist across reloads. Cached raw responses are reused. Only codes explicitly written in titles are matched; absent or incomplete labels are not an allergy-safety guarantee. Always consult the provider’s full information.
- The site always opens in the continuous Tom-View: one grid of all dishes, five cards wide on desktop, two on tablets, and two on phones with cards sized to their content. Each card labels the cafeteria and the station inside it on one line (for example “Neue Mensa – Teller 1”); weekly cards prefix the weekday. The Tag/Woche slider switches to the weekly view, which shows only the evening meals of the selected week (Monday–Friday) in the same continuous style. Weekend menus are neither requested nor displayed. Both views retain cafeteria, dietary and price selections. In the weekly view, days without matching published offers simply contribute no cards, and failed requests are collected in one retry banner above the grid. In the weekly view arrows and mobile date swipes change the week; in the day view they step between weekdays like the normal page. The Mittag/Abend switch is locked to Abend in the weekly view and stays active in the day view. Week requests share the existing five-minute cache and four-request concurrency limit. The normal weekday-only date strip is unchanged. The page loads scrolled to the meals; scroll up for the filters.
- Each meal in the Tom-View weekly view has a “zum Kalender hinzufügen” button with a calendar icon, also available in its details dialog. It downloads a standard `.ics` calendar event with the meal title, cafeteria name/address and that meal's displayed date. Times always represent 17:30–19:00 in `Europe/Berlin`, converted to UTC with the correct summer/winter offset so imports work in other time zones. The calendar app still requires the user to open/import and confirm the event; the website does not directly access a calendar account.
- The “Student / Bediensteter / Gäste” price selector defaults to Student and persists across reloads. Each card shows only the selected category’s published price (or “Keine Preisangabe” if unavailable). Both the Dresden API’s German price keys and standard OpenMensa keys are supported. Changing category updates prices in place, without fetching menus or resetting the grid; the selection is retained across the other filters and dates.
- Cafeterias without matching meals are omitted; a clear empty state appears when none match. Failed requests are collected in one retry banner above the grid. Raw cached API responses are shared between lunch and evening views, so switching does not discard either set of meals.
- Cards have no internal scrolling. On desktop/tablet the day grid uses fixed 360px cards; week cards use 400px. On phones (up to 560px wide) cards size to their content, the gaps between cards and to the page edge are smaller, and card type is slightly reduced. Descriptions are previews; clicking the card, or focusing it and pressing Enter or Space, opens the complete text and all notes in a separate details dialog. Details photos use their natural aspect ratio without cropping or hover zoom.
- Photos, prices, sold-out status, dietary labels, and allergen notes come from the API. Missing photos and the API’s generic promotional image receive a neutral placeholder, never an unrelated food photo. Cards mark vegan and vegetarian meals with a small leaf badge (solid mint for vegan, soft mint for vegetarian); the full label is available as a tooltip and to screen readers. Dietary labels reflect provider notes, not inferred ingredients.
- Successful menu responses are cached in memory for five minutes. Requests run with a maximum concurrency of four; changing dates or filters cancels obsolete requests. Failed cafeterias can be retried independently of successful cached results.
- Only menu browsing is implemented: no accounts, ordering, advertising, or other reference-site features.
- Google Fonts provides optional typography; system fallback fonts keep the page usable if that request fails.

Data and images remain those of [Studentenwerk Dresden](https://www.studentenwerk-dresden.de/mensen/speiseplan/). This is an independent interface, not the official website.

## Browser regression checks

Run all pages headlessly, either inside the dev shell or by serving a checkout yourself:

```sh
nix develop -c tests/browser-tests.sh             # current checkout
nix develop -c tests/browser-tests.sh result/share/mensa   # a built site
```

The runner starts a local HTTP server and headless Chromium, then waits for each page's `PASS — …`/`FAIL — …` title and prints its output. `nix flake check` does the same against the built package.

With the static server running, open `/tests/swipe.html`. It loads the production modules in an isolated iframe with API fixtures and simulated touch-pointer events. It checks the mobile date strip (live finger tracking, cancellation, weekday-only navigation), default date/meal-period selection, no-scroll card details, price categories, all dietary combinations and additive exclusions. It does not change saved cafeteria preferences or query the live menu API. Test results appear on the page.

These checks do not replace real-device testing of native touch input, scrolling, and browser gesture arbitration.

Open `/tests/theme.html` for isolated theme checks: browser defaults, saved preferences, toggles, system changes, cross-tab changes, blocked storage, light/dark contrast and mobile layout.

Open `/tests/tom.html` for the main-view checks: the continuous day view with combined cafeteria/station labels, starting scrolled to the meals, Monday–Friday only (no weekend requests), the flat weekly grid, hidden cafeterias, evening-only menus, price/dietary selections, partial failures and retry, caching, request cancellation/concurrency, year boundaries, the Tag/Woche layout slider, tighter card gaps, the smaller mobile type scale and responsive layout. It also verifies calendar downloads, meal/date/location mapping, summer/winter/DST event times, safe iCalendar text escaping and Unicode line folding. Opening/importing the downloaded event in a native calendar app remains a manual check.


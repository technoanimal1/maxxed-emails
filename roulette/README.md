# Social Roulette — game UI

Front-end build of the Figma frame **"01 · The social party table"** from the
*Brasilian Roulette* file. Plain HTML/CSS/JS, no build step.

## Run it

```bash
# from this folder
python3 -m http.server 8000
# then open http://localhost:8000
```


## Deploy (Vercel)

Same as `partners/`: deploy this folder as its own project.

```bash
npx vercel          # preview
npx vercel --prod   # production
```

For Git auto-deploys, set the project's **Root Directory** to `roulette`.

## What's interactive

- **Chips**: click a chip, use the arrows, or press `←` / `→` / `1`–`5`. The selected chip grows to the 56px size from the design.
- **Table**: click any number, dozen, column (2:1) or even-money box to place the selected chip. Hovering an outside bet lights up the numbers it covers.
- **Racetrack**: click a number for a straight-up bet, or click TIERS / ORPHELINS / VOISINS / ZERO to put one chip on every number in that section. "Switch to Racetrack" hides/shows it.
- **Controls**: rebet (last round), X2 (double), undo (`Ctrl/⌘ + Z`), clear.
- **Rounds**: 15s betting timer in the BETS OPEN tab → NO MORE BETS → result, with the winning bets highlighted, the payout added to the demo balance and the result pushed into the history bar. Round number increments.
- **Chat**: type and press Enter. Rafaela (the host) reacts to every result. Stickers tab launches floating reactions; Voice tab toggles the mic.
- **Top bar**: sound on/off, settings, results history, how-to-play/payouts, full screen.

Payouts: straight up 35:1 · column/dozen 2:1 · red/black, even/odd, 1–18/19–36 1:1.
Results use `crypto.getRandomValues` in the browser. This is a **demo**: no real money and no server.

## Layout

**Landscape / desktop:** the stage is built at the design's native 1440 × 810 using the
Figma coordinates, then scaled to fit the window (letterboxed).

**Portrait (phones and tablets held upright, any window taller than it is wide):** the same
components re-flow into a mobile layout:

- live dealer video on top with the round pill, results history, floating reactions and the
  party card (shows for 6 s, then tucks into its avatars; tap to reopen)
- a **vertical betting table**: zero on top, 12 rows × 3 numbers, dozens and even-money bets
  down the left, 2:1 columns at the bottom
- table row height is computed from the real screen height, so it fits from a 553px-tall
  iPhone SE (Safari bars showing) up to iPad; the video gives up space first, then the rows
- "Racetrack" swaps the table for a scaled-up racetrack
- thumb-reach dock: balance, racetrack switch, chat button, then rebet/X2 · chips · undo/clear
- chat opens as a **bottom sheet** from the host's avatar; new messages pop over the video
  with an unread badge
- respects notches / home indicator (safe areas), no iOS zoom on the chat field,
  44px touch targets on the top bar icons

Rotating the device mid-round swaps layouts without losing bets.

## Files

```
index.html        markup
styles.css        all styling (Figma tokens at the top in :root)
app.js            game logic: bets, rounds, payouts, chat, racetrack
assets/img        table background, logos, avatar sprite sheets, grid frame, racetrack
assets/icons      top bar + control icons (exported from Figma)
assets/chips      chip ring + dot vectors (exported from Figma)
fonts/            open-source stand-ins (see below)
```

## Fonts

The design uses **Aktiv Grotesk Ex**, **Nexa** and **Google Sans**, which are licensed fonts.
Until those are added, the page uses OFL-licensed stand-ins bundled in `fonts/`:

| Design font       | Stand-in                    |
| ----------------- | --------------------------- |
| Aktiv Grotesk Ex  | Archivo at 119% width       |
| Nexa              | Montserrat                  |
| Google Sans       | DM Sans                     |

To use the real fonts, add `@font-face` rules for them at the top of `styles.css`
(with the family names `Aktiv Grotesk Ex`, `Nexa` and `Google Sans`).
They're first in each font stack, so they take over automatically.

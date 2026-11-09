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

## Live video, music and motion

- **Live round video** (`assets/video/live-round.mp4` + `.webm` fallback): one full 29.5s
  spin, re-cut so the end crossfades into the start. Muted (browsers only autoplay muted
  video); the poster frame shows while it loads. **The round is timed by the video itself:**

  | Video time | Game |
  | --- | --- |
  | 0s | dealer launches the ball: bets open (≈15s to bet while it circles) |
  | 14.9s | no more bets (just before the ball starts bouncing) |
  | 25.7s | ball has settled in **24**: result, payouts, result arc |
  | 29.5s | loop → next round |

  These live in `ROUND` at the top of `app.js` (`closeAt`, `resultAt`, `result`); change them
  if the video changes. If the video stalls or can't autoplay, a fallback clock keeps the
  rounds going and re-syncs the video when it plays again.
- **Result arc:** a slice of the wheel over the video: the winning pocket in the middle, its
  two wheel neighbours either side, the ball resting in it.
- **Background music** (`assets/audio/casino-jazz-loop.m4a`): the supplied lounge-jazz track,
  trimmed and crossfaded into a seamless 78s loop. It starts on the first tap/click (browser
  rule), fades in, dips under wins, pauses when the tab is hidden. The speaker icon mutes
  everything; Settings has separate Music / Sound effects switches. Choices are remembered.
- **Motion** (`motion.js`, built on [GSAP](https://gsap.com) 3 + Flip + MotionPath, self-hosted
  in `vendor/`, free for commercial use under GSAP's standard licence):

| Moment | What happens |
| --- | --- |
| Page load | video eases out of a zoom, chrome slides in, the table rises with a 3D tilt, numbers ripple out from the zero, chips deal in one by one |
| Select chip | chip flips on its edge and grows |
| Place bet | chip arcs from the rack onto the cell and lands with a bounce (racetrack sections cascade) |
| Undo / clear | chips slide off the felt and fade |
| Last 5 seconds | status label pulses each second, soft tick |
| No more bets | table tilts back and dims, camera creeps toward the wheel, controls dim |
| Result | table lifts back into focus, winning cell punches with a gold ring and sparks, losing chips are swept to the wheel, winning chips fly into the balance, balance counts up |
| Bets open | table springs back; new number drops into the history bar |
| Chat (portrait) | bottom sheet springs up over a fading backdrop; drag the handle down or tap outside to close |
| Popovers | grow out of the icon that opened them; rows cascade in |
| Party card (portrait) | morphs between card and avatar cluster |
| Racetrack | desktop: soft blur fade; portrait: the table card-flips into the racetrack |
| Reactions | a constant stream of emoji bubbles floats up beside the wheel |

Everything is skipped for visitors with *Reduce motion* turned on, and the game still works if
GSAP fails to load.

**Motion demo:** open the page with `?demo` (e.g. `/roulette?demo`) for a panel that triggers
each animation on demand, including a forced win and a forced loss.

## Every bet type

| Bet | Where to tap | Pays |
| --- | --- | --- |
| Straight up | a number | 35:1 |
| Split | the line between two numbers (incl. 0-1, 0-2, 0-3) | 17:1 |
| Street | the outer edge of a row of three | 11:1 |
| Trio | where 0 meets 1-2 or 2-3 | 11:1 |
| Corner | where four numbers meet | 8:1 |
| First four | the outer corner of 0-1-2-3 | 8:1 |
| Six line | where two streets meet on the outer edge | 5:1 |
| Column / Dozen | 2:1 boxes · 1st/2nd/3rd 12 | 2:1 |
| Red/Black · Even/Odd · 1–18/19–36 | the outside boxes | 1:1 |
| Neighbours | a number on the racetrack: it plus N each side on the wheel (− / + sets N, 1–9) | 35:1 per number |
| Voisins du zéro | racetrack section: 0/2/3 trio ×2, splits 4/7, 12/15, 18/21, 19/22, 32/35, corner 25-29 ×2 (9 chips) | per bet |
| Tiers du cylindre | splits 5/8, 10/11, 13/16, 23/24, 27/30, 33/36 (6 chips) | per bet |
| Orphelins | 1, splits 6/9, 14/17, 17/20, 31/34 (5 chips) | per bet |
| Jeu zéro | splits 0/3, 12/15, 32/35, straight 26 (4 chips) | per bet |

Hovering any spot lights up exactly the numbers it covers. Inside-bet spots are invisible
until hovered, so the table still matches the design.

## Chat

On desktop the chat is a live feed: up to 4–5 messages at a time, each fading out after ~4s.
Other players at the table chat too (simulated, like the reactions). On phones the bottom
sheet keeps the full history, and only the host's messages pop up over the video.
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
app.js            game logic: bets, rounds, payouts, chat, racetrack, music, demo panel
motion.js         every animation (GSAP)
vendor/           GSAP core, Flip, MotionPath (self-hosted)
assets/video      live round video + poster
assets/audio      background music loop
assets/img        logos, avatar sprite sheets, grid frame, racetrack
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

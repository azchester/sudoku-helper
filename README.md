# Sudoku Helper

A lightweight **Sudoku pencil-mark helper** that runs entirely in the browser—no build step, no frameworks, no backend.

Start from a blank 9×9 board with every cell showing candidates **1–9**. Eliminate marks, place entries, and let the helper auto-fill forced singles and flag conflicts as you go.

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![No build step](https://img.shields.io/badge/build-none-lightgrey.svg)
![Vanilla JS](https://img.shields.io/badge/stack-HTML%20%2B%20CSS%20%2B%20JS-yellow.svg)

## Try it

```bash
git clone https://github.com/azchester/sudoku-helper.git
cd sudoku-helper
python3 -m http.server 8080
# open http://localhost:8080
```

Or open `index.html` directly in your browser (plain `<script>` tags; works with `file://`).

## Features

| Feature | What it does |
|--------|----------------|
| **Mode select** | Choose **Hide mark**, **Place user** (black), or **Place given** (blue), then click a pencil mark |
| **Hotkeys** | `H` / `U` / `G` switch modes; underlined letters on the mode buttons |
| **Peer clear** | Placing a digit removes that candidate from the same box, row, and column |
| **Auto-place** | Sole remaining mark in a **cell** (naked single), or sole remaining instance of a digit in a **box / row / column**, is filled as a user entry and cascades |
| **Conflicts** | Duplicate filled digits in a box, row, or column highlight in red |
| **Digit stats** | Side panel shows placed / remaining (of 9); green “Complete” when all nine are filled |
| **Hover highlight** | Hover a digit on the board or stats panel to highlight all matching marks and values |
| **Undo / Redo** | Full history including auto-fills (`Ctrl/Cmd+Z` / `Y`) |
| **New Game** | Reset to a blank board with all pencil marks |

## How to play (helper workflow)

1. Select a **number status** on the left (or press `H`, `U`, or `G`).
2. Click pencil marks on the board to hide candidates or place values.
3. Watch **auto-place** fill forced singles and **conflicts** light up in red if the same digit is placed twice in a unit.
4. Use **digit stats** on the right to track how many of each digit you’ve placed.
5. **Undo** anytime; **New Game** starts over.

> This is a *helper*, not a puzzle generator or full solver. You enter the clues (givens) and work candidates yourself—the app automates the bookkeeping.

## Project layout

```
sudoku-helper/
├── index.html      # Entry page
├── styles.css      # Layout, modes, conflicts, highlights
├── board.js        # Pure board logic (testable, no DOM)
├── app.js          # UI binding: modes, clicks, history, stats
├── test/           # Node unit tests (no browser required)
└── README.md
```

| Module | Responsibility |
|--------|----------------|
| `board.js` | Grid model, hide/place, peer clear, history, auto-promote, conflicts, digit frequency |
| `app.js` | DOM render, mode hotkeys, hover, undo/redo wiring |
| `styles.css` | Visual design (GIVEN blue, USER black, HINT gray, conflict red) |

## Tests

Requires [Node.js](https://nodejs.org/). No install step—tests `require` the shipped scripts directly.

```bash
node test/board.test.js
node test/history-stats.test.js
node test/mode-select.test.js
node test/auto-promote.test.js
node test/naked-single.test.js
node test/conflict-hotkey.test.js
```

Or run them all:

```bash
for f in test/*.test.js; do echo "=== $f ==="; node "$f" || exit 1; done
```

## Browser support

Modern browsers (Chrome, Firefox, Safari, Edge). No polyfills or bundler. Designed for desktop mouse interaction (including middle-click alternatives via mode buttons).

## License

[MIT](LICENSE) — free to use, modify, and share.

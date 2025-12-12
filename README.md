# Unicode Solitaire Collection

Local, dependency-free implementations of Klondike (`index.html`) and Spider (`spider.html`) using TypeScript/JS and Unicode suit faces (no bitmap assets).

## Games
- **Klondike**: Draw 1/3 toggle, standard/Vegas/none scoring, undo, auto-move to foundations.
- **Spider**: 1/2/4-suit difficulty, 10 columns, suited descending moves, deal one card per column, auto-removal of completed K?A runs.

## Run locally
1. From this folder run a simple server (Python 3 built-in):
   - `python -m http.server 8000`
2. Open in a browser:
   - `http://localhost:8000/index.html` (Klondike)
   - `http://localhost:8000/spider.html` (Spider)

## Controls
- Click to select a card/run, click another stack to move; drag also works.
- Double-click (Klondike) a top face-up card to auto-send to foundation.
- Buttons: new game, undo/auto-move (Klondike), deal row (Spider), difficulty/scoring/draw selectors.

## Notes
- Uses Unicode suit emoji and CSS for card faces; no external assets.
- Tested in modern Chromium-based browsers.

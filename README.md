# Unicode Solitaire Collection

Local, dependency-free implementations of Klondike (`solitaire.html`), Spider (`spider.html`), and Dr. Blackjack (`drblackjack.html`) using TypeScript/JS and Unicode suit faces (no bitmap assets). A simple landing page (`index.html`) links to all games.

## Games
- **Klondike**: Draw 1/3 toggle, standard/Vegas/none scoring, undo, auto-move to foundations.
- **Spider**: 1/2/4-suit difficulty, 10 columns, suited descending moves, deal one card per column, auto-removal of completed K?A runs.
- **Dr. Blackjack**: Configurable deck count/rules (surrender, DAS, double restrictions, soft-17), split/double/surrender buttons, and a built-in basic-strategy hint.

## Run locally
1. From this folder run a simple server (Python 3 built-in):
   - `python -m http.server 8000`
2. Open in a browser:
   - `http://localhost:8000/` (Landing)
   - `http://localhost:8000/solitaire.html` (Klondike)
   - `http://localhost:8000/spider.html` (Spider)
   - `http://localhost:8000/drblackjack.html` (Dr. Blackjack)

## Controls
- Click to select a card/run, click another stack to move; drag also works.
- Double-click (Klondike) a top face-up card to auto-send to foundation.
- Buttons: new game, undo/auto-move (Klondike), deal row (Spider), difficulty/scoring/draw selectors.
- Dr. Blackjack: set decks/rule toggles, choose bet, deal; per hand you can hit/stand/double/split/surrender, or tap Hint for strategy advice.

## Notes
- Uses Unicode suit emoji and CSS for card faces; no external assets.
- Tested in modern Chromium-based browsers.

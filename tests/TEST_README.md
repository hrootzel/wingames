# Game Shell Test Suite

Automated Playwright tests for the game-shell.js layout system.

## Setup

```bash
cd tests
npm install
npx playwright install chromium
```

## Running Tests

```bash
cd tests

# Run all tests
npm test

# Run only game tests
npm run test:games

# Run only generic shell tests
npm run test:generic

# Run with browser visible
npm run test:headed

# Run with UI mode
npm run test:ui
```

## Test Files

### `test-game-shell.js`
Tests all 7 actual games:
- Games with preview pieces (Puzzle Puncher, Blocks, Plop Plop, Pill Popper)
- Games without preview pieces (Prismpulse, Super Buster, Paddle Royale)
- Layout transitions
- HUD zoom behavior
- Preview piece scaling

### `test-generic-shell.js`
Tests generic canvas configurations:
- Tall canvas (320×600) - should prefer side layout
- Wide canvas (720×480) with `canvasBias: 'wide'` - should prefer stack layout
- Canvas growth when HUD compresses
- Aspect ratio preservation
- HUD zoom range validation

### Test Pages

- `test-tall-canvas.html` - Generic tall canvas test page
- `test-wide-canvas.html` - Generic wide canvas test page

Access at:
- http://localhost:8000/tests/test-tall-canvas.html
- http://localhost:8000/tests/test-wide-canvas.html

## What's Tested

✅ Layout mode selection (side vs stack)  
✅ Canvas scaling behavior  
✅ HUD compression (zoom) application  
✅ Preview piece scaling consistency  
✅ Layout transitions at different viewport sizes  
✅ Canvas aspect ratio preservation  
✅ HUD zoom range (0.5 to 1.0)  
✅ Canvas growth when HUD compresses  
✅ canvasBias preference handling  

## Test Coverage

- 4 viewport sizes: 1400×900, 900×900, 700×900, 500×800
- 7 real games + 2 generic test pages
- ~50 test scenarios total

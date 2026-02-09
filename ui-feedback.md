## What you nailed

* **Clear semantic structure**: `.gs-shell` → `.gs-stage` → `.gs-surface` (canvas) + `.gs-hud` (panels). Great for reuse.
* **JS-managed sizing with progressive enhancement**: CSS has `aspect-ratio` by default, JS flips to managed sizing (`data-gs-managed`) and sets explicit px sizes.
* **Snap lanes**: `data-gs-snap="top/bottom"` + `.gs-snap-top/.gs-snap-bottom` is a really nice idea for portrait/stack mode.
* **`ResizeObserver` + `visualViewport`**: good instinct for mobile browser chrome/address-bar resizing.
* **Layout choice based on geometry** instead of only media queries: the `pickLayout()` logic is the right approach for “wide vs tall games.”

## Things to fix (these matter on mobile/tablet)

### 1) Add the viewport meta in the example (and in your template)

Your example HTML currently **does not** include the mobile viewport meta, so iOS/Android sizing will be inconsistent.

Add:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

### 2) `fit` mode mismatch: docs/example say `css/logical`, code uses `backing`

In `game-shell-example.html` you call:

```js
fit: 'css'
```

But in `game-shell.js`, backing-store resize only happens when:

```js
if (fit === 'backing') { ... }
```

So right now, the public API and implementation disagree.

Recommendation:

* Officially support: `fit: 'css' | 'backing'`
* Update comments and example to match.
* (Optional) accept legacy `'logical'` as an alias if you already used it elsewhere.

### 3) Don’t rely on `zoom` for HUD scaling

You use:

```js
hud.style.zoom = hudScale.toFixed(3);
```

`zoom` is **non-standard** and unreliable (not supported in Firefox; mobile behavior varies). This is the biggest cross-device risk in the whole system.

Safer pattern: **transform-scaling an inner wrapper while shrinking the outer width**.

Structure:

```html
<div class="gs-hud"><div class="gs-hudInner"> ... panels ... </div></div>
```

CSS:

```css
.gs-hudInner{
  transform-origin: top left;
  transform: scale(var(--gs-hud-scale, 1));
  width: calc(100% / var(--gs-hud-scale, 1));
}
```

JS: set `--gs-hud-scale` + your `--gs-hud-width-live` instead of `zoom`.

This keeps layout correct *and* works everywhere.

### 4) `scrollIntoView({ behavior: 'instant' })` is risky

You do:

```js
shell.scrollIntoView({ block: 'start', behavior: 'instant' });
```

`behavior: 'instant'` isn’t widely supported (standard values are typically `auto`/`smooth`). Also: auto-scrolling the user is often annoying on mobile.

Suggestion:

* Make this opt-in (e.g. `autoScrollIntoView: false` default).
* Use `behavior: 'auto'` if you keep it.

### 5) Safe-area padding on `.gs-surface` will conflict with explicit sizing

In `game-shell.css` you have:

```css
.gs-surface { padding: env(safe-area-inset-...); overflow:hidden; }
```

But your JS sets `surface.style.width/height = cssW/cssH`, and the canvas is also sized to `cssW/cssH`.

On notched devices, that padding can:

* reduce the content box (making the canvas not actually fit), or
* cause clipping because overflow is hidden.

Better: **remove padding from `.gs-surface` when managed**, and apply safe-area padding to overlay UI instead (touch controls, floating HUD, etc.).

Quick fix:

```css
.gs-surface[data-gs-managed="true"] { padding: 0; }
```

### 6) ResizeObserver loop minimization

You observe `surface`, but you also directly mutate `surface.style.width/height` every resize pass. That can cause extra resize churn.

You can usually drop observing the surface and just observe `fitHost/shell` (unless you have a specific reason to watch surface).

## Minor polish / API completeness

* You already have CSS support for `data-gs-side="left"` but JS never sets it. Consider adding `side: 'left'|'right'` to `initGameShell()` and applying the dataset.
* `getRequiredHudHeight()` sums heights in a way that can double-count gaps depending on layout; it’s fine, but if you see canvas getting “mysteriously small” in stack mode, this is where it comes from.

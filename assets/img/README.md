# Images (optional)

The cat is drawn as an inline **SVG** in `index.html`, so this folder can stay
empty.

If you'd rather use your own picture, drop a PNG/SVG here and set its path in
`app.js`:

```js
const ASSETS = {
  img: { cat: "assets/img/your-cat.png" }  // null = use the built-in SVG
};
```

⚠️ A flat image **won't have the animated mouth/ears** — those only work with
the built-in SVG (or your own SVG that keeps the ids `cat-mouth`,
`cat-ear-left`, `cat-ear-right`). Use a generic, non-branded cat to avoid
copyright issues.

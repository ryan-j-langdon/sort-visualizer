# Sort Visualizer

An interactive visualizer for six classic sorting algorithms. The algorithms
are implemented in C++, compiled to WebAssembly, and driven by a small
vanilla JS/canvas frontend. Deployed as a static site via GitHub Pages.

## Algorithms

Bubble sort, insertion sort, selection sort, merge sort, quick sort, heap sort.

Each algorithm (`src/sort.cpp`) returns a `SortResult`: the initial array plus
a flat sequence of `Step`s (`Compare`, `Swap`, `Overwrite`, `SetSorted`). The
frontend replays these steps to drive the animation, so the visualization is
an exact trace of the algorithm's behavior rather than an approximation.

## Local development

Requires [Emscripten](https://emscripten.org/) (`emcc`) on your `PATH`.

```bash
./scripts/build.sh   # compiles src/ to web/dist/sort.{mjs,wasm}
npx serve web         # or: python3 -m http.server -d web
```

Then open the served URL in a browser. A local server is required because
the WASM module is loaded as an ES module (blocked by `file://` CORS rules).

## Deployment

`.github/workflows/deploy.yml` builds the WASM module and publishes `web/`
to GitHub Pages on every push to `main`.

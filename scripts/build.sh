#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p web/dist

em++ src/sort.cpp src/bindings.cpp \
    -O3 \
    --bind \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s EXPORT_NAME=createSortModule \
    -s ENVIRONMENT=web \
    -s ALLOW_MEMORY_GROWTH=1 \
    -o web/dist/sort.mjs

echo "Built web/dist/sort.mjs and web/dist/sort.wasm"

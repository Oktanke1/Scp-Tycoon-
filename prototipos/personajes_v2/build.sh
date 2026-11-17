#!/bin/bash
cd "$(dirname "$0")"
{ echo '<!doctype html><html><head><meta charset="utf-8"><title>Prototipo personajes</title><style>body{margin:0;background:#2a2e33}</style></head><body>';
  echo '<script>/* three.js r160 — MIT License — Copyright © 2010-2023 three.js authors — https://threejs.org */'; cat three.min.js; echo '</script><script>'; cat sdf.js chars.js main.js scene.js; echo '</script></body></html>'; } > proto.html

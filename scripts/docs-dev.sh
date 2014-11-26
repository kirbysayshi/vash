#!/bin/bash
cat \
  <(echo '<!DOCTYPE html><link href="docs/gfm.css" rel="stylesheet" type="text/css">') \
  <(node_modules/marked/bin/marked <README.md) \
  > README.html
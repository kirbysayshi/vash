#!/bin/bash
cat \
  <(echo '<!-- This document was generated from README.vash -->') \
  <(bin/vash <README.vash --render --helpers <(bin/vash <docs/helpers/* --helper)) \
  > README.md
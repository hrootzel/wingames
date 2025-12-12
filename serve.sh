#!/usr/bin/env sh
PORT=8000
URL="http://localhost:/"
open_cmd="xdg-open"
command -v open >/dev/null 2>&1 && open_cmd="open"
 "" 2>/dev/null &
python3 -m http.server ""

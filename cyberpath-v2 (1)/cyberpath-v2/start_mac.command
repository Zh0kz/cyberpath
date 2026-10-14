#!/bin/bash
cd "$(dirname "$0")"
PORT=8092
python3 -m http.server "$PORT" --bind 127.0.0.1 &
SERVER_PID=$!
sleep 2
open "http://127.0.0.1:$PORT"
echo "CyberPath V2 server PID: $SERVER_PID"
echo "Keep this Terminal window open. Press Ctrl+C to stop."
wait $SERVER_PID

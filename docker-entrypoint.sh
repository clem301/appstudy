#!/bin/sh

# Start nginx in background
nginx

# Start Node.js application
exec node src/server.js

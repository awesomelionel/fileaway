#!/usr/bin/env bash
# IMPORTANT: do NOT use `set -e` here. A failure in `npm ci` should not kill
# the entire devcontainer post-create step — we want the container to come up
# even when the lockfile or node_modules volume is in a weird state.
set -uo pipefail

cd /workspace || exit 0

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found; skipping post-create setup."
  exit 0
fi

# The devcontainer.json mounts a named volume at /workspace/node_modules.
# On first create that volume can come up owned by root. `sudo -n` means
# "never prompt", so we silently skip if passwordless sudo isn't available.
if [ -d /workspace/node_modules ] && [ ! -w /workspace/node_modules ]; then
  echo "Fixing ownership of /workspace/node_modules..."
  sudo -n chown -R node:node /workspace/node_modules 2>/dev/null \
    || echo "  (chown skipped — passwordless sudo not available; rebuild the container to pick up the new sudoers rule)"
fi

echo "Installing npm dependencies..."
if [ -f package-lock.json ]; then
  if ! npm ci; then
    echo "  npm ci failed — falling back to npm install (lockfile may be out of sync)."
    npm install || echo "  npm install also failed; run it manually inside the container."
  fi
else
  npm install || echo "  npm install failed; run it manually inside the container."
fi

# Claude CLI is installed in the image, but reinstall if missing (e.g. after a
# global npm cache wipe).
if ! command -v claude >/dev/null 2>&1; then
  npm install -g @anthropic-ai/claude-code || true
fi

echo "post-create.sh done."
exit 0

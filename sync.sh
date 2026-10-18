#!/usr/bin/env bash
# ============================================================
# Rebuild the Engineering Hub, and optionally deploy.
#   ./sync.sh            rebuild only (manifest + docs + traceability)
#   ./sync.sh --deploy   rebuild, then deploy (AWS S3 example below)
# Set HUB_BUCKET and HUB_CF for your target (and AWS creds / region).
# Swap the deploy block for Netlify / GitHub Pages / etc. as needed.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

echo "==> building hub (manifest, docs, code traceability)"
node build.mjs

if [ "${1:-}" = "--deploy" ]; then
  : "${HUB_BUCKET:?set HUB_BUCKET to your S3 bucket}"
  echo "==> deploying to s3://$HUB_BUCKET/engineer-guide"
  aws s3 sync . "s3://$HUB_BUCKET/engineer-guide" --delete \
    --exclude ".git/*" --exclude "backend/*" --exclude "ci/*" --exclude "*.sh" --exclude "build.mjs" --exclude "node_modules/*"
  if [ -n "${HUB_CF:-}" ]; then
    echo "==> invalidating CloudFront $HUB_CF"
    aws cloudfront create-invalidation --distribution-id "$HUB_CF" --paths "/engineer-guide/*" >/dev/null
  fi
  echo "==> deployed"
else
  echo "==> build done (local only). Run './sync.sh --deploy' to publish."
fi

#!/usr/bin/env bash
# ============================================================
# Rebuild the Engineering Hub, and optionally deploy to S3 + CloudFront.
#   ./sync.sh            rebuild only (manifest + docs + traceability)
#   ./sync.sh --deploy   rebuild, then sync to S3 and invalidate CloudFront
# The target comes from content/brand.json:
#   "deploy": { "bucket": "my-bucket", "prefix": "hub", "cloudfront": "E123...", "url": "https://example.com/hub" }
# Env overrides: HUB_BUCKET, HUB_PREFIX, HUB_CF, HUB_URL (and the usual AWS_PROFILE / region).
# A hub with its own deploy script (for example deploy-aws.sh) can ignore --deploy.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

echo "==> building hub (manifest, docs, code traceability)"
node build.mjs

if [ "${1:-}" = "--deploy" ]; then
  cfg() { node -e "const b=JSON.parse(require('fs').readFileSync('content/brand.json','utf8'));process.stdout.write(String((b.deploy||{})['$1']||''))" 2>/dev/null || true; }
  : "${HUB_BUCKET:=$(cfg bucket)}"
  : "${HUB_PREFIX:=$(cfg prefix)}"
  : "${HUB_CF:=$(cfg cloudfront)}"
  : "${HUB_URL:=$(cfg url)}"
  : "${HUB_BUCKET:?set deploy.bucket in content/brand.json or HUB_BUCKET}"
  : "${HUB_PREFIX:=engineer-guide}"
  HUB_PREFIX="${HUB_PREFIX#/}"; HUB_PREFIX="${HUB_PREFIX%/}"
  echo "==> deploying to s3://$HUB_BUCKET/$HUB_PREFIX"
  aws s3 sync . "s3://$HUB_BUCKET/$HUB_PREFIX" --delete \
    --exclude ".git/*" --exclude "backend/*" --exclude "ci/*" --exclude "*.sh" --exclude "build.mjs" --exclude "node_modules/*" \
    --exclude "tools/hub-migrate.mjs" --exclude "tools/engine-files.txt" --exclude "README.md" --exclude ".gitignore"
  if [ -n "${HUB_CF:-}" ]; then
    echo "==> invalidating CloudFront $HUB_CF /$HUB_PREFIX/*"
    aws cloudfront create-invalidation --distribution-id "$HUB_CF" --paths "/$HUB_PREFIX/*" >/dev/null
  fi
  echo "==> deployed${HUB_URL:+: $HUB_URL}"
else
  echo "==> build done (local only). Run './sync.sh --deploy' to publish."
fi

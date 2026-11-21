#!/usr/bin/env bash
# ============================================================
# Rebuild the Engineering Hub, and optionally deploy to S3 + CloudFront.
#   ./sync.sh                  rebuild only (manifest + docs + traceability)
#   ./sync.sh --deploy         rebuild, then sync to every target and invalidate CloudFront
#   ./sync.sh --deploy <name>  rebuild, then deploy only the named target
# Targets come from content/brand.json "deploy", either one object or a list of named ones:
#   "deploy": { "bucket": "my-bucket", "prefix": "hub", "cloudfront": "E123...", "url": "https://example.com/hub" }
#   "deploy": [ { "name": "dev", "bucket": ..., ... }, { "name": "demo", "bucket": ..., ... } ]
# Env overrides (one ad-hoc target, ignores brand.json targets): HUB_BUCKET, HUB_PREFIX, HUB_CF, HUB_URL.
# --delete is scoped to s3://<bucket>/<prefix> only; an empty prefix is refused.
# A hub with its own deploy script (for example deploy-aws.sh) can ignore --deploy.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

# loop hubs (brand.json "workspace"): pull the specs and the agentic setup from the workspace first
if node -e "process.exit(JSON.parse(require('fs').readFileSync('content/brand.json','utf8')).workspace?0:1)" 2>/dev/null; then
  echo "==> reading the workspace (specs, findings, commands, agents, hooks)"
  python3 tools/sync_loop.py
  python3 tools/sync_agentic.py
  python3 tools/sync_system.py
  python3 tools/sync_modules.py
  python3 tools/sync_operations.py
  python3 tools/sync_insights.py || echo "insights: skipped (see above)"
fi
echo "==> building hub (manifest, docs, code traceability)"
node build.mjs

if [ "${1:-}" != "--deploy" ]; then
  echo "==> build done (local only). Run './sync.sh --deploy [target]' to publish."
  exit 0
fi
ONLY="${2:-}"

deploy_one() {
  local name="$1" bucket="$2" prefix="$3" cf="$4" url="$5"
  prefix="${prefix#/}"; prefix="${prefix%/}"
  [ -n "$bucket" ] || { echo "target '$name': no bucket" >&2; exit 1; }
  [ -n "$prefix" ] || { echo "target '$name': empty prefix, refusing --delete at the bucket root" >&2; exit 1; }
  echo "==> [$name] deploying to s3://$bucket/$prefix"
  aws s3 sync . "s3://$bucket/$prefix" --delete \
    --exclude ".git/*" --exclude "backend/*" --exclude "ci/*" --exclude "*.sh" --exclude "build.mjs" --exclude "node_modules/*" \
    --exclude "tools/hub-migrate.mjs" --exclude "tools/engine-files.txt" --exclude "README.md" --exclude ".gitignore" </dev/null
  if [ -n "$cf" ]; then
    echo "==> [$name] invalidating CloudFront $cf /$prefix/*"
    aws cloudfront create-invalidation --distribution-id "$cf" --paths "/$prefix/*" </dev/null >/dev/null
  fi
  echo "==> [$name] deployed${url:+: $url}"
}

if [ -n "${HUB_BUCKET:-}" ]; then
  deploy_one "env" "$HUB_BUCKET" "${HUB_PREFIX:-engineer-guide}" "${HUB_CF:-}" "${HUB_URL:-}"
  exit 0
fi

TARGETS=$(node -e '
  const b = JSON.parse(require("fs").readFileSync("content/brand.json", "utf8"));
  let d = b.deploy || [];
  if (!Array.isArray(d)) d = [Object.assign({ name: "default" }, d)];
  d.forEach((t, i) => console.log([t.name || "target" + (i + 1), t.bucket || "", t.prefix || "engineer-guide", t.cloudfront || "", t.url || ""].join("|")));
')
[ -n "$TARGETS" ] || { echo "set deploy in content/brand.json or HUB_BUCKET" >&2; exit 1; }

found=0
while IFS="|" read -r name bucket prefix cf url; do
  if [ -n "$ONLY" ] && [ "$ONLY" != "$name" ]; then continue; fi
  found=1
  deploy_one "$name" "$bucket" "$prefix" "$cf" "$url"
done <<< "$TARGETS"
[ "$found" = 1 ] || { echo "no deploy target named '$ONLY' (have: $(echo "$TARGETS" | cut -d"|" -f1 | paste -sd' ' -))" >&2; exit 1; }

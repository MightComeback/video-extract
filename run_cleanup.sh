#!/bin/bash
exec > debug_run.log 2>&1
set -x

mkdir .hakky-lock 2>/dev/null || exit 0
cd /Users/might/clawd/repos/fathom2action
set -a; source /Users/might/clawd/.secrets/linear.env; set +a

echo "Starting run..."
ls -la check_status.cjs

RESPONSE=$(node scripts/linear.mjs dump MIG-14)
echo "Linear Dump: $RESPONSE"

if [[ "$RESPONSE" == *"Title:"* ]]; then
  echo "Proceeding with cleanup..."
  rm check_status.cjs check_status.js comment_linear.cjs check_issue_desc.cjs status.json status.txt .status issue_status.json issue_status_temp.json .last_issue_state.json test_all.log test_output.txt test_payment.log issue_info.txt issue_info.json issue_details.json 2>/dev/null || true
  
  git add .
  if git commit -m "chore: remove redundant root scripts and temp files"; then
    echo "Committed."
    git push origin main
    SHA=$(git rev-parse HEAD)
    URL=$(gh api repos/MightComeback/fathom-extract/commits/$SHA --jq .html_url)
    echo "Commit URL: $URL"
    node scripts/linear.mjs comment MIG-14 "Removed redundant root scripts and temp artifacts. Commit: $URL"
  else
    echo "Nothing to commit."
  fi
else
  echo "Linear check failed or returned unexpected format."
fi

rmdir .hakky-lock 2>/dev/null
echo "Done."

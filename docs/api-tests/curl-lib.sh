# Shared helpers for the curl proof scripts. Source this file; don't run it.
BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT
FAILURES=0

json() { node -pe "JSON.parse(require('fs').readFileSync('$BODY_FILE','utf8'))$1"; }

# call <expected status> <label> <method> <path> [json body] [token]
call() {
  local expected="$1" label="$2" method="$3" path="$4" body="${5:-}" token="${6:-}"
  local args=(-s -o "$BODY_FILE" -w '%{http_code}' -X "$method" "$BASE$path")
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' -d "$body")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  local status
  status="$(curl "${args[@]}")"
  local result='PASS'
  if [ "$status" != "$expected" ]; then result='FAIL'; FAILURES=$((FAILURES + 1)); fi
  local message=''
  [ -s "$BODY_FILE" ] && message="$(json '.message ?? ""' 2>/dev/null)"
  if [ -z "$message" ] && [ -s "$BODY_FILE" ]; then
    local count
    count="$(json '.count ?? ""' 2>/dev/null)"
    [ -n "$count" ] && message="count: $count"
  fi
  printf '%s  %s  %-44s %s\n' "$result" "$status" "$label" "$message"
}

finish() {
  echo
  if [ "$FAILURES" -eq 0 ]; then echo 'All checks passed.'; else echo "$FAILURES check(s) failed."; exit 1; fi
}

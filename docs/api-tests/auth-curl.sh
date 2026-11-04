#!/usr/bin/env bash
# Proves the sign-in and profile status codes with curl.
# Usage: bash docs/api-tests/auth-curl.sh http://localhost:5000/api
# Needs OTP_MOCK=true and NODE_ENV not set to production. Use a development
# database: the phone account it creates has no delete route yet.
set -u
BASE="${1:?Pass the API base URL, for example http://localhost:5000/api}"

STAMP="$(date +%s)"
EMAIL="curl.${STAMP}@example.com"
OTHER="curl.other.${STAMP}@example.com"
PHONE="+9190$(printf '%08d' "$((STAMP % 100000000))")"
PASSWORD='secret123'
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
  printf '%s  %s  %-42s %s\n' "$result" "$status" "$label" "$message"
}

echo '--- Email path'
REG="{\"username\":\"Curl User\",\"emailId\":\"$EMAIL\",\"age\":21,\"password\":\"$PASSWORD\"}"
call 201 'Register' POST /users "$REG"
call 409 'Register the same email' POST /users "$REG"
call 400 'Register with bad fields' POST /users '{"username":"A"}'
call 404 'Login with an unknown email' POST /login "{\"emailId\":\"nobody.$STAMP@example.com\",\"password\":\"$PASSWORD\"}"
call 401 'Login with a wrong password' POST /login "{\"emailId\":\"$EMAIL\",\"password\":\"wrong-pass\"}"
call 200 'Login' POST /login "{\"emailId\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
TOKEN="$(json '.data.token')"
call 200 'Get my profile' GET /users/me '' "$TOKEN"
call 401 'Get my profile with no token' GET /users/me

echo '--- Own account only'
call 201 'Register a second user' POST /users "{\"username\":\"Other\",\"emailId\":\"$OTHER\",\"age\":22,\"password\":\"$PASSWORD\"}"
call 400 'PUT without emailId' PUT /users '{"username":"Curl","age":22,"password":"secret456"}' "$TOKEN"
call 403 "PUT someone else's account" PUT "/users?emailId=$OTHER" '{"username":"Hack","age":22,"password":"secret456"}' "$TOKEN"
call 400 'PUT without a password' PUT "/users?emailId=$EMAIL" '{"username":"Curl Two","age":22}' "$TOKEN"
call 200 'PUT full update' PUT "/users?emailId=$EMAIL" "{\"username\":\"Curl Two\",\"age\":22,\"password\":\"$PASSWORD\"}" "$TOKEN"
call 200 'PATCH one field' PATCH "/users?emailId=$EMAIL" '{"age":23}' "$TOKEN"

echo '--- Account details'
ADDRESS='{"label":"Home","name":"Curl","phone":"9876543210","line1":"221B Lake Road","city":"Chennai","state":"TN","pincode":"600001"}'
call 201 'Add an address' POST /users/me/addresses "$ADDRESS" "$TOKEN"
ADDRESS_ID="$(json '.data._id')"
call 200 'List addresses' GET /users/me/addresses '' "$TOKEN"
call 200 'Update the address' PUT "/users/me/addresses/$ADDRESS_ID" '{"city":"Madurai"}' "$TOKEN"
call 204 'Delete the address' DELETE "/users/me/addresses/$ADDRESS_ID" '' "$TOKEN"
call 201 'Add a device' POST /users/me/devices '{"name":"Pixel 9"}' "$TOKEN"
call 200 'Change a preference' PATCH /users/me/prefs '{"notificationPrefs":{"priceDrops":false}}' "$TOKEN"

echo '--- Delete'
call 204 'Delete my account' DELETE "/users?emailId=$EMAIL" '' "$TOKEN"
call 401 'Old token after deletion' GET /users/me '' "$TOKEN"
OTHER_TOKEN="$(curl -s -X POST "$BASE/login" -H 'Content-Type: application/json' -d "{\"emailId\":\"$OTHER\",\"password\":\"$PASSWORD\"}" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).data.token")"
curl -s -o /dev/null -X DELETE "$BASE/users?emailId=$OTHER" -H "Authorization: Bearer $OTHER_TOKEN"

echo '--- Phone OTP'
call 400 'Request a code for a bad number' POST /auth/otp/request '{"phone":"12345"}'
call 200 'Request a code' POST /auth/otp/request "{\"phone\":\"$PHONE\"}"
CODE="$(json '.data.devCode')"
WRONG="$([ "$CODE" = '000000' ] && echo 000001 || echo 000000)"
call 401 'Verify with a wrong code' POST /auth/otp/verify "{\"phone\":\"$PHONE\",\"code\":\"$WRONG\"}"
call 200 'Verify with the right code' POST /auth/otp/verify "{\"phone\":\"$PHONE\",\"code\":\"$CODE\"}"
PHONE_TOKEN="$(json '.data.token')"
call 200 'Get the new phone account' GET /users/me '' "$PHONE_TOKEN"
call 400 'Reuse the same code' POST /auth/otp/verify "{\"phone\":\"$PHONE\",\"code\":\"$CODE\"}"
call 501 'Google sign-in' POST /auth/google '{}'

echo
if [ "$FAILURES" -eq 0 ]; then echo 'All checks passed.'; else echo "$FAILURES check(s) failed."; exit 1; fi

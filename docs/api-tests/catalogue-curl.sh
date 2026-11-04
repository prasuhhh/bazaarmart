#!/usr/bin/env bash
# Proves the catalogue status codes with curl.
#
# Default mode needs a seeded admin account, and removes what it creates:
#   bash docs/api-tests/catalogue-curl.sh http://localhost:5000/api admin@example.com 'admin-password'
#
# With the server started using REQUIRE_AUTH_FOR_CATALOGUE=true:
#   bash docs/api-tests/catalogue-curl.sh http://localhost:5000/api --require-auth
set -u
source "$(dirname "$0")/curl-lib.sh"
BASE="${1:?Pass the API base URL, for example http://localhost:5000/api}"
MODE="${2:?Pass the admin email, or --require-auth}"

STAMP="$(date +%s)"
EMAIL="curl.catalogue.${STAMP}@example.com"
PASSWORD='secret123'
REGISTER="{\"username\":\"Curl Shopper\",\"emailId\":\"$EMAIL\",\"age\":21,\"password\":\"$PASSWORD\"}"
LOGIN="{\"emailId\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"

if [ "$MODE" = '--require-auth' ]; then
  echo '--- REQUIRE_AUTH_FOR_CATALOGUE=true'
  call 401 'Products with no token' GET /products
  call 401 'Category with no token' GET /products/audio
  call 401 'Product sheet with no token' GET /products/sheet/A-01-117
  call 401 'Search with no token' GET '/search?q=mouse'
  call 401 'Products with a bad token' GET /products '' 'not-a-token'
  call 201 'Register' POST /users "$REGISTER"
  call 200 'Login' POST /login "$LOGIN"
  TOKEN="$(json '.data.token')"
  call 200 'Products with a token' GET /products '' "$TOKEN"
  call 200 'Zones stay public' GET /zones
  call 204 'Delete the test account' DELETE "/users?emailId=$EMAIL" '' "$TOKEN"
  finish
  exit 0
fi

ADMIN_EMAIL="$MODE"
ADMIN_PASSWORD="${3:?Pass the admin password}"
SKU="A-99-$((STAMP % 1000))"
SIBLING="A-99-$(((STAMP % 1000) + 1000))"
CATEGORY="CurlAudio$STAMP"
product() {
  printf '{"productId":"%s","productName":"Curl Earbuds","productPrice":1999,"category":"%s","quantity":5,"description":"Test.","zoneCode":"A","bay":99,"bayName":"Curl bay","brand":"CurlBrand%s","colours":["Black"],"use":["gym"],"connectivity":"wireless","isNew":true}' "$1" "$CATEGORY" "$STAMP"
}

echo '--- Accounts'
call 200 'Login as admin' POST /login "{\"emailId\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
ADMIN="$(json '.data.token')"
call 201 'Register a shopper' POST /users "$REGISTER"
call 200 'Login as the shopper' POST /login "$LOGIN"
TOKEN="$(json '.data.token')"

echo '--- Admin product changes'
call 401 'POST with no token' POST /products "$(product "$SKU")"
call 403 'POST as a shopper' POST /products "$(product "$SKU")" "$TOKEN"
call 201 'POST as admin' POST /products "$(product "$SKU")" "$ADMIN"
call 201 'POST a second product' POST /products "$(product "$SIBLING")" "$ADMIN"
call 409 'POST a duplicate productId' POST /products "$(product "$SKU")" "$ADMIN"
call 400 'POST an invalid body' POST /products "{\"productId\":\"BAD-$STAMP\",\"productPrice\":-1}" "$ADMIN"
call 200 'PUT an update' PUT "/products?productId=$SKU" '{"productPrice":1799}' "$ADMIN"
call 400 'PUT that fails a validator' PUT "/products?productId=$SKU" '{"productPrice":-5}' "$ADMIN"
call 404 'PUT an unknown product' PUT "/products?productId=NOPE-$STAMP" '{"productPrice":1}' "$ADMIN"
call 400 'PUT with no productId' PUT /products '{"productPrice":1}' "$ADMIN"
call 403 'PUT as a shopper' PUT "/products?productId=$SKU" '{"productPrice":1}' "$TOKEN"

echo '--- Public reads'
call 200 'Zones' GET /zones
call 200 'Products' GET /products
call 200 'Products, filtered' GET "/products?zone=A&bay=99&brand=curlbrand$STAMP,other&colour=black&use=gym&connectivity=wireless&isNew=true&minPrice=100&maxPrice=5000&sort=price_asc&limit=5"
call 400 'Products with a bad filter' GET '/products?minPrice=cheap'
call 200 'Product sheet' GET "/products/sheet/$SKU"
echo "      fits with: $(json '.data.related.map(p => p.productId).join(", ")')"
call 404 'Product sheet, unknown' GET "/products/sheet/NOPE-$STAMP"
call 200 'Category, in a different case' GET "/products/curlaudio$STAMP"
call 404 'Category, empty' GET "/products/no-such-category-$STAMP"
call 200 'Search by exact SKU' GET "/search?q=$SKU"
echo "      first result: $(json '.data[0].productId')"
call 200 'Search by words' GET '/search?q=curl+earbuds'
call 400 'Search with no q' GET /search
call 200 'Kits' GET /kits
KIT="$(json '.data[0]._id')"
call 200 'One kit' GET "/kits/$KIT"
call 404 'Unknown kit' GET /kits/000000000000000000000000
call 400 'Malformed kit id' GET /kits/not-an-id

echo '--- Reviews and questions'
call 200 'Read reviews' GET "/products/$SKU/reviews"
call 401 'Write a review with no token' POST "/products/$SKU/reviews" '{"rating":5,"text":"Great."}'
call 201 'Write a review' POST "/products/$SKU/reviews" '{"rating":5,"text":"Great."}' "$TOKEN"
call 409 'Write a second review' POST "/products/$SKU/reviews" '{"rating":1,"text":"Again."}' "$TOKEN"
call 400 'Write an invalid review' POST "/products/$SIBLING/reviews" '{"rating":9,"text":"Bad."}' "$TOKEN"
call 404 'Review an unknown product' GET "/products/NOPE-$STAMP/reviews"
call 200 'Read questions' GET "/products/$SKU/questions"
call 401 'Ask with no token' POST "/products/$SKU/questions" '{"text":"Waterproof?"}'
call 201 'Ask a question' POST "/products/$SKU/questions" '{"text":"Waterproof?"}' "$TOKEN"

echo '--- Delete'
call 403 'DELETE as a shopper' DELETE "/products?productId=$SKU" '' "$TOKEN"
call 400 'DELETE with no productId' DELETE /products '' "$ADMIN"
call 204 'DELETE as admin' DELETE "/products?productId=$SKU" '' "$ADMIN"
call 404 'DELETE it again' DELETE "/products?productId=$SKU" '' "$ADMIN"
call 204 'DELETE the second product' DELETE "/products?productId=$SIBLING" '' "$ADMIN"
call 204 'Delete the test account' DELETE "/users?emailId=$EMAIL" '' "$TOKEN"

finish

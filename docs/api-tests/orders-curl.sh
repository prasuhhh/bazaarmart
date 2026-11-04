#!/usr/bin/env bash
# Proves the order and shelf rules with curl. It removes its test products and
# accounts, but its orders stay in the database, so use a development database.
# Usage: bash docs/api-tests/orders-curl.sh http://localhost:5000/api admin@example.com 'admin-password'
set -u
source "$(dirname "$0")/curl-lib.sh"
BASE="${1:?Pass the API base URL, for example http://localhost:5000/api}"
ADMIN_EMAIL="${2:?Pass the admin email}"
ADMIN_PASSWORD="${3:?Pass the admin password}"

STAMP="$(date +%s)"
SKU="T-99-$STAMP"
PASSWORD='secret123'
EMAIL="curl.orders.${STAMP}@example.com"
OTHER="curl.orders.other.${STAMP}@example.com"
GUEST_PHONE="+9191$(printf '%08d' "$((STAMP % 100000000))")"
WRONG_PHONE='%2B919000000000'
ENCODED_PHONE="%2B${GUEST_PHONE#+}"
DETAILS='"address":{"name":"Asha","phone":"9876543210","line1":"221B Lake Road","city":"Chennai","state":"Tamil Nadu","pincode":"600001"},"slot":{"label":"Tomorrow"},"payment":{"method":"upi"}'

items() { printf '"items":[{"productId":"%s","qty":%s}]' "$SKU" "$1"; }
show_stock() {
  curl -s "$BASE/products/sheet/$SKU" | node -pe "'      stock is now ' + JSON.parse(require('fs').readFileSync(0,'utf8')).data.product.quantity"
}
order_no() { json '.data.orderNo'; }

echo '--- Setup'
call 200 'Login as admin' POST /login "{\"emailId\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
ADMIN="$(json '.data.token')"
call 201 'Create a product, stock 10' POST /products "{\"productId\":\"$SKU\",\"productName\":\"Curl Speaker\",\"productPrice\":1500,\"category\":\"Audio\",\"quantity\":10,\"description\":\"Test.\"}" "$ADMIN"
call 201 'Register a shopper' POST /users "{\"username\":\"Curl One\",\"emailId\":\"$EMAIL\",\"age\":21,\"password\":\"$PASSWORD\"}"
call 200 'Login as the shopper' POST /login "{\"emailId\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
TOKEN="$(json '.data.token')"
call 201 'Register another user' POST /users "{\"username\":\"Curl Two\",\"emailId\":\"$OTHER\",\"age\":22,\"password\":\"$PASSWORD\"}"
call 200 'Login as the other user' POST /login "{\"emailId\":\"$OTHER\",\"password\":\"$PASSWORD\"}"
OTHER_TOKEN="$(json '.data.token')"

echo '--- Guest checkout'
call 400 'Guest with no guest details' POST /orders "{$(items 1),$DETAILS}"
call 201 'Guest checkout, qty 2' POST /orders "{$(items 2),$DETAILS,\"guest\":{\"name\":\"Curl Guest\",\"phone\":\"$GUEST_PHONE\"}}"
GUEST_ORDER="$(order_no)"
echo "      subtotal $(json '.data.subtotal'), delivery $(json '.data.delivery'), total $(json '.data.total'), payment $(json '.data.payment.status')"
show_stock
call 200 'Guest tracks with the right phone' GET "/orders/$GUEST_ORDER/track?phone=$ENCODED_PHONE"
call 403 'Guest tracks with a wrong phone' GET "/orders/$GUEST_ORDER/track?phone=$WRONG_PHONE"
call 400 'Guest tracks with no phone' GET "/orders/$GUEST_ORDER/track"

echo '--- Logged-in checkout'
call 201 'Checkout, qty 3, with a coupon' POST /orders "{$(items 3),$DETAILS,\"coupon\":\"WELCOME10\"}" "$TOKEN"
ORDER="$(order_no)"
echo "      subtotal $(json '.data.subtotal'), coupon -$(json '.data.coupon'), total $(json '.data.total')"
show_stock
call 409 'Checkout more than the stock' POST /orders "{$(items 99),$DETAILS}" "$TOKEN"
show_stock
call 400 'Checkout with no address' POST /orders "{$(items 1),\"slot\":{\"label\":\"Tomorrow\"},\"payment\":{\"method\":\"upi\"}}" "$TOKEN"
call 400 'Checkout with a bad coupon' POST /orders "{$(items 1),$DETAILS,\"coupon\":\"NOPE\"}" "$TOKEN"
call 404 'Checkout an unknown product' POST /orders "{\"items\":[{\"productId\":\"NOPE-$STAMP\",\"qty\":1}],$DETAILS}" "$TOKEN"

echo "--- Other users' orders"
call 200 'Owner reads the order' GET "/orders/$ORDER" '' "$TOKEN"
call 403 'Another user reads it' GET "/orders/$ORDER" '' "$OTHER_TOKEN"
call 403 'Another user tracks it' GET "/orders/$ORDER/track" '' "$OTHER_TOKEN"
call 403 'Another user cancels it' PATCH "/orders/$ORDER" '{"cancel":true}' "$OTHER_TOKEN"
call 401 'No token' GET "/orders/$ORDER"

echo '--- Cancel rules'
call 200 'Change the slot' PATCH "/orders/$ORDER" '{"slot":{"label":"Today 6-9 pm"}}' "$TOKEN"
call 200 'Leave at door' PATCH "/orders/$ORDER" '{"leaveAtDoor":true,"deliveryNote":"By the gate"}' "$TOKEN"
call 200 'Cancel before shipping' PATCH "/orders/$ORDER" '{"cancel":true}' "$TOKEN"
echo "      payment is now $(json '.data.payment.status')"
show_stock
call 409 'Cancel it again' PATCH "/orders/$ORDER" '{"cancel":true}' "$TOKEN"
show_stock
call 201 'Place another order, qty 1' POST /orders "{$(items 1),$DETAILS}" "$TOKEN"
LIVE_ORDER="$(order_no)"

echo '--- Admin status changes'
call 403 'A shopper changes the status' PATCH "/admin/orders/$LIVE_ORDER/status" '{"status":"packed"}' "$TOKEN"
call 409 'Admin skips a step' PATCH "/admin/orders/$LIVE_ORDER/status" '{"status":"delivered"}' "$ADMIN"
call 400 'Admin sends an unknown status' PATCH "/admin/orders/$LIVE_ORDER/status" '{"status":"lost"}' "$ADMIN"
call 200 'Admin marks it packed' PATCH "/admin/orders/$LIVE_ORDER/status" '{"status":"packed"}' "$ADMIN"
call 200 'Admin marks it shipped' PATCH "/admin/orders/$LIVE_ORDER/status" '{"status":"shipped"}' "$ADMIN"
call 409 'Cancel after shipping' PATCH "/orders/$LIVE_ORDER" '{"cancel":true}' "$TOKEN"
call 200 'Track before delivery' GET "/orders/$LIVE_ORDER/track" '' "$TOKEN"
echo "      delivery OTP shown: $(json '.data.deliveryOtp ? "yes" : "no"')"
call 200 'Admin marks it out for delivery' PATCH "/admin/orders/$LIVE_ORDER/status" '{"status":"out_for_delivery"}' "$ADMIN"
call 200 'Track when out for delivery' GET "/orders/$LIVE_ORDER/track" '' "$TOKEN"
echo "      delivery OTP shown: $(json '.data.deliveryOtp ? "yes" : "no"')"
call 200 'List live orders' GET '/orders?status=live' '' "$TOKEN"
call 200 'List cancelled orders' GET '/orders?status=cancelled' '' "$TOKEN"
call 400 'List with a bad status' GET '/orders?status=lost' '' "$TOKEN"

echo '--- Shelves'
call 201 'Create a shelf' POST /shelves '{"name":"New desk"}' "$TOKEN"
SHELF="$(json '.data._id')"
SHARE="$(json '.data.shareId')"
call 201 'Save a product' POST "/shelves/$SHELF/items" "{\"productId\":\"$SKU\"}" "$TOKEN"
call 409 'Save it again' POST "/shelves/$SHELF/items" "{\"productId\":\"$SKU\"}" "$TOKEN"
call 200 'Admin drops the price to 1320' PUT "/products?productId=$SKU" '{"productPrice":1320}' "$ADMIN"
call 200 'List my shelves' GET /shelves '' "$TOKEN"
echo "      saved ₹$(json '.data[0].items[0].savedPrice'), now ₹$(json '.data[0].items[0].currentPrice'), change $(json '.data[0].items[0].percentChange')%"
call 200 'Open the share link with no login' GET "/shelves/shared/$SHARE"
call 403 "Open someone else's shelf" GET "/shelves/$SHELF" '' "$OTHER_TOKEN"
call 204 'Remove the product' DELETE "/shelves/$SHELF/items/$SKU" '' "$TOKEN"
call 204 'Delete the shelf' DELETE "/shelves/$SHELF" '' "$TOKEN"

echo '--- Cleanup'
call 204 'Delete the test product' DELETE "/products?productId=$SKU" '' "$ADMIN"
call 204 'Delete the shopper' DELETE "/users?emailId=$EMAIL" '' "$TOKEN"
call 204 'Delete the other user' DELETE "/users?emailId=$OTHER" '' "$OTHER_TOKEN"

finish

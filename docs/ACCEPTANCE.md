# BazaarMart acceptance audit

Audited on 5 November 2026 against CONTEXT.md section 11 and DESIGN.md section 11. **All 20 lines pass.**

"Test C1" means the test with that label in `backend/tests/acceptance.test.js`. Browser checks ran in headless Chromium against a seeded temporary database.

## Results

| Check | Result |
|---|---|
| Backend tests (`npm test`) | 308 of 308 pass |
| Browser checks | 137 of 137 pass, across three suites, plus 120 layout measurements |
| Thunder Client collection, replayed from the exported file | 183 of 183 requests return the expected status |
| Routes in the code missing from the collection | 0 of 54 |
| curl scripts | All pass, with the catalogue script also run under `REQUIRE_AUTH_FOR_CATALOGUE=true` |
| `npm audit --omit=dev`, backend and frontend | 0 vulnerabilities |

The collection saw 200, 201, 204, 400, 401, 403, 404, 409, 429 and 501. 503 needs `OTP_MOCK` turned off and 500 needs a database failure, so a request alone can't trigger them.

## CONTEXT.md section 11

| # | Line | Result | Evidence |
|---|---|---|---|
| C1 | Duplicate email gives "Email ID is already registered" (409) | Pass | Test C1 |
| C2 | Unknown email 404, wrong password 401 | Pass | Test C2 |
| C3 | Products need a valid JWT; a bad or expired token gives 401 and the UI logs out | Pass | Test C3, run with `REQUIRE_AUTH_FOR_CATALOGUE=true`; browser check for the logout and "Session expired" notice |
| C4 | Profile PUT, PATCH and DELETE work only on your own account (403 otherwise) | Pass | Test C4; browser check confirms the page sends `?emailId=` |
| C5 | Products: POST 201, GET 200 with `count`, category 200/404, PUT 200/404, DELETE 204/404 | Pass | Test C5 |
| C6 | Duplicate `productId` 409, missing `productId` query 400, invalid body 400 | Pass | Test C6 |
| C7 | A non-admin can't create, update or delete products (403) | Pass | Test C7 |
| C8 | No secrets in the repo; a fresh clone runs with only `.env` files filled in | Pass | Test C8; see "Secrets and fresh clone" |
| C9 | Layout works at desktop, tablet and phone widths | Pass | See "Layout" |

## DESIGN.md section 11

| # | Line | Result | Evidence |
|---|---|---|---|
| D1 | Day and Night shift toggle works and persists | Pass | Browser check, including after a reload |
| D2 | GO TO: `A-01-117` jumps to its sheet; "earbuds" lists matches | Pass | Test D2; browser checks for SKU + Enter and for picking a result |
| D3 | Tile sizes reflect stock; click opens the zone; peek shows the zone's first nine products | Pass | Test D3; browser checks. Area per unit of stock is within 1.3× across zones above the 112 px minimum tile width. Body care is larger than its share so its name stays readable |
| D4 | Filters change results and the URL | Pass | Test D4; browser check, including a reload |
| D5 | `+`, the product sheet and conveyor drag all update Receipt · N | Pass | Browser checks for all three, including a drag dropped elsewhere adding nothing |
| D6 | Guest can check out; a member sees the order; totals are computed server-side | Pass | Test D6, which sends false prices; browser check of the guest journey |
| D7 | Admin status change updates Orders, the bar, Track, the live badge and the LIVE ORDER card | Pass | Test D7; demo steps 6 and 7 |
| D8 | OTP works with the mock code; wrong 401, expired 400 | Pass | Test D8; browser check of the six boxes |
| D9 | Shelf create, share, price drop and move to receipt; the link works logged out | Pass | Test D9; browser checks, including "↓ 12% since saved" |
| D10 | Addresses CRUD, preference toggles, and PUT, PATCH, DELETE on `?emailId=` (403 on someone else's) | Pass | Test D10, test C4; browser checks |
| D11 | Layout checked at 1440, 1024, 768 and 390 px in both themes | Pass | See "Layout" |

## Layout

Every page was loaded at 1440, 1024, 768 and 390 px in Day and Night shift, with no sideways page scroll anywhere. Screenshots were also read by eye against the wireframes. Product grids step 6, 4, 3, 2 columns as designed, and no zone name is cut off at any width down to 320 px. On phones the admin tables scroll sideways inside their own box.

## Secrets and fresh clone

- No `.env`, key or credential file is tracked, or has ever been committed.
- The real `MONGO_URI`, `JWT_SECRET` and seed passwords were each searched for in all tracked files and across all of git history, with 0 matches.
- A new `git clone` installed, seeded, started, built and passed all 308 tests with only `backend/.env` and `frontend/.env` filled in.

## Demo journey

All 12 steps ran in a real browser and passed.

1. Created an account and signed in.
2. Found a product with the GO TO box and saved it to a new shelf.
3. Copied the share link, which opened logged out.
4. Moved the shelf to the receipt and checked out with a new address and simulated UPI.
5. Orders, the progress bar, the live badge and the LIVE ORDER card all agreed.
6. An admin advanced the order to Out for delivery from the admin page.
7. Orders and Track updated, with the delivery OTP and a narrower ETA window.
8. Downloaded the invoice.
9. Edited the profile with PUT. The new password worked and the old one was refused.
10. Edited the profile with PATCH, which changed only the age.
11. Deleted the account with DELETE. The login and the share link both stopped working.
12. The order stayed on record for the admin.

## Fixed during this work

| Problem | Fix |
|---|---|
| A deleted account's public shelf links kept working | Deleting an account now removes its shelves |
| Phone-only accounts couldn't edit or delete themselves, because the lab routes need an email | Added `PATCH` and `DELETE /api/users/me` |
| Adding an email to a phone account would have lost its receipt | The receipt now uses a stable key |
| The "account deleted" notice disappeared on the redirect | It's now shown once, in the right order |
| Order progress bars didn't line up between rows | The thumbnail column has a fixed width |

## Known gaps outside the checklists

These pass nothing and fail nothing above, but differ from the wider design.

- Receipts stay in the browser. DESIGN.md section 2 says they sync for logged-in users.
- Nobody can answer a customer's Q&A question yet, because there's no answer route or screen.
- Product sheets show 3 photos, while the wireframe's strip shows 5.
- The Orders wireframe hides one control behind a sticky note. It's marked [CONFIRM] in DESIGN.md, so it wasn't built.

The README's "Known trade-offs" section lists the deliberate ones, such as the JWT in `localStorage` and the mock OTP, payments and map.

# BazaarMart — Design & Requirements (v2, from the Lovable wireframe)

> Replaces the earlier draft. Source: 9 wireframe screenshots (in `wireframe/`, numbered 01–09) + `CONTEXT.md`.
> **CONTEXT.md still rules the backend foundations** (ES modules, Express 5 + Mongoose, `/api` envelope, status codes, JWT, `?emailId=` / `?productId=` lab routes, security). **This file rules the UI and the new features the wireframe adds.** Where they differ, §10 lists each difference and the default I chose. Items tagged **[CONFIRM]** need Tarun's yes/no.
>
> Reading the wireframe: yellow sticky notes are the designer's annotations (requirements in words), not UI to build. Grey bars are placeholder text, `₹000` is a placeholder price, X-boxes are image placeholders.

---

## 1. Concept

**BazaarMart — "lifestyle × tech"**. A store that behaves like a physical floor: you *walk in* through a **store map** of **zones**, browse **bays** (shelves) of products, put things on your **receipt** (cart), save them to **shelves** (wishlists), pay at the **counter** (checkout), and follow the parcel. Everything is a retail metaphor, and the copy should keep it up.

| Retail word | Means |
|---|---|
| Taskbar | left sidebar navigation |
| Store map | home / category overview |
| Zone / Bay | category / sub-category |
| Product sheet | product detail page |
| Receipt | cart (count shown top right) |
| Bench | compare list |
| Saved shelf | wishlists (named, shareable) |
| Counter | checkout |
| Day shift / Night shift | light / dark theme toggle |
| SKU / code | product code like `A-01-117` = Zone A · Bay 01 · item 117 |

## 2. App shell (on every page)

**Left sidebar "TASKBAR"** (fixed, ~380px on desktop; becomes a slide-over drawer under 900px)
- Brand: **Bazaar/Mart** (slash in orange), caption `lifestyle × tech` in mono.
- Numbered items, active one is a black filled pill with white text:
  `01 Store map` · `02 Browse zone` · `03 Product sheet` · `04 Saved shelf` · `05 Counter (checkout)` · `06 Orders` (orange badge **"2 live"** = count of in-progress orders) · `07 Track parcel` · `08 Profile` · `09 Sign in` (shows **Sign out** when logged in).
- Bottom: dashed **LIVE ORDER #BM-2041** mini card (order no., 5-segment progress bar, "Delivery · 4:30 pm"); clicking opens Track parcel. Hidden when there is no live order.
- `03 Product sheet` and `07 Track parcel` open the last viewed product / latest live order; if none, they show a gentle empty state with a link to Store map / Orders.

**Top bar**
- Left: page title (e.g. "Store map", "Zone A · Audio", "Product sheet · A-01-117", "Track · #BM-2041", "Counter · checkout").
- Centre: dashed command box **`GO TO · code "T-04-117" or "linen shirt"`** — type a SKU (jumps to its product sheet) or words (shows a result dropdown of matching products and zones). Keyboard shortcut `/` focuses it.
- Right: **Day shift** toggle (theme), **Receipt · N** (opens the receipt drawer; N = line count), circular avatar (→ Profile or Sign in).

**Receipt drawer** (slides from right): lines with qty steppers, remove, subtotal, button **"Go to counter"**. Receipt persists in `localStorage` for guests and syncs for logged-in users.

**Notices**: toast banner (success/error/info), shows the API `message` verbatim. Buttons show **"Please wait…"** while busy.

## 3. Visual system (from screenshots — hex values are my estimates, **[CONFIRM]** against Lovable if you can)

| Token | Light ("Day shift") | Night shift (derive) |
|---|---|---|
| `--bg` page | `#F6F3EC` with faint 24px grid lines | `#14120F` grid `#1E1B17` |
| `--panel` | `#FCFBF9` | `#1B1814` |
| `--sidebar` | `#E8E4DD` | `#221F1A` |
| `--ink` | `#1A1613` | `#F2EEE6` |
| `--muted` | `#6B645B` | `#9A9288` |
| `--accent` orange | `#FF5A1F` (buttons, badges, price-drop, progress) | same |
| `--sticky` | `#F7DC7A` (zone highlight, tags, price chips) | `#C9A93A` |
| `--placeholder` | `#E7E3DC` | `#2A2621` |

- **Fonts:** monospace (JetBrains Mono / Space Mono) for labels, nav, codes, buttons; heavy grotesk (Space Grotesk 700) for titles. Uppercase letter-spaced mono for section captions ("ENTRY PASS", "CONVEYOR · NEW DROPS · DRAG ONTO RECEIPT").
- **Look:** 2px near-black borders, **hard offset shadow** (6px 6px 0 ink) on primary cards, **dashed borders** for secondary/interactive boxes, square-ish corners (2–4px), no gradients.
- Price: `₹` + `Intl.NumberFormat('en-IN')`; price chips have a sticky-yellow background in grids.
- "Night shift" persists in `localStorage`; default follows `prefers-color-scheme`. Tarun mentioned a dark-mode sample image; none of the 9 images I received was dark, so the night palette above is derived. **[CONFIRM]** send it if you want it matched exactly.
- Responsive: ≥1200 full layout; 900–1199 sidebar collapses to icons+numbers; <900 drawer + top bar hamburger; product grids 6 → 4 → 3 → 2 columns; two-column detail layouts stack.

## 4. Routes

| Route | Page (taskbar item) | Access |
|---|---|---|
| `/` | redirects to `/map` | — |
| `/map` | 01 Store map | public |
| `/zone/:zoneCode` | 02 Browse zone (e.g. `/zone/A`; `/zone` = first zone) | public |
| `/p/:sku` | 03 Product sheet | public |
| `/saved` | 04 Saved shelf | login |
| `/counter` | 05 Counter (checkout) | **guest allowed** |
| `/orders` | 06 Orders | login |
| `/track/:orderNo` | 07 Track parcel | login (guests: order no. + phone) |
| `/profile` | 08 Profile | login |
| `/signin` | 09 Sign in | public |
| `/s/:shareId` | Public shared shelf view | public |
| `/admin/products` | Admin product manager (not in wireframe, required by CONTEXT.md) | admin |
| `*` | Not found | public |

## 5. Pages

### 5.1 Sign in `/signin` (screen 01)
- Left: large image placeholder (hero/illustration area, X-box). Right: shadowed card **ENTRY PASS · "Walk in."**
- Phone field `+91 · phone number`, **six OTP boxes**, orange **Get OTP** button (becomes **Verify** after the code is sent; resend after 30s).
- Divider, then secondary dashed buttons **Google** and **Email**. Sticky note: *"Phone OTP first (India). Guest checkout allowed."*
- **Email** opens the email+password form (login + a "Create account" link with username, email, age, password) — this keeps the lab's Register/Login and JWT flow intact.
- **Google**: UI present; see §10 (stub unless Tarun supplies OAuth credentials).
- After success: return to the page the user came from, else `/map`. New phone users get an account created automatically; Profile asks them to complete name/email later.

### 5.2 Store map `/map` (screen 02)
- Sticky note: *"Floor plan of tech + lifestyle zones. Size = stock. Click to walk in."*
- **Floor plan grid** of zone tiles with mono caption `ZONE X` and bold name: A **Audio**, W **Wearables** (shown highlighted in sticky yellow = hovered/selected), D **Desk setup**, L **Living** (large), S **Style**, G **Gaming**, C **Carry**, P **Phone+**, B **Body care**. **Tile area is proportional to the zone's total stock** (CSS grid spans computed from `GET /api/zones`). Click/Enter → `/zone/:code`.
- **Peek panel** (right, shadowed card, titled "Wearables · Bay 02", label "peek"): shows the hovered zone's first bay as a 3×3 grid of thumbnails with SKU captions (`W-02-00`…). Clicking a thumbnail opens its product sheet.
- **Conveyor · new drops · drag onto receipt**: horizontal scroller of newest products (image, ₹ price). Dragging a card onto the **Receipt** button in the top bar adds it (pointer-events drag; also a click "+" fallback for touch).
- **Kits** (3 cards with a short image, label "KIT"): *Build a desk setup*, *Pair a look with a watch*, *Gift under ₹2000*. Each opens a curated product list (a kit = named query/preset: `GET /api/kits`, seeded).

### 5.3 Browse zone `/zone/:code` (screen 03)
- Title "Zone A · Audio". **Filter "dials"** row of dashed pills (sticky note: *"Filters are 'dials' by use-case, not a long sidebar of checkboxes"*): **Budget → Premium** (price range slider), **Wired / Wireless**, **Use: gym · commute · studio**, **Brand**, **Colour**; at right **View: shelf | list | bench**.
- Below: one section per **bay** — "Bay 01 · Earbuds", "Bay 02 · Headphones", "Bay 03 · Speakers" — each with `12 ITEMS →` (link to expand the bay) and a 6-column row of product cards.
- **Product card:** square image, name (bar placeholder), yellow price chip, `☆` (save to a shelf) and `+` (add to receipt) at the bottom right. Click the card → product sheet.
- **View modes:** *shelf* = the bay rows above; *list* = compact rows with specs; *bench* = side-by-side compare table of products the user "put on the bench".
- Filters call `GET /api/products?zone=A&…` and update the URL query string.

### 5.4 Product sheet `/p/:sku` (screen 04)
- Title "Product sheet · A-01-117". Left: vertical thumbnail strip (5) + big image; sticky note: *"360° drag + 'see it on desk / on wrist' scale toggle."* (v1: drag-to-rotate through an image sequence if provided, otherwise the toggle just swaps to the scale images; mark as progressive enhancement.)
- Right spec card (shadowed): caption `AUDIO · BAY 01`, **product name**, rows with dashed dividers: **Price, Battery, Weight, Stock, Arrives, Seller, Warranty** (generic `specs` list; Battery/Weight apply to tech only, other zones show their own spec rows).
- **Colour swatches** as dashed pills (Black / Sand / Olive). Buttons: orange **Add to receipt**, **Put on bench** (compare), `☆` save (opens shelf picker, can create a new shelf).
- Bottom row of three dashed panels: **FITS WITH** (3 related products), **OWNER NOTES (REVIEWS)**, **Q&A** (questions with answers; logged-in users can ask).
- Stock 0 → "Out of stock" and Add disabled.

### 5.5 Saved shelf `/saved` (screen 05)
- Three-column grid of **named shelves** (cards: "New desk", "Trip kit", "Birthday ideas"), each with a **SHARE** link (copies `/s/:shareId`), up to N items showing thumbnail, name, price and orange **↓ 12% since saved** (price-drop watch per item), and the underlined link **Move whole shelf to receipt**. Sticky note: *"Price-drop watch per item. Shelves can be shared as a link."*
- Actions: create shelf, rename, delete shelf, remove item.

### 5.6 Counter (checkout) `/counter` (screen 09)
- Sticky note: *"All steps on one screen, no page jumps. Each step collapses when done."* Left: three accordion steps with numbered black circles:
  1. **Deliver to** — default address summary `Home · 221B … (change)`; address list/add form; guests enter name, phone, address.
  2. **When** — slot options `Today 6–9 pm · Tomorrow · Pick a day`.
  3. **Pay with** — `UPI · Card · Netbanking · COD`.
  Below: dashed extras strip **GIFT WRAP · NOTE · GST INVOICE** (toggle gift wrap, text note ≤200 chars, GST invoice with GSTIN field).
- Right: **RECEIPT** panel (shadowed): lines `SKU name ₹`, then Subtotal, Delivery, Coupon, **TOTAL**, orange **Pay ₹N** button.
- Payment is **simulated** (no real gateway): choosing UPI/Card/Netbanking shows a mock "payment successful" step; COD places the order directly. Never collect or store real card numbers. **[CONFIRM]**
- On success → order created (status `placed`), receipt cleared, redirect to `/track/:orderNo` with notice "Order #BM-2042 placed".

### 5.7 Orders `/orders` (screen 08)
- Sticky note: *"Orders as a timeline of receipts. 5-segment bar = ordered → packed → shipped → out → delivered."*
- Tabs: **All · Live (n) · Delivered · Returns · Cancelled** (a right-side extra control is hidden behind the note — likely search/sort; **[CONFIRM]**).
- Vertical dashed timeline with circle nodes; each order card: `#BM-2041`, `3 items · ₹total`, three thumbnails, orange **5-segment progress bar** + status text ("Out for delivery", "Packed", "Delivered · 2 Oct", "Returned · refund done"), buttons **Track**, **Invoice** (downloadable HTML/PDF invoice), **Buy again** (adds all items to receipt).

### 5.8 Track parcel `/track/:orderNo` (screen 07)
- Title "Track · #BM-2041". Sticky note: *"Live route map. ETA window shrinks as it gets closer."*
- Left: dashed **route map** area: dashed curve from "● Warehouse" to "⌂ You" with an orange **▲ Parcel now** marker positioned by progress (v1 is a simulated SVG route, no real map/GPS). Under it three tiles: **ETA** (big "4:30 pm"), **COURIER** (name, Call · Chat), **DELIVERY OTP** (4-digit code to tell the courier; visible only to the owner when status is out-for-delivery).
- Right card: **JOURNEY** timeline (Ordered · date time, Packed, Shipped, Out for delivery, Delivered — filled orange dots for completed), **IN THIS PARCEL** (thumbnails + names), buttons **Change slot**, **Leave at door**, **Help**.

### 5.9 Profile `/profile` (screen 06)
- **Member card** header (sticky note: *"Header reads like a store membership card."*): avatar circle, `MEMBER CARD · SINCE {year}`, name, `email · phone`, stats **orders / ₹ saved / shelves**.
- Six dashed panels in a 3×2 grid:
  - **Addresses** (Home · default, Office, + Add), **Payments** (UPI handle, card `···· 4021` display-only token, + Add), **My devices** (registered gadgets, warranty expiry, accessory matches),
  - **Style profile** (sizes, fits & colours, brands I like), **Notifications** (order updates, price drops, new drops in zones — toggles), **Account** (Password & login, Privacy, **Sign out**).
- **Lab requirements live here:** Account panel contains **Edit profile (PUT)**, **Quick edit (PATCH)** and **Delete my account (DELETE)** using `?emailId=`; email is read-only there.

### 5.10 Admin products `/admin/products` (not in wireframe)
Styled in the same system (dashed cards, mono labels). Form + table to create/edit/delete products: SKU (`productId`), name, zone, bay, brand, price, stock, colours, specs, images, description. Uses `POST/PUT/DELETE /api/products` (admin). Admin also gets an order-status control to advance an order (needed to demo tracking). Link appears in the taskbar only for admins.

## 6. Data model (extends CONTEXT.md §4)

- **User:** `username`, `emailId` (unique, optional for phone-only users — sparse unique), `phone` (unique sparse, `+91…`), `age` (optional), `password` (select:false, optional for OTP users), `role`, `addresses[{label,name,phone,line1,line2,city,state,pincode,isDefault}]`, `paymentMethods[{type:'upi'|'card',label,last4?}]` (display tokens only), `devices[{name,category,purchasedAt,warrantyUntil}]`, `stylePrefs{sizes,colours,brands}`, `notificationPrefs{orderUpdates,priceDrops,newDrops}`, timestamps.
- **Product:** `productId` (= **SKU** like `A-01-117`, unique), `productName`, `productPrice`, `quantity` (stock), `category` (= zone name e.g. "Audio"), `zoneCode` (A/W/D/L/S/G/C/P/B), `bay` (number), `bayName`, `brand`, `colours[]`, `use[]` (gym/commute/studio…), `connectivity` (wired|wireless|n/a), `specs{label:value}` (map), `images[]`, `seller`, `warrantyMonths`, `arrivesInDays`, `isNew`, `description`, timestamps.
- **Zone** (seeded, read-only): `code`, `name`, `order`, `layout{col,row}`. Stock per zone is aggregated from products.
- **Shelf:** `user`, `name`, `shareId`, `items[{ product(SKU), savedPrice, savedAt }]`.
- **Order:** `orderNo` (`BM-2041`), `user?` (null for guest), `guest{name,phone,email}`, `items[{productId,name,price,qty,image}]`, `address`, `slot{label,date}`, `payment{method,status}`, `gift{wrap,note}`, `gst{invoice,gstin}`, `subtotal`, `delivery`, `coupon`, `total`, `status` (`placed|packed|shipped|out_for_delivery|delivered|returned|cancelled`), `events[{status,at}]`, `courier{name,phone}`, `etaAt`, `deliveryOtp`, timestamps.
- **Review**, **Question**: `product`, `user`, `rating/text`, `answer?`.
- **Kit** (seeded): `title`, `query` or `productIds[]`.

## 7. API additions (all under `/api`, same envelope and status codes as CONTEXT.md)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/otp/request` | public | `{phone}`; **mock provider**: code printed to server log and, when `NODE_ENV!=production`, returned in the response as `devCode`. Rate-limited (5/10 min). |
| POST | `/auth/otp/verify` | public | `{phone, code}` → `{ token, user }` (creates user if new). Codes expire in 5 min, hashed. |
| POST | `/auth/google` | public | stub → 501 "Google sign-in not configured" until credentials exist |
| GET | `/zones` | public | zones with `productCount`, `totalStock`, `bays[]` |
| GET | `/products` | **public** | filters: `zone, bay, q, minPrice, maxPrice, brand, colour, use, connectivity, sort, isNew, limit` ; includes `count` |
| GET | `/products/sheet/:productId` | public | full product + related ("fits with") |
| GET | `/products/:category` | public | lab route kept: case-insensitive, escaped regex, 404 if none |
| GET | `/search?q=` | public | SKU exact match or name/zone text search, max 8 results (GO TO box) |
| POST/PUT/DELETE | `/products` (`?productId=`) | admin | unchanged from CONTEXT.md |
| GET/POST | `/products/:productId/reviews`, `/questions` | read public / write login | |
| GET/POST/PATCH/DELETE | `/shelves`, `/shelves/:id`, `/shelves/:id/items` | login | `GET /shelves/shared/:shareId` is public |
| POST | `/orders` | **optional JWT** | guest checkout; server recomputes prices and totals from DB, validates stock, decrements atomically |
| GET | `/orders?status=live\|delivered\|returns\|cancelled` | login | |
| GET | `/orders/:orderNo` / `/orders/:orderNo/track` | login (guest: `?phone=`) | journey events, ETA, courier, delivery OTP (owner only) |
| PATCH | `/orders/:orderNo` | owner | change slot, leave-at-door note, cancel (only before `shipped`) |
| PATCH | `/admin/orders/:orderNo/status` | admin | advance status; appends an event |
| GET | `/kits`, `/kits/:id` | public | |
| (existing) | `/users`, `/login`, `/users?emailId=` PUT/PATCH/DELETE, `/users/me` | per CONTEXT.md | addresses/devices/prefs are managed via `PATCH /users/me` sub-resources: `/users/me/addresses`, `/users/me/devices`, `/users/me/prefs` |

Rules unchanged: no stack traces in production, 409 duplicates, 400 for validation/missing query, never accept `role` from clients, prices always come from the DB (never trust client totals).

## 8. Frontend structure (replaces CONTEXT.md §6 frontend block)

```
frontend/src/
  main.jsx, App.jsx (routes only)
  api/client.js
  context/  AuthContext, ReceiptContext (cart), ThemeContext, NoticeContext
  components/ layout/{Shell,Taskbar,TopBar,CommandBox,ReceiptDrawer,LiveOrderCard}
              ui/{Button,DashedBox,Sticky? (only for dev notes, off in prod),Notice,Toggle,OtpInput,Pill,Segments}
              shop/{ProductCard,PriceChip,ZoneTile,BayRow,FilterDials,SwatchPicker,SpecTable}
  pages/ SignIn, StoreMap, BrowseZone, ProductSheet, SavedShelf, SharedShelf, Counter, Orders, TrackParcel, Profile, AdminProducts, NotFound
  hooks/ useDebounce, useLocalStorage, useDragToReceipt
  styles/ tokens.css, base.css, layout.css, components.css
```

## 9. Phasing

- **Phase 1 – lab core (must pass CONTEXT.md §11):** shell + theme, email/password auth, products list/filter/category, admin product CRUD, profile PUT/PATCH/DELETE, product sheet, receipt, seed.
- **Phase 2 – the shopping flow:** zones/store map, browse filters, shelves, counter, orders, track parcel, OTP sign-in (mock).
- **Phase 3 – extras:** reviews/Q&A, bench compare, kits, 360° view, GST invoice PDF, Google sign-in, real SMS/payment/maps.

## 10. Differences from CONTEXT.md and defaults chosen

| # | CONTEXT.md | Wireframe | Default I chose |
|---|---|---|---|
| 1 | Name "Simple Store", green `#1e4934` theme, DM Sans/Manrope | **BazaarMart**, cream/black/orange, mono + grotesk, dashed/hard-shadow style | Use the wireframe. DB renamed `bazaarmart`; repo folder `bazaarmart/`. **[CONFIRM]** |
| 2 | Auth = email + password only | **Phone OTP (India) first**, Google, Email; guest checkout | Keep email+password (lab-required) as the "Email" option; add phone OTP with a **mock SMS provider**; Google stubbed. **[CONFIRM]** |
| 3 | Product GET requires JWT; acceptance item "products require valid JWT" | Browsing + guest checkout imply a public catalogue | Catalogue **public by default**; env `REQUIRE_AUTH_FOR_CATALOGUE=true` restores the lab behaviour so the checklist item can still be demonstrated. **[CONFIRM]** |
| 4 | Category = free-text string | Zones (A–Z letter) + bays + SKU codes | `category` = zone name, plus `zoneCode`, `bay`; `productId` = SKU, so `?productId=` still works |
| 5 | Product fields: name, price, category, qty, description | brand, colours, use, connectivity, specs, images, seller, warranty, arrival | Extended model (§6) |
| 6 | Routes `/products`, `/register`, `/login`, `/admin/products` | `/map`, `/zone/:c`, `/p/:sku`, `/counter`, `/orders`, `/track/:no`, `/saved`, `/signin` | Use §4 routes; `/register` and `/login` redirect to `/signin` |
| 7 | Navbar | Left numbered **Taskbar** + top bar with GO TO box, theme toggle, receipt | Per §2 |
| 8 | Cart/orders = optional Phase 5 | Cart, checkout, orders, tracking are core screens | Promoted to Phase 2 |
| 9 | ₹ en-IN, 3/2/1 grid at 760/520 | 6-col grids, other breakpoints | Per §3 (still ₹ en-IN) |
| 10 | Profile = PUT/PATCH/DELETE forms | Rich profile (addresses, payments, devices, style, notifications) | Both: rich panels + the lab forms inside the Account panel |
| 11 | Notice banner | Not shown | Keep (toast style) |
| 12 | Online payments not mentioned | UPI/Card/Netbanking/COD | **Simulated only**; never store card data |
| 13 | Live map | Route map with moving parcel | Simulated SVG route from order status |
| 14 | Not mentioned | Dark mode ("Day shift") | Included, tokens in §3 |
| 15 | Registration requires username/age | OTP-only sign-in has no such fields | `username`/`age`/`emailId` optional for OTP users (validated if present); lab-required fields still enforced on the Email registration path |
| 16 | `users` unique `emailId` | phone accounts may have no email | `emailId` unique+sparse; `?emailId=` routes work for accounts that have one |

## 11. Acceptance (adds to CONTEXT.md §11)

- [ ] Day/Night shift toggle works and persists
- [ ] GO TO box: `A-01-117` jumps to its sheet; "earbuds" lists matches
- [ ] Store map tile sizes reflect stock; click opens the zone; peek panel shows that zone's first bay
- [ ] Filters (price, wired/wireless, use, brand, colour) change results and the URL
- [ ] Add via `+`, via product sheet and by dragging from the conveyor all update **Receipt · N**
- [ ] Guest can check out; logged-in user sees the order under Orders; totals computed server-side
- [ ] Order status advanced by admin updates Orders, the 5-segment bar, Track page, "2 live" badge and the LIVE ORDER card
- [ ] OTP sign-in works with the mock code; wrong/expired code → 401/400 with clear message
- [ ] Shelf create/share/price-drop/"move to receipt" work; shared link is viewable logged out
- [ ] Profile: addresses CRUD, prefs toggles, plus PUT/PATCH/DELETE `?emailId=` (403 on someone else's)
- [ ] Layout checked at 1440, 1024, 768 and 390 px in both themes

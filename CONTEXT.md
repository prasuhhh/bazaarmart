# CONTEXT.md — Unified MERN Shopping Project (Exercise 7 + Exercise 8)

> Owner: Prashanna Pooranachandran · Reg. No. 24011102076 · Course: CS3801 Web Technologies Lab
> Purpose: single source of truth for merging **Exercise 7** (Node/Express/MongoDB CRUD REST API) and **Exercise 8** (MERN Shopping app with JWT auth) into **one project-level shopping website**. Read this before writing or changing code.

---

## 1. Goal

Deliver one deployable, full-stack MERN **shopping website** (MongoDB + Express + React + Node) with a single backend API and a single React frontend.

How the two exercises combine:

- **Exercise 8 is the application**: users, registration/login (JWT), product catalogue, profile management, React UI.
- **Exercise 7 is the backend pattern**: full CRUD on a MongoDB collection, query-parameter PUT/DELETE, a category filter route, strict HTTP status codes, a central error handler, tested with Thunder Client. Its *Students* entity is **not** part of the website. The same pattern is applied to **products**, which in Ex 8 are read-only.

Working name: **Simple Store**. Rename freely.

---

## 2. What exists today (source material)

### Exercise 7 — Student CRUD API
- Stack: Node.js, Express 5.2, Mongoose 9.x, dotenv 18, nodemon. CommonJS. Everything in `server.js` + `models/Student.js`.
- Pattern to reuse (entity was Student: `studentId` unique, `name`, `email`, `department`, `year`, timestamps):

| Method | Path | Behaviour | Success |
|---|---|---|---|
| POST | `/students` | Create | 201 |
| GET | `/students` | List all, with `count` | 200 |
| GET | `/students/:dept` | Case-insensitive filter by a field; 404 if none | 200 |
| PUT | `/students?studentId=` | Update by unique id, `runValidators`, `new: true` | 200 |
| DELETE | `/students?studentId=` | Delete by unique id | 204 |

- Errors: duplicate key (11000) → 400, `ValidationError` → 400, missing query param → 400, not found → 404, other → 500 via central error middleware. Envelope: `{ success, data | message, count? }`.
- Atlas connection with `serverSelectionTimeoutMS: 5000`; `dns.setServers(['8.8.8.8','8.8.4.4'])` workaround for SRV lookups.

### Exercise 8 — MERN Shopping app
- Backend: Express 4.21, Mongoose 8.9, bcryptjs, jsonwebtoken, cors, dotenv. ES modules.
- Frontend: React 18.3, Vite 6, plain CSS (DM Sans + Manrope, green palette `#1e4934`), one large `App.jsx` using `useState` page switching.
- Models: `User` (`username` min 2, `emailId` unique lowercase, `age` 1–120, bcrypt `password`), `Product` (`productId` unique, `productName`, `productPrice` ≥ 0, `category`, `quantity` ≥ 0, `description`).
- Endpoints:

| Method | Path | Auth | Behaviour |
|---|---|---|---|
| POST | `/api/users` | none | Register; 400 / 409 duplicate / 201 |
| POST | `/api/login` | none | `{ token, user }`; 404 not registered, 401 bad password; JWT 2h |
| GET | `/api/products` | JWT | List sorted by `productId` (read-only) |
| PUT | `/api/users?emailId=` | JWT + own | Full profile update |
| PATCH | `/api/users?emailId=` | JWT + own | Partial update |
| DELETE | `/api/users?emailId=` | JWT + own | Delete own account |

- Middleware: `authenticate` (Bearer JWT), `authorizeEmail` (query `emailId` must match token → else 403).
- `seed.js` inserts 5 products (Wireless Mouse, Mechanical Keyboard, Notebook, Water Bottle, USB-C Hub) if the collection is empty.
- UI: Register/Login tabs, token and user in `localStorage`, product grid, profile PUT/PATCH/DELETE forms, notice banner, logout. API URL hard-coded.
- Env: `PORT`, `MONGO_URI`, `JWT_SECRET`, optional `CLIENT_ORIGIN`. Secrets never committed.

---

## 3. Conflicts to resolve in the merge

| # | Conflict | Decision |
|---|---|---|
| 1 | CommonJS (Ex 7) vs ES modules (Ex 8) | ES modules everywhere |
| 2 | Express 5 / Mongoose 9 vs Express 4 / Mongoose 8 | Pick one pair (recommend Express 5 + Mongoose 8/9) and test against the checklist |
| 3 | Duplicate key: 400 (Ex 7) vs 409 (Ex 8) | 409 Conflict everywhere |
| 4 | Response shape differs | One envelope: `{ success, message?, data?, count? }` |
| 5 | `/students` vs `/api/users` | Everything under `/api` |
| 6 | Query-param identifiers are required by the lab specs | Keep `?productId=` / `?emailId=` variants; document them |
| 7 | Ex 7 has no auth | All product writes require JWT + admin |
| 8 | Ex 8 products are GET-only | Keep GET for users; add admin create/update/delete using the Ex 7 pattern |
| 9 | `dns.setServers` hack in `server.js` | Move to `config/db.js`, only when `DNS_SERVERS` env is set |
| 10 | Logic inline in route files | Routes → controllers → models, shared middleware |
| 11 | Ex 7 spec table says `UPDATE` | Typo, the method is PUT |
| 12 | One 400-line `App.jsx`, hard-coded API URL | Pages/components, React Router, `VITE_API_URL` |

---

## 4. Data model (MongoDB)

Database: `simple_store`.

**users**: `username` (String, required, trim, min 2) · `emailId` (String, required, unique, lowercase, trim) · `age` (Number, 1–120) · `password` (bcrypt hash, `select: false`) · `role` (`'user'` | `'admin'`, default `'user'`) · timestamps.

**products**: `productId` (String, required, unique, trim) · `productName` · `productPrice` (≥ 0) · `category` · `quantity` (≥ 0) · `description` · timestamps.

**Phase 5 extension (not in either exercise):** `orders` { user ref, items [{ product ref, qty, price }], total, status } with a client-side cart. This turns the catalogue into a real shopping flow.

---

## 5. API contract

Base `/api`. Envelope `{ success, message?, data?, count? }`.

**Users**

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/users` | public | Register → 201 |
| POST | `/api/login` | public | → 200 `{ data: { token, user } }` |
| PUT | `/api/users?emailId=` | JWT, own | Full profile update |
| PATCH | `/api/users?emailId=` | JWT, own | Partial update |
| DELETE | `/api/users?emailId=` | JWT, own | Delete own account |

**Products** (Ex 7 CRUD pattern on Ex 8's entity)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/products` | JWT | List with `count`; sorted by `productId` |
| GET | `/api/products/:category` | JWT | Case-insensitive category filter; 404 if none (Ex 7 `:dept` route). Escape regex input. |
| POST | `/api/products` | JWT + admin | Create → 201, duplicate `productId` → 409 |
| PUT | `/api/products?productId=` | JWT + admin | Update, `runValidators`, 404 if not found |
| DELETE | `/api/products?productId=` | JWT + admin | → 204, 404 if not found |

**Status codes:** 200 OK · 201 Created · 204 No Content · 400 validation / missing query param · 401 missing or invalid token, bad password · 403 wrong owner / not admin · 404 not found · 409 duplicate · 500 server or database error (no stack traces in production).

---

## 6. Target folder structure

```
simple-store/
├── README.md
├── CONTEXT.md
├── .gitignore
├── package.json                 (root scripts: dev, seed, build; concurrently)
│
├── backend/
│   ├── package.json             ("type": "module")
│   ├── .env.example             (PORT, MONGO_URI, JWT_SECRET, CLIENT_ORIGIN, DNS_SERVERS?)
│   ├── server.js                (connect DB, start app)
│   ├── app.js                   (cors, json, routes, error handlers)
│   ├── seed.js                  (products + one admin user)
│   ├── config/db.js
│   ├── models/        User.js, Product.js
│   ├── middleware/    auth.js (authenticate, authorizeEmail, requireAdmin), validate.js, errorHandler.js
│   ├── controllers/   userController.js, productController.js
│   ├── routes/        userRoutes.js, productRoutes.js
│   └── utils/response.js
│
├── frontend/
│   ├── package.json, vite.config.js, index.html, .env.example (VITE_API_URL)
│   └── src/
│       ├── main.jsx, App.jsx    (routes only)
│       ├── api/client.js        (base URL, Bearer token, envelope parsing, 401 → logout)
│       ├── context/AuthContext.jsx
│       ├── components/  Navbar, Footer, ProtectedRoute, Notice, ProductCard
│       ├── pages/       Home, Register, Login, Products, Profile, AdminProducts, NotFound
│       └── styles/style.css     (Ex 8 theme)
│
└── docs/
    ├── api-tests/               (Thunder Client / Postman export)
    └── screenshots/
```

---

## 7. Frontend routes

| Route | Page | Access |
|---|---|---|
| `/` | Home | public |
| `/register`, `/login` | Ex 8 forms | public |
| `/products` | Catalogue with category filter | logged in |
| `/profile` | Profile PUT / PATCH / DELETE | logged in |
| `/admin/products` | Add / edit / delete products | admin |
| `*` | Not found | public |

Carry over from Ex 8: notice banner, "Please wait…" disabled buttons, `₹` with `en-IN` formatting, responsive grid (3 → 2 → 1 columns at 760px / 520px), read-only email on the profile page.

---

## 8. Security and quality

- bcrypt (cost 10); passwords never returned.
- `MONGO_URI` and `JWT_SECRET` only in `backend/.env` (git-ignored); commit `.env.example` only.
- `authorizeEmail` on user mutations, `requireAdmin` on product mutations.
- Registration never accepts `role` from the client; the admin is created by `seed.js`.
- Server-side validation of everything (age 1–120, password ≥ 6, price/quantity ≥ 0).
- Escape input before building a RegExp (Ex 7 builds one from raw `:dept`).
- CORS limited to `CLIENT_ORIGIN`; exit clearly on DB connection failure at startup.
- JWT in `localStorage` is a known XSS trade-off; note in README.

---

## 9. Run instructions (target)

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
cp backend/.env.example backend/.env      # fill MONGO_URI + JWT_SECRET
cp frontend/.env.example frontend/.env
npm run seed --prefix backend
npm run dev                               # API :5000, UI :5173
```

Deploy: backend on Render/Railway, frontend on Vercel/Netlify, DB on MongoDB Atlas; set `CLIENT_ORIGIN` and `VITE_API_URL`.

---

## 10. Build plan

1. Scaffold folders, root `package.json`, `.gitignore`, `.env.example` files.
2. Backend core: `config/db.js`, `app.js`, `server.js`, response helpers, error handler.
3. Models: port `User` (add `role`) and `Product` to ESM.
4. Users and auth: Ex 8 routes into controllers; unified envelope and status codes.
5. Products: GET list and category filter, then admin POST / PUT / DELETE (Ex 7 pattern).
6. Seed script.
7. Frontend shell: Vite, React Router, `AuthContext`, `api/client.js`, Navbar/Footer, theme.
8. Pages: Register, Login, Products, Profile (split from Ex 8 `App.jsx`), then AdminProducts.
9. Test every endpoint and error code in Thunder Client; export to `docs/api-tests/`.
10. README with setup, endpoint table, screenshots. Then optional cart and orders.

---

## 11. Acceptance checklist

- [ ] Duplicate email on register → "Email ID is already registered" (409)
- [ ] Unknown email on login → 404; wrong password → 401
- [ ] Products require a valid JWT; bad or expired token → 401 and UI logs out
- [ ] Profile PUT, PATCH, DELETE work, only on own account (403 otherwise)
- [ ] Products: POST 201, GET 200 with `count`, category filter 200/404, PUT 200/404, DELETE 204/404
- [ ] Duplicate `productId` → 409; missing `productId` query → 400; invalid body → 400
- [ ] Non-admin cannot create, update or delete products (403)
- [ ] No secrets in the repo; a fresh clone runs with only `.env` files filled in
- [ ] Layout works at desktop, tablet and phone widths

---

## 12. Notes for whoever continues

- The two source PDFs hold the original code; this file records every behaviour that must survive. Preserve lab-specified behaviour (query-param PUT/PATCH/DELETE, status codes, messages) and layer improvements on top.
- The Students entity from Ex 7 is deliberately dropped. Only its CRUD conventions are reused.
- Never print or commit real `MONGO_URI` / `JWT_SECRET` values.
- Newer Express 5 / Mongoose 9 (Ex 7) vs Express 4 / Mongoose 8 (Ex 8): test any version choice against the checklist.

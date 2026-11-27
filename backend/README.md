# HardwareHub — Backend (Express + MongoDB)

REST API that replaces the json-server mock used in the previous milestone. It
keeps the same endpoints, string `id` fields and query-string syntax, so the
frontend works unchanged when pointed at `http://localhost:3000`.

> As agreed with the instructor, there is **no authentication and passwords are stored in plain text**.

## Running

Requirements: Node.js 18+ and Docker.

```bash
cd backend
cp .env.example .env        # Windows: copy .env.example .env
docker compose up -d        # MongoDB (27017) and mongo-express (http://localhost:8081)
npm install
npm run seed                # imports ../frontend/src/seed.json (WIPES current data)
npm run dev                 # API at http://localhost:3000
```

Then, in another terminal, run `cd frontend && npm run dev`.
`npm run mock:server` is no longer needed (it uses the same port 3000).

To restore the initial data (the old `npm run mock:reset`), run `npm run seed`
again from `backend/`.

The frontend reads the API URL from `VITE_API_URL` (default `http://localhost:3000`).
To use another server, create `frontend/.env` with `VITE_API_URL=http://host:port`.

No Docker? Create a free MongoDB Atlas cluster and put its connection string in
`MONGODB_URI` inside `.env`.

## Scripts

| Script                 | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `npm start`            | Starts the API                                  |
| `npm run dev`          | Starts the API and restarts it on file changes  |
| `npm run seed`         | Resets the database from the frontend seed file |
| `npm test`             | Runs the tests (`node --test`; no database or network needed) |
| `npm run format`       | Formats the code with Prettier                  |
| `npm run format:check` | Fails if any file is not formatted              |

## Endpoints

Resources: `users`, `products`, `carts`, `orders`, `builds`.

| Method | Route             | Description                                                           |
| ------ | ----------------- | --------------------------------------------------------------------- |
| GET    | `/{resource}`     | Lists records (supports filters, sorting and pagination)              |
| GET    | `/{resource}/:id` | Fetches one record                                                    |
| POST   | `/{resource}`     | Creates a record (201; the `id` is generated when omitted)            |
| PUT    | `/{resource}/:id` | Replaces the whole record                                             |
| PATCH  | `/{resource}/:id` | Changes only the fields sent                                          |
| DELETE | `/{resource}/:id` | Deletes a record (the default `admin` account cannot be deleted: 403) |
| POST   | `/checkout`       | Completes a purchase atomically (see below)                           |
| GET    | `/builds/analyze` | `{ enabled }`: whether the AI build analysis is turned on             |
| POST   | `/builds/analyze` | AI analysis of a PC Builder build (optional, see below)               |

### Filtering, sorting and pagination (json-server v1 and v0 compatible)

```
GET /users?email=user@gmail.com
GET /products?category=cpu&brand=AMD
GET /products?price:gte=500&price:lte=2000        # operators: lt lte gt gte ne eq in
GET /products?name:contains=ryzen                 # contains, startsWith, endsWith
GET /products?specs.socket=AM5                    # field inside specs
GET /orders?_where={"userId":{"eq":"1"}}          # JSON filter (supports "or" and "and")
GET /products?_sort=-price,name                   # "-" means descending
GET /products?_page=2&_per_page=10                # { first, prev, next, last, pages, items, data }
GET /products?_page=2&_limit=10                   # array + X-Total-Count header (legacy)
GET /users?_embed=orders                          # attaches children (orders.userId)
GET /orders?_expand=user                          # attaches the parent (userId)
DELETE /users/1?_dependent=carts&_dependent=builds  # deletes the children too
```

The legacy syntax (`price_gte`, `name_like`, `_order=desc`) is still accepted.

DELETE returns the deleted record. As in json-server, other resources pointing to
it (`<resource>Id`) are set to `null`, except those listed in `_dependent`, which
are deleted. For example, deleting a client removes the cart and saved builds but
keeps the orders with `userId: null` (sales history).

### Checkout

`POST /checkout` with:

```json
{
  "userId": "1",
  "cardNumber": "4111 1111 1111 1111",
  "items": [{ "productId": "11", "quantity": 1 }]
}
```

The server uses the prices stored in the database, decrements `stock` and
increments `sold` with a conditional update (not enough stock: 409 and nothing
changes), stores the order with a masked card (`cardLast4`), the client's address
and status `Pago`, and empties the cart. Services (`stock: null`) only increment
`sold`.

### AI build analysis (optional)

Turned on by setting `ANTHROPIC_API_KEY` in `.env` (see `.env.example`). Without
it, `GET /builds/analyze` answers `{ "enabled": false }`, `POST` answers 503, and
the PC Builder hides its "Análise com IA" panel. Each analysis is one Claude API
call billed to that key, and the store only makes it when the user clicks.

`POST /builds/analyze` with:

```json
{ "parts": { "cpu": "4", "motherboard": "5" } }
```

The server runs the store's own rules (`analyzeCompatibility` and `rankOptions`,
imported from `frontend/src/utils`), picks up to 3 compatible, in-stock
candidates for each slot that has an issue or is empty, and asks Claude
(`claude-opus-5-5`, structured JSON output, server-side refusal fallback) for a
summary, an explanation of each issue and swap suggestions. Suggestions outside
the candidate list and explanations of issues the rules did not report are
dropped. The rules' `status` and `issues` are returned unchanged:

```json
{
  "status": "error",
  "issues": [{ "id": "socket", "level": "error", "slots": ["cpu", "motherboard"], "message": "..." }],
  "analysis": {
    "summary": "...",
    "issues": [{ "slot": "cpu", "explanation": "..." }],
    "suggestions": [{ "slot": "cpu", "productId": "2", "name": "AMD Ryzen 5 7600", "price": 1199.9, "reason": "..." }]
  },
  "model": "claude-opus-5-5"
}
```

Errors: 400 for an empty build, an unknown slot or a product in the wrong slot;
404 for an unknown product; 502 when the AI declines, answers incompletely or the
Anthropic API fails; 503 when the feature is off.

## Project structure

```
backend/
├── docker-compose.yml       MongoDB + mongo-express
├── .prettierrc.json         Code style (matches the frontend)
├── test/
│   └── buildAnalysis.test.js AI analysis with a fake Anthropic client
└── src/
    ├── server.js            Express app and route wiring
    ├── db.js                MongoDB connection
    ├── models/index.js      Mongoose schemas (users, products, carts, orders, builds)
    ├── crud.js              Generic CRUD with json-server style queries
    ├── routes/checkout.js   Purchase with stock control
    ├── routes/analyze.js    AI build analysis endpoints
    ├── ai/buildAnalysis.js  Candidates, prompt, Claude call and result filtering
    ├── errors.js            Error helpers and middleware
    └── seed.js              Imports the frontend seed.json
```

## Data model

- **users**: clients and administrators in one collection (`type: "user" | "admin"`); unique e-mail.
- **products**: products and services (`type`), free-form `specs` per category; `stock: null` for services.
- **carts**: one per client (`userId`, `items: [{ productId, quantity }]`).
- **orders**: items copied at purchase time (name and price), `total`, `date`, `cardLast4`, `address`, `status`; `userId` becomes `null` if the client is deleted.
- **builds**: saved PC Builder configurations (`parts` = `{ cpu: "1", motherboard: "6", ... }`).

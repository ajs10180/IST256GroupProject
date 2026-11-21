# Community Blog

A group project for a community blog with a member management page. Visitors can view the homepage and sign up as members. The member page will validate entries, display members, and allow existing entries to be updated.

## Pages

- **Homepage:** Introduces the blog and provides navigation to the member sign-up page.
- **Member sign-up:** Collects and displays member information.

Both pages will use HTML, CSS, and Bootstrap for a responsive layout.

## Member information

| Field | Required |
| --- | --- |
| Full name | Yes |
| Email address | Yes |
| Age | Yes |
| Address | Yes |
| Phone number | No |

JavaScript will validate required fields before submission. Member records will be represented in JSON format and displayed dynamically in a table or cards.


## Running with MongoDB

```bash
npm install
npm run dev
```

`npm run dev` starts the database along with the web server. It uses a MongoDB already running on `localhost:27017` (or `MONGODB_URI`), and otherwise launches its own `mongod` with files in `data/db` (the first run downloads the mongod binary). Connect Compass to `mongodb://127.0.0.1:27017/ist256` to see the collections: `products`, `carts`, `shipping`, `billing`, `returns` (plus `orders`, `registrations`, `artworks`, `members`, `posts`, `events`).

## Testing

With the server running (`npm run dev`), run the end to end API tests in a second terminal:

```bash
npm test -- --tester "Your Name"
```

Each test sends real requests (create, read, update, delete, plus bad data and edge cases for members, products, carts, orders, billing, shipping, returns and registrations) and checks the data in MongoDB. The results go to `tests/test-plan.csv`, which opens in Excel or Google Sheets and has the test plan columns (Test ID, Test Date, Tester, Area Tested, Testing Actions Performed, Expected Results, Actual Results, Pass/Fail, Comments, Bug Fixed On Date). The `UI-` rows are browser steps to run by hand and fill in.

The first run found that every create request returned 500 because `refreshProducts` had been removed from `server/api.js`. It was put back and all 44 automated tests pass, so fill in the Comments and Bug Fixed On Date columns for that one.

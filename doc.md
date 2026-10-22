## Next.js runs proxy.ts by itself on every matched request, before the page or route handler. The matcher at the bottom skips static files, images, and the favicon, so this only runs for pages and API routes.

## getAll and setAll are not called by your page. The Supabase client calls them when it needs the session cookie.

## getAll returns every cookie on the incoming request. Supabase looks through that list for its auth cookie and reads the access token from it. getClaims() then checks that token.

## setAll runs only when that token must be refreshed. Supabase hands over the new cookies, and the function does three things:

## It writes them onto the request, so the rest of this request sees the new token.
## It writes them onto the response, so the browser stores them for the next visit.
## It copies the cache headers Supabase supplies, so a shared cache does not keep one user's session and serve it to someone else.


## supabase has auth and a public schema
## By default, Postgres comes with a few built-in schemas like auth (where Supabase stores user passwords), storage (where it stores uploaded files), and public (where your custom application tables go).
## Clarity & Safety: It removes any ambiguity. For example, Supabase has an auth schema and a public schema. Writing public.readings makes it 100% clear that this is your application table, not a system table.


## These files are .mts rather than .ts because the Next.js app is CommonJS: package.json has no "type": "module". Node follows that setting for a .ts file, so the simulator's import / export syntax would not run as an ES module. .mts is the TypeScript form of .mjs, and Node always treats it as an ES module, which is what node --experimental-strip-types simulator/run.mts needs. That is also why the simulator has its own tsconfig.json. The app config excludes this folder, because an import path ending in .mts is not allowed there.

## Partition readings by day. Every query is one mill, one signal, and a time range, so each partition keeps the index (mill_id, signal, ts). Dropping yesterday is dropping a partition. Subpartition by mill_id only when one day is too big to vacuum, which is tens of mills, not two.

Keep raw rows for a few days, rollups for months. Seven days of one mill is about 180 million raw rows, and that is enough to open an incident. History beyond that reads 1-second rollups. Past a few days of chart range, build 1-minute rollups from the 1-second ones.

Add a queue when the mills post at the same time. One million an hour from one mill does not need it. The handler can keep writing, then return 202. With many mills, the route checks the batch, queues it, and returns. One worker per mill preserves time order, which the detector needs, and one slow mill does not block the others.

Leave the query load off the primary. Ingest stays on the primary. Live status and history read a replica, so a dashboard refresh is not competing with the upserts. Compress old partitions, Timescale-style, before replacing Postgres. The access pattern is still one mill and a time range, which Postgres already serves.


## 1 million rows an hour. That is one mill. One upsert a second, then six rollup rows, then the detector, then 202. No queue. Cache the signal list and write readings and rollups in one database call.

10 million rows an hour. That is about ten mills. One primary still takes the writes. One worker per mill, so a slow mill does not block the others and each mill stays in time order. Dashboards read a replica. Partition readings by day and keep raw rows for a few days.

100 million rows. That table is about four days of one mill, roughly 15–40 GB, so it still sits on one primary. Partition by day so only today stays hot.

100 million rows an hour is the rate that outgrows one primary. That is about ninety mills, 28,000 rows a second. Split primaries by mill_id. Each primary has its own workers, daily partitions, and a replica. A mill is judged on its own primary. A report across all mills reads the replicas, after the alert already exists.
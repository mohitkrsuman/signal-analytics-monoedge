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
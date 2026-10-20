## Next.js runs proxy.ts by itself on every matched request, before the page or route handler. The matcher at the bottom skips static files, images, and the favicon, so this only runs for pages and API routes.

## getAll and setAll are not called by your page. The Supabase client calls them when it needs the session cookie.

## getAll returns every cookie on the incoming request. Supabase looks through that list for its auth cookie and reads the access token from it. getClaims() then checks that token.

## setAll runs only when that token must be refreshed. Supabase hands over the new cookies, and the function does three things:

## It writes them onto the request, so the rest of this request sees the new token.
## It writes them onto the response, so the browser stores them for the next visit.
## It copies the cache headers Supabase supplies, so a shared cache does not keep one user's session and serve it to someone else.
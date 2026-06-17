// Minimal History-API router: clean URLs (/live) instead of hash URLs (/#/live).
//
// `navigate` pushes a new path and notifies listeners; App re-renders on the
// "popstate" event (fired by the browser on back/forward, and by us on navigate).
// Any component can import `navigate` to change routes.
//
// NOTE: clean URLs need a server that serves index.html for unknown paths
// (SPA fallback). Vite's dev server and `vite preview` do this out of the box;
// for production hosting, configure a catch-all rewrite to /index.html.

/** Current route path, with any trailing slash normalised away. */
export function currentPath(): string {
	return window.location.pathname.replace(/\/+$/, "") || "/"
}

/** Navigate to an in-app path (e.g. "/live", "/t/123") without a full reload. */
export function navigate(path: string): void {
	if (path !== window.location.pathname) {
		window.history.pushState({}, "", path)
	}
	// pushState doesn't emit popstate, so dispatch it ourselves to trigger a render.
	window.dispatchEvent(new PopStateEvent("popstate"))
}

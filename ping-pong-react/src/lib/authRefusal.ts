const WORKSPACE_REFUSAL = 'workspace_not_on_ping_pong'

const paramsOf = (url: URL) => [url.searchParams, new URLSearchParams(url.hash.slice(1))]

export const isWorkspaceRefusal = (href: string): boolean =>
  paramsOf(new URL(href)).some((params) => params.get('error_description') === WORKSPACE_REFUSAL)

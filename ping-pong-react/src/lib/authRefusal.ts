const WORKSPACE_REFUSAL = 'workspace_not_on_ping_pong'
const AUTH_ERROR_PARAMS = ['error', 'error_code', 'error_description']

const paramsOf = (url: URL) => [url.searchParams, new URLSearchParams(url.hash.slice(1))]

const withoutErrorParams = (params: URLSearchParams) =>
  new URLSearchParams([...params].filter(([key]) => !AUTH_ERROR_PARAMS.includes(key))).toString()

export const isWorkspaceRefusal = (href: string): boolean =>
  paramsOf(new URL(href)).some((params) => params.get('error_description') === WORKSPACE_REFUSAL)

export function withoutAuthError(href: string): string {
  const url = new URL(href)
  const search = withoutErrorParams(url.searchParams)
  return `${url.origin}${url.pathname}${search && `?${search}`}`
}

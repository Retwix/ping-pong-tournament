export type Org = { orgId: string; orgName: string }

const utf8 = (binary: string) => new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))

const claimsOf = (token: string): Record<string, unknown> => {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return { ...JSON.parse(utf8(atob(payload))) }
  } catch {
    return {}
  }
}

export function orgOfToken(token: string | undefined): Org | null {
  const { org_id: orgId, org_name: orgName } = claimsOf(token ?? '')
  if (typeof orgId !== 'string' || typeof orgName !== 'string') return null
  return { orgId, orgName }
}

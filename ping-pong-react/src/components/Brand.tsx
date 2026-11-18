import type { Org } from '../lib/org'

const PRODUCT_NAME = 'Ping-Pong'

export default function Brand({ org }: { org: Org | null }) {
  return (
    <>
      {PRODUCT_NAME}
      {org && (
        <>
          {' · '}
          <span className="em">{org.orgName}</span>
        </>
      )}
    </>
  )
}

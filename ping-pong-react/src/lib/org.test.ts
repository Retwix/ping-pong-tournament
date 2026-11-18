import { describe, expect, test } from 'vitest'
import { orgOfToken } from './org'

const RECOVR_ID = '0b6f6a4e-5c1b-4f3e-9a51-2a8c7d1e9f00'

const segment = (json: string) => Buffer.from(json).toString('base64url')

const tokenWith = (claims: Record<string, unknown>) =>
  [segment('{"alg":"HS256","typ":"JWT"}'), segment(JSON.stringify({ sub: 'user-1', ...claims })), 'signature'].join('.')

describe('orgOfToken', () => {
  test('reads the company the sign-in hook put in the token', () => {
    expect(orgOfToken(tokenWith({ org_id: RECOVR_ID, org_name: 'Recovr' }))).toEqual({
      orgId: RECOVR_ID,
      orgName: 'Recovr',
    })
  })

  test('reads a non-Latin company name, whose payload uses the URL-safe base64 alphabet', () => {
    expect(orgOfToken(tokenWith({ org_id: RECOVR_ID, org_name: '乒乓球俱乐部' }))?.orgName).toBe(
      '乒乓球俱乐部',
    )
  })

  test.for([
    { reason: 'no token (signed out)', token: undefined },
    { reason: 'a token issued before the hook (no org claims)', token: tokenWith({}) },
    { reason: 'an org id without a name', token: tokenWith({ org_id: RECOVR_ID }) },
    { reason: 'a name without an org id', token: tokenWith({ org_name: 'Recovr' }) },
    { reason: 'something that is not a JWT', token: 'not-a-jwt' },
  ])('has no company for $reason', ({ token }) => {
    expect(orgOfToken(token)).toBeNull()
  })
})

import { expect, test } from 'vitest'
import { isWorkspaceRefusal, withoutAuthError } from './authRefusal'

const APP = 'https://pingpong.example'

test.for([
  { form: 'the hash (implicit flow)', url: `${APP}/#error_description=workspace_not_on_ping_pong` },
  { form: 'the query (PKCE flow)', url: `${APP}/?error_description=workspace_not_on_ping_pong` },
])('reads a workspace refusal from $form', ({ url }) => {
  expect(isWorkspaceRefusal(url)).toBe(true)
})

test.for([
  { reason: 'a plain visit', url: `${APP}/classement` },
  { reason: 'another auth error', url: `${APP}/#error=access_denied&error_description=Email+link+is+invalid+or+has+expired` },
  { reason: 'a successful sign-in', url: `${APP}/#access_token=abc&refresh_token=def&token_type=bearer` },
])('sees no refusal in $reason', ({ url }) => {
  expect(isWorkspaceRefusal(url)).toBe(false)
})

test.for([
  {
    form: 'the hash',
    url: `${APP}/classement#error=access_denied&error_code=403&error_description=workspace_not_on_ping_pong`,
    clean: `${APP}/classement`,
  },
  {
    form: 'the query, keeping the page’s own parameters',
    url: `${APP}/stats?error=access_denied&period=season&error_code=403&error_description=workspace_not_on_ping_pong`,
    clean: `${APP}/stats?period=season`,
  },
])('strips the refusal from $form', ({ url, clean }) => {
  expect(withoutAuthError(url)).toBe(clean)
})

import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { SLACK_PROVIDER } from '../lib/slackIdentity'

/**
 * The signed-in Slack account, or null. Supabase persists the session in
 * localStorage, so this survives a refresh without any work here.
 *
 * Deliberately knows nothing about the roster: who you *are* on the ladder is
 * `linkedPlayer(userId, players)` in lib/slackIdentity, which is pure and
 * tested. Keeping the two apart means this hook never needs the player list.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  // Without redirectTo, Slack returns to the project's Site URL — the deployed
  // app — so signing in from anywhere else lands the session on the wrong page.
  const signIn = useCallback(
    () =>
      supabase.auth.signInWithOAuth({
        provider: SLACK_PROVIDER,
        options: { redirectTo: window.location.origin },
      }),
    [],
  )
  const signOut = useCallback(() => supabase.auth.signOut(), [])

  return { session, userId: session?.user.id ?? null, loading, signIn, signOut }
}

import { IconBrandSlack, IconLogout } from '@tabler/icons-react'
import { useSession } from '../hooks/useSession'

/**
 * Sign in with Slack, or sign out again. Sits in the top bar beside the theme
 * toggle.
 *
 * Nothing is gated on it yet. The delete guards live in Postgres and arrive
 * with auth-migration.sql, which must not be applied before claiming works —
 * see the spec's "Deferred, and owed". Until then, signing in is how someone
 * links their Slack account to a roster row, and how the identity payload can
 * be inspected at all.
 */
export default function SlackSignIn() {
  const { session, loading, signIn, signOut } = useSession()

  // Render nothing rather than flashing "Se connecter" at someone who is
  // already signed in: getSession resolves a tick after the first paint.
  if (loading) return null

  if (session === null) {
    return (
      <button
        className="rv-nav-link rv-nav-auth"
        onClick={() => signIn()}
        aria-label="Se connecter avec Slack"
        title="Se connecter avec Slack"
      >
        <IconBrandSlack size={16} stroke={1.8} />
        <span className="rv-nav-auth-label">Se connecter</span>
      </button>
    )
  }

  return (
    <button
      className="rv-nav-link rv-nav-auth"
      onClick={() => signOut()}
      aria-label="Se déconnecter"
      title="Se déconnecter"
    >
      <IconLogout size={16} stroke={1.8} />
    </button>
  )
}

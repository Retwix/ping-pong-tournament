import { IconBrandSlack, IconLogout } from '@tabler/icons-react'
import type { User } from '@supabase/supabase-js'
import { useRatings } from '../hooks/useRatings'
import { useSession } from '../hooks/useSession'
import { playerHistory } from '../lib/playerHistory'
import { defaultLadderScope } from '../lib/seasons'
import { ownRatingRow, slackIdentity } from '../lib/slackIdentity'
import ClaimGate from './ClaimGate'
import OwnCardButton from './OwnCardButton'

/**
 * Sign in with Slack, open your own card, or sign out again. Sits in the top
 * bar beside the theme toggle.
 *
 * Signing in is how someone links their Slack account to a roster row; the
 * delete guards that turn on that link live in Postgres (auth-migration.sql).
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

  return <SignedIn user={session.user} signOut={signOut} />
}

/**
 * Split out so only signed-in visitors pay for the ladder load: the hook
 * fetches every finished match and opens a realtime channel.
 *
 * With a card to show — linked, and rated this season — your name opens it
 * and sign-out lives on the card. Otherwise the name signs you out, as before.
 */
function SignedIn({ user, signOut }: { user: User; signOut: () => void }) {
  const { rows, events, players } = useRatings(defaultLadderScope(new Date()))
  const own = ownRatingRow(user.id, players, rows)

  // Slack withholds the name unless `profile` scope was granted, so the button
  // has to work as an icon alone. The label rides the same class as the
  // signed-out one, which the nav already hides below 820px.
  const { profile } = slackIdentity(user)

  return (
    <>
      {own !== null ? (
        <OwnCardButton
          row={own}
          history={playerHistory(events, rows, own.key)}
          onSignOut={signOut}
        />
      ) : (
        <button
          className="rv-nav-link rv-nav-auth"
          onClick={() => signOut()}
          aria-label={
            profile === null ? 'Se déconnecter' : `Se déconnecter (${profile.displayName})`
          }
          title="Se déconnecter"
        >
          <IconLogout size={16} stroke={1.8} />
          {profile !== null && <span className="rv-nav-auth-label">{profile.displayName}</span>}
        </button>
      )}
      <ClaimGate userId={user.id} user={user} onSignOut={() => signOut()} />
    </>
  )
}

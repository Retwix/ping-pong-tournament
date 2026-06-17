import { supabase } from './supabase'

// Slack notifications are optional. They only fire when VITE_SLACK_ENABLED is
// truthy AND the `slack-notify` Edge Function is deployed. Everything here is
// best-effort and never throws into the tournament flow — a Slack hiccup must
// not block creating a tournament or crowning a champion.
const slackEnabled = String(import.meta.env.VITE_SLACK_ENABLED ?? '').toLowerCase() === 'true'

export const hasSlackConfig = slackEnabled

async function call(action: 'invite' | 'result', tournamentId: string): Promise<void> {
  if (!slackEnabled) return
  try {
    const { data, error } = await supabase.functions.invoke('slack-notify', {
      body: { action, tournamentId },
    })
    if (error) throw error
    if (data && (data as { error?: string }).error) {
      throw new Error((data as { error: string }).error)
    }
  } catch (e) {
    // Log, don't surface: the app works fine without Slack.
    console.warn(`[slack] ${action} failed:`, e instanceof Error ? e.message : e)
  }
}

/** Post the invitation (private group DM + threadable anchor) for a new tournament. */
export function inviteToSlack(tournamentId: string): Promise<void> {
  return call('invite', tournamentId)
}

/** Post final standings as a reply in the invitation thread. Safe to call more than once. */
export function postSlackResult(tournamentId: string): Promise<void> {
  return call('result', tournamentId)
}

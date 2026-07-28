/**
 * Build a unique realtime channel topic from a stable base name.
 *
 * Supabase identifies channels by topic, so calling `supabase.channel('x')`
 * twice returns the *same* channel. Under React 18 StrictMode a subscribing
 * effect mounts, cleans up, then remounts before the async `removeChannel`
 * teardown finishes — so the remount gets back the still-subscribed channel and
 * `.on()` throws "cannot add postgres_changes callbacks ... after subscribe()".
 * Appending a fresh suffix per subscription gives each mount its own channel.
 */
export function uniqueChannelName(
  base: string,
  suffix: () => string = () => crypto.randomUUID(),
): string {
  return `${base}-${suffix()}`
}

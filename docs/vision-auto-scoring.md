# Auto-scoring par vision — spec

A phone on a tripod films the table, a Python service on a laptop watches the
ball, and points appear on the existing live scorer by themselves. No ball
speed, no forehand/backhand, no shot placement — **just: is there a ball, are
there players, and who won that point.**

Inspired by the tennis CV project, but deliberately smaller: that one renders an
annotated video after the fact. This one has to be **live**, which changes every
engineering trade-off in here.

---

## 1. Scope

**In**

- Live capture from a phone streaming to a laptop.
- Ball detection and tracking.
- Player (person) detection.
- Bounce detection, with the half of the table each bounce landed on.
- Rally start/end detection and **automatic point attribution**.
- Points pushed into the existing `LiveScorer`, with one-tap undo.

**Out** (explicitly, for v1)

- Ball speed, stroke type, shot placement, spin — everything the tennis post
  showed and we don't need.
- Player *identification* (who is who). The service knows "left side" and
  "right side"; the operator maps those to A/B once at session start.
- Serve legality, lets, edge/net judgement.
- Doubles-specific logic. The side-based rule below works unchanged for
  doubles; only serve rotation differs, and that already lives in the app.
- Any recording or upload of video. See §16.

---

## 2. Capture and transport

**Decision: phone as camera, laptop as brain.** A phone has far better optics
and framerate than a laptop webcam, and the laptop can sit anywhere.

Two transports, in order of preference:

1. **Phone as a USB/WiFi virtual webcam** (Camo, Iriun, or equivalent). The
   phone shows up as a normal capture device, so `cv2.VideoCapture(0)` just
   works. Latency ~50–150 ms over USB. **Preferred.**
2. **MJPEG or RTSP stream** over WiFi (IP Webcam on Android, Larix, etc.).
   `cv2.VideoCapture("http://192.168.1.x:8080/video")`. Latency ~150–400 ms and
   dependent on the WiFi. Fallback.

The capture layer takes a single `--source` that accepts an integer (device
index), a file path (recorded clip, for development), or a URL. Development and
testing therefore never require a camera.

### Camera placement (this is not optional garnish)

The whole ball-detection approach in §5 rests on the camera **not moving**. A
tripod or a clamp is a hard requirement, not a nicety. If someone bumps it
mid-match, detection degrades until recalibration.

- **Position:** elevated, ~2–2.5 m high, 1–2 m behind one end of the table,
  looking down the long axis. Both halves stay visible, the net line is
  unambiguous, and players occlude less than they do from the side.
- **Framing:** the whole table plus roughly a metre beyond each end, so a ball
  that goes long is still seen leaving.
- **Trade-off, stated honestly:** a side-on view gives cleaner bounce detection
  (bounces are a clean vertical minimum) but the near player blocks the table
  and perspective foreshortening is worse. Start end-on; the code doesn't care,
  so this is re-testable in five minutes.

### Camera settings

- **60 fps** if the phone/transport allows it, 30 fps as a floor. At 30 fps a
  ball at 40 km/h travels ~37 cm between frames — about seven samples per length
  of the table, which is marginal for bounce detection. At 60 fps it's fifteen.
- **Lock exposure, focus, and white balance.** Auto-exposure hunting is the
  single most destructive thing for the background model in §5.
- **Bright, constant, artificial light.** Windows are the enemy: passing clouds
  change the background globally. Bright light also buys a shorter shutter,
  which shortens the ball's motion streak.
- **Orange ball, not white.** Best separation from a blue/green table, white
  lines, and white shirts.

---

## 3. Architecture

```
phone (tripod)
   │  USB / WiFi
   ▼
vision/ (Python, on the laptop)
   capture ──► ball tracker ──► bounce detector ──┐
           └─► person detector (every N frames)   ├─► rally state machine
                                                  │        │
                                 OpenCV overlay ◄─┘        │ point events
                                 (operator window)         ▼
                                                  Supabase Realtime broadcast
                                                           │
                                                           ▼
                                      LiveScorer.addPoint(side)  ← existing code
```

**Load-bearing decision: the vision service does not know the rules of table
tennis.** It emits "a point was won by the left side". Game target, win-by-2,
serve alternation, deuce, capot, chaos mode, Elo — all of that already lives in
`src/lib/pingpong.ts` and `LiveScorer.tsx` and stays there, tested, in one
language. The service is a sensor, not a referee.

---

## 4. Table calibration

Once per session (the camera doesn't move between matches), the operator clicks
the **four table corners** in a still frame. That gives a homography `H` mapping
image pixels → the table plane in centimetres (274 × 152.5, net at y = 137).

Auto-detecting the table by colour segmentation is possible and is not worth it
for v1 — four clicks take five seconds and never fail. Calibration is persisted
to `vision/calibration.json` so a restart doesn't re-ask.

`H` buys four things, and this is why it comes first:

1. **Which half a bounce landed on** — the entire scoring rule depends on it.
2. **A depth-aware size gate.** A 40 mm ball is ~18 px across at the near end of
   the table and ~8 px at the far end. A single pixel-area threshold either
   misses far balls or admits near noise; projecting a candidate through `H`
   gives its expected size at that spot for free.
3. **An in-play polygon** — table, plus a margin — to separate table bounces
   from floor bounces.
4. **Left/right → A/B mapping**, set once and swappable with a key.

---

## 5. Ball detection — classical first, learned only if needed

**Decision: no trained model in v1.**

The tennis project fine-tuned RF-DETR because it processed video offline, where
a slow model costs nothing but patience. We need live inference on a laptop CPU,
and — critically — a **fixed camera pointed at a controlled indoor scene**. That
makes motion-based detection viable, and it needs zero labelled data, zero GPU,
and zero training loop:

1. Background subtraction (MOG2) against the static scene → foreground blobs.
2. Filter candidates by size (depth-aware, §4), position (in or near the play
   area), and colour (orange gate).
3. Associate the surviving candidates to a track with a constant-acceleration
   motion model, so the tracker predicts where the ball should be next and
   prefers the candidate nearest that prediction.
4. Accept a track only once it shows several frames of consistent, near-ballistic
   motion. A hand or a racket produces blobs; it does not produce a parabola.

Two things to get right, which will otherwise burn a day each:

- **The ball is a streak, not a circle.** At 60 fps a ball at 40 km/h smears
  ~18 cm across the frame. Any circularity filter must accept elongated blobs —
  and the streak's orientation is a free extra signal about direction.
- **Occlusion is normal.** The ball vanishes behind a player, a bat, the net.
  The tracker must coast on prediction for a handful of frames rather than
  declaring the rally over. This is the same timeout that ends rallies (§8), so
  it needs tuning against real footage, not guessing.

**Upgrade path, if §14's accuracy target isn't met:** a TrackNet-style model —
three consecutive frames in, a heatmap out — which is the standard answer for
small fast balls, precisely because motion helps it instead of hurting it.
That's ~1–2k labelled frames, and Roboflow-style labelling is exactly the tennis
project's workflow. Deferred, not dismissed; §14 defines the trigger.

---

## 6. Person detection — what it's actually for

YOLO (`yolo11n`, person class only, ~320 px input) every 5th frame, ~6 Hz. That
is plenty: players don't teleport.

Being straight about this: **person detection contributes almost nothing to the
scoring in v1.** Its jobs are (a) the on-screen overlay, which is most of the
"wow" in the tennis post, and (b) knowing which side each player stands on so
left/right maps to A/B without the operator being asked.

It earns its keep in v2, in the interception refinement (§9).

---

## 7. Bounce detection

Working from the ball track:

- A **table bounce** is a local maximum in image-y (the lowest on-screen point of
  the arc) with the vertical velocity flipping sign, whose contact point projects
  **inside the table polygon**.
- A **floor bounce** is the same signature projecting **outside** it. Floor
  bounces are the strongest rally-end signal we have.
- Each table bounce is tagged with its half via `H`.

Detected on a sliding window of the last 5–9 tracked points, so it lags reality
by ~100 ms at 60 fps. Irrelevant: points are only emitted at rally end anyway.

Known soft spot: at 30 fps a bounce can fall entirely between two frames on a
hard smash. Another reason for 60.

---

## 8. Point attribution — one rule

This is the heart of the project, and it is smaller than it looks.

> **The point goes to the player on the side opposite the last table bounce.**

That's it. It works because every way a rally ends is a fault by exactly one
player, and the last place the ball legally touched the table identifies them:

| What happened | Bounces (…, last) | Awarded | Right? |
|---|---|---|---|
| R serves, L doesn't reach it | …, L | R | ✓ |
| R serves into the net | R, (R) | L | ✓ |
| R serves long, misses L's half | R | L | ✓ |
| L returns into the net | …, L | R | ✓ |
| L returns long, no bounce on R's half | …, L | R | ✓ |
| L's shot lands, R swings and misses | …, R | L | ✓ |
| Double bounce on R's half (R too slow) | …, R, R | L | ✓ |
| Edge ball R can't return | …, R | L | ✓ |
| **L volleys before the ball bounces on their half** | …, R | L | **✗ (should be R)** |
| **Ball strikes L before bouncing on their half** | …, R | L | **✗ (should be R)** |

The two failures share one shape: the receiving player intercepts the ball
before it bounces. Casual play does produce these — people reflexively bat at
balls that were going out. v1 accepts them and relies on undo (§10); §9 says how
v2 catches them.

### Rally state machine

```
IDLE ──(ball tracked, net crossed)──► RALLY ──(end condition)──► SCORED ──(cooldown)──► IDLE
```

- **Rally starts** when a confirmed ball track crosses the net line.
- **Rally ends** on any of: ball untracked for `T_dwell` (~0.7 s, tuned on real
  footage), a floor bounce, or the ball coming to rest.
- **A rally only scores if it saw ≥ 2 table bounces and ≥ 1 net crossing.** This
  is the guard against phantom points: a ball rolled across the table, or
  knocked about between rallies, produces no score.
- **Cooldown** of ~3 s after a point, so fetching the ball and tossing it back
  over the table can't be read as a new rally. This is the single most likely
  source of garbage points, and the cheapest to defend against.

The state machine consumes an **event stream** (`ball_seen`, `bounce(side)`,
`ball_lost`, `floor_bounce`), not frames. So it is fully unit-testable on
synthetic event sequences, with no video and no camera — every row of the table
above becomes a test. See §12.

---

## 9. Refinements deliberately deferred

Written down so they're decisions and not oversights:

- **Interception detection** (fixes both ✗ rows). An interception is a sharp
  direction reversal *with no bounce*, over the receiver's half — distinguishable
  from a ball flying long, which reverses nowhere. Invert the attribution and
  flag low confidence. This is where person detection stops being decorative.
- **Serve validation** (own half then opponent's half). Cheap to add once
  bounces are reliable, but it only matters if people are arguing about serves.
- **Let detection.** Requires seeing the ball clip the net — a couple of pixels
  of deflection. Not realistically worth it; undo covers it.
- **Auto table detection**, replacing four clicks with colour segmentation.

---

## 10. Integration with the app

Python publishes to a **Supabase Realtime broadcast channel**, `vision:<matchId>`:

```json
{
  "type": "point",
  "side": "a",
  "confidence": 0.86,
  "reason": "last_bounce_opposite",
  "rally": { "bounces": ["a", "b", "a"], "duration_ms": 4200 },
  "ts": "2026-09-10T09:03:11.482Z"
}
```

Broadcast, not a table write, because the point is an *event*, not state — and
because writing `score_a`/`score_b` directly would mean reimplementing win-by-2,
deuce and serve rotation in Python, and fighting the optimistic-write echo
suppression in `realtimeSync.ts`.

Frontend work is small:

- A `useVisionPoints(matchId, onPoint)` hook subscribing to the channel — using
  `uniqueChannelName()` from `src/lib/realtimeChannel.ts`, for the StrictMode
  reason documented there.
- `LiveScorer` calls its existing `addPoint(side)`. A vision point and a
  referee's tap follow the identical code path, so Elo, chaos mode, capot,
  match-point and the spectator view all keep working with no changes.
- Supabase Realtime already reaches every open client, so a phone or TV showing
  `SpectatorView` updates too, for free.

Trust note: the anon key can publish to that channel, so anyone on the network
could spoof a point. That is the same trust model as the app's existing anon-key
score writes, in an office ping-pong app. Noted, accepted, not solved.

---

## 11. The undo affordance is part of the design

An automatic scorer that is right 92% of the time and can't be corrected is
worse than useless — it loses arguments. The UX has to assume it will be wrong:

- Every vision point raises a toast: **« Point A — annuler »**, with a ~5 s
  countdown, wired straight to the scorer's existing `undo()`.
- Low-confidence points (short rallies, few bounces, poor tracking) **ask
  instead of asserting**: « Point A ? » with confirm/reject, auto-dismissing
  without scoring.
- A keyboard **cancel** in the vision window discards the rally in progress
  (someone caught the ball, a let, a conversation broke out).
- The referee's manual taps never stop working. Vision is an assist, not a lock.

---

## 12. Repo layout and testing

```
vision/
  README.md
  requirements.txt
  pingpong_vision/
    capture.py      # --source: device index | file | URL
    calibration.py  # four corners, homography, persistence
    ball.py         # motion candidates + track
    people.py       # YOLO person, every Nth frame
    bounce.py       # bounces from the track, side via H
    rally.py        # event stream → point events   ← pure, no OpenCV
    overlay.py      # the operator HUD
    emit.py         # Supabase broadcast | console (--dry-run)
    cli.py
  tests/
    test_rally.py   # §8's table, row by row
    test_bounce.py  # synthetic tracks
    fixtures/
```

`rally.py` and `bounce.py` are pure functions over event streams and point
lists: no camera, no OpenCV, no network. The scoring logic — the part that must
be *correct* — is therefore testable in CI alongside the existing Vitest suite,
and every failure mode in §8 is a regression test rather than a memory.

---

## 13. Performance budget

Per frame at 720p on a mid-range laptop CPU, no GPU:

| Stage | Cost |
|---|---|
| Capture + decode | ~5 ms |
| Background subtraction + blobs | ~4 ms |
| Person detection (320 px, every 5th frame) | ~8 ms amortised |
| Tracking + bounce + state machine | < 1 ms |
| Overlay + display | ~5 ms |
| **Total** | **~23 ms → 40+ fps** |

Comfortable at 30 fps input, adequate at 60. Apple Silicon (MPS/CoreML) or an
NVIDIA GPU makes the person detector free, but neither is required.

End-to-end latency from the real point to the score changing: transport
(~100 ms) + dwell timeout (~700 ms) + network (~100 ms) ≈ **under a second**,
which reads as instant next to someone walking to fetch the ball.

---

## 14. Milestones

- **M0 — the stream works.** Phone → laptop, measured fps and latency, frames on
  screen. Ten lines of code. Do this *first*: it decides the transport, and
  everything downstream assumes it.
- **M1 — calibration + overlay.** Four corners clicked, table polygon and net
  line drawn, `H` persisted.
- **M2 — the ball.** Live track drawn over the video, bounces marked with their
  half. Measure detection rate on recorded clips. **This is the risky milestone;
  everything after it is bookkeeping.**
- **M3 — points, offline.** Rally state machine, `--dry-run` printing point
  events to the console, keyboard undo/cancel. Unit tests green.
- **M4 — players.** Person boxes on the overlay, automatic left/right → A/B.
- **M5 — into the app.** Supabase broadcast, `useVisionPoints`, the undo toast.
- **M6 — evaluate.** §15 against real matches; decide on the learned detector.

---

## 15. Acceptance criteria

Recorded across ~100 real points, hand-scored as ground truth:

| Metric | Target |
|---|---|
| **Points awarded to the correct player** | **≥ 90%** |
| Rally ends detected (neither missed nor invented) | ≥ 95% |
| Phantom points during 10 min of knocking about / warm-up | 0 |
| Latency, real point → score on screen | < 1.5 s |
| Sustained processing rate | ≥ input fps |

Point accuracy is the only metric that matters; the rest explain failures.
**Below 85%, stop tuning heuristics and go train the detector** (§5) — that
threshold is what makes "classical first" a decision rather than a gamble.

---

## 16. Privacy

Video never leaves the laptop: no recording by default, no upload, no cloud
inference. Only point events — a side, a timestamp, a confidence — reach
Supabase. Anything recorded for evaluation (§15) is a local file the operator
deletes, and it needs the consent of whoever is playing.

---

## 17. Open questions

1. **Laptop specs?** Determines whether the person detector runs comfortably and
   whether the learned-detector upgrade is viable locally.
2. **Which phone / which streaming app?** Decides transport and the achievable
   framerate. M0 answers this.
3. **Table and ball colour?** Drives the colour gate in §5. Orange ball on a
   dark table is the friendliest combination by a wide margin.
4. **Where does the laptop sit during a real match** — is someone watching the
   operator window, or does it run headless with the phone as the only display?

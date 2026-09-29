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

**Confirmed setup: iPhone → Apple Silicon Mac, over USB.** Two ways to get the
frames, both of which present the iPhone as an ordinary capture device, so
`cv2.VideoCapture(index)` is all the code ever sees:

1. **Continuity Camera** — built into macOS, nothing to install, no licence.
   Plug the iPhone in and it appears as a camera.
2. **Camo or Iriun** — third-party, but they expose framerate and resolution
   controls that Continuity Camera does not, and can drive 60 fps.

### M0 result: Continuity Camera over USB, 30 fps, stable

Measured 2026-09-14, iPhone 16 Pro (`iPhone17,2`) → Apple Silicon Mac:

| | fps | p50 | p95 | max interval | failed reads |
|---|---|---|---|---|---|
| **USB, 60 s sustained** | **30.0** | 33.4 ms | 35.9 ms | **46.7 ms** | 0 |
| USB, first run after idle | 29.6 | 33.5 ms | 38.0 ms | 265.3 ms | 0 |
| Wi-Fi, first run after idle | 29.1 | 33.4 ms | 35.9 ms | 498.6 ms | 0 |
| Built-in FaceTime HD (control) | 30.0 | 33.4 ms | 34.4 ms | 37.4 ms | 0 |

Four things follow, and the last is the one that will bite.

**Continuity Camera is stable, and the transport question is closed.** Over USB,
after warm-up, the worst frame in 1,800 arrived 46.7 ms late — 1.4 frame
intervals, a single dropped frame. Nothing to design around.

**The half-second stalls are cold-start, not transport.** The 498 ms outlier
that made the first measurement alarming was a first capture after the device
had been idle, over Wi-Fi. On USB the same artefact is half the size, and by the
second run it is gone entirely. `WARMUP_FRAMES = 30` is only one second at
30 fps and does not cover it: **open the capture device once at session start
and keep it open**, and discard the first ~2 s rather than the first 30 frames.
Re-opening the device mid-session buys a stall each time.

**60 fps is not on offer here.** Continuity Camera refuses the request and
delivers 30. By the rule this section originally set — fall back below ~50 fps —
that mandates Camo/Iriun. **Deliberately not doing that yet.** 30 fps gives ~7
ball samples per table length against 15 at 60, and whether that resolves a
bounce is a question about real footage, not about a framerate. M2 measures
detection rate on the recorded clips; if it falls short, Camo is a fifteen-minute
change that touches no code, because both present as an ordinary capture device.
Installing it now would be paying for a problem we have not yet observed.

**Device indices are not stable — select by name.** With the phone asleep,
index `[1]` opened successfully and delivered *no frames*; woken, the same index
delivered 1080p30. Index order also depends on which cameras exist. Anything
past M0 must resolve the camera by name (`iPhone17,2` / "Caméra de …") and fail
loudly when it is absent, or it will silently grab the laptop webcam one evening
and detect nothing.

macOS gotcha worth knowing before it costs an hour: the process running Python
needs camera permission under **System Settings → Privacy & Security → Camera**.
Under OpenCV 4 this failed *silently* — empty frames, no error. **OpenCV 5 says
so explicitly** (`not authorized to capture video (status 0)`), so the symptom
to expect now is that line, not a mysterious black window.

The permission is granted to the **owning application bundle**, which is the
trap: running inside a `tmux` server started from `launchd` attributes the
request to nothing macOS can prompt for, so it is refused with no dialog, for
ever, no matter how many times you grant Terminal access. Run the probe from a
plain terminal window — attribution follows the process tree to the app bundle.

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
- **Orange ball on a white table** — confirmed, and it's a *better* combination
  than it sounds. White is unsaturated; orange is strongly saturated. So the
  colour gate keys on **saturation, not hue**, and the table falls out of the
  mask almost completely. Two caveats it also solves: player shadows and the
  ball's own shadow travelling across a white table are dark but *grey* (low
  saturation), so the same gate kills them, and MOG2's shadow classification
  catches the rest. Glare is the one real risk — a specular highlight on a
  glossy white table is bright and blown out; diffuse lighting, or angling the
  lights away from the camera, avoids it.

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
the **four table corners** in a still frame, **and the two ends of the net**.
That gives a homography `H` mapping image pixels → the table plane in
centimetres, plus the net's real position on it.

### The table is not a regulation table, and the net is not at its middle

Measured 2026-09-17. The playing surface is **two 140 × 140 cm office desks**
pushed together: **280 × 140 cm** overall. Close to regulation in length (274)
and 12.5 cm narrower, but the proportions differ — 2:1 against 1.8:1 — so the
dimensions are a **parameter, not a constant**. Another room will differ again.

The net matters more. It is a clamp-on net, and where it can sit is constrained
by the desks' legs, so it lands **up to ±25 cm off the centre line**, on either
side. One half can be 165 cm and the other 115 cm.

That is why the net is clicked rather than assumed. §8's rule is *"the point
goes to the player on the side opposite the last table bounce"* — the net line
**is** the decision boundary, and the whole scoring rule rests on it. Assuming
`y = length / 2` would silently misattribute every bounce landing in a 25 cm
band near the middle, and misattribution doesn't degrade a point, it **inverts**
it. It also cannot be caught by inspection: the system would look confident and
be wrong only for balls near the net, which is where a lot of play happens.

Re-clamping the net between sessions moves it again, so this is per-session
calibration, never a stored constant.

Any camera angle works, so the framing can be tweaked freely to fit the room —
the homography absorbs arbitrary perspective. The two real constraints are that
**all four corners stay visible** and that **the camera does not move** once
calibrated. Nothing else about the angle matters.

The camera does **not** need to return to the same spot between sessions — it is
re-calibrated each time, so there is no mark to preserve on the floor. Equally,
the table and net must not move *relative to the camera* after calibration;
moving the whole rig together is harmless, nudging one of them is not.

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
Deferred, not dismissed; §14 defines the trigger.

### What the tennis project actually did (read 2026-09-21)

[collidingScopes/tennis-cv](https://github.com/collidingScopes/tennis-cv). Three
corrections to the assumptions above, and one lesson that applies either way.

**The labelling cost was overestimated by 5–10×.** Their entire dataset is
**~200 frames**, sampled at 2 fps from three 30-second clips, auto-labelled
zero-shot by a vision-language model and then reviewed by hand. "~1–2k labelled
frames" was the main reason this section deferred a trained model, and it is
wrong. We have 13 minutes of footage; they had ninety seconds.

**Keep the input resolution high.** Their sharpest practical finding: *"In a
1920×1080 frame the ball is about 25px across. The conventional 640×640 resize
shrinks it to roughly 8px."* They train at 1024×1024 with **stretching, not
letterboxing**. Our own measurements agree — the ball runs 100–900 px², so
11–34 px across. This applies to the classical pipeline too: downscaling frames
for speed destroys the very signal being detected.

**A trained model does not solve motion blur.** They report ball detection as
their weakest class, with "invented balls" and **motion-blur misses** among the
common failures. So blur is a problem for both routes, and 60 fps helps either.

What stands from the original reasoning: they run **offline, with cached
inference on a hosted GPU endpoint**, and report no inference speed. Nothing
there shows RF-DETR running live on a laptop, which is now the principal
objection rather than the labelling cost.

Two things we already do that they list as missing: the net line is clicked
rather than assumed (§4), and camera drift is detected rather than hoped for —
their README lists automatic compensation for camera motion as a wanted
improvement.

### What the pipeline actually does on the clips (measured 2026-09-21)

**The headline: the ball was being discarded for being in the air, and the
first reading of these clips blamed motion blur for it.** That reading is
corrected below. Both sets of numbers are kept, because the wrong one is the
more instructive.

#### The false trail

The first measurement ran the colour-and-size gate over all four clips and
found this:

| clip | what is in it | nothing found | exactly one |
|---|---|---|---|
| `empty-table.mp4` | table, no ball, nobody | 100.0% | 0.0% |
| `rally.mp4` | points being played | 73.5% | 18.0% |
| `warmup.mp4` | knocking about | 75.9% | 17.0% |
| `ball-positions.mp4` | ball placed by hand, at rest | 27.8% | 69.2% |

69.2% on a resting ball against 18.0% on a struck one looks conclusive: the
ball blurs in flight, the saturation drops, the gate loses it. It was read
that way, and §17.3 was answered "180 does not survive flight."

Two things were wrong with that. The reading of rally against warm-up as "in
play" against "between points" is the smaller one — `warmup.mp4` is ten
minutes of knocking a ball about, so it is *full* of ball, and a ball detector
scoring the same on both is the right answer rather than a failure. Searching
for a distinction that was never going to be there cost an afternoon.

#### What it actually was

§4's homography maps an image point to where that ray meets the **table
plane**. A ball in flight is above the plane, so it lands past the far edge —
further the higher it goes. The candidate filter rejected anything off the
table, with a 10 cm margin. It was therefore discarding the ball precisely
while it was in play, and keeping it whenever it was lying still.

Sweeping that margin on `rally.mp4`, frames with at least one candidate:

| margin | `rally.mp4` (ball in play) | `ball-positions.mp4` (ball at rest) |
|---|---|---|
| 10 cm | 25.3% | 86.8% |
| 60 cm | 57.5% | 90.1% |
| 150 cm | **77.0%** | 90.7% |
| 400 cm | 94.0% | 90.7% |

A filter that costs three quarters of the moving ball and nothing of the still
one is not measuring saturation. **§17.3 is answered the other way: there is
no evidence here that `sat_min = 180` fails in flight.** The margin is now
150 cm and no longer asks a question about the table at all — far enough out
the plane projection degenerates, and the bound only keeps the ceiling and the
back wall out. §7 asks the polygon question properly, of bounces, which really
are on the plane.

Two repairs that were tried and did **not** help, recorded so they are not
tried again. Lowering `sat_min` raises the raw count but inverts the result
once tracking is applied — the warm-up overtakes the rally, which is skin
returning below 140 exactly as §17.3 predicted. Adding MOG2 motion on top of
`sat_min = 180` changes almost nothing, because colour is the tighter
constraint of the two, not because motion is worthless.

#### With the tracker, against real bounces

Coverage is distinct frames inside an accepted track. Paths overlap, so adding
their lengths double-counts — it read 29.9% where the truth was 22.1%.

#### With the tracker

There is still no *labelled* ground truth for ball position. `rally.truth.csv`
is not it: its twelve rows are point outcomes — a human pressing a key for who
won, as §12's README describes — so they are rally endings plus reaction time,
at moments when the ball is in the net or on the floor. Scoring against them
gave 10 of 12, and twelve *random* frames score 10.5 on the same test. At high
coverage a two-second window lands on some track wherever it is put.
`track_probe.py` prints that chance figure beside the score so it cannot be
read naively again.

What *was* done instead, and should have been done first: **draw the accepted
tracks onto the frames and look at them.** It settled in minutes what the
percentages could not.

| gate | coverage | what the longest tracks were |
|---|---|---|
| one path at a time, 200 px | 1.3% | — |
| every blob starts a path, 25 px | 48.2% | a ball held in a hand; the player's red jumper |
| + hue floor at 10 | 14.9% | a ball held in a hand |
| + travel ≥ 150 px | **8.6%** | the ball, dropping and bouncing |

The two repairs that produced that came straight off the images. The colour
gate opened at hue 3; the ball reads 14–18 and the player's red jumper and the
red bat face read 2–5, and **90% of all tracked frames sat below hue 6**.
Separately, standing still is constant acceleration with a = 0, so a ball
waiting in a hand fitted the arc test perfectly and was the single longest
accepted path in the clip — longer than any rally in it.

Coverage *fell* at every repair, and that is the point: the earlier figures
were mostly jumper.

**All 26 surviving tracks were then inspected by eye.** None is clothing, bat
or background — every one sits on the ball. Twenty show the ball in free
motion: arcs over the net, bounces off the table, rolls along it, serve
tosses. Six show the ball held or carried in a hand, which is the ball
correctly found at a moment that is not play, and is §8's problem rather than
§5's.

So **precision is high and recall is unmeasured**. Twenty-six trajectories in
three minutes of play is far fewer than the number of shots played, so the
tracker is missing most of the ball's flights — it just is not inventing any.
That is the right way round: §15's phantom-point target is the strict one.

#### Measured against hand-labelled frames (2026-09-22)

213 frames of `rally.mp4`, one every 25, labelled with `label_ball.py`. Every
planned frame was answered, so the sample is not skewed towards the easy ones.
**131 had the ball visible; 82 did not** — the ball is genuinely unfindable in
38% of frames, before any algorithm is blamed.

| | first measured | per-frame gates widened | split association gate |
|---|---|---|---|
| ball found | 17 — 13.0% | 35 — 26.7% | **67 of 131 — 51.1%** |
| invented | 1 of 213 | 0 of 213 | **1 of 213** |

#### Why the misses happened

Every one of the 114 misses was diagnosed against the labels, and the order was
not the expected one:

| cause | frames | share |
|---|---|---|
| detected, but never became a track | 49 | 43% |
| projected off the table (margin) | 37 | 32% |
| size gate — too thick | 16 | 14% |
| size gate — too thin | 12 | 11% |
| **colour gate** | **0** | **0%** |

**The colour gate never fails.** On every missed frame the ball reads hue
12–17, saturation 186–230, value 221–252 — comfortably inside it. The
saturation threshold, motion blur and MOG2 all stopped being the problem the
moment the hue floor was fixed, and the effort spent on them was aimed at
something that had already gone.

Two of the remaining causes are thresholds. Widening both — `margin_cm`
150 → 900, `tolerance` (0.5, 2.5) → (0.25, 6.0) — takes recall from 13.0% to
26.7% while invented balls fall from 1 to 0. Margin kept paying at every step
out to 900 cm at no cost in precision; 2000 cm bought one more sighting and
started inventing.

**The design that settles.** The per-frame gates only have to exclude the
absurd. A forearm and a ball are alike in one frame and nothing alike over six,
so the discriminating belongs to steps 3–4, across frames, which is where it
now happens. A blob four times the expected width is deliberately kept; a ball
projecting 8 m past a 2.8 m table is still a candidate, because that is what a
high ball looks like through a plane homography.

#### Where the remaining misses go (diagnosed 2026-09-23)

Re-run at the widened gates, and attributed by relaxing one rule at a time in
the real `follow` rather than by re-implementing its logic:

| | frames |
|---|---|
| a candidate sat on the ball, but no track formed | 80 of 96 |
| no candidate at all | 16 of 96 |

Of the 16, twelve still project past even the 900 cm margin and four fail the
size gate. Detection is no longer the constraint.

**Detection is at 88%.** Accepting any single candidate as a track
(`least=1, travel=0`) finds the ball in 115 of 131 labelled frames. So the
pipeline *sees* the ball nearly nine times in ten, and the tracker discards
two thirds of that.

~~**The ball is seen in isolated frames.**~~ **Wrong, corrected 2026-09-23.**
Requiring two sightings rather than one drops 87.8% to 55.0%, and that was read
as the detections having no neighbour to chain to. Measured directly, the
missed frames carry almost as many neighbouring detections as the tracked ones
— a mean of 3.39 of the 4 surrounding frames against 3.69 — so the ball *is*
being detected either side. The drop was the tracker failing to link
detections, not detections being absent, and the "~55% ceiling" read off it did
not exist.

**It was the association gate.** The ball moves a median 25 px per frame and
75 px at the 90th percentile; the gate was 25 px. A path with one sighting has
no velocity to extrapolate, so its prediction is "stays put" and it reached the
ball's next frame about half the time. Splitting that into `reach_px` while a
path is still guessing and `gate_px` once it has three positions and a real arc
took recall from 26.7% to **51.1%** for one extra invented ball in 213 frames.
A uniformly wide gate had already measured worse, which is why one number could
not serve both jobs.

**Only the travel rule binds.** Varying `least` from 3 to 6 changes nothing at
all — found and invented are identical at every value — because a path that
spans 150 px has plenty of sightings anyway. The two guards overlap and travel
does all the work.

| `least_travel_px` | found | invented |
|---|---|---|
| 150 (current) | 35 — 26.7% | **0** |
| 100 | 44 — 33.6% | 2 |
| 60 | 54 — 41.2% | 4 |
| 30 | 68 — 51.9% | 12 |
| 0 | 69 — 52.7% | **89** |

The cliff at 0 is the rule earning its place: it is what rejects a ball resting
in a hand and anything else that sits still. Between 150 and 30 there is a
genuine frontier — 15 points of recall for 4 false claims in 213 frames — and
`empty-table.mp4` stays at zero tracks across all of it.

#### Re-diagnosed at 51% (2026-09-23)

With the association gate split, the tracker's other rules stop blocking
anything. Of 64 remaining misses, 48 have a candidate sitting on the ball, and
relaxing each rule alone recovers:

| relaxation | recovers, of the 48 |
|---|---|
| no travel rule | 32 |
| travel 60 px | 18 |
| sighting minimum (`least` 1 or 3) | 4 |
| association gate, reach, coasting | 1 each |
| **the arc rule** | **0** |

The remaining 16 have no candidate at all: twelve project past even the 900 cm
margin, four fail the size gate.

**Recall is now bounded by a precision trade, not by a fixable fault.** Every
lever except the travel rule is exhausted, and the travel rule is priced:

| `least_travel_px` | found | counted invented |
|---|---|---|
| 150 (current) | 67 — 51.1% | 1 |
| 100 | 76 — 58.0% | 3 |
| 60 | 85 — 64.9% | 6 |
| 30 | 98 — 74.8% | 15 |

**And "invented" overstates the harm.** The six at travel 60, inspected: one is
the dog in the doorway, one is a track up a forearm, two sit 2.7 and 3.6
ball-widths from the click — on the hand gripping the ball, not an invention —
and two are on frames marked hidden, one of which is a clean ball-like
trajectory down the table that the labeller could not see. The genuine phantom
rate at travel 60 is about **2 in 213**, and both are objects that never bounce
on the table, which is what §7 and §8 key on.

**Still not chosen here**, and now for a better reason than caution: the
remaining question is what a phantom track costs in *points*, and §8's rally
logic may discard a dog and a forearm for free. That is measurable at M3 and
guessable at M2. Raising recall further means taking this trade, so M3 is the
work that unblocks M2 rather than the other way round.

**Not chosen here.** Where to sit on that frontier is a judgement about points,
not about detections, and §15 measures points. It should be decided at M3
against point accuracy rather than guessed at now, and with more than one clip:
131 labelled frames is a thin basis for picking among six configurations.

**Precision is near-perfect.** The tracker finds about half the visible ball and claims almost none that is
not there. That is the right way round for §15, whose phantom-point target is
the strict one, and it is a long way from M2 being done.

The match radius barely mattered at 13% — 12.2% at 10 px against 13.0% at 25,
50 and 100 px — so the hits are not marginal. When a track is on the ball it is within
ten pixels of it, and there is no band of near-misses to recover by loosening
anything.

Dropping the travel guard takes recall to 23.7% and invented from 1 to 5.
Recorded, not taken: that trade wants deciding against point accuracy, not
against a detection rate.

A ball counts as found only when a track's position *for that frame* lands near
the click. Merely covering the frame counts for nothing, for the reason above.

Quantifying the miss rate needs somebody to mark where the ball is in a sample
of frames, which nobody has done and which no amount of parameter sweeping
substitutes for. tennis-cv managed on ~200 such frames, and three minutes of
rally footage is already recorded — so it is labelling work, not filming.

Filming is separately needed for §15's ~100 points, and **those need not be one
clip**: several shorter clips are fine and give more varied lighting and
positions. Each clip needs its own four-corner calibration, since the camera
moves between sessions — `drift.py` exists to catch it when it moves within
one.

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

### Measured end to end (2026-09-23): no points, and why

§7 and §8 are built and unit-tested, and running the whole chain over
`rally.mp4` awards **zero points against the 12 hand-marked outcomes**. The
reason is upstream of both, and it is not a threshold.

| | |
|---|---|
| tracks | 126 (median length **11 frames**, 0.37 s) |
| tracks containing any reversal in y | **17 of 126** |
| reversals found | 48 |
| reversals landing on the table | **9** |
| reversals landing off it | 39 |

**Bounces are not being captured.** A bounce is a reversal, and a reversal needs
three consecutive tracked positions spanning the turn. Tracks are third-second
fragments, so 109 of 126 contain no reversal at all — they catch one side of an
arc and stop. §7 already warned that at 30 fps a bounce can fall entirely
between two frames; this is that, made worse by the ball being tracked in only
half of them.

**And the reversals that are found are mostly not on the table.** Median x of
−61 cm on a table spanning 0–140, with 30 of the 39 misses off the *side*
rather than the ends. These are turns in tracks following the ball around the
players — a serve toss, a catch, the ball in a hand — not table bounces
projected badly. Widening the bounce margin does not recover them: it would
take 250 cm to sweep in 45 of 48, by which point the polygon has stopped
meaning anything and floor bounces are gone as a rally-end signal.

T_dwell is necessary and not sufficient. Joining fragments took rallies from 35
to 12 and points from 0 to 2, and neither of those 2 lands near a real one.

**What this says about the milestones.** M3 cannot be evaluated until bounces
are captured, so the earlier reading — that M3 unblocks M2 — was half right:
the travel trade still needs point-level judgement, but no point-level
judgement is possible yet. Both wait on the same thing.

**The promising direction, not yet tried:** stop requiring the reversal to be
sampled. A track either side of a bounce is two parabolic arcs, and where they
meet is the contact — fit them and solve for it. That works with the samples
already in hand, needs no extra frames, and would also place the contact at the
surface rather than at the lowest *sampled* point a few centimetres above it.
It is a change to how §7 detects, not a threshold, which is why it is recorded
here rather than swept.


### Points, at last (2026-09-23)

The chain awards points. Against the 12 hand-marked outcomes in
`rally.truth.csv`, at the settings whose tracks were inspected frame by frame:

| | travel 150, dwell 21 | travel 150, dwell 45 | travel 60, dwell 45 |
|---|---|---|---|
| points found | 6 of 12 | 8 of 12 | 8 of 12 |
| **awarded to the right side** | **6 of 6** | 6 of 8 | 7 of 8 |
| spurious | 1 | 2 | 3 |

**Half the points are missed and the ones found are mostly right.** That is the
shape §15 wants — its phantom-point target is the strict one — but it is
6 of 12, not 90%.

**The side mapping is settled, and measured rather than chosen.** `near` is the
camera's left: 6 correct against 0 for the opposite mapping, and the same
ordering at every other setting. §1 leaves this to the operator at session
start; for this footage it is not in doubt.

#### Two corrections to the previous entry

The "39 floor bounces" above were almost all **a ball held in a hand before the
match began** — every one inspected, and all before frame 900 when the first
point is at 1753. Measuring only the window where points are played gives 115
tracks, 15 sampled reversals, 5 of them on the table. The statistic was not
measuring play.

And the turns are not missing. **57 of the 91 in-play fragment pairs** have the
first ending downward and the next beginning upward, with a **median gap of one
frame**. The ball is lost for a single frame at exactly the moment it bounces —
fastest, lowest, against the table edge. Requiring the reversal to be sampled
threw away four bounces in five.

`bounce_between` solves for it: each arm is a straight run, and the two meet in
a V whose vertex is the contact. That also places the contact *below* both
fragments, at the surface the ball touched rather than at the lowest frame that
happened to be caught — a difference §7 magnifies by projecting it into table
centimetres. Table bounces go from 9 to 49 at unchanged settings.

Only within a dwell the tracker already treats as one rally. Across a real loss,
a descent followed by a rise is just the next serve.


#### Why the other six are missed, and what does not fix it

Diagnosed per point. One rally never registers a net crossing; the other four
cross and register **a single table bounce**.

Tracing one of them (the point at f3678) shows the mechanism, and it is not a
missing bounce. The rally contains two good table bounces, at f3555 and f3610 —
and between them a contact at f3572 projecting to **16 cm past the near edge**,
classified as the floor. A floor bounce ends the rally. So one rally becomes
two, each left holding a single bounce, and neither can score.

The obvious repair is a looser bounce margin, and it was measured rather than
assumed:

| bounce margin | points found | **correct** | awarded |
|---|---|---|---|
| 8 cm | 6 of 12 | **6** | 7 |
| 30 cm | 9 of 12 | **6** | 11 |
| 50 cm | 10 of 12 | 7 | 12 |
| 80 cm | 10 of 12 | 7 | 13 |

**The correct count does not move.** Loosening finds more points and the extra
ones go to the wrong player, because widening the margin also destroys the
floor bounce as a rally-end signal and real rallies start merging.

A two-threshold version was tried too — count a contact as a table bounce only
when clearly on the table, end the rally only when clearly off it, ignore the
band between. Across six combinations of the two thresholds the correct count
sat at 6 every time. It was measured before being built, and it is not built.

**So thresholds are exhausted.** Six correct points is what this bounce data
supports, whatever the margins. The next lever is the quality of the contacts
themselves — where `bounce_between`'s V-vertex lands relative to the real
contact — not where the boundaries are drawn around them.


### The travel trade, settled (2026-09-23)

Deferred three times as "a judgement about points, not detections". With the
pipeline scoring, it can be judged — and it resolves against loosening.

| `least_travel_px` | points found | correct | awarded | **accuracy** |
|---|---|---|---|---|
| **150 (current)** | 7 of 12 | 7 | 8 | **87.5%** |
| 100 | 6 of 12 | 6 | 10 | 60.0% |
| 60 | 6 of 12 | 6 | 10 | 60.0% |
| 30 | 5 of 12 | 5 | 8 | 62.5% |

**Loosening loses both accuracy and recall.** Not a trade at all. The extra
tracks that a looser rule admits raise the detection rate — 51% to 65%,
measured — and then make the scoring worse, because a rally holding one real
ball and several fragments of an arm has a last table bounce that belongs to
neither. The detection figure was measuring the wrong thing all along, which is
the argument for judging at M3 rather than M2, arrived at from the other
direction.

§15's target is 90% of awarded points to the correct player. 87.5% of 8 is
within one point of it, on 12.

#### What still misses, traced individually

| point | cause |
|---|---|
| f3183 | two good bounces, split by a **27-frame gap** — 6 frames past the dwell |
| f3494 | two good bounces, split by a contact **23 cm past the near edge**, read as the floor |
| f2075 | one bounce; the ball is barely tracked through the rally |
| f4518 | last fragment ends at f4447, point marked at f4518 — **71 frames untracked** |
| f1753 | no table bounce at all in the rally |

Two of the five are rallies **cut in half**, not rallies missed. Widening the
bounce margin to 20 cm reattaches one of them: 8 found and 8 correct, at 2
spurious rather than 1 — 80% accuracy against 87.5%. One more correct point for
one more wrong one, on twelve. Left at 8 cm, because §15 weights accuracy and
the difference is a coin-flip at this sample size, not because 8 is known to be
right.

The other three are the tracker losing the ball for seconds at a time, which no
threshold downstream can repair.


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
| Person detection (320 px, every 5th frame, MPS) | ~3 ms amortised |
| Tracking + bounce + state machine | < 1 ms |
| Overlay + display | ~5 ms |
| **Total** | **~23 ms → 40+ fps** |

Apple Silicon confirmed, so the person detector runs on the GPU via MPS (or a
CoreML export) and is effectively free — the budget above is the pessimistic
CPU-only case and still clears 60 fps. It also means the TrackNet-style upgrade
in §5 can be trained and run locally if §15 calls for it, rather than needing
rented hardware.

End-to-end latency from the real point to the score changing: transport
(**160 ms, measured**) + dwell timeout (~700 ms) + network (~100 ms) ≈
**960 ms**, which reads as instant next to someone walking to fetch the ball —
but with far less headroom than the ~100 ms guess this section started with.

**Transport measured 2026-09-14:** median 157–161 ms over two runs of ten
flashes, by `probe.py --latency`. That is an *upper* bound — it includes the
display's own latency, since the method times a flash on screen — and it
resolves only to one frame interval (33 ms), which is why the two runs land a
frame apart rather than disagreeing.

The dwell timeout is now the only part of the budget worth tuning: it is 4× the
transport, it is ours to choose, and §8 sets it. If the total ever needs to come
down, shorten the dwell — do not go looking for a faster camera.

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

## 17. Resolved, and what's still open

Settled 2026-09-10: **Apple Silicon Mac + iPhone over USB**, **orange ball on a
white table**, and the framing is free to be tweaked to fit the room (§4).

Settled 2026-09-14 by M0 (§2): **Continuity Camera over USB**, no third-party
capture app, **1280×720 at a true 30.0 fps**, jitter ≤ 47 ms sustained. The
iPhone must be resolved **by name, not index**. Capture is opened once per
session and held open, because re-opening costs a cold-start stall.

Still open:

1. **Is 30 fps enough to resolve a bounce?** Continuity Camera will not give 60,
   so this is the one measurement that could still force a change of capture app.
   Not answerable from a framerate — M2 measures detection rate on recorded
   clips and decides. Switching to Camo/Iriun afterwards touches no code.
2. **Where does the Mac sit during a real match** — is someone watching the
   operator window, or does it run headless with a phone or TV showing
   `SpectatorView` as the only display? Decides how much the overlay in §12
   matters versus the toast in §11. Not blocking.
3. ~~**The exact saturation threshold for the orange gate.**~~ **Settled
   2026-09-14 → measured 2026-09-17: `sat_min = 180`**, now the default. The
   original guess of 110 was far too low — at 110 an arm is an 11,498 px² blob
   and the ball is lost in it. Skin collapses by 140, the ball survives past
   240, and at 180 the ball is usually the *only* blob in frame. Its area runs
   ~100 px² at the far end to ~900 px² near the camera, which is the §5 size
   gate measured rather than guessed. **Reopened and re-closed 2026-09-21:**
   the resting-ball numbers looked suspect once §5 measured a struck ball at
   18.0% against 69.2% at rest, and that gap was read as motion blur. It was
   not: the table-polygon filter was discarding the airborne ball, and fixing
   it took the rally to 77.0% at this same threshold. 180 stands. Lowering it
   was tried and measured worse, skin returning below 140 as recorded here.
Closed 2026-09-14: **end-to-end capture latency is ~160 ms** (§13), measured by
flashing the screen and timing the step rather than reading a counter by eye.
Two lessons came out of getting there, and both apply to the ball detector:

- **The camera's auto-exposure moves the baseline.** With the panel black, a
  settled frame measured *brighter* than the white panel had a second earlier.
  Any detector keyed to an absolute brightness will drift out of calibration on
  its own, unprompted — which is what §2's "lock exposure" instruction is really
  protecting, and why §5's gate keys on saturation rather than value.
- **A measurement that works once has not been shown to work.** The absolute
  threshold produced a plausible 31 ms on its first run and refused to measure
  at all on its second. Run every calibration twice before believing it.

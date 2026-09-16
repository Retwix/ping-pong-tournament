# vision/ — auto-scoring by camera

Live point detection for the ping-pong app: an iPhone films the table, this
service tracks the ball, and points land on the existing live scorer.

Design and decisions: [`docs/vision-auto-scoring.md`](../docs/vision-auto-scoring.md).

**Status: M0, mostly answered.** Only the capture probe exists — a measuring
instrument, not part of the pipeline. Its numbers become the constants
everything else is tuned against, which is why it comes first. Transport is
settled (§2 of the spec); the orange gate and latency are still open.

## Setup (macOS, Apple Silicon)

```sh
cd vision
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Then grant camera access to whichever terminal app you're running Python in:
**System Settings → Privacy & Security → Camera**. OpenCV 5 reports the refusal
explicitly (`not authorized to capture video (status 0)`); OpenCV 4 did not, and
handed back empty frames in silence.

**Run this from a plain terminal window, not inside `tmux`.** macOS grants
camera access per *application bundle*, and a tmux server started from `launchd`
belongs to no bundle — the request is refused with no dialog, permanently,
however many times you grant your terminal access. In a normal window the
permission follows the process tree to the app and the prompt appears.

## M0: what it measured, and what is left

Plug the iPhone in over USB and unlock it. Continuity Camera makes it appear
with nothing installed — but only while the phone is **awake**: asleep, its
index opens fine and delivers no frames at all.

**1. Find the iPhone.**

```sh
python3 probe.py --list
```

*Result:* built-in FaceTime HD at `[0]`, iPhone at `[1]`. Do not hard-code that
— see the index warning in §2 of the spec.

**2. Measure the real framerate.** The reported fps is frequently a lie; this
times the frames as they actually arrive.

```sh
python3 probe.py --source 1 --seconds 60
```

*Result:* 1280×720 at a true **30.0 fps**, p95 35.9 ms, worst frame 46.7 ms,
zero failed reads over 60 s. Continuity Camera refuses 60 fps. Measure for a
full minute, not fifteen seconds: the first capture after the device has been
idle stalls for 0.25–0.5 s and skews a short run.

**3. Measure latency.** The screen flashes; the probe times how long the flash
takes to come back through the camera. Point the phone at the window and fill
its frame with it.

```sh
python3 probe.py --source 1 --latency
```

*Result:* median **157–161 ms** over two runs. Resolution is one frame interval
(33 ms), and the figure includes the display's own latency, so treat it as an
upper bound. If it reports *no step seen*, the phone is not looking at the
window — that is the intended failure, not a bug.

**4. Tune the orange gate.** ⏳ **Still to do — needs the table and a ball.**
This is the one that de-risks the white table. Aim the camera at the table, hold
the ball at the far end and then the near end, and raise `sat_min` until the
table and the shadows go black and only the ball stays white.

```sh
python3 probe.py --source 1 --mask
```

Note the **largest-blob area at each end** — that pixel count is what the
depth-aware size gate gets built from.

**Tune from a clip instead of at the table.** `--mask` takes a recorded file
just as happily as a camera, and loops it so the sliders stay usable:

```sh
python3 probe.py --source rally.mp4 --mask
```

So the scarce thing is *footage*, not table time. Record the ball held still at
each end, an empty table, and some warm-up, and the gate can be tuned and
re-tuned at any desk.

## Recording session — the field checklist

Four clips, recorded live through Continuity Camera. Follow this at the table;
it needs no other page.

### Record live, never on the phone

These commands open the iPhone and write the mp4 on the Mac as it happens. Do
**not** substitute a clip shot with the iPhone's Camera app: that is a different
pipeline — 60 fps, HEVC, Apple's full image processing, no Continuity Camera
compression, different auto-exposure behaviour. A detector tuned on footage that
clean will fail on the 30 fps stream the service actually receives. Record
through the pipeline you are going to run.

### Before you start

- [ ] iPhone plugged in over USB and **unlocked**. Asleep, it opens fine and
      delivers no frames at all.
- [ ] `python3 probe.py --list` — confirm the index. It was `[1]` here, but the
      ordering is not guaranteed.
- [ ] Camera on something **rigid**, elevated ~2–2.5 m, 1–2 m behind one end,
      looking down the long axis, with ~1 m of space beyond each end in frame.
      Everything downstream assumes it does not move.
- [ ] **Do not re-aim between clips.** Calibration is per session.
- [ ] Bright, constant, artificial light. No windows — a passing cloud changes
      the background globally. Keep glare off the white table.
- [ ] A few GB free. Five minutes of 1080p from this encoder is several hundred MB.

### Camera settings, and the one you cannot set

The spec asks for exposure, focus and white balance to be **locked** — it calls
auto-exposure the single most destructive thing for detection. **Continuity
Camera exposes no manual controls at all.** This is not an oversight to hunt
for in a menu; Apple's pipeline does not offer it.

It is not hypothetical. Measuring latency, the camera reported a *black* panel
as brighter than white had been a second earlier — the gain control hunting,
badly enough to break the measurement outright. Camo and Iriun do expose those
controls, which is a stronger argument for them than 60 fps ever was. Worth
knowing before spending an afternoon filming; whether it actually hurts ball
detection is what M2 decides.

What you can control today is the light: bright, constant, artificial, no
windows, no glare off the table.

Record at **1080p, not the 720p default**: a clip can be downscaled later, but
detail never captured cannot be invented, and the far-end ball is exactly where
pixels are scarce.

```sh
cd vision
P="./.venv/bin/python probe.py --source 1 --width 1920 --height 1080"
```

### The four clips

```sh
$P --record empty-table.mp4    --seconds 15
```
Background model, and the four table corners M1 needs for the homography. Nobody
in frame.

```sh
$P --record ball-positions.mp4 --seconds 45
```
Ball resting **on the table** at the far end for a few seconds, then the near
end, then a couple of spots between; rolling it slowly down the length is a
bonus. This measures how many pixels the ball occupies at each distance — it may
be ~300 px² near the camera and ~30 px² at the far end, and that ratio builds the
depth-aware size gate. One fixed size threshold would either miss the far ball
or accept every speck of noise near the camera.

```sh
$P --record warmup.mp4         --seconds 300
```
**No points scored, on purpose.** Knocking the ball about, fetching it off the
floor, standing around talking, walking through frame. This is the only evidence
that can prove the acceptance criterion *"zero phantom points during 10 minutes
of knocking about"*: any point emitted against this footage is a false positive
by definition, with no judgement call needed. Play real points during it and that
evidence is gone. Ten minutes is what the criterion actually asks for.

```sh
$P --record rally.mp4          --seconds 180
```
Real points, played properly. **Two people play, a third marks the score** in
the preview window as each point ends:

| key | meaning |
|---|---|
| `a` | the **left** side won that point |
| `b` | the **right** side won that point |
| `u` | undo the last mark |
| `q` | stop recording early |

Left and right as the *camera* sees them — the vision service only ever knows
sides, and the mapping to players happens once. The window shows a running count
and the last mark, so the marker can see their keypress landed.

This writes `rally.truth.csv` beside the clip (`frame, seconds, side`), on the
video's own clock. That alignment is the whole point: "points awarded to the
correct player ≥ 90%" is meaningless without ground truth, and a sequence with
no timestamps desynchronises the moment the system misses a point — every
comparison after it then reads as wrong, measuring drift rather than accuracy.

A notes app cannot do this. Marks must land on the video's clock, not
wall-clock. Nothing is written if nothing is marked, so an unmarked clip is not
a broken one — just an unlabelled one.

Reaction time of a few hundred milliseconds does not matter here: rallies are
seconds apart, and the *latency* criterion cannot be measured from a clip at
all — it only exists with the whole system running live at the table.

### While it runs

- **~2 seconds pass before it captures anything** — 60 frames are discarded to
  clear the cold-start stall. The line `Recording 45s to … at 29.7 fps` is the
  cue that recording has begun; the countdown starts there, not at the keypress.
- **The fps in that line is the measured rate.** Wildly wrong means something
  regressed — stop and say so.
- **A preview window opens; `q` in that window stops early.** A clip going badly
  costs nothing.

### Afterwards

Clips are gitignored (`vision/*.mp4`) and stay local. They are video of people:
tell whoever is playing, and delete them when M2 is done with them.

Tuning happens away from the table — `--mask` takes a file and loops it:

```sh
./.venv/bin/python probe.py --source ball-positions.mp4 --mask
```

## What is still to report back

Transport is answered (§2). What the next session at the table needs to bring
home:

- The tuned gate values, and largest-blob area at the **near** and **far** ends
  of the table — the size gate is built from the ratio between them.
- Whether glare on the white table survives the gate as a bright blob.
- A recorded clip or two of real rallies, which is what makes M2 developable
  away from the table.

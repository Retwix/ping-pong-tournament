# vision/ — auto-scoring by camera

Live point detection for the ping-pong app: an iPhone films the table, this
service tracks the ball, and points land on the existing live scorer.

Design and decisions: [`docs/vision-auto-scoring.md`](../docs/vision-auto-scoring.md).

**Status: M0.** Only the capture probe exists — a measuring instrument, not
part of the pipeline. Its numbers become the constants everything else is
tuned against, which is why it comes first.

## Setup (macOS, Apple Silicon)

```sh
cd vision
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Then grant camera access to whichever terminal app you're running Python in:
**System Settings → Privacy & Security → Camera**. Without it OpenCV opens the
device successfully and hands back empty frames, with no error — a genuinely
confusing half-hour if you don't know.

## M0: four things to measure

Plug the iPhone in over USB first. Continuity Camera should make it appear with
nothing installed.

**1. Find the iPhone.** `[0]` is usually the Mac's built-in camera.

```sh
python3 probe.py --list
```

**2. Measure the real framerate.** The reported fps is frequently a lie; this
times the frames as they actually arrive.

```sh
python3 probe.py --source 1 --seconds 15
```

≥ 50 fps closes the transport question. ~30 fps works but is the marginal case
the spec warns about — worth testing Camo or Iriun with the same phone before
settling.

**3. Measure latency.** Point the iPhone at the window; the counter inside the
video versus the counter beside it is the round-trip lag, in ms.

```sh
python3 probe.py --source 1 --latency
```

**4. Tune the orange gate.** This is the one that de-risks the white table.
Aim the camera at the table, hold the ball at the far end and then the near end,
and raise `sat_min` until the table and the shadows go black and only the ball
stays white.

```sh
python3 probe.py --source 1 --mask
```

Note the **largest-blob area at each end** — that pixel count is what the
depth-aware size gate gets built from.

## Recording test footage

```sh
python3 probe.py --source 1 --record rally.mp4 --seconds 30
```

Every later stage accepts `--source rally.mp4`, so the tracker can be developed
and tested against a real clip with no camera attached. Keep clips local and out
of git (`.gitignore` covers `vision/*.mp4`); they are video of people.

## What to report back

- The device index the iPhone landed on, and measured fps / resolution.
- Latency in ms.
- The tuned gate values, and blob area at the near and far ends of the table.
- Whether glare on the white table shows up as a bright blob in the mask.

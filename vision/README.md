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

## Recording test footage

```sh
python3 probe.py --source 1 --record rally.mp4 --seconds 30
```

Every later stage accepts `--source rally.mp4`, so the tracker can be developed
and tested against a real clip with no camera attached. Keep clips local and out
of git (`.gitignore` covers `vision/*.mp4`); they are video of people.

## What is still to report back

Transport is answered (§2). What the next session at the table needs to bring
home:

- The tuned gate values, and largest-blob area at the **near** and **far** ends
  of the table — the size gate is built from the ratio between them.
- Whether glare on the white table survives the gate as a bright blob.
- A recorded clip or two of real rallies, which is what makes M2 developable
  away from the table.

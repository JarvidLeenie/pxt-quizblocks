# QuizBlocks

QuizBlocks turns almost any [MakeCode Arcade](https://arcade.makecode.com/)
game into an educational quiz game with a small set of blocks. Your game
reads the current question and answer choices, displays them however it
likes (text, speech bubbles, labeled sprites, ...), and calls one block to
submit the player's answer. QuizBlocks checks it, fires a correct/incorrect
event, and automatically prepares the next question.

This release generates multiplication questions (factors 1-12). The public
API is deliberately independent of *how* questions are generated, so a
future version can plug in a different source (for example, a remote
question provider) without changing any block your game uses.

## Install

In the MakeCode Arcade editor:

1. Click the gear menu (or the **Extensions** toolbox category).
2. Click **Extensions**.
3. Paste this repository's GitHub URL into the search box:
   `https://github.com/YOUR_GITHUB_USERNAME/pxt-quizblocks`
4. Click the search result to add it to your project.

A **QuizBlocks** category now appears in the toolbox.

## Blocks

### Reporters (read the current question)

| Block | Returns |
|---|---|
| `question` | The current question's text, e.g. `"What is 7 x 8?"` |
| `choices` | TypeScript only. A **copy** of the current answer choices, as an array of strings. Not shown in the blocks drawer |
| `choice at index [0]` | One answer choice, by zero-based index. A whole number comes back as a number; anything else comes back as text |
| `correct choice index` | The zero-based index of the correct answer within `choices` |
| `answer` | The correct answer. A whole number comes back as a number, e.g. `56`. Anything else comes back as text |
| `number of choices` | How many choices the current question has |

`choices` returns a defensive copy: editing the array your code gets back
never changes QuizBlocks' internal state.

`choice at index` returns an empty string for an out-of-range index, instead
of throwing or returning `undefined`.

### Setup

| Block | Effect |
|---|---|
| `set number of choices to [4]` | Sets how many choices questions use |
| `set math operation to [multiplication]` | Sets the question topic (only *multiplication* is implemented in this release) |

`set number of choices to` accepts 2-6; values outside that range are
clamped (not rejected). It immediately rebuilds the *current* question's
choices with the new count - generating fresh, distinct distractors and
reshuffling - so `correct choice index` always stays in range. It does
**not** record an answer, fire `on correct answer`/`on incorrect answer`, or
change the question text.

### Submitting an answer

| Block | Effect |
|---|---|
| `submit choice [0]` | Submits the player's answer by choice index |
| `submit answer [56]` | Submits the player's answer as a number or as text |

`submit choice` takes a zero-based index into `choices`. **An out-of-range
or non-integer index is silently ignored**: it does not count as an
incorrect answer, does not fire any event, and does not advance the
question. This means a game can safely call `submit choice` with input it
hasn't validated (e.g. an index read from sprite data) without accidentally
corrupting quiz state.

`submit answer` takes a number or text. Both are turned into text and matched against the current choices, so `56` and `"56"` submit the same choice. A value that is not one of those choices is ignored the same way an invalid index is: it does not count as incorrect and does not advance the question.

If a `submit choice` or `submit answer` call happens while another one is still being
processed (for example, a handler that itself calls `submit choice`), the
nested call is ignored. This keeps state consistent even if game code
accidentally re-enters submission.

### Events

| Block | Fires when |
|---|---|
| `on correct answer` | The submitted choice was correct |
| `on incorrect answer` | The submitted choice was incorrect |
| `on new question` | A new question becomes available |

Multiple handlers for the same event all run (in registration order).

## Choice indexing

All indexes are **zero-based**, matching normal MakeCode array indexing.
For a question with choices `["48", "56", "54", "64"]` and
`correct choice index` returning `1`, the correct answer is `choices[1]`,
i.e. `"56"`.

## Event ordering and question advancement

`submit choice` runs through these steps, in this exact order:

1. Check the index. If it's invalid, stop here - nothing else happens.
2. Compare it to `correct choice index`.
3. Fire every `on correct answer` handler (if it matched) **or** every
   `on incorrect answer` handler (if it didn't). At this point,
   `question`/`choices`/`correct choice index` still describe the
   **question that was just answered** - so a handler can, for example,
   show which choice was correct before moving on.
4. Generate a new question. `submit choice` then returns.
5. Fire every `on new question` handler after that return (on the next
   pause, about 1 ms later). `question`/`choices`/`correct choice index`
   now describe the **new** question. The handler can open a dialog, such
   as `show long text` or `ask for number`, and submit the next answer.
   Opening that dialog from inside the submit that is still running freezes
   the game.

This ordering is implemented directly (handlers are called from plain
arrays), not via MakeCode's generic event bus (`control.raiseEvent`/
`control.onEvent`) and its `flush` timing - so the order above is guaranteed
by QuizBlocks' own code, not by unverified engine event-dispatch behavior.

### Startup timing

The first question is generated as soon as QuizBlocks loads - before any of
your code runs - so `question()`, `choices()`, and `correct choice index`
are always safe to read immediately, including inside an `on start` block.

`on new question` also fires once for this first question, so you can use
it for initial UI setup and not just for questions after the first one. It
fires on the first frame of the game loop (via `game.onUpdate`, with a
one-shot internal flag), which is the point at which every top-level block
in your program - including any `on new question` block sitting anywhere in
your workspace - has already registered its handler. MakeCode Arcade's
`on start` block is **not** a deferred callback (it compiles to plain code
inlined at that point in your program), so firing this event any earlier
would risk running before your own `on new question` handler was
registered. This is standard, documented engine behavior (the same hook
ordinary game code uses for per-frame logic), not an arbitrary delay.

## Building the simple A/B quiz

See [`examples/simple-quiz`](./examples/simple-quiz) for the full,
runnable code. In short:

```ts
quiz.setNumberOfChoices(2)

quiz.onCorrect(function () { info.changeScoreBy(1) })
quiz.onIncorrect(function () { info.changeLifeBy(-1) })

// game.onPaint runs every frame, before sprites, after the background.
// Read the current question/choices fresh each frame.
game.onPaint(function () {
    screen.fill(15)
    screen.print(quiz.question(), 4, 4, 1)
    screen.print("A) " + quiz.choice(0), 4, 40, 1)
    screen.print("B) " + quiz.choice(1), 4, 56, 1)
})

controller.A.onEvent(ControllerButtonEvent.Pressed, function () {
    quiz.submitChoice(0)
})
controller.B.onEvent(ControllerButtonEvent.Pressed, function () {
    quiz.submitChoice(1)
})
```

Use a non-blocking, every-frame draw call (`screen.print` inside
`game.onPaint`), not a modal dialog and not a one-shot `screen.print`
called only from `onNewQuestion`. A modal dialog would block A/B input
while it's open; a one-shot draw gets erased, because MakeCode Arcade
redraws the background every frame regardless of whether anything
changed, so a draw that only happens once (e.g. only inside
`onNewQuestion`) disappears on the very next frame. `onNewQuestion` is
still useful here - the example uses it to clear a "Correct!"/"Try again!"
feedback message - just don't make it the only place you draw the
question itself. See the example's
[README](./examples/simple-quiz/README.md) for step-by-step import
instructions.

## Building the Space Invaders example

See [`examples/space-invaders`](./examples/space-invaders) for the full
code. In short: create one enemy sprite per choice, label each with
`sprite.sayText(choice)` (no `timeOnScreen` argument - passing `0` makes
the label expire immediately), and remember its answer index on the
sprite itself (`sprite.data["choiceIndex"] = i`). When a projectile
overlaps an enemy, read that index back and call
`quiz.submitChoice(index)`. Respawn enemies from `quiz.choices()` inside
`onNewQuestion`. The question text itself isn't on any sprite, so draw it
separately with `game.onPaint()`, the same every-frame technique used in
the A/B quiz above. See the example's
[README](./examples/space-invaders/README.md) for step-by-step import
instructions.

This demonstrates the same QuizBlocks API driving a completely different
game design from the A/B quiz - QuizBlocks doesn't know or care whether an
answer came from a button press or a bullet hitting a sprite.

## Multiplication question generation

Questions use random factors from 1-12. Distractors are built from
plausible mistakes (off-by-one-factor errors, `a*b ± a`, `a*b ± b`,
transposed digits, nearby numbers, ...), deduplicated against each other
and the correct answer, with a numeric fallback if there aren't enough
plausible candidates for the configured choice count. Answer order is
shuffled, so the correct answer isn't always in the same position. The
generator avoids repeating the exact same factors twice in a row where
possible. Question generation lives entirely behind one internal function
(`generateQuestionData`/`generateNewQuestion` in `main.ts`), separate from
the public blocks, so a future question source can replace it without
touching `question()`, `choices()`, `submitChoice()`, or the events.

## Tests

`test.ts` is a `pxt test` test file covering: the initial question being
available synchronously; the default and configurable choice counts (2-6);
no duplicate choice values; `correctChoice()` always in bounds and matching
the right product; correct/incorrect submissions firing the right events
exactly once; a submission always advancing to a new question; invalid
indexes being ignored safely; and repeated submissions not corrupting
state.

Run it with the [pxt CLI](https://github.com/microsoft/pxt):

```bash
npm install -g pxt
pxt target arcade
pxt install
pxt test
```

`pxt test`/`pxt build` compile `main.ts` (and `test.ts`) with the real
MakeCode Arcade compiler and catch type errors or invalid block
annotations, but do not execute the program - MakeCode Arcade's simulator
runs in a browser, and the CLI's headless Node simulator does not implement
every engine primitive the game loop needs (`control.runInParallel`, used
by the scene/game loop itself, isn't available there - this reproduces even
for an empty default Arcade project, so it's an environment limitation, not
a QuizBlocks issue).

### What was actually verified

- `pxt build` and `pxt test` were run against the real, officially
  published `pxt-arcade` npm target (installed via `pxt target arcade`) for
  `main.ts`, `test.ts`, and both examples. All compiled with zero errors.
- The exact compiled JavaScript output of `main.ts` + `test.ts` was also
  executed directly in Node (bypassing the browser-only simulator, with a
  one-line stub for `game.onUpdate`) and **all assertions in `test.ts`
  passed**, including event firing counts/order, choice-count
  reconfiguration, invalid-index handling, and repeated submissions.

### What still needs manual/browser verification

- Opening the extension in the actual MakeCode Arcade web editor to confirm
  the **QuizBlocks** toolbox category, block shapes, and tooltips render as
  expected in Blocks (not just that the TypeScript compiles). To do this
  yourself: create a project, add the extension via its GitHub URL (see
  **Install** above), and check the **QuizBlocks** category.

Compiling cleanly is not the same as working correctly in the simulator -
both examples initially had real rendering bugs that only showed up when
actually run in the browser, and were only caught once a person ran them:
`screen.print()` called once from `onNewQuestion` got silently erased by
the engine's own per-frame background redraw (fixed by moving drawing into
`game.onPaint`, which runs every frame), and `sprite.sayText(text, 0)`
made the `0` set the speech bubble's expiry to "now," so it vanished
almost immediately (fixed by omitting the argument). Both fixes are
reflected in the example code and the "Building the simple A/B quiz"
section above, and were re-verified with `pxt build` against the real
target afterward - but since neither example has been run in an actual
simulator by this process (only compiled), treat them as compiling
correctly and logically reviewed, not as confirmed bug-free until you've
run them yourself.

## Publishing a release

1. Push this repository to GitHub as `pxt-quizblocks` (public).
2. In the MakeCode Arcade editor, open the project, click **Share**, and
   follow the GitHub publish flow, **or** from the command line:
   ```bash
   npm install -g pxt
   pxt target arcade
   pxt login   # one-time auth, if publishing via the pxt CLI
   pxt bump    # tags a new semver release (e.g. v0.0.1) and pushes it
   ```
3. Once tagged, anyone can add the extension in MakeCode Arcade via
   **Extensions** and your repository's GitHub URL (optionally with
   `#v0.0.1` to pin a version).

## Future compatibility

The long-term goal is a companion website that serves personalized
questions and tracks learning progress, falling back to offline questions
(like this release's multiplication generator) when a game runs outside
that website. This version intentionally does **not** implement that
integration. To keep the door open without over-building now:

- The public blocks expose no network concepts.
- `submitChoice` is independent of how a question was generated.
- The current question is always cached and read synchronously - no game
  author ever has to manage async loading.
- All question generation lives behind one internal function, ready to be
  swapped for a remote provider later.

# QuizBlocks demo: A-or-B Quiz

The smallest possible QuizBlocks game: two answer choices, Button A picks
choice 0, Button B picks choice 1. Correct answers add to the score,
incorrect answers remove a life. The question and both answers are drawn
with `screen.print()` every time a new question arrives, so the display
updates automatically and nothing ever blocks button input.

## Run it

1. Open the [MakeCode Arcade editor](https://arcade.makecode.com/).
2. Create a new project.
3. Click **Extensions** in the toolbox (or the gear menu > Extensions) and
   add QuizBlocks: paste the GitHub URL for this repository (e.g.
   `https://github.com/YOUR_GITHUB_USERNAME/pxt-quizblocks`) into the search
   box and click the search result to add it.
4. Switch to the **JavaScript** editor and replace the starter code with the
   contents of [`main.ts`](./main.ts) from this folder.
5. Switch back to **Blocks** to see the equivalent block code, or just run
   the program with the ▶ button in the simulator.
6. Press **A** to answer with the first choice, **B** for the second.

## What it shows

- `quiz.setNumberOfChoices(2)` configures a true/false-style quiz.
- `quiz.onNewQuestion()` is the single place the display gets updated - it
  fires for the first question automatically, and again after every
  `quiz.submitChoice()` call.
- `quiz.onCorrect()` / `quiz.onIncorrect()` drive the score and lives via
  the built-in `info` HUD.
- No modal dialogs: `screen.print()` draws directly into the frame buffer,
  so button presses are never blocked waiting on a prompt to close.

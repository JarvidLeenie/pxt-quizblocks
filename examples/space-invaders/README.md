# QuizBlocks demo: Space Invaders Quiz

Four enemy ships cross the top of the screen, each labeled with one answer
choice via `sprite.sayText()`. Move with left/right, shoot with **A**.
Hitting an enemy submits its answer. This demo exists to show that the
exact same QuizBlocks API used in the [simple A/B quiz](../simple-quiz)
also works for a completely different game design.

## Run it

1. Open the [MakeCode Arcade editor](https://arcade.makecode.com/).
2. Create a new project.
3. Add the QuizBlocks extension (Extensions > search the GitHub URL for
   this repository, e.g. `https://github.com/YOUR_GITHUB_USERNAME/pxt-quizblocks`).
4. Switch to the **JavaScript** editor and replace the starter code with
   the contents of [`main.ts`](./main.ts) from this folder.
5. Switch to **Blocks** if you'd like to see/edit it visually, or just run
   it in the simulator.
6. Use left/right to move, **A** to fire. Shoot the enemy showing the
   answer you think is correct.

## What it shows

- `quiz.setNumberOfChoices(4)` configures a 4-answer question, one per
  enemy.
- Each enemy's answer index is stored directly on the sprite with
  `sprite.data["choiceIndex"] = i` - a built-in, Blocks-compatible
  key/value store on every sprite. (The community "Sprite Data" extension
  provides the same kind of per-sprite storage if you prefer it.)
- The overlap handler (`sprites.onOverlap(SpriteKind.Projectile,
  SpriteKind.Enemy, ...)`) reads that stored index and calls
  `quiz.submitChoice(index)` - QuizBlocks doesn't know or care that the
  "choice" came from a bullet hitting a sprite instead of a button press.
- `quiz.onNewQuestion()` spawns the next wave of enemies. It's the same
  handler used for the very first wave and every wave after - no special
  "first time" setup code needed.

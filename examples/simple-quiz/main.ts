// QuizBlocks demo A: a minimal "A or B" quiz.
// Two choices, Button A submits choice 0, Button B submits choice 1.
//
// Display is drawn with game.onPaint(), which runs every frame, before
// sprites, after the background. A one-shot screen.print() is not enough:
// MakeCode Arcade redraws the background every frame regardless, which
// would erase a draw that only happened once. onPaint keeps redrawing the
// current question/choices each frame, is never a modal dialog, and so
// never blocks A/B from being pressed.

quiz.setNumberOfChoices(2)

let feedback = ""

quiz.onCorrect(function () {
    feedback = "Correct!"
    info.changeScoreBy(1)
})

quiz.onIncorrect(function () {
    feedback = "Try again!"
    info.changeLifeBy(-1)
})

// Fires once for the very first question (right after the game starts)
// and again after every submitChoice() call, so this one handler clears
// the feedback message for the new question.
quiz.onNewQuestion(function () {
    feedback = ""
})

game.onPaint(function () {
    screen.fill(15)
    screen.print(quiz.question(), 4, 4, 1)
    screen.print("A) " + quiz.choice(0), 4, 40, 1)
    screen.print("B) " + quiz.choice(1), 4, 56, 1)
    if (feedback) {
        screen.print(feedback, 4, 100, 1)
    }
})

controller.A.onEvent(ControllerButtonEvent.Pressed, function () {
    quiz.submitChoice(0)
})

controller.B.onEvent(ControllerButtonEvent.Pressed, function () {
    quiz.submitChoice(1)
})

info.setScore(0)
info.setLife(3)

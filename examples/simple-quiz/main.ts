// QuizBlocks demo A: a minimal "A or B" quiz.
// Two choices, Button A submits choice 0, Button B submits choice 1.
// Display is drawn with screen.print() - a per-frame draw, not a modal
// dialog - so it never blocks the player from pressing A or B.

quiz.setNumberOfChoices(2)

function render() {
    screen.fill(15)
    screen.print(quiz.question(), 4, 4, 1)
    screen.print("A) " + quiz.choice(0), 4, 40, 1)
    screen.print("B) " + quiz.choice(1), 4, 56, 1)
}

quiz.onCorrect(function () {
    info.changeScoreBy(1)
})

quiz.onIncorrect(function () {
    info.changeLifeBy(-1)
})

// Fires once for the very first question (right after the game starts)
// and again after every submitChoice() call, so this one handler keeps
// the display in sync for the whole game.
quiz.onNewQuestion(function () {
    render()
})

controller.A.onEvent(ControllerButtonEvent.Pressed, function () {
    quiz.submitChoice(0)
})

controller.B.onEvent(ControllerButtonEvent.Pressed, function () {
    quiz.submitChoice(1)
})

info.setScore(0)
info.setLife(3)

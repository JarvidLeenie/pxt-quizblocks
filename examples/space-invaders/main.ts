// QuizBlocks demo B: Space Invaders Quiz.
// Four enemy ships, each labeled with one answer choice using sayText().
// Shooting an enemy submits its choice. Each enemy's choice index is
// stored on the sprite itself using the built-in `sprite.data` bag (a
// simple, Blocks-compatible key/value store on every sprite - the "Sprite
// Data extension" mentioned in the spec is one way to get this same
// behavior; this demo uses the equivalent built-in feature instead so it
// needs no extra extension).

quiz.setNumberOfChoices(4)

let enemies: Sprite[] = []

const enemyImage = img`
    . . . 5 . . . 5 . .
    . . . . 5 5 5 5 . .
    . . 5 5 5 5 5 5 5 .
    . 5 5 . 5 5 . 5 5 .
    5 5 5 5 5 5 5 5 5 5
    5 . 5 5 5 5 5 5 . 5
    5 . 5 . . . . 5 . 5
`

const shipImage = img`
    . . . . 1 1 . . . .
    . . . 1 1 1 1 . . .
    . . . 1 1 1 1 . . .
    . 1 1 1 1 1 1 1 1 .
    1 1 1 1 1 1 1 1 1 1
`

const bulletImage = img`
    . 7 .
    7 7 7
    . 7 .
`

// Spawns one enemy per current choice, each sayText()-ing its own answer
// and remembering its own choice index via sprite.data.
function spawnEnemies() {
    const choices = quiz.choices()
    for (let i = 0; i < choices.length; i++) {
        const enemy = sprites.create(enemyImage, SpriteKind.Enemy)
        enemy.data["choiceIndex"] = i
        enemy.setPosition(20 + i * 28, 20)
        // No timeOnScreen argument: passing 0 sets the bubble's expiry to
        // "now," so it disappears almost immediately. Omitting it leaves
        // the label on screen indefinitely, until the sprite is destroyed.
        enemy.sayText(choices[i])
        enemies.push(enemy)
    }
}

const ship = sprites.create(shipImage, SpriteKind.Player)
ship.setPosition(80, 110)
ship.setStayInScreen(true)

game.onUpdate(function () {
    if (controller.left.isPressed()) {
        ship.x -= 2
    } else if (controller.right.isPressed()) {
        ship.x += 2
    }
})

controller.A.onEvent(ControllerButtonEvent.Pressed, function () {
    sprites.createProjectileFromSprite(bulletImage, ship, 0, -120)
})

// Shooting an enemy submits its stored choice index. QuizBlocks fires
// onCorrect/onIncorrect first (while the submitted question is still the
// "current" one), then advances the question, then fires onNewQuestion -
// which is where the next wave of enemies is spawned below.
sprites.onOverlap(SpriteKind.Projectile, SpriteKind.Enemy, function (projectile, enemy) {
    projectile.destroy()

    const index = enemy.data["choiceIndex"]
    for (let i = 0; i < enemies.length; i++) {
        enemies[i].destroy()
    }
    enemies = []

    quiz.submitChoice(index)
})

quiz.onCorrect(function () {
    info.changeScoreBy(1)
})

quiz.onIncorrect(function () {
    info.changeLifeBy(-1)
})

// Useful for both the very first wave of enemies and every wave after.
quiz.onNewQuestion(function () {
    spawnEnemies()
})

info.setScore(0)
info.setLife(3)

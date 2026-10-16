// Automated tests for QuizBlocks, run via `pxt test` (see README.md).
// Uses simple throw-on-failure assertions so failures show a clear message
// in the `pxt test` output.

function assert(cond: boolean, message: string): void {
    if (!cond) {
        throw "FAILED: " + message;
    }
}

function assertInRange(value: number, min: number, max: number, message: string): void {
    assert(value >= min && value <= max, message + " (got " + value + ")");
}

// --- Initial question is available synchronously, with defaults ---

assert(quiz.question() != null && quiz.question().length > 0, "initial question() is non-empty");
assert(quiz.numberOfChoices() == 4, "default number of choices is 4");
assert(quiz.choices().length == 4, "default choices() has 4 entries");
assertInRange(quiz.correctChoice(), 0, 3, "default correctChoice() is in range");

// choices() returns a defensive copy
{
    const c = quiz.choices();
    c.push("tampered");
    assert(quiz.choices().length == 4, "mutating choices() result does not affect internal state");
}

// choice(correctChoice()) matches the value returned by choices()
assert(quiz.choice(quiz.correctChoice()) == quiz.choices()[quiz.correctChoice()], "choice(i) matches choices()[i]");
assert(quiz.answer() == quiz.choice(quiz.correctChoice()), "answer() is the correct choice text");

// --- Choice-count configuration, from 2 through 6 ---

for (let n = 2; n <= 6; n++) {
    quiz.setNumberOfChoices(n);
    assert(quiz.numberOfChoices() == n, "numberOfChoices() reflects setNumberOfChoices(" + n + ")");
    assert(quiz.choices().length == n, "choices() length matches setNumberOfChoices(" + n + ")");
    assertInRange(quiz.correctChoice(), 0, n - 1, "correctChoice() stays in bounds for " + n + " choices");

    const choiceList = quiz.choices();
    const seen: { [key: string]: boolean } = {};
    for (let i = 0; i < choiceList.length; i++) {
        assert(!seen[choiceList[i]], "no duplicate choice values for " + n + " choices");
        seen[choiceList[i]] = true;
    }

    let correctCount = 0;
    for (let i = 0; i < choiceList.length; i++) {
        if (i == quiz.correctChoice()) correctCount++;
    }
    assert(correctCount == 1, "exactly one choice slot is marked correct for " + n + " choices");
}

// Out-of-range values are clamped, not rejected outright
quiz.setNumberOfChoices(1);
assert(quiz.numberOfChoices() == 2, "setNumberOfChoices clamps values below 2");
quiz.setNumberOfChoices(10);
assert(quiz.numberOfChoices() == 6, "setNumberOfChoices clamps values above 6");

quiz.setNumberOfChoices(4);

// --- correctChoice() always points at the right product ---

for (let trial = 0; trial < 20; trial++) {
    const beforeQuestion = quiz.question();
    const correctIndex = quiz.correctChoice();
    const correctValue = quiz.choice(correctIndex);

    // Question text is "What is A x B?" - recover A and B to check the math
    // without relying on regex (not supported by the Arcade TS subset).
    const prefix = "What is ";
    const sep = " x ";
    const startA = beforeQuestion.indexOf(prefix) + prefix.length;
    const sepIndex = beforeQuestion.indexOf(sep, startA);
    assert(startA >= prefix.length && sepIndex > startA, "question text matches expected multiplication format");
    const aStr = beforeQuestion.substr(startA, sepIndex - startA);
    const bStart = sepIndex + sep.length;
    const qIndex = beforeQuestion.indexOf("?", bStart);
    const bStr = beforeQuestion.substr(bStart, qIndex - bStart);
    const a = parseInt(aStr);
    const b = parseInt(bStr);
    assert(correctValue == (a * b).toString(), "choice(correctChoice()) equals a * b for '" + beforeQuestion + "'");
    assert(quiz.answer() == (a * b).toString(), "answer() equals a * b for '" + beforeQuestion + "'");

    // advance via a harmless wrong submission so the next trial gets a fresh question
    const wrongIndex = correctIndex == 0 ? 1 : 0;
    quiz.submitChoice(wrongIndex);
}

// --- Correct and incorrect submissions fire the right events ---

let correctFired = 0;
let incorrectFired = 0;
let newQuestionFired = 0;

quiz.onCorrect(function () { correctFired++; });
quiz.onIncorrect(function () { incorrectFired++; });
quiz.onNewQuestion(function () { newQuestionFired++; });

{
    const before = newQuestionFired;
    const correctIndex = quiz.correctChoice();
    quiz.submitChoice(correctIndex);
    assert(correctFired == 1, "submitting the correct index fires onCorrect exactly once");
    assert(incorrectFired == 0, "submitting the correct index does not fire onIncorrect");
    assert(newQuestionFired == before + 1, "a correct submission advances to a new question exactly once");
}

{
    const before = newQuestionFired;
    const correctIndex = quiz.correctChoice();
    const wrongIndex = correctIndex == 0 ? 1 : 0;
    quiz.submitChoice(wrongIndex);
    assert(correctFired == 1, "submitting a wrong index does not fire onCorrect");
    assert(incorrectFired == 1, "submitting a wrong index fires onIncorrect exactly once");
    assert(newQuestionFired == before + 1, "an incorrect submission still advances to a new question exactly once");
}

// --- submitAnswer matches choice text and ignores unknown values ---

{
    const before = newQuestionFired;
    const correctText = quiz.answer();
    quiz.submitAnswer(correctText);
    assert(correctFired == 2, "submitAnswer of the correct text fires onCorrect");
    assert(incorrectFired == 1, "submitAnswer of the correct text does not fire onIncorrect");
    assert(newQuestionFired == before + 1, "submitAnswer of the correct text advances once");
}

{
    const before = newQuestionFired;
    const wrongText = quiz.choice(quiz.correctChoice() == 0 ? 1 : 0);
    quiz.submitAnswer(wrongText);
    assert(correctFired == 2, "submitAnswer of a wrong choice does not fire onCorrect");
    assert(incorrectFired == 2, "submitAnswer of a wrong choice fires onIncorrect");
    assert(newQuestionFired == before + 1, "submitAnswer of a wrong choice advances once");
}

{
    const before = newQuestionFired;
    const beforeCorrect = correctFired;
    quiz.submitAnswer(quiz.answer().toString());
    assert(correctFired == beforeCorrect + 1, "submitAnswer of the answer text matches the numeric answer");
    assert(newQuestionFired == before + 1, "submitAnswer of the answer text advances once");
}

{
    const beforeQuestion = quiz.question();
    const beforeCorrect = correctFired;
    const beforeIncorrect = incorrectFired;
    const beforeNew = newQuestionFired;
    quiz.submitAnswer("not-a-choice");
    quiz.submitAnswer("");
    assert(quiz.question() == beforeQuestion, "unknown submitAnswer does not change the question");
    assert(correctFired == beforeCorrect, "unknown submitAnswer does not fire onCorrect");
    assert(incorrectFired == beforeIncorrect, "unknown submitAnswer does not fire onIncorrect");
    assert(newQuestionFired == beforeNew, "unknown submitAnswer does not advance");
}

// --- Invalid indexes are handled safely and do not advance the question ---

{
    const beforeQuestion = quiz.question();
    const beforeCorrect = correctFired;
    const beforeIncorrect = incorrectFired;
    const beforeNew = newQuestionFired;

    quiz.submitChoice(-1);
    quiz.submitChoice(999);
    quiz.submitChoice(quiz.numberOfChoices());

    assert(quiz.question() == beforeQuestion, "invalid submissions do not change the current question");
    assert(correctFired == beforeCorrect, "invalid submissions do not fire onCorrect");
    assert(incorrectFired == beforeIncorrect, "invalid submissions do not fire onIncorrect");
    assert(newQuestionFired == beforeNew, "invalid submissions do not fire onNewQuestion");
}

// --- Repeated submissions do not corrupt internal state ---

for (let i = 0; i < 25; i++) {
    const n = quiz.numberOfChoices();
    assertInRange(quiz.correctChoice(), 0, n - 1, "correctChoice() stays in bounds across repeated submissions");
    quiz.submitChoice(quiz.correctChoice());
}

console.log("ALL TESTS PASSED");

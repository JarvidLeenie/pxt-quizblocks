/**
 * QuizBlocks
 *
 * Turns almost any MakeCode Arcade game into an educational quiz game.
 * Game code reads the current question/choices, shows them however it
 * likes (sprites, text, speech bubbles, ...), and calls submitChoice()
 * when the player picks an answer. See README.md for full docs.
 */

//% color="#AA5585" icon="" block="QuizBlocks" weight=90
//% groups='["Question", "Setup", "Answer", "Events"]'
namespace quiz {

    /**
     * Topics that QuizBlocks can generate questions for.
     * Only Multiplication is implemented in this release; the enum exists
     * so future topics (Addition, Subtraction, Division, ...) can be added
     * without changing any existing block signatures.
     */
    export enum MathOperation {
        //% block="multiplication"
        Multiplication = 0
    }

    // One in-flight question: the public-facing text/choices plus the
    // internal data (a, b, correct) needed to rebuild choices when the
    // player changes the number of choices mid-question.
    class QuizQuestion {
        text: string;
        a: number;
        b: number;
        correct: number;
        choices: string[];
        correctIndex: number;
    }

    const MIN_CHOICES = 2;
    const MAX_CHOICES = 6;
    const DEFAULT_CHOICES = 4;
    const MAX_DISTRACTOR_SPREAD = 1000;

    let numChoices = DEFAULT_CHOICES;
    let operation = MathOperation.Multiplication;
    let submitting = false;
    let lastA = -1;
    let lastB = -1;

    let correctHandlers: (() => void)[] = [];
    let incorrectHandlers: (() => void)[] = [];
    let newQuestionHandlers: (() => void)[] = [];

    function randomInt(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function shuffle<T>(arr: T[]): T[] {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = randomInt(0, i);
            const tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
        return arr;
    }

    function pickFactors(): { a: number; b: number } {
        let a = randomInt(1, 12);
        let b = randomInt(1, 12);
        let attempts = 0;
        // Best-effort: avoid repeating the exact same question twice in a row.
        while (a === lastA && b === lastB && attempts < 5) {
            a = randomInt(1, 12);
            b = randomInt(1, 12);
            attempts++;
        }
        lastA = a;
        lastB = b;
        return { a, b };
    }

    // Plausible wrong answers: off-by-one factor mistakes, common
    // off-by-a/off-by-b slip-ups, nearby numbers, and transposed digits.
    function multiplicationDistractorCandidates(a: number, b: number, correct: number): number[] {
        const raw = [
            a * (b + 1), a * (b - 1),
            (a + 1) * b, (a - 1) * b,
            a * b + a, a * b - a,
            a * b + b, a * b - b,
            (a + 1) * (b + 1), (a - 1) * (b - 1),
            a * (b + 2), a * (b - 2),
            correct + 1, correct - 1,
            correct + 2, correct - 2,
            correct + 10, correct - 10
        ];

        if (correct >= 10 && correct <= 99) {
            const tens = Math.floor(correct / 10);
            const ones = correct % 10;
            if (tens !== ones) {
                raw.push(ones * 10 + tens);
            }
        }

        const seen: { [key: number]: boolean } = {};
        const result: number[] = [];
        for (let i = 0; i < raw.length; i++) {
            const v = raw[i];
            if (v > 0 && v !== correct && !seen[v]) {
                seen[v] = true;
                result.push(v);
            }
        }
        return shuffle(result);
    }

    function fillDistractors(candidates: number[], correct: number, count: number): number[] {
        const chosen: number[] = [];
        const used: { [key: number]: boolean } = {};
        used[correct] = true;

        for (let i = 0; i < candidates.length && chosen.length < count - 1; i++) {
            const v = candidates[i];
            if (!used[v]) {
                used[v] = true;
                chosen.push(v);
            }
        }

        // Fallback for when there aren't enough plausible candidates
        // (small factors, large choice counts): fabricate distinct,
        // positive values near the correct answer.
        let spread = 1;
        while (chosen.length < count - 1 && spread < MAX_DISTRACTOR_SPREAD) {
            const low = correct - spread;
            const high = correct + spread;
            for (let v = low; v <= high && chosen.length < count - 1; v++) {
                if (v > 0 && !used[v]) {
                    used[v] = true;
                    chosen.push(v);
                }
            }
            spread++;
        }

        return chosen;
    }

    function buildChoices(a: number, b: number, correct: number, count: number): { choices: string[]; correctIndex: number } {
        const candidates = multiplicationDistractorCandidates(a, b, correct);
        const distractors = fillDistractors(candidates, correct, count);
        const values = shuffle([correct].concat(distractors));
        const correctIndex = values.indexOf(correct);
        const choices = values.map(v => v.toString());
        return { choices, correctIndex };
    }

    // Internal question generator. Kept separate from the public blocks so
    // a future provider (e.g. a remote question service) could replace it
    // without touching question()/choices()/submitChoice()/events.
    function generateQuestionData(): { text: string; a: number; b: number; correct: number } {
        switch (operation) {
            case MathOperation.Multiplication:
            default: {
                const factors = pickFactors();
                const correct = factors.a * factors.b;
                return { text: "What is " + factors.a + " x " + factors.b + "?", a: factors.a, b: factors.b, correct: correct };
            }
        }
    }

    function generateNewQuestion(): QuizQuestion {
        const data = generateQuestionData();
        const built = buildChoices(data.a, data.b, data.correct, numChoices);
        const q = new QuizQuestion();
        q.text = data.text;
        q.a = data.a;
        q.b = data.b;
        q.correct = data.correct;
        q.choices = built.choices;
        q.correctIndex = built.correctIndex;
        return q;
    }

    // Initialized synchronously at load time (before any user "on start"
    // code runs), so question()/choices()/correctChoice() are always safe
    // to call immediately. See README "Startup timing" for details.
    let currentQuestion: QuizQuestion = generateNewQuestion();

    function fireHandlers(handlers: (() => void)[]) {
        // Snapshot in case a handler registers/unregisters during dispatch.
        const snapshot = handlers.slice();
        for (let i = 0; i < snapshot.length; i++) {
            snapshot[i]();
        }
    }

    // MakeCode Arcade's "on start" block is not a deferred callback: it
    // compiles to plain code inlined at that point in top-level program
    // order. So firing onNewQuestion eagerly while this file loads would
    // run before the user's own top-level code (including any "on new
    // question" blocks) has had a chance to register handlers, and they
    // would miss it.
    //
    // game.onUpdate() registers a per-frame handler that only starts
    // running once the game loop begins - which is after every top-level
    // statement (ours and the user's) has executed. Firing the initial
    // onNewQuestion on the first such frame, guarded by a one-shot flag,
    // guarantees every onNewQuestion handler the user registered anywhere
    // in their program is already in place. This is standard, documented
    // engine behavior (the same hook game code uses for per-frame logic),
    // not an arbitrary delay.
    let hasFiredInitialQuestion = false;
    game.onUpdate(function () {
        if (!hasFiredInitialQuestion) {
            hasFiredInitialQuestion = true;
            fireHandlers(newQuestionHandlers);
        }
    });

    /**
     * The current question's text.
     */
    //% blockId=quiz_question block="question"
    //% group="Question" weight=100
    export function question(): string {
        return currentQuestion.text;
    }

    /**
     * The current question's answer choices, in display order.
     * Returns a copy, so changing the result does not affect QuizBlocks.
     */
    //% blockId=quiz_choices block="choices"
    //% group="Question" weight=90
    export function choices(): string[] {
        return currentQuestion.choices.slice();
    }

    /**
     * One answer choice from the current question.
     * Returns an empty string if index is out of range.
     * @param index zero-based choice index, eg: 0
     */
    //% blockId=quiz_choice block="choice at index %index"
    //% index.defl=0
    //% group="Question" weight=80
    export function choice(index: number): string {
        if (isInvalidIndex(index, currentQuestion.choices.length)) {
            return "";
        }
        return currentQuestion.choices[index];
    }

    /**
     * The correct answer for the current question, as text.
     * For a multiplication question this is the product, e.g. "56".
     */
    //% blockId=quiz_answer block="answer"
    //% group="Question" weight=75
    export function answer(): string {
        return currentQuestion.choices[currentQuestion.correctIndex];
    }

    /**
     * The zero-based index of the correct answer among choices().
     */
    //% blockId=quiz_correct_choice block="correct choice index"
    //% group="Question" weight=70
    export function correctChoice(): number {
        return currentQuestion.correctIndex;
    }

    /**
     * How many answer choices the current question has.
     */
    //% blockId=quiz_number_of_choices block="number of choices"
    //% group="Question" weight=60
    export function numberOfChoices(): number {
        return currentQuestion.choices.length;
    }

    /**
     * Sets how many answer choices future and current questions use (2-6).
     * Values outside that range are clamped. Rebuilds the current
     * question's choices immediately so correctChoice() stays valid, but
     * does not record an answer, fire events, or change the question text.
     * @param count number of choices, eg: 4
     */
    //% blockId=quiz_set_number_of_choices block="set number of choices to %count"
    //% count.defl=4 count.min=2 count.max=6
    //% group="Setup" weight=50
    export function setNumberOfChoices(count: number): void {
        let c = Math.floor(count);
        if (isNaN(c)) {
            c = DEFAULT_CHOICES;
        }
        if (c < MIN_CHOICES) {
            c = MIN_CHOICES;
        }
        if (c > MAX_CHOICES) {
            c = MAX_CHOICES;
        }
        numChoices = c;

        const built = buildChoices(currentQuestion.a, currentQuestion.b, currentQuestion.correct, numChoices);
        currentQuestion.choices = built.choices;
        currentQuestion.correctIndex = built.correctIndex;
    }

    /**
     * Sets which kind of question QuizBlocks generates next.
     * Only multiplication is available in this release.
     */
    //% blockId=quiz_set_math_operation block="set math operation to %op"
    //% group="Setup" weight=40
    export function setMathOperation(op: MathOperation): void {
        operation = op;
    }

    function isInvalidIndex(index: number, length: number): boolean {
        return index === undefined || index === null || isNaN(index) ||
            Math.floor(index) !== index || index < 0 || index >= length;
    }

    /**
     * Submits the player's answer for the current question.
     *
     * - An out-of-range or non-integer index is ignored: it does not count
     *   as incorrect and does not advance the question.
     * - Otherwise, fires onCorrect() or onIncorrect() (while question(),
     *   choices(), and correctChoice() still describe the *submitted*
     *   question), then generates a new question, then fires
     *   onNewQuestion() (now describing the *new* question).
     * - Calls to submitChoice() while a submission is already being
     *   processed (eg. from inside a handler) are ignored, to avoid
     *   recursive/duplicate submissions corrupting state.
     * @param index the chosen answer's zero-based index, eg: 0
     */
    //% blockId=quiz_submit_choice block="submit choice %index"
    //% index.defl=0
    //% group="Answer" weight=30
    export function submitChoice(index: number): void {
        if (submitting) {
            return;
        }
        if (isInvalidIndex(index, currentQuestion.choices.length)) {
            return;
        }

        submitting = true;

        if (index === currentQuestion.correctIndex) {
            fireHandlers(correctHandlers);
        } else {
            fireHandlers(incorrectHandlers);
        }

        currentQuestion = generateNewQuestion();
        fireHandlers(newQuestionHandlers);

        submitting = false;
    }

    /**
     * Submits the player's answer as text, matched against the current choices.
     *
     * A value that is not one of the current choices is ignored: it does not
     * count as incorrect and does not advance the question. Matching is exact.
     * A nested call made while a submission is already being processed is ignored.
     * @param value the chosen answer, eg: "56"
     */
    //% blockId=quiz_submit_answer block="submit answer %value"
    //% value.defl="56"
    //% group="Answer" weight=29
    export function submitAnswer(value: string): void {
        if (submitting || value == null) {
            return;
        }
        const index = currentQuestion.choices.indexOf(value);
        if (index < 0) {
            return;
        }
        submitChoice(index);
    }

    /**
     * Runs when the player submits the correct answer.
     */
    //% blockId=quiz_on_correct block="on correct answer"
    //% group="Events" weight=20 blockGap=8
    export function onCorrect(handler: () => void): void {
        correctHandlers.push(handler);
    }

    /**
     * Runs when the player submits an incorrect answer.
     */
    //% blockId=quiz_on_incorrect block="on incorrect answer"
    //% group="Events" weight=19 blockGap=8
    export function onIncorrect(handler: () => void): void {
        incorrectHandlers.push(handler);
    }

    /**
     * Runs whenever a new question becomes available - including once for
     * the very first question, right after the game starts. Use this to
     * set up or refresh your question/answer display.
     */
    //% blockId=quiz_on_new_question block="on new question"
    //% group="Events" weight=18 blockGap=8
    export function onNewQuestion(handler: () => void): void {
        newQuestionHandlers.push(handler);
    }
}

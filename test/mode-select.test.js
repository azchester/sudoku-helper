/**
 * Unit tests for shipped action-mode mapping (board.js applyActionMode).
 * Run: node test/mode-select.test.js
 */
"use strict";

var path = require("path");
var assert = require("assert");

var root = path.join(__dirname, "..");
var Board = require(path.join(root, "board.js"));

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("PASS  " + name);
  } catch (e) {
    failed++;
    console.error("FAIL  " + name);
    console.error("      " + (e && e.stack ? e.stack : e));
  }
}

function record(history, board, mutator) {
  var before = Board.cloneBoard(board);
  var ok = mutator();
  if (ok) {
    Board.pushHistory(history, before);
  }
  return ok;
}

// --- mode constants / mapping ---

test("ACTION_MODE maps to hide / USER / GIVEN click types", function () {
  assert.strictEqual(
    Board.modeToClickType(Board.ACTION_MODE.HIDE),
    Board.CLICK_TYPE.LEFT
  );
  assert.strictEqual(
    Board.modeToClickType(Board.ACTION_MODE.USER),
    Board.CLICK_TYPE.RIGHT
  );
  assert.strictEqual(
    Board.modeToClickType(Board.ACTION_MODE.GIVEN),
    Board.CLICK_TYPE.MIDDLE
  );
  assert.strictEqual(Board.modeToClickType("NOPE"), null);
  assert.strictEqual(Board.isActionMode(Board.ACTION_MODE.HIDE), true);
  assert.strictEqual(Board.isActionMode("FOO"), false);
  assert.deepStrictEqual(Board.ACTION_MODES, [
    Board.ACTION_MODE.HIDE,
    Board.ACTION_MODE.USER,
    Board.ACTION_MODE.GIVEN,
  ]);
});

// --- HIDE mode primary activation ---

test("HIDE mode hides only the target mark", function () {
  var board = Board.createBoard();
  var ok = Board.applyActionMode(board, Board.ACTION_MODE.HIDE, 5, 0, 0);
  assert.strictEqual(ok, true);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 0, 5), false);
  for (var d = 1; d <= 9; d++) {
    if (d === 5) continue;
    assert.strictEqual(Board.hasVisibleHint(board, 0, 0, d), true);
  }
  assert.strictEqual(Board.hasVisibleHint(board, 0, 1, 5), true);
});

// --- USER mode primary activation ---

test("USER mode places USER and peer-clears digit", function () {
  var board = Board.createBoard();
  var ok = Board.applyActionMode(board, Board.ACTION_MODE.USER, 7, 0, 0);
  assert.strictEqual(ok, true);
  var cell = Board.getCell(board, 0, 0);
  assert.strictEqual(cell.value, 7);
  assert.strictEqual(cell.type, Board.CELL_TYPE.USER);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 1, 7), false);
  assert.strictEqual(Board.hasVisibleHint(board, 1, 0, 7), false);
  assert.strictEqual(Board.hasVisibleHint(board, 3, 0, 7), false);
});

// --- GIVEN mode primary activation ---

test("GIVEN mode places GIVEN with peer clear", function () {
  var board = Board.createBoard();
  var ok = Board.applyActionMode(board, Board.ACTION_MODE.GIVEN, 9, 4, 4);
  assert.strictEqual(ok, true);
  var cell = Board.getCell(board, 4, 4);
  assert.strictEqual(cell.value, 9);
  assert.strictEqual(cell.type, Board.CELL_TYPE.GIVEN);
  assert.strictEqual(Board.hasVisibleHint(board, 4, 0, 9), false);
});

// --- invalid mode / filled lock ---

test("invalid mode and filled cell are no-ops", function () {
  var board = Board.createBoard();
  assert.strictEqual(
    Board.applyActionMode(board, "NOPE", 1, 0, 0),
    false
  );
  Board.applyActionMode(board, Board.ACTION_MODE.USER, 1, 0, 0);
  assert.strictEqual(
    Board.applyActionMode(board, Board.ACTION_MODE.HIDE, 2, 0, 0),
    false
  );
  assert.strictEqual(
    Board.applyActionMode(board, Board.ACTION_MODE.GIVEN, 3, 0, 0),
    false
  );
  assert.strictEqual(Board.getCell(board, 0, 0).value, 1);
});

// --- history path with modes ---

test("mode-applied mutations push/undo history and update stats", function () {
  var board = Board.createBoard();
  var history = Board.createHistory();

  record(history, board, function () {
    return Board.applyActionMode(board, Board.ACTION_MODE.HIDE, 4, 0, 0);
  });
  record(history, board, function () {
    return Board.applyActionMode(board, Board.ACTION_MODE.USER, 6, 1, 1);
  });

  assert.strictEqual(Board.digitStats(board, 6).placed, 1);
  assert.strictEqual(Board.canUndo(history), true);

  assert.strictEqual(Board.undo(history, board), true);
  assert.strictEqual(Board.isFilled(Board.getCell(board, 1, 1)), false);
  assert.strictEqual(Board.digitStats(board, 6).placed, 0);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 0, 4), false);

  assert.strictEqual(Board.undo(history, board), true);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 0, 4), true);

  assert.strictEqual(Board.canUndo(history), false);
  assert.strictEqual(Board.undo(history, board), false);

  assert.strictEqual(Board.redo(history, board), true);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 0, 4), false);
});

// --- empty redo after new mode edit ---

test("new mode edit after undo clears redo", function () {
  var board = Board.createBoard();
  var history = Board.createHistory();
  record(history, board, function () {
    return Board.applyActionMode(board, Board.ACTION_MODE.HIDE, 1, 0, 0);
  });
  record(history, board, function () {
    return Board.applyActionMode(board, Board.ACTION_MODE.HIDE, 2, 0, 0);
  });
  Board.undo(history, board);
  assert.strictEqual(Board.canRedo(history), true);
  record(history, board, function () {
    return Board.applyActionMode(board, Board.ACTION_MODE.USER, 8, 8, 8);
  });
  assert.strictEqual(Board.canRedo(history), false);
  assert.strictEqual(Board.getCell(board, 8, 8).type, Board.CELL_TYPE.USER);
});

// --- summary ---

console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) {
  process.exit(1);
}

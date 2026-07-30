/**
 * Unit tests for conflict detection and mode hotkeys (shipped board.js).
 * Run: node test/conflict-hotkey.test.js
 */
"use strict";

var path = require("path");
var assert = require("assert");

var root = path.join(__dirname, "..");
var Board = require(path.join(root, "board.js"));
var fs = require("fs");

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

// --- hotkey mapping ---

test("modeFromHotkey maps h/u/g (case-insensitive)", function () {
  assert.strictEqual(Board.modeFromHotkey("h"), Board.ACTION_MODE.HIDE);
  assert.strictEqual(Board.modeFromHotkey("H"), Board.ACTION_MODE.HIDE);
  assert.strictEqual(Board.modeFromHotkey("u"), Board.ACTION_MODE.USER);
  assert.strictEqual(Board.modeFromHotkey("U"), Board.ACTION_MODE.USER);
  assert.strictEqual(Board.modeFromHotkey("g"), Board.ACTION_MODE.GIVEN);
  assert.strictEqual(Board.modeFromHotkey("G"), Board.ACTION_MODE.GIVEN);
  assert.strictEqual(Board.modeFromHotkey("z"), null);
  assert.strictEqual(Board.modeFromHotkey(""), null);
  assert.strictEqual(Board.modeFromHotkey(null), null);
});

// --- no conflict on empty / non-duplicate board ---

test("empty board and non-conflicting places yield no conflict", function () {
  var board = Board.createBoard();
  var c0 = Board.detectConflicts(board);
  assert.strictEqual(c0.hasConflict, false);
  assert.strictEqual(c0.cells.length, 0);

  Board.placeValue(board, 0, 0, 1, Board.CELL_TYPE.USER);
  Board.placeValue(board, 0, 1, 2, Board.CELL_TYPE.GIVEN);
  Board.placeValue(board, 1, 0, 3, Board.CELL_TYPE.USER);
  var c1 = Board.detectConflicts(board);
  assert.strictEqual(c1.hasConflict, false);
  assert.strictEqual(c1.cells.length, 0);
  assert.strictEqual(c1.boxes.length, 0);
});

// --- box conflict ---

test("duplicate digit in same box marks conflict cells and box", function () {
  var board = Board.createBoard();
  // Bypass peer-clear path: placeValue still places even if digit already filled
  Board.placeValue(board, 0, 0, 5, Board.CELL_TYPE.USER);
  Board.placeValue(board, 0, 4, 5, Board.CELL_TYPE.USER);

  var conf = Board.detectConflicts(board);
  assert.strictEqual(conf.hasConflict, true);
  assert.ok(conf.boxes.indexOf(0) >= 0, "box 0 in conflict");
  assert.strictEqual(Board.isConflictCell(conf, 0, 0), true);
  assert.strictEqual(Board.isConflictCell(conf, 0, 4), true);
  assert.strictEqual(Board.isConflictCell(conf, 0, 1), false);

  var values = conf.cells.map(function (c) {
    return c.value;
  });
  assert.ok(values.every(function (v) {
    return v === 5;
  }));
});

// --- row conflict ---

test("duplicate digit in same row marks row conflict", function () {
  var board = Board.createBoard();
  // Global row 0: box0 cell0 and box1 cell0
  Board.placeValue(board, 0, 0, 7, Board.CELL_TYPE.USER);
  Board.placeValue(board, 1, 0, 7, Board.CELL_TYPE.GIVEN);

  var conf = Board.detectConflicts(board);
  assert.strictEqual(conf.hasConflict, true);
  assert.ok(conf.rows.indexOf(0) >= 0, "row 0 conflict");
  assert.strictEqual(Board.isConflictCell(conf, 0, 0), true);
  assert.strictEqual(Board.isConflictCell(conf, 1, 0), true);
  // Non-conflicting GIVEN still blue when not in conflict set — type preserved
  assert.strictEqual(Board.getCell(board, 1, 0).type, Board.CELL_TYPE.GIVEN);
});

// --- column conflict ---

test("duplicate digit in same column marks col conflict", function () {
  var board = Board.createBoard();
  // Global col 0: box0 cell0 and box3 cell0
  Board.placeValue(board, 0, 0, 9, Board.CELL_TYPE.USER);
  Board.placeValue(board, 3, 0, 9, Board.CELL_TYPE.USER);

  var conf = Board.detectConflicts(board);
  assert.strictEqual(conf.hasConflict, true);
  assert.ok(conf.cols.indexOf(0) >= 0, "col 0 conflict");
  assert.strictEqual(Board.isConflictCell(conf, 0, 0), true);
  assert.strictEqual(Board.isConflictCell(conf, 3, 0), true);
});

// --- undo/reset clear conflicts ---

test("undo and reset clear conflicts", function () {
  var board = Board.createBoard();
  var history = Board.createHistory();

  record(history, board, function () {
    return Board.placeValue(board, 0, 0, 4, Board.CELL_TYPE.USER);
  });
  record(history, board, function () {
    return Board.placeValue(board, 0, 8, 4, Board.CELL_TYPE.USER);
  });
  assert.strictEqual(Board.detectConflicts(board).hasConflict, true);

  Board.undo(history, board);
  assert.strictEqual(Board.detectConflicts(board).hasConflict, false);
  assert.strictEqual(Board.getCell(board, 0, 0).value, 4);
  assert.strictEqual(Board.isFilled(Board.getCell(board, 0, 8)), false);

  Board.placeValue(board, 0, 8, 4, Board.CELL_TYPE.USER);
  assert.strictEqual(Board.detectConflicts(board).hasConflict, true);
  Board.resetBoard(board);
  assert.strictEqual(Board.detectConflicts(board).hasConflict, false);
});

// --- structural: mode labels underline hotkeys ---

test("index.html mode labels underline H/U/G hotkey letters", function () {
  var html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(
    /hotkey-letter">H<\/u>ide/i.test(html) || /<u[^>]*>H<\/u>ide/i.test(html),
    "Hide label underlines H"
  );
  assert.ok(
    /hotkey-letter">u<\/u>ser/i.test(html) || /<u[^>]*>u<\/u>ser/i.test(html),
    "User label underlines u"
  );
  assert.ok(
    /hotkey-letter">g<\/u>iven/i.test(html) || /<u[^>]*>g<\/u>iven/i.test(html),
    "Given label underlines g"
  );
  assert.ok(/data-mode="HIDE"/.test(html));
  assert.ok(/data-mode="USER"/.test(html));
  assert.ok(/data-mode="GIVEN"/.test(html));
});

// --- structural: conflict CSS and stats hover path in app ---

test("styles define conflict red; app binds stats hover and hotkeys", function () {
  var css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.ok(/--conflict:\s*#/.test(css) || /conflict:\s*#d/.test(css));
  assert.ok(/\.cell-value\.conflict/.test(css));
  assert.ok(/\.super-cell\.conflict/.test(css));
  assert.ok(/conflict-row|conflict-col/.test(css));

  var app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  assert.ok(/modeFromHotkey/.test(app));
  assert.ok(/onStatsEnter|statsEl\.addEventListener\("mouseover"/.test(app));
  assert.ok(/detectConflicts/.test(app));
  assert.ok(/setHighlightFrom/.test(app));
});

// --- summary ---

console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) {
  process.exit(1);
}

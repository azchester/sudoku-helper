/**
 * Pure Sudoku helper board logic ported from the Java Swing app
 * (com.aaron.sudoku.components: Grid, SuperCell, Cell, CellValue).
 *
 * Layout: 9 super-cells (3×3 boxes) × 9 cells each. Empty cells hold
 * pencil marks 1–9. Left-click hides a mark; right-click places USER (black);
 * middle-click places GIVEN (blue). Placing clears that digit from peers in
 * the same box, row, and column. Filled cells reject further edits.
 */
(function (root) {
  "use strict";

  var CELL_TYPE = {
    GIVEN: "GIVEN",
    USER: "USER",
    HINT: "HINT",
  };

  var CLICK_TYPE = {
    LEFT: "LEFT",
    RIGHT: "RIGHT",
    MIDDLE: "MIDDLE",
  };

  /** UI action modes for primary-click on a pencil mark (replaces mouse-button status). */
  var ACTION_MODE = {
    HIDE: "HIDE",
    USER: "USER",
    GIVEN: "GIVEN",
  };

  var ACTION_MODES = [ACTION_MODE.HIDE, ACTION_MODE.USER, ACTION_MODE.GIVEN];

  function isActionMode(mode) {
    return (
      mode === ACTION_MODE.HIDE ||
      mode === ACTION_MODE.USER ||
      mode === ACTION_MODE.GIVEN
    );
  }

  /**
   * Map UI action mode to legacy click type (for handleClick compatibility).
   */
  function modeToClickType(mode) {
    if (mode === ACTION_MODE.HIDE) return CLICK_TYPE.LEFT;
    if (mode === ACTION_MODE.USER) return CLICK_TYPE.RIGHT;
    if (mode === ACTION_MODE.GIVEN) return CLICK_TYPE.MIDDLE;
    return null;
  }

  /**
   * Apply the selected number-status mode to a visible pencil mark (primary path).
   * HIDE → hideHint; USER → place USER; GIVEN → place GIVEN.
   * @returns {boolean} true if board state changed
   */
  function applyActionMode(board, mode, digit, superCell, cell) {
    if (!isActionMode(mode)) {
      return false;
    }
    return handleClick(board, modeToClickType(mode), digit, superCell, cell);
  }

  /**
   * Create a fresh empty board: 9 boxes, each with 9 cells of hints 1–9.
   * @returns {object} board state
   */
  function createBoard() {
    var superCells = [];
    for (var s = 0; s < 9; s++) {
      var cells = [];
      for (var c = 0; c < 9; c++) {
        cells.push(createEmptyCell());
      }
      superCells.push(cells);
    }
    return {
      superCells: superCells,
      highlightValue: null,
    };
  }

  function createEmptyCell() {
    var hints = [];
    for (var i = 1; i <= 9; i++) {
      hints.push({ value: i, visible: true });
    }
    return {
      value: null,
      type: null,
      hints: hints,
    };
  }

  function getCell(board, superCell, cell) {
    return board.superCells[superCell][cell];
  }

  function isFilled(cell) {
    return cell.value !== null && cell.value !== undefined;
  }

  /**
   * Hide a single pencil mark in one empty cell (left-click).
   * No-op if the cell is already filled or the mark is already hidden.
   * @returns {boolean} true if a mark was hidden
   */
  function hideHint(board, superCell, cell, digit) {
    var c = getCell(board, superCell, cell);
    if (isFilled(c)) {
      return false;
    }
    for (var i = 0; i < c.hints.length; i++) {
      if (c.hints[i].value === digit && c.hints[i].visible) {
        c.hints[i].visible = false;
        return true;
      }
    }
    return false;
  }

  /**
   * Hide digit from all empty cells in the same box except the placed cell.
   */
  function clearBoxPeers(board, superCell, cell, digit) {
    var cells = board.superCells[superCell];
    for (var i = 0; i < 9; i++) {
      if (i !== cell) {
        hideHint(board, superCell, i, digit);
      }
    }
  }

  /**
   * Clear digit from cells in the same row across other boxes in the box-row.
   * Java SuperCell.clearRow + Grid row loop.
   */
  function clearRowPeers(board, superCell, cell, digit) {
    var boxRow = Math.floor(superCell / 3);
    var cellRow = Math.floor(cell / 3);
    for (var s = 0; s < 9; s++) {
      if (s === superCell) continue;
      if (Math.floor(s / 3) !== boxRow) continue;
      for (var i = 0; i < 9; i++) {
        if (Math.floor(i / 3) === cellRow) {
          hideHint(board, s, i, digit);
        }
      }
    }
  }

  /**
   * Clear digit from cells in the same column across other boxes in the box-col.
   * Java SuperCell.clearCol + Grid col loop.
   */
  function clearColPeers(board, superCell, cell, digit) {
    var boxCol = superCell % 3;
    var cellCol = cell % 3;
    for (var s = 0; s < 9; s++) {
      if (s === superCell) continue;
      if (s % 3 !== boxCol) continue;
      for (var i = 0; i < 9; i++) {
        if (i % 3 === cellCol) {
          hideHint(board, s, i, digit);
        }
      }
    }
  }

  /**
   * Place a digit as GIVEN or USER and clear peers (right/middle click).
   * No-op if the cell is already filled.
   * @returns {boolean} true if the value was placed
   */
  function placeValue(board, superCell, cell, digit, cellType) {
    var c = getCell(board, superCell, cell);
    if (isFilled(c)) {
      return false;
    }
    if (cellType !== CELL_TYPE.GIVEN && cellType !== CELL_TYPE.USER) {
      return false;
    }
    c.value = digit;
    c.type = cellType;
    // Hints become irrelevant once filled; leave them in place for snapshot
    // but filled cells render value only.
    clearBoxPeers(board, superCell, cell, digit);
    clearRowPeers(board, superCell, cell, digit);
    clearColPeers(board, superCell, cell, digit);
    return true;
  }

  /**
   * Handle a click on a pencil mark (only HINT digits are clickable in Java).
   * After a successful hide/place, auto-promotes unique remaining hints.
   * @param {string} clickType LEFT | RIGHT | MIDDLE
   * @returns {boolean} true if board state changed
   */
  function handleClick(board, clickType, digit, superCell, cell) {
    var c = getCell(board, superCell, cell);
    if (isFilled(c)) {
      return false;
    }
    // Only interact with a currently visible mark of that digit
    var visible = false;
    for (var i = 0; i < c.hints.length; i++) {
      if (c.hints[i].value === digit && c.hints[i].visible) {
        visible = true;
        break;
      }
    }
    if (!visible) {
      return false;
    }

    var changed = false;
    if (clickType === CLICK_TYPE.LEFT) {
      changed = hideHint(board, superCell, cell, digit);
    } else if (clickType === CLICK_TYPE.RIGHT) {
      changed = placeValue(board, superCell, cell, digit, CELL_TYPE.USER);
    } else if (clickType === CLICK_TYPE.MIDDLE) {
      changed = placeValue(board, superCell, cell, digit, CELL_TYPE.GIVEN);
    }
    if (changed) {
      promoteUniquesCascade(board);
    }
    return changed;
  }

  /** Global board row 0–8 from super-cell + cell-in-box indices. */
  function globalRow(superCell, cell) {
    return Math.floor(superCell / 3) * 3 + Math.floor(cell / 3);
  }

  /** Global board column 0–8 from super-cell + cell-in-box indices. */
  function globalCol(superCell, cell) {
    return (superCell % 3) * 3 + (cell % 3);
  }

  function coordsFromGlobal(row, col) {
    var superCell = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    var cell = (row % 3) * 3 + (col % 3);
    return { superCell: superCell, cell: cell };
  }

  /**
   * Find empty cells that still show digit D as a visible pencil mark.
   * @returns {Array<{superCell:number, cell:number}>}
   */
  function locationsWithVisibleDigit(board, digit) {
    var out = [];
    for (var s = 0; s < 9; s++) {
      for (var c = 0; c < 9; c++) {
        if (hasVisibleHint(board, s, c, digit)) {
          out.push({ superCell: s, cell: c });
        }
      }
    }
    return out;
  }

  /**
   * If digit appears as a visible hint in exactly one empty cell among the
   * given list of positions, return that position; otherwise null.
   */
  function uniqueLocationAmong(board, digit, positions) {
    var found = null;
    var count = 0;
    for (var i = 0; i < positions.length; i++) {
      var p = positions[i];
      if (hasVisibleHint(board, p.superCell, p.cell, digit)) {
        count++;
        found = p;
        if (count > 1) return null;
      }
    }
    return count === 1 ? found : null;
  }

  function boxPositions(superCell) {
    var out = [];
    for (var c = 0; c < 9; c++) {
      out.push({ superCell: superCell, cell: c });
    }
    return out;
  }

  function rowPositions(row) {
    var out = [];
    for (var col = 0; col < 9; col++) {
      out.push(coordsFromGlobal(row, col));
    }
    return out;
  }

  function colPositions(col) {
    var out = [];
    for (var row = 0; row < 9; row++) {
      out.push(coordsFromGlobal(row, col));
    }
    return out;
  }

  /**
   * Naked single: empty cell with exactly one visible pencil mark.
   * @returns {{superCell:number, cell:number, digit:number}|null}
   */
  function findNextNakedSingle(board) {
    for (var s = 0; s < 9; s++) {
      for (var c = 0; c < 9; c++) {
        var cell = getCell(board, s, c);
        if (isFilled(cell)) continue;
        var sole = null;
        var count = 0;
        for (var h = 0; h < cell.hints.length; h++) {
          if (cell.hints[h].visible) {
            count++;
            sole = cell.hints[h].value;
            if (count > 1) break;
          }
        }
        if (count === 1) {
          return { superCell: s, cell: c, digit: sole };
        }
      }
    }
    return null;
  }

  /**
   * Scan boxes, rows, and columns for digits with exactly one remaining visible
   * pencil mark in that unit. Returns the first promotion found, or null.
   * @returns {{superCell:number, cell:number, digit:number}|null}
   */
  function findNextUniquePromotion(board) {
    var d;
    var s;
    var r;
    var col;
    var loc;

    // Super-cells (boxes)
    for (s = 0; s < 9; s++) {
      for (d = 1; d <= 9; d++) {
        loc = uniqueLocationAmong(board, d, boxPositions(s));
        if (loc) {
          return { superCell: loc.superCell, cell: loc.cell, digit: d };
        }
      }
    }

    // Full board rows
    for (r = 0; r < 9; r++) {
      for (d = 1; d <= 9; d++) {
        loc = uniqueLocationAmong(board, d, rowPositions(r));
        if (loc) {
          return { superCell: loc.superCell, cell: loc.cell, digit: d };
        }
      }
    }

    // Full board columns
    for (col = 0; col < 9; col++) {
      for (d = 1; d <= 9; d++) {
        loc = uniqueLocationAmong(board, d, colPositions(col));
        if (loc) {
          return { superCell: loc.superCell, cell: loc.cell, digit: d };
        }
      }
    }

    return null;
  }

  /**
   * Default technique toggles. Singles always default on; pairs/triples/pointing
   * default on so advanced forced moves apply unless the user disables them.
   * X-Wing / coloring are hint-only (never auto).
   */
  function createTechniqueOptions(overrides) {
    var o = overrides || {};
    return {
      nakedSingles: o.nakedSingles !== false,
      hiddenSingles: o.hiddenSingles !== false,
      nakedPairs: o.nakedPairs !== false,
      nakedTriples: o.nakedTriples !== false,
      pointing: o.pointing !== false,
    };
  }

  var techniqueOptions = createTechniqueOptions();

  function getTechniqueOptions() {
    return createTechniqueOptions(techniqueOptions);
  }

  function setTechniqueOptions(partial) {
    var p = partial || {};
    var merged = {
      nakedSingles:
        p.nakedSingles !== undefined
          ? p.nakedSingles
          : techniqueOptions.nakedSingles,
      hiddenSingles:
        p.hiddenSingles !== undefined
          ? p.hiddenSingles
          : techniqueOptions.hiddenSingles,
      nakedPairs:
        p.nakedPairs !== undefined
          ? p.nakedPairs
          : techniqueOptions.nakedPairs,
      nakedTriples:
        p.nakedTriples !== undefined
          ? p.nakedTriples
          : techniqueOptions.nakedTriples,
      pointing:
        p.pointing !== undefined ? p.pointing : techniqueOptions.pointing,
    };
    techniqueOptions = createTechniqueOptions(merged);
    return getTechniqueOptions();
  }

  function visibleDigitsList(board, superCell, cell) {
    var c = getCell(board, superCell, cell);
    if (isFilled(c)) return [];
    var marks = [];
    for (var i = 0; i < c.hints.length; i++) {
      if (c.hints[i].visible) marks.push(c.hints[i].value);
    }
    return marks;
  }

  function marksToSet(marks) {
    var set = Object.create(null);
    for (var i = 0; i < marks.length; i++) set[marks[i]] = true;
    return set;
  }

  function setSize(set) {
    var n = 0;
    for (var k in set) n++;
    return n;
  }

  function isSubsetOfSet(marks, set) {
    if (!marks.length) return false;
    for (var i = 0; i < marks.length; i++) {
      if (!set[marks[i]]) return false;
    }
    return true;
  }

  function unionMarks(listOfMarkArrays) {
    var set = Object.create(null);
    for (var i = 0; i < listOfMarkArrays.length; i++) {
      var m = listOfMarkArrays[i];
      for (var j = 0; j < m.length; j++) set[m[j]] = true;
    }
    return set;
  }

  function emptyCellsInUnit(board, positions) {
    var out = [];
    for (var i = 0; i < positions.length; i++) {
      var p = positions[i];
      if (!isFilled(getCell(board, p.superCell, p.cell))) {
        out.push({
          superCell: p.superCell,
          cell: p.cell,
          marks: visibleDigitsList(board, p.superCell, p.cell),
        });
      }
    }
    return out;
  }

  /**
   * Find one elimination from a naked subset of given size (2=pair, 3=triple)
   * in any unit. Returns {superCell, cell, digit, technique} or null.
   */
  function findNakedSubsetElimination(board, size) {
    function scanUnit(positions) {
      var empty = emptyCellsInUnit(board, positions);
      if (empty.length < size) return null;
      var n = empty.length;
      var idxs = [];
      var i;
      for (i = 0; i < size; i++) idxs[i] = i;

      function nextCombo() {
        var k = size - 1;
        while (k >= 0 && idxs[k] === n - size + k) k--;
        if (k < 0) return false;
        idxs[k]++;
        for (var t = k + 1; t < size; t++) idxs[t] = idxs[t - 1] + 1;
        return true;
      }

      do {
        var markLists = [];
        var ci;
        for (ci = 0; ci < size; ci++) markLists.push(empty[idxs[ci]].marks);
        var u = unionMarks(markLists);
        if (setSize(u) !== size) continue;
        var ok = true;
        for (ci = 0; ci < size; ci++) {
          if (!isSubsetOfSet(empty[idxs[ci]].marks, u)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        var pairKeys = Object.create(null);
        for (ci = 0; ci < size; ci++) {
          pairKeys[empty[idxs[ci]].superCell + "," + empty[idxs[ci]].cell] =
            true;
        }
        for (var e = 0; e < empty.length; e++) {
          var key = empty[e].superCell + "," + empty[e].cell;
          if (pairKeys[key]) continue;
          for (var d = 1; d <= 9; d++) {
            if (!u[d]) continue;
            if (hasVisibleHint(board, empty[e].superCell, empty[e].cell, d)) {
              return {
                superCell: empty[e].superCell,
                cell: empty[e].cell,
                digit: d,
                technique: size === 2 ? "nakedPair" : "nakedTriple",
              };
            }
          }
        }
      } while (nextCombo());
      return null;
    }

    var s;
    var r;
    var col;
    var hit;
    for (s = 0; s < 9; s++) {
      hit = scanUnit(boxPositions(s));
      if (hit) return hit;
    }
    for (r = 0; r < 9; r++) {
      hit = scanUnit(rowPositions(r));
      if (hit) return hit;
    }
    for (col = 0; col < 9; col++) {
      hit = scanUnit(colPositions(col));
      if (hit) return hit;
    }
    return null;
  }

  /**
   * Pointing pairs / box-line reduction: one elimination step.
   * Box→line and line→box forms.
   */
  function findPointingElimination(board) {
    var d;
    var s;
    var r;
    var col;
    var i;

    // Box → line
    for (s = 0; s < 9; s++) {
      for (d = 1; d <= 9; d++) {
        var inBox = [];
        for (i = 0; i < 9; i++) {
          if (hasVisibleHint(board, s, i, d)) {
            inBox.push({
              superCell: s,
              cell: i,
              row: globalRow(s, i),
              col: globalCol(s, i),
            });
          }
        }
        if (inBox.length < 2) continue;

        var sameRow = true;
        var sameCol = true;
        for (i = 1; i < inBox.length; i++) {
          if (inBox[i].row !== inBox[0].row) sameRow = false;
          if (inBox[i].col !== inBox[0].col) sameCol = false;
        }
        if (sameRow) {
          var row = inBox[0].row;
          for (col = 0; col < 9; col++) {
            var pos = coordsFromGlobal(row, col);
            if (pos.superCell === s) continue;
            if (hasVisibleHint(board, pos.superCell, pos.cell, d)) {
              return {
                superCell: pos.superCell,
                cell: pos.cell,
                digit: d,
                technique: "pointing",
              };
            }
          }
        }
        if (sameCol) {
          var ccol = inBox[0].col;
          for (r = 0; r < 9; r++) {
            var pos2 = coordsFromGlobal(r, ccol);
            if (pos2.superCell === s) continue;
            if (hasVisibleHint(board, pos2.superCell, pos2.cell, d)) {
              return {
                superCell: pos2.superCell,
                cell: pos2.cell,
                digit: d,
                technique: "pointing",
              };
            }
          }
        }
      }
    }

    // Line → box (claiming)
    for (r = 0; r < 9; r++) {
      for (d = 1; d <= 9; d++) {
        var inRow = [];
        for (col = 0; col < 9; col++) {
          var rp = coordsFromGlobal(r, col);
          if (hasVisibleHint(board, rp.superCell, rp.cell, d)) {
            inRow.push(rp);
          }
        }
        if (inRow.length < 2) continue;
        var boxR = inRow[0].superCell;
        var allSameBox = true;
        for (i = 1; i < inRow.length; i++) {
          if (inRow[i].superCell !== boxR) {
            allSameBox = false;
            break;
          }
        }
        if (!allSameBox) continue;
        for (i = 0; i < 9; i++) {
          if (globalRow(boxR, i) === r) continue;
          if (hasVisibleHint(board, boxR, i, d)) {
            return {
              superCell: boxR,
              cell: i,
              digit: d,
              technique: "pointing",
            };
          }
        }
      }
    }

    for (col = 0; col < 9; col++) {
      for (d = 1; d <= 9; d++) {
        var inCol = [];
        for (r = 0; r < 9; r++) {
          var cp = coordsFromGlobal(r, col);
          if (hasVisibleHint(board, cp.superCell, cp.cell, d)) {
            inCol.push(cp);
          }
        }
        if (inCol.length < 2) continue;
        var boxC = inCol[0].superCell;
        var allSameBoxC = true;
        for (i = 1; i < inCol.length; i++) {
          if (inCol[i].superCell !== boxC) {
            allSameBoxC = false;
            break;
          }
        }
        if (!allSameBoxC) continue;
        for (i = 0; i < 9; i++) {
          if (globalCol(boxC, i) === col) continue;
          if (hasVisibleHint(board, boxC, i, d)) {
            return {
              superCell: boxC,
              cell: i,
              digit: d,
              technique: "pointing",
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Next elimination from enabled auto techniques (pairs/triples/pointing).
   */
  function findNextTechniqueElimination(board, options) {
    var opts = createTechniqueOptions(options || techniqueOptions);
    var hit = null;
    if (opts.nakedPairs) {
      hit = findNakedSubsetElimination(board, 2);
      if (hit) return hit;
    }
    if (opts.nakedTriples) {
      hit = findNakedSubsetElimination(board, 3);
      if (hit) return hit;
    }
    if (opts.pointing) {
      hit = findPointingElimination(board);
      if (hit) return hit;
    }
    return null;
  }

  /**
   * Next auto-promotion candidate: naked single and/or hidden single (unit unique).
   */
  function findNextPromotion(board, options) {
    var opts = createTechniqueOptions(options || techniqueOptions);
    if (opts.nakedSingles) {
      var naked = findNextNakedSingle(board);
      if (naked) return naked;
    }
    if (opts.hiddenSingles) {
      return findNextUniquePromotion(board);
    }
    return null;
  }

  /**
   * Promote at most one auto-place candidate to a USER placement.
   */
  function promoteNextUnique(board, options) {
    var next = findNextPromotion(board, options);
    if (!next) return false;
    return placeValue(
      board,
      next.superCell,
      next.cell,
      next.digit,
      CELL_TYPE.USER
    );
  }

  /**
   * Apply at most one technique elimination (hide one mark).
   */
  function applyNextTechniqueElimination(board, options) {
    var elim = findNextTechniqueElimination(board, options);
    if (!elim) return false;
    return hideHint(board, elim.superCell, elim.cell, elim.digit);
  }

  /**
   * Cascade auto-place + enabled technique eliminations to a fixed point.
   * @param {object} board
   * @param {object} [options] technique toggles (defaults to module options)
   * @returns {number} number of successful steps (places + hides)
   */
  function promoteUniquesCascade(board, options) {
    var opts = createTechniqueOptions(options || techniqueOptions);
    var count = 0;
    var max = 200;
    while (count < max) {
      if (promoteNextUnique(board, opts)) {
        count++;
        continue;
      }
      if (applyNextTechniqueElimination(board, opts)) {
        count++;
        continue;
      }
      break;
    }
    return count;
  }

  // ---------- Hint-only advanced techniques (no mutation) ----------

  /**
   * X-Wing hint: two rows (or cols) with digit D only in the same two columns
   * (rows). Returns targets without mutating the board.
   */
  function findXWingHint(board) {
    var d;
    var r1;
    var r2;
    var c1;
    var c2;

    function colsWithDigitInRow(row, digit) {
      var cols = [];
      for (var col = 0; col < 9; col++) {
        var p = coordsFromGlobal(row, col);
        if (hasVisibleHint(board, p.superCell, p.cell, digit)) cols.push(col);
      }
      return cols;
    }

    function rowsWithDigitInCol(col, digit) {
      var rows = [];
      for (var row = 0; row < 9; row++) {
        var p = coordsFromGlobal(row, col);
        if (hasVisibleHint(board, p.superCell, p.cell, digit)) rows.push(row);
      }
      return rows;
    }

    for (d = 1; d <= 9; d++) {
      var rowCols = [];
      for (r1 = 0; r1 < 9; r1++) {
        var cols = colsWithDigitInRow(r1, d);
        if (cols.length === 2) rowCols.push({ row: r1, cols: cols });
      }
      for (r1 = 0; r1 < rowCols.length; r1++) {
        for (r2 = r1 + 1; r2 < rowCols.length; r2++) {
          var a = rowCols[r1];
          var b = rowCols[r2];
          if (
            a.cols[0] === b.cols[0] &&
            a.cols[1] === b.cols[1]
          ) {
            c1 = a.cols[0];
            c2 = a.cols[1];
            var eliminate = [];
            var highlight = [];
            var rr;
            for (rr = 0; rr < 9; rr++) {
              if (rr === a.row || rr === b.row) {
                var pa = coordsFromGlobal(rr, c1);
                var pb = coordsFromGlobal(rr, c2);
                if (hasVisibleHint(board, pa.superCell, pa.cell, d)) {
                  highlight.push({
                    superCell: pa.superCell,
                    cell: pa.cell,
                    digit: d,
                  });
                }
                if (hasVisibleHint(board, pb.superCell, pb.cell, d)) {
                  highlight.push({
                    superCell: pb.superCell,
                    cell: pb.cell,
                    digit: d,
                  });
                }
                continue;
              }
              var p1 = coordsFromGlobal(rr, c1);
              var p2 = coordsFromGlobal(rr, c2);
              if (hasVisibleHint(board, p1.superCell, p1.cell, d)) {
                eliminate.push({
                  superCell: p1.superCell,
                  cell: p1.cell,
                  digit: d,
                });
              }
              if (hasVisibleHint(board, p2.superCell, p2.cell, d)) {
                eliminate.push({
                  superCell: p2.superCell,
                  cell: p2.cell,
                  digit: d,
                });
              }
            }
            if (eliminate.length > 0) {
              return {
                type: "X_WING",
                digit: d,
                orientation: "rows",
                rows: [a.row, b.row],
                cols: [c1, c2],
                highlight: highlight,
                eliminate: eliminate,
                message:
                  "X-Wing on digit " +
                  d +
                  " in rows " +
                  (a.row + 1) +
                  " & " +
                  (b.row + 1) +
                  ", columns " +
                  (c1 + 1) +
                  " & " +
                  (c2 + 1),
              };
            }
          }
        }
      }

      // Column-based X-Wing
      var colRows = [];
      for (c1 = 0; c1 < 9; c1++) {
        var rows = rowsWithDigitInCol(c1, d);
        if (rows.length === 2) colRows.push({ col: c1, rows: rows });
      }
      for (c1 = 0; c1 < colRows.length; c1++) {
        for (c2 = c1 + 1; c2 < colRows.length; c2++) {
          var ca = colRows[c1];
          var cb = colRows[c2];
          if (
            ca.rows[0] === cb.rows[0] &&
            ca.rows[1] === cb.rows[1]
          ) {
            var rowA = ca.rows[0];
            var rowB = ca.rows[1];
            var elim2 = [];
            var hl2 = [];
            var cc;
            for (cc = 0; cc < 9; cc++) {
              if (cc === ca.col || cc === cb.col) {
                var qa = coordsFromGlobal(rowA, cc);
                var qb = coordsFromGlobal(rowB, cc);
                if (hasVisibleHint(board, qa.superCell, qa.cell, d)) {
                  hl2.push({
                    superCell: qa.superCell,
                    cell: qa.cell,
                    digit: d,
                  });
                }
                if (hasVisibleHint(board, qb.superCell, qb.cell, d)) {
                  hl2.push({
                    superCell: qb.superCell,
                    cell: qb.cell,
                    digit: d,
                  });
                }
                continue;
              }
              var q1 = coordsFromGlobal(rowA, cc);
              var q2 = coordsFromGlobal(rowB, cc);
              if (hasVisibleHint(board, q1.superCell, q1.cell, d)) {
                elim2.push({
                  superCell: q1.superCell,
                  cell: q1.cell,
                  digit: d,
                });
              }
              if (hasVisibleHint(board, q2.superCell, q2.cell, d)) {
                elim2.push({
                  superCell: q2.superCell,
                  cell: q2.cell,
                  digit: d,
                });
              }
            }
            if (elim2.length > 0) {
              return {
                type: "X_WING",
                digit: d,
                orientation: "cols",
                rows: [rowA, rowB],
                cols: [ca.col, cb.col],
                highlight: hl2,
                eliminate: elim2,
                message:
                  "X-Wing on digit " +
                  d +
                  " in columns " +
                  (ca.col + 1) +
                  " & " +
                  (cb.col + 1) +
                  ", rows " +
                  (rowA + 1) +
                  " & " +
                  (rowB + 1),
              };
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * Simple coloring hint for a digit using conjugate (bilocation) links.
   * Reports cells in a 2-colored chain and optional elimination targets
   * without mutating the board.
   */
  function findSimpleColoringHint(board) {
    var d;
    for (d = 1; d <= 9; d++) {
      // Map cell key → list of neighbor keys (conjugate links)
      var nodes = Object.create(null);
      var keys = [];

      function addNode(s, c) {
        var k = s + "," + c;
        if (!nodes[k]) {
          nodes[k] = { superCell: s, cell: c, neighbors: [] };
          keys.push(k);
        }
        return k;
      }

      function link(k1, k2) {
        if (k1 === k2) return;
        if (nodes[k1].neighbors.indexOf(k2) < 0) nodes[k1].neighbors.push(k2);
        if (nodes[k2].neighbors.indexOf(k1) < 0) nodes[k2].neighbors.push(k1);
      }

      function addUnitLinks(positions) {
        var locs = [];
        var i;
        for (i = 0; i < positions.length; i++) {
          var p = positions[i];
          if (hasVisibleHint(board, p.superCell, p.cell, d)) {
            locs.push(p);
          }
        }
        if (locs.length === 2) {
          var a = addNode(locs[0].superCell, locs[0].cell);
          var b = addNode(locs[1].superCell, locs[1].cell);
          link(a, b);
        }
      }

      var s;
      var r;
      var col;
      for (s = 0; s < 9; s++) addUnitLinks(boxPositions(s));
      for (r = 0; r < 9; r++) addUnitLinks(rowPositions(r));
      for (col = 0; col < 9; col++) addUnitLinks(colPositions(col));

      if (keys.length < 2) continue;

      // 2-color each connected component independently. Colors 0/1 are only
      // comparable within the same componentId (shared palette across
      // components would invent false "sees both colors" eliminations).
      var color = Object.create(null);
      var componentId = Object.create(null);
      var nextComp = 0;
      var qi;
      for (qi = 0; qi < keys.length; qi++) {
        var start = keys[qi];
        if (color[start] !== undefined) continue;
        var queue = [start];
        color[start] = 0;
        componentId[start] = nextComp;
        var head = 0;
        while (head < queue.length) {
          var cur = queue[head++];
          var neigh = nodes[cur].neighbors;
          for (var ni = 0; ni < neigh.length; ni++) {
            var nb = neigh[ni];
            if (color[nb] === undefined) {
              color[nb] = 1 - color[cur];
              componentId[nb] = nextComp;
              queue.push(nb);
            }
          }
        }
        nextComp++;
      }

      // Elimination: candidate sees both colors of the SAME component only
      var eliminate = [];
      var elimSeen = Object.create(null);
      var highlight = [];
      for (var hk = 0; hk < keys.length; hk++) {
        var nk = keys[hk];
        highlight.push({
          superCell: nodes[nk].superCell,
          cell: nodes[nk].cell,
          digit: d,
          color: color[nk],
          component: componentId[nk],
        });
      }

      for (s = 0; s < 9; s++) {
        for (var c = 0; c < 9; c++) {
          if (!hasVisibleHint(board, s, c, d)) continue;
          var ck = s + "," + c;
          if (nodes[ck]) continue;

          // Per-component color sightings: seesBoth[comp] = {0:bool,1:bool}
          var sees = Object.create(null);
          for (var j = 0; j < keys.length; j++) {
            var ok = keys[j];
            var os = nodes[ok].superCell;
            var oc = nodes[ok].cell;
            var peer =
              s === os ||
              globalRow(s, c) === globalRow(os, oc) ||
              globalCol(s, c) === globalCol(os, oc);
            if (!peer) continue;
            var comp = componentId[ok];
            if (!sees[comp]) sees[comp] = { 0: false, 1: false };
            sees[comp][color[ok]] = true;
          }
          var both = false;
          for (var compKey in sees) {
            if (sees[compKey][0] && sees[compKey][1]) {
              both = true;
              break;
            }
          }
          if (both) {
            var ek = s + "," + c;
            if (!elimSeen[ek]) {
              elimSeen[ek] = true;
              eliminate.push({ superCell: s, cell: c, digit: d });
            }
          }
        }
      }

      if (highlight.length >= 2) {
        return {
          type: "SIMPLE_COLORING",
          digit: d,
          highlight: highlight,
          eliminate: eliminate,
          message:
            eliminate.length > 0
              ? "Simple coloring on digit " +
                d +
                ": " +
                eliminate.length +
                " candidate(s) see both colors"
              : "Simple coloring chain on digit " +
                d +
                " (" +
                highlight.length +
                " linked cells)",
        };
      }
    }
    return null;
  }

  /**
   * First available advanced hint (X-Wing, then simple coloring). No mutation.
   */
  function findAdvancedHint(board) {
    return findXWingHint(board) || findSimpleColoringHint(board);
  }

  /**
   * Set or clear board-wide highlight for a digit (hover).
   * @param {number|null} digit 1–9 or null to clear
   */
  function setHighlight(board, digit) {
    board.highlightValue = digit == null ? null : digit;
  }

  /**
   * Positions that should be highlighted for the current (or given) digit.
   * Returns array of { superCell, cell, kind: 'HINT'|'FILLED', value }.
   */
  function getHighlightTargets(board, digit) {
    var d = digit !== undefined ? digit : board.highlightValue;
    var out = [];
    if (d == null) {
      return out;
    }
    for (var s = 0; s < 9; s++) {
      for (var c = 0; c < 9; c++) {
        var cell = board.superCells[s][c];
        if (isFilled(cell)) {
          if (cell.value === d) {
            out.push({
              superCell: s,
              cell: c,
              kind: "FILLED",
              value: d,
              type: cell.type,
            });
          }
        } else {
          for (var h = 0; h < cell.hints.length; h++) {
            if (cell.hints[h].value === d && cell.hints[h].visible) {
              out.push({
                superCell: s,
                cell: c,
                kind: "HINT",
                value: d,
              });
              break;
            }
          }
        }
      }
    }
    return out;
  }

  /**
   * Reset board to initial all-pencil-marks state (New Game).
   */
  function resetBoard(board) {
    var fresh = createBoard();
    board.superCells = fresh.superCells;
    board.highlightValue = null;
    return board;
  }

  /**
   * Count visible pencil marks in an empty cell (0 if filled).
   */
  function visibleHintCount(cell) {
    if (isFilled(cell)) return 0;
    var n = 0;
    for (var i = 0; i < cell.hints.length; i++) {
      if (cell.hints[i].visible) n++;
    }
    return n;
  }

  /**
   * Snapshot of a cell useful for tests/render: filled value+type or list of visible marks.
   */
  function cellSnapshot(cell) {
    if (isFilled(cell)) {
      return { filled: true, value: cell.value, type: cell.type };
    }
    var marks = [];
    for (var i = 0; i < cell.hints.length; i++) {
      if (cell.hints[i].visible) {
        marks.push(cell.hints[i].value);
      }
    }
    return { filled: false, marks: marks };
  }

  /**
   * Whether digit is still a visible pencil mark in the cell.
   */
  function hasVisibleHint(board, superCell, cell, digit) {
    var c = getCell(board, superCell, cell);
    if (isFilled(c)) return false;
    for (var i = 0; i < c.hints.length; i++) {
      if (c.hints[i].value === digit && c.hints[i].visible) return true;
    }
    return false;
  }

  /**
   * Deep-clone board state (superCells + highlight) for undo snapshots.
   */
  function cloneBoard(board) {
    var superCells = [];
    for (var s = 0; s < 9; s++) {
      var cells = [];
      for (var c = 0; c < 9; c++) {
        var src = board.superCells[s][c];
        var hints = [];
        for (var h = 0; h < src.hints.length; h++) {
          hints.push({
            value: src.hints[h].value,
            visible: src.hints[h].visible,
          });
        }
        cells.push({
          value: src.value,
          type: src.type,
          hints: hints,
        });
      }
      superCells.push(cells);
    }
    return {
      superCells: superCells,
      highlightValue: board.highlightValue,
    };
  }

  /**
   * Replace board contents in-place from a snapshot (keeps board object identity).
   */
  function restoreBoard(board, snapshot) {
    var cloned = cloneBoard(snapshot);
    board.superCells = cloned.superCells;
    board.highlightValue = cloned.highlightValue;
    return board;
  }

  /**
   * Create a linear undo/redo history for a board.
   * push(before) must be called with a snapshot taken *before* a successful mutation.
   */
  function createHistory() {
    return {
      undoStack: [],
      redoStack: [],
    };
  }

  function canUndo(history) {
    return history.undoStack.length > 0;
  }

  function canRedo(history) {
    return history.redoStack.length > 0;
  }

  /**
   * Record pre-mutation snapshot. Clears redo branch (new edit after undo).
   */
  function pushHistory(history, beforeSnapshot) {
    history.undoStack.push(beforeSnapshot);
    history.redoStack = [];
  }

  /**
   * Undo last mutation: restore previous board; current state goes to redo.
   * @returns {boolean} true if undo applied
   */
  function undo(history, board) {
    if (!canUndo(history)) {
      return false;
    }
    var previous = history.undoStack.pop();
    history.redoStack.push(cloneBoard(board));
    restoreBoard(board, previous);
    return true;
  }

  /**
   * Redo previously undone mutation.
   * @returns {boolean} true if redo applied
   */
  function redo(history, board) {
    if (!canRedo(history)) {
      return false;
    }
    var next = history.redoStack.pop();
    history.undoStack.push(cloneBoard(board));
    restoreBoard(board, next);
    return true;
  }

  /**
   * Clear history stacks (e.g. after discarding redo-only state if needed).
   * Not required by New Game — New Game is itself a recorded mutation.
   */
  function clearHistory(history) {
    history.undoStack = [];
    history.redoStack = [];
  }

  /**
   * Digit frequency from filled GIVEN/USER cells only.
   * remaining = 9 − placed; complete when placed === 9.
   * @returns {Array<{digit:number, placed:number, remaining:number, complete:boolean}>}
   */
  function digitFrequency(board) {
    var placed = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // index 1–9
    for (var s = 0; s < 9; s++) {
      for (var c = 0; c < 9; c++) {
        var cell = board.superCells[s][c];
        if (isFilled(cell) && cell.value >= 1 && cell.value <= 9) {
          placed[cell.value]++;
        }
      }
    }
    var out = [];
    for (var d = 1; d <= 9; d++) {
      var p = placed[d];
      out.push({
        digit: d,
        placed: p,
        remaining: 9 - p,
        complete: p >= 9,
      });
    }
    return out;
  }

  /**
   * Stats for a single digit (1–9).
   */
  function digitStats(board, digit) {
    var all = digitFrequency(board);
    if (digit < 1 || digit > 9) {
      return { digit: digit, placed: 0, remaining: 9, complete: false };
    }
    return all[digit - 1];
  }

  function isDigitComplete(board, digit) {
    return digitStats(board, digit).complete;
  }

  /**
   * Map bare keyboard key to action mode: h→HIDE, u→USER, g→GIVEN.
   * @returns {string|null} ACTION_MODE value or null
   */
  function modeFromHotkey(key) {
    if (key == null) return null;
    var k = String(key).toLowerCase();
    if (k === "h") return ACTION_MODE.HIDE;
    if (k === "u") return ACTION_MODE.USER;
    if (k === "g") return ACTION_MODE.GIVEN;
    return null;
  }

  function cellKey(superCell, cell) {
    return superCell + "," + cell;
  }

  /**
   * Detect filled-cell digit conflicts in boxes, rows, and columns.
   * A conflict exists when two or more filled cells share the same digit
   * within one unit. Returns conflicting cells and involved units.
   *
   * @returns {{
   *   hasConflict: boolean,
   *   cells: Array<{superCell:number, cell:number, value:number}>,
   *   boxes: number[],
   *   rows: number[],
   *   cols: number[]
   * }}
   */
  function detectConflicts(board) {
    var cellMap = Object.create(null);
    var boxMap = Object.create(null);
    var rowMap = Object.create(null);
    var colMap = Object.create(null);

    function markConflictCells(list) {
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        cellMap[cellKey(p.superCell, p.cell)] = {
          superCell: p.superCell,
          cell: p.cell,
          value: p.value,
        };
      }
    }

    function checkUnit(positions, unitKind, unitIndex) {
      var byDigit = Object.create(null);
      for (var i = 0; i < positions.length; i++) {
        var p = positions[i];
        var cell = getCell(board, p.superCell, p.cell);
        if (!isFilled(cell)) continue;
        var d = cell.value;
        if (!byDigit[d]) byDigit[d] = [];
        byDigit[d].push({
          superCell: p.superCell,
          cell: p.cell,
          value: d,
        });
      }
      for (var digit in byDigit) {
        if (byDigit[digit].length >= 2) {
          markConflictCells(byDigit[digit]);
          if (unitKind === "box") boxMap[unitIndex] = true;
          else if (unitKind === "row") rowMap[unitIndex] = true;
          else if (unitKind === "col") colMap[unitIndex] = true;
        }
      }
    }

    var s;
    var r;
    var col;
    for (s = 0; s < 9; s++) {
      checkUnit(boxPositions(s), "box", s);
    }
    for (r = 0; r < 9; r++) {
      checkUnit(rowPositions(r), "row", r);
    }
    for (col = 0; col < 9; col++) {
      checkUnit(colPositions(col), "col", col);
    }

    var cells = [];
    for (var k in cellMap) {
      cells.push(cellMap[k]);
    }
    var boxes = [];
    for (s = 0; s < 9; s++) {
      if (boxMap[s]) boxes.push(s);
    }
    var rows = [];
    for (r = 0; r < 9; r++) {
      if (rowMap[r]) rows.push(r);
    }
    var cols = [];
    for (col = 0; col < 9; col++) {
      if (colMap[col]) cols.push(col);
    }

    return {
      hasConflict: cells.length > 0,
      cells: cells,
      boxes: boxes,
      rows: rows,
      cols: cols,
    };
  }

  /**
   * Whether a filled cell position is part of a conflict set.
   */
  function isConflictCell(conflicts, superCell, cell) {
    if (!conflicts || !conflicts.cells) return false;
    for (var i = 0; i < conflicts.cells.length; i++) {
      var c = conflicts.cells[i];
      if (c.superCell === superCell && c.cell === cell) return true;
    }
    return false;
  }

  var api = {
    CELL_TYPE: CELL_TYPE,
    CLICK_TYPE: CLICK_TYPE,
    ACTION_MODE: ACTION_MODE,
    ACTION_MODES: ACTION_MODES,
    isActionMode: isActionMode,
    modeToClickType: modeToClickType,
    modeFromHotkey: modeFromHotkey,
    applyActionMode: applyActionMode,
    detectConflicts: detectConflicts,
    isConflictCell: isConflictCell,
    createBoard: createBoard,
    createEmptyCell: createEmptyCell,
    getCell: getCell,
    isFilled: isFilled,
    hideHint: hideHint,
    placeValue: placeValue,
    handleClick: handleClick,
    setHighlight: setHighlight,
    getHighlightTargets: getHighlightTargets,
    resetBoard: resetBoard,
    visibleHintCount: visibleHintCount,
    cellSnapshot: cellSnapshot,
    hasVisibleHint: hasVisibleHint,
    clearBoxPeers: clearBoxPeers,
    clearRowPeers: clearRowPeers,
    clearColPeers: clearColPeers,
    globalRow: globalRow,
    globalCol: globalCol,
    coordsFromGlobal: coordsFromGlobal,
    findNextNakedSingle: findNextNakedSingle,
    findNextUniquePromotion: findNextUniquePromotion,
    findNextPromotion: findNextPromotion,
    promoteNextUnique: promoteNextUnique,
    promoteUniquesCascade: promoteUniquesCascade,
    createTechniqueOptions: createTechniqueOptions,
    getTechniqueOptions: getTechniqueOptions,
    setTechniqueOptions: setTechniqueOptions,
    findNakedSubsetElimination: findNakedSubsetElimination,
    findPointingElimination: findPointingElimination,
    findNextTechniqueElimination: findNextTechniqueElimination,
    applyNextTechniqueElimination: applyNextTechniqueElimination,
    findXWingHint: findXWingHint,
    findSimpleColoringHint: findSimpleColoringHint,
    findAdvancedHint: findAdvancedHint,
    cloneBoard: cloneBoard,
    restoreBoard: restoreBoard,
    createHistory: createHistory,
    canUndo: canUndo,
    canRedo: canRedo,
    pushHistory: pushHistory,
    undo: undo,
    redo: redo,
    clearHistory: clearHistory,
    digitFrequency: digitFrequency,
    digitStats: digitStats,
    isDigitComplete: isDigitComplete,
  };

  root.SudokuBoard = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

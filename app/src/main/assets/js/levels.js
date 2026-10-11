/**
 * MazeMint: One Line Quest - Snake Arrow Maze Levels (1-100)
 * 100 guaranteed-solvable levels featuring intertwined arrow-headed snakes.
 * Inspired by classic Snake Escape & Arrow Labyrinths.
 */

(function(global) {
  'use strict';

  // Distinct vibrant snake colors + classic navy
  const SNAKE_PALETTES = [
    '#0066FF', // Blue
    '#10B981', // Mint Green
    '#F59E0B', // Golden Amber
    '#EF4444', // Coral Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#F97316', // Orange
    '#14B8A6', // Teal
    '#6366F1', // Indigo
    '#84CC16', // Lime
    '#D946EF'  // Magenta
  ];

  // Helper to calculate direction vector
  const DIRS = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 }
  };

  /**
   * Deterministic Reverse-Generator:
   * Builds solvable puzzles by adding snakes in reverse order of escape.
   * Last placed snake has clear path out, creating a guaranteed topological solution!
   */
  function generateSolvableLevel(id) {
    let cols = 8;
    let rows = 8;
    let snakeCount = 4;

    if (id <= 5) {
      cols = 7; rows = 7; snakeCount = 3 + id;
    } else if (id <= 20) {
      cols = 9; rows = 9; snakeCount = 7 + Math.floor((id - 5) / 3);
    } else if (id <= 50) {
      cols = 11; rows = 11; snakeCount = 11 + Math.floor((id - 20) / 3);
    } else if (id <= 75) {
      cols = 13; rows = 13; snakeCount = 16 + Math.floor((id - 50) / 3);
    } else {
      cols = 14; rows = 14; snakeCount = 20 + Math.floor((id - 75) / 4);
    }

    // Grid tracking: cell -> snakeId
    const grid = {};
    const snakes = [];
    let seed = id * 982451653 + 12345;
    function rand() {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    }

    // Directions array
    const dirNames = ['up', 'down', 'left', 'right'];

    // Try placing snakes
    for (let s = 0; s < snakeCount; s++) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 80) {
        attempts++;
        const dir = dirNames[Math.floor(rand() * 4)];
        const delta = DIRS[dir];

        // Head must be placed such that ray in 'dir' to grid border is completely FREE
        let hx, hy;
        if (dir === 'up') {
          hx = 1 + Math.floor(rand() * (cols - 2));
          hy = 1 + Math.floor(rand() * Math.min(rows - 2, 4));
        } else if (dir === 'down') {
          hx = 1 + Math.floor(rand() * (cols - 2));
          hy = Math.max(1, rows - 2 - Math.floor(rand() * 4));
        } else if (dir === 'left') {
          hx = 1 + Math.floor(rand() * Math.min(cols - 2, 4));
          hy = 1 + Math.floor(rand() * (rows - 2));
        } else {
          hx = Math.max(1, cols - 2 - Math.floor(rand() * 4));
          hy = 1 + Math.floor(rand() * (rows - 2));
        }

        // Check if head position is free
        if (grid[`${hx},${hy}`]) continue;

        // Check that ray in 'dir' to board edge has NO current snakes
        let rx = hx + delta.dx;
        let ry = hy + delta.dy;
        let pathClear = true;
        while (rx >= 0 && rx < cols && ry >= 0 && ry < rows) {
          if (grid[`${rx},${ry}`]) {
            pathClear = false;
            break;
          }
          rx += delta.dx;
          ry += delta.dy;
        }

        if (!pathClear) continue;

        // Now grow snake body backwards from head (inward into the maze)
        const body = [{ x: hx, y: hy }];
        let curr = { x: hx, y: hy };
        const bodyLen = 3 + Math.floor(rand() * 4); // 3 to 6 points
        let growSuccess = true;

        for (let b = 1; b < bodyLen; b++) {
          // Candidates: 4 directions opposite/orthogonal
          const options = [];
          for (const d of dirNames) {
            const opp = DIRS[d];
            const nx = curr.x + opp.dx;
            const ny = curr.y + opp.dy;
            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
              if (!grid[`${nx},${ny}`] && !body.some(p => p.x === nx && p.y === ny)) {
                options.push({ x: nx, y: ny });
              }
            }
          }

          if (options.length === 0) {
            growSuccess = body.length >= 2;
            break;
          }

          const nextPt = options[Math.floor(rand() * options.length)];
          body.push(nextPt);
          curr = nextPt;
        }

        if (body.length >= 2) {
          // Body points stored from TAIL to HEAD
          const snakePoints = body.reverse();
          const snakeId = s + 1;

          // Register in grid
          snakePoints.forEach(p => {
            grid[`${p.x},${p.y}`] = snakeId;
          });

          snakes.push({
            id: snakeId,
            color: SNAKE_PALETTES[s % SNAKE_PALETTES.length],
            points: snakePoints, // points[points.length - 1] is HEAD
            dir: dir
          });

          placed = true;
        }
      }
    }

    return {
      cols,
      rows,
      snakes
    };
  }

  // Pre-crafted Level 2 inspired directly by the user's screenshot with the red "2"
  function getScreenshotLevel2() {
    return {
      cols: 11,
      rows: 11,
      label: "2",
      snakes: [
        // Snake 1: Escapes DOWN (bottom right exit)
        {
          id: 1,
          color: '#0066FF',
          points: [{ x: 8, y: 7 }, { x: 7, y: 7 }, { x: 7, y: 9 }, { x: 8, y: 9 }],
          dir: 'down'
        },
        // Snake 2: Escapes RIGHT (middle right)
        {
          id: 2,
          color: '#10B981',
          points: [{ x: 5, y: 5 }, { x: 7, y: 5 }, { x: 7, y: 6 }, { x: 9, y: 6 }],
          dir: 'right'
        },
        // Snake 3: Escapes UP (top right)
        {
          id: 3,
          color: '#F59E0B',
          points: [{ x: 8, y: 4 }, { x: 8, y: 2 }, { x: 7, y: 2 }, { x: 7, y: 1 }],
          dir: 'up'
        },
        // Snake 4: Escapes LEFT (middle left)
        {
          id: 4,
          color: '#EF4444',
          points: [{ x: 4, y: 6 }, { x: 3, y: 6 }, { x: 3, y: 5 }, { x: 1, y: 5 }],
          dir: 'left'
        },
        // Snake 5: Escapes UP (top left)
        {
          id: 5,
          color: '#8B5CF6',
          points: [{ x: 2, y: 4 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 1 }],
          dir: 'up'
        },
        // Snake 6: Center hook escaping DOWN
        {
          id: 6,
          color: '#06B6D4',
          points: [{ x: 4, y: 2 }, { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 5, y: 8 }],
          dir: 'down'
        },
        // Snake 7: Bottom corridor escaping RIGHT
        {
          id: 7,
          color: '#F97316',
          points: [{ x: 1, y: 9 }, { x: 1, y: 8 }, { x: 4, y: 8 }, { x: 4, y: 9 }, { x: 6, y: 9 }],
          dir: 'right'
        },
        // Snake 8: Top loop escaping LEFT
        {
          id: 8,
          color: '#EC4899',
          points: [{ x: 6, y: 3 }, { x: 5, y: 3 }, { x: 5, y: 1 }, { x: 1, y: 1 }],
          dir: 'left'
        }
      ]
    };
  }

  // Pre-crafted Level 1 (Tutorial)
  function getTutorialLevel1() {
    return {
      cols: 7,
      rows: 7,
      snakes: [
        // Snake 1: Free to escape RIGHT immediately
        {
          id: 1,
          color: '#10B981',
          points: [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 1 }, { x: 5, y: 1 }],
          dir: 'right'
        },
        // Snake 2: Points UP, blocked by Snake 1 until Snake 1 exits!
        {
          id: 2,
          color: '#0066FF',
          points: [{ x: 4, y: 5 }, { x: 4, y: 3 }, { x: 4, y: 2 }],
          dir: 'up'
        },
        // Snake 3: Points DOWN, escapes at bottom left
        {
          id: 3,
          color: '#F59E0B',
          points: [{ x: 1, y: 2 }, { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 5 }],
          dir: 'down'
        },
        // Snake 4: Points LEFT, blocked by Snake 3
        {
          id: 4,
          color: '#EF4444',
          points: [{ x: 5, y: 4 }, { x: 3, y: 4 }],
          dir: 'left'
        }
      ]
    };
  }

  function generateAllLevels() {
    const list = [];

    for (let id = 1; id <= 100; id++) {
      let levelData;
      let title = `Level ${id}`;
      let category = 'simple';
      let categoryName = 'Simple Mazes';

      if (id === 1) {
        levelData = getTutorialLevel1();
        title = "Level 1: First Slither";
      } else if (id === 2) {
        levelData = getScreenshotLevel2();
        title = "Level 2: The Red Two";
      } else {
        levelData = generateSolvableLevel(id);
        if (id <= 20) {
          category = 'simple';
          categoryName = 'Simple Mazes';
          title = `Level ${id}: Labyrinth ${id}`;
        } else if (id <= 50) {
          category = 'arrows';
          categoryName = 'Arrow Mazes';
          title = `Level ${id}: Arrow Jam ${id}`;
        } else if (id <= 75) {
          category = 'geometric';
          categoryName = 'Geometric Shapes';
          title = `Level ${id}: Geometry ${id}`;
        } else {
          category = 'challenge';
          categoryName = 'Master Challenges';
          title = `Level ${id}: Mega Quest ${id}`;
        }
      }

      const rewardCoins = 60 + id * 10;
      const rewardCash = (0.30 + id * 0.05).toFixed(2);
      const snakeCount = levelData.snakes.length;
      const parTime = Math.max(15, snakeCount * 6);

      list.push({
        id,
        name: title,
        category,
        categoryName,
        cols: levelData.cols,
        rows: levelData.rows,
        snakes: levelData.snakes,
        label: levelData.label || null,
        optimalMoves: snakeCount,
        parTime,
        rewardCoins,
        rewardCash: parseFloat(rewardCash)
      });
    }

    return list;
  }

  global.MAZEMINT_LEVELS = generateAllLevels();

})(window);

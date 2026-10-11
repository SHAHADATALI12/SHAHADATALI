/**
 * MazeMint: One Line Quest - Snake Arrow Maze Engine
 * Interactive canvas for slithering arrow-headed snakes out of the labyrinth.
 */

class MazeCanvas {
  constructor(canvasElement, onMoveCallback, onCompleteCallback) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.onMove = onMoveCallback || (() => {});
    this.onComplete = onCompleteCallback || (() => {});

    this.level = null;
    this.activeSnakes = []; // Remaining snakes on board
    this.escapedSnakes = []; // History for undo
    this.animatingSnakes = []; // Snakes currently slithering out or bumping
    this.highlightedSnakeId = null; // Set by Hint
    this.rulerActive = false; // Set by Ruler

    this.dpr = window.devicePixelRatio || 1;
    this.cellSize = 32;
    this.offsetX = 0;
    this.offsetY = 0;

    this.initEvents();
    this.startRenderLoop();
  }

  loadLevel(levelData) {
    this.level = levelData;
    // Deep clone snakes
    this.activeSnakes = JSON.parse(JSON.stringify(levelData.snakes));
    this.escapedSnakes = [];
    this.animatingSnakes = [];
    this.highlightedSnakeId = null;
    this.resize();
    this.draw();
  }

  resize() {
    if (!this.canvas.parentElement) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const size = Math.min(rect.width - 16, rect.height - 16, 440);

    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = size * this.dpr;
    this.canvas.height = size * this.dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;

    this.ctx.scale(this.dpr, this.dpr);

    if (this.level) {
      const padding = 28;
      const availW = size - padding * 2;
      const availH = size - padding * 2;
      this.cellSize = Math.min(availW / this.level.cols, availH / this.level.rows);

      const mazeW = this.level.cols * this.cellSize;
      const mazeH = this.level.rows * this.cellSize;
      this.offsetX = (size - mazeW) / 2;
      this.offsetY = (size - mazeH) / 2;
    }
  }

  gridToPixel(x, y) {
    return {
      x: this.offsetX + (x + 0.5) * this.cellSize,
      y: this.offsetY + (y + 0.5) * this.cellSize
    };
  }

  initEvents() {
    const handleTap = (e) => {
      e.preventDefault();
      if (!this.level || this.activeSnakes.length === 0) return;

      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Find clicked snake (priority to head/arrow)
      const clicked = this.findSnakeAt(clickX, clickY);
      if (clicked) {
        this.trySlitherSnake(clicked);
      }
    };

    this.canvas.addEventListener('pointerdown', handleTap);

    window.addEventListener('resize', () => {
      this.resize();
      this.draw();
    });
  }

  findSnakeAt(px, py) {
    let bestSnake = null;
    let minDist = this.cellSize * 0.75;

    // First check heads (arrows)
    for (const snake of this.activeSnakes) {
      const head = snake.points[snake.points.length - 1];
      const pt = this.gridToPixel(head.x, head.y);
      const dist = Math.hypot(px - pt.x, py - pt.y);
      if (dist < minDist) {
        minDist = dist;
        bestSnake = snake;
      }
    }

    if (bestSnake) return bestSnake;

    // Check body segments
    for (const snake of this.activeSnakes) {
      for (let i = 0; i < snake.points.length - 1; i++) {
        const p1 = this.gridToPixel(snake.points[i].x, snake.points[i].y);
        const p2 = this.gridToPixel(snake.points[i + 1].x, snake.points[i + 1].y);
        const dist = this.distToSegment({ x: px, y: py }, p1, p2);
        if (dist < this.cellSize * 0.45) {
          return snake;
        }
      }
    }

    return null;
  }

  distToSegment(p, v, w) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

  getDirectionDelta(dir) {
    if (dir === 'up') return { dx: 0, dy: -1 };
    if (dir === 'down') return { dx: 0, dy: 1 };
    if (dir === 'left') return { dx: -1, dy: 0 };
    return { dx: 1, dy: 0 };
  }

  checkCollision(snake) {
    const head = snake.points[snake.points.length - 1];
    const delta = this.getDirectionDelta(snake.dir);

    let currX = head.x + delta.dx;
    let currY = head.y + delta.dy;

    // Raycast forward in arrow direction until board boundary
    while (currX >= 0 && currX < this.level.cols && currY >= 0 && currY < this.level.rows) {
      // Check if any other active snake occupies this cell
      for (const other of this.activeSnakes) {
        if (other.id === snake.id) continue;
        const hitsOther = other.points.some(p => p.x === currX && p.y === currY);
        if (hitsOther) {
          return { blocked: true, hitPoint: { x: currX, y: currY }, blocker: other };
        }
      }
      currX += delta.dx;
      currY += delta.dy;
    }

    return { blocked: false };
  }

  trySlitherSnake(snake) {
    // Avoid double triggering if already animating
    if (this.animatingSnakes.some(a => a.snake.id === snake.id)) return;

    const collision = this.checkCollision(snake);

    if (collision.blocked) {
      // Trigger bump recoil animation
      if (window.soundEngine) window.soundEngine.playError();
      if (window.showToast) window.showToast("Blocked by another snake! Free it first.", "error");

      this.animatingSnakes.push({
        type: 'bump',
        snake: snake,
        startTime: performance.now(),
        duration: 260,
        hitPoint: collision.hitPoint
      });
    } else {
      // CLEAR! Slither out of the maze like a snake!
      if (window.soundEngine) window.soundEngine.playArrow();
      if (this.highlightedSnakeId === snake.id) {
        this.highlightedSnakeId = null;
      }

      this.animatingSnakes.push({
        type: 'slither',
        snake: snake,
        startTime: performance.now(),
        duration: 400
      });

      // Remove from active snakes immediately for collision calculations
      this.activeSnakes = this.activeSnakes.filter(s => s.id !== snake.id);
      this.escapedSnakes.push(snake);

      const total = this.level.snakes.length;
      const remaining = this.activeSnakes.length;
      this.onMove(total - remaining);

      // Check level complete
      if (remaining === 0) {
        setTimeout(() => {
          if (window.soundEngine) window.soundEngine.playWin();
          this.onComplete({
            moves: total,
            optimal: this.level.optimalMoves
          });
        }, 450);
      }
    }
  }

  undo() {
    if (this.escapedSnakes.length === 0) return false;
    const last = this.escapedSnakes.pop();
    this.activeSnakes.push(last);
    if (window.soundEngine) window.soundEngine.playUndo();
    this.onMove(this.level.snakes.length - this.activeSnakes.length);
    this.draw();
    return true;
  }

  reset() {
    if (!this.level) return;
    this.activeSnakes = JSON.parse(JSON.stringify(this.level.snakes));
    this.escapedSnakes = [];
    this.animatingSnakes = [];
    this.highlightedSnakeId = null;
    this.onMove(0);
    this.draw();
  }

  applyHint() {
    // Find any unblocked snake
    for (const snake of this.activeSnakes) {
      const col = this.checkCollision(snake);
      if (!col.blocked) {
        this.highlightedSnakeId = snake.id;
        this.draw();
        return true;
      }
    }
    return false;
  }

  applyStarPower() {
    // Instantly find a free snake (or remove top blocker) and slither it out!
    if (this.activeSnakes.length === 0) return false;

    // Prefer unblocked snake
    let target = this.activeSnakes.find(s => !this.checkCollision(s).blocked);
    if (!target) {
      // If all blocked, pick the first one and blast it out!
      target = this.activeSnakes[0];
    }

    if (target) {
      this.trySlitherSnake(target);
      return true;
    }
    return false;
  }

  toggleRuler() {
    this.rulerActive = !this.rulerActive;
    this.draw();
    return this.rulerActive;
  }

  startRenderLoop() {
    const loop = (timestamp) => {
      if (this.animatingSnakes.length > 0) {
        this.animatingSnakes = this.animatingSnakes.filter(anim => {
          const elapsed = timestamp - anim.startTime;
          return elapsed < anim.duration;
        });
        this.draw();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  draw() {
    if (!this.level || !this.ctx) return;
    const width = this.canvas.width / this.dpr;
    const height = this.canvas.height / this.dpr;

    this.ctx.clearRect(0, 0, width, height);

    // Optional level label like the red "2" in the screenshot
    if (this.level.label) {
      this.ctx.save();
      this.ctx.font = 'bold 52px -apple-system, sans-serif';
      this.ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
      this.ctx.fillText(this.level.label, this.offsetX + 16, this.offsetY + this.cellSize * 5.5);
      this.ctx.restore();
    }

    // Draw Ruler trajectory lasers if active
    if (this.rulerActive) {
      this.drawRulerTrajectories();
    }

    // Draw active snakes
    for (const snake of this.activeSnakes) {
      // Check if snake is bumping
      const bumpAnim = this.animatingSnakes.find(a => a.type === 'bump' && a.snake.id === snake.id);
      this.drawSnake(snake, bumpAnim);
    }

    // Draw escaping snakes
    const slitherAnims = this.animatingSnakes.filter(a => a.type === 'slither');
    for (const anim of slitherAnims) {
      this.drawSlitheringSnake(anim);
    }

    // Draw Hint highlight
    if (this.highlightedSnakeId) {
      this.drawHintHighlight();
    }
  }

  drawSnake(snake, bumpAnim = null) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const isClassic = document.body.classList.contains('classic-lines');
    const color = isClassic ? (isDark ? '#E2E8F0' : '#1E293B') : snake.color;

    let offsetDelta = { x: 0, y: 0 };
    if (bumpAnim) {
      const elapsed = performance.now() - bumpAnim.startTime;
      const progress = Math.sin((elapsed / bumpAnim.duration) * Math.PI);
      const dirDelta = this.getDirectionDelta(snake.dir);
      offsetDelta = {
        x: dirDelta.dx * this.cellSize * 0.35 * progress,
        y: dirDelta.dy * this.cellSize * 0.35 * progress
      };
    }

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = Math.max(6, this.cellSize * 0.28);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Draw body path
    this.ctx.beginPath();
    for (let i = 0; i < snake.points.length; i++) {
      const pt = this.gridToPixel(snake.points[i].x, snake.points[i].y);
      const drawX = pt.x + offsetDelta.x;
      const drawY = pt.y + offsetDelta.y;

      if (i === 0) {
        this.ctx.moveTo(drawX, drawY);
      } else {
        this.ctx.lineTo(drawX, drawY);
      }
    }
    this.ctx.stroke();

    // Draw tail rounded cap
    const tailPt = this.gridToPixel(snake.points[0].x, snake.points[0].y);
    this.ctx.beginPath();
    this.ctx.arc(tailPt.x + offsetDelta.x, tailPt.y + offsetDelta.y, this.ctx.lineWidth * 0.5, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw Arrow Head at head point
    const headPt = this.gridToPixel(
      snake.points[snake.points.length - 1].x,
      snake.points[snake.points.length - 1].y
    );
    this.drawArrowHead(headPt.x + offsetDelta.x, headPt.y + offsetDelta.y, snake.dir, color);

    this.ctx.restore();
  }

  drawSlitheringSnake(anim) {
    const elapsed = performance.now() - anim.startTime;
    const progress = Math.min(1, elapsed / anim.duration);
    const snake = anim.snake;
    const dirDelta = this.getDirectionDelta(snake.dir);

    // Moves smoothly along arrow direction out of screen
    const slitherDist = progress * (this.cellSize * 12);
    const offsetX = dirDelta.dx * slitherDist;
    const offsetY = dirDelta.dy * slitherDist;

    this.ctx.save();
    this.ctx.strokeStyle = snake.color;
    this.ctx.fillStyle = snake.color;
    this.ctx.lineWidth = Math.max(6, this.cellSize * 0.28);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.globalAlpha = Math.max(0, 1 - progress * 0.85);

    this.ctx.beginPath();
    for (let i = 0; i < snake.points.length; i++) {
      const pt = this.gridToPixel(snake.points[i].x, snake.points[i].y);
      if (i === 0) this.ctx.moveTo(pt.x + offsetX, pt.y + offsetY);
      else this.ctx.lineTo(pt.x + offsetX, pt.y + offsetY);
    }
    this.ctx.stroke();

    const headPt = this.gridToPixel(
      snake.points[snake.points.length - 1].x,
      snake.points[snake.points.length - 1].y
    );
    this.drawArrowHead(headPt.x + offsetX, headPt.y + offsetY, snake.dir, snake.color);

    this.ctx.restore();
  }

  drawArrowHead(x, y, dir, color) {
    const size = Math.max(8, this.cellSize * 0.38);
    this.ctx.save();
    this.ctx.translate(x, y);

    let angle = 0;
    if (dir === 'up') angle = -Math.PI / 2;
    else if (dir === 'down') angle = Math.PI / 2;
    else if (dir === 'left') angle = Math.PI;
    else if (dir === 'right') angle = 0;

    this.ctx.rotate(angle);

    // Clean sharp arrow head
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(size * 0.9, 0);
    this.ctx.lineTo(-size * 0.6, -size * 0.7);
    this.ctx.lineTo(-size * 0.3, 0);
    this.ctx.lineTo(-size * 0.6, size * 0.7);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  drawHintHighlight() {
    const snake = this.activeSnakes.find(s => s.id === this.highlightedSnakeId);
    if (!snake) return;

    const head = snake.points[snake.points.length - 1];
    const pt = this.gridToPixel(head.x, head.y);

    const pulse = Math.sin(performance.now() * 0.008) * 4;
    const radius = this.cellSize * 0.65 + pulse;

    this.ctx.save();
    this.ctx.strokeStyle = '#F59E0B';
    this.ctx.lineWidth = 3.5;
    this.ctx.setLineDash([5, 4]);

    this.ctx.beginPath();
    this.ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawRulerTrajectories() {
    this.ctx.save();
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]);

    for (const snake of this.activeSnakes) {
      const head = snake.points[snake.points.length - 1];
      const pt = this.gridToPixel(head.x, head.y);
      const col = this.checkCollision(snake);
      const delta = this.getDirectionDelta(snake.dir);

      this.ctx.strokeStyle = col.blocked ? 'rgba(239, 68, 68, 0.7)' : 'rgba(16, 185, 129, 0.7)';
      this.ctx.beginPath();
      this.ctx.moveTo(pt.x, pt.y);

      const targetX = col.blocked
        ? this.gridToPixel(col.hitPoint.x, col.hitPoint.y).x
        : pt.x + delta.dx * this.cellSize * 12;
      const targetY = col.blocked
        ? this.gridToPixel(col.hitPoint.x, col.hitPoint.y).y
        : pt.y + delta.dy * this.cellSize * 12;

      this.ctx.lineTo(targetX, targetY);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }
}

window.MazeCanvas = MazeCanvas;

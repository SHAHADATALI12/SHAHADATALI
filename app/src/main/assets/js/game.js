/**
 * MazeMint: One Line Quest - Master Game Controller
 * Manages game state, user progression, modals, wallet, tools, achievements, and persistence.
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'mazemint_save_v1';

  const INITIAL_STATE = {
    coins: 200,
    virtualCash: 12.50,
    currentLevel: 1,
    unlockedLevel: 1,
    levelStars: {},
    levelBestTimes: {},
    tools: {
      hints: 3,
      erasers: 5,
      stars: 2,
      rulers: 3
    },
    daily: {
      lastDate: '',
      completed: false,
      streak: 1
    },
    achievements: {
      first_step: { title: "First Step", desc: "Complete Level 1", reward: 100, unlocked: false, claimed: false },
      arrow_cadet: { title: "Arrow Cadet", desc: "Complete an Arrow Maze (Level 21+)", reward: 150, unlocked: false, claimed: false },
      speedster: { title: "Speed Demon", desc: "Beat any level under 10 seconds", reward: 200, unlocked: false, claimed: false },
      three_stars: { title: "Perfectionist", desc: "Earn 3 stars on any 5 levels", reward: 250, unlocked: false, claimed: false },
      coin_hoarder: { title: "Coin Hoarder", desc: "Accumulate 1,000 Coins", reward: 300, unlocked: false, claimed: false },
      geometric_mind: { title: "Geometry Mind", desc: "Complete a Geometric Shape level", reward: 250, unlocked: false, claimed: false },
      tool_master: { title: "Tool Specialist", desc: "Use all 4 power-up tools", reward: 150, unlocked: false, claimed: false },
      daily_devotee: { title: "Daily Devotee", desc: "Complete a Daily Challenge", reward: 200, unlocked: false, claimed: false },
      halfway_hero: { title: "Halfway Hero", desc: "Reach Level 50", reward: 500, unlocked: false, claimed: false },
      challenge_master: { title: "Challenge Master", desc: "Complete a Master Challenge level (76+)", reward: 600, unlocked: false, claimed: false },
      centurion: { title: "Grand Centurion", desc: "Complete all 100 Levels", reward: 1500, unlocked: false, claimed: false },
      mint_millionaire: { title: "Virtual High Roller", desc: "Reach $50.00 virtual game balance", reward: 500, unlocked: false, claimed: false }
    },
    transactions: [
      { id: "MM-INIT-001", title: "Welcome Quest Bonus", amount: "+$12.50", status: "Demo Credited", date: "Initial Play" }
    ],
    settings: {
      sound: true,
      haptics: true,
      theme: 'light',
      highContrast: false
    }
  };

  class GameApp {
    constructor() {
      this.state = this.loadState();
      this.canvas = null;
      this.timerInterval = null;
      this.elapsedSeconds = 0;
      this.currentMoves = 0;
      this.isPaused = false;
      this.usedToolsInLevel = new Set();

      this.initUI();
      this.initTheme();
      this.initAudioSettings();
      this.initCanvas();
      this.loadLevel(this.state.currentLevel);
      this.updateBadges();
      this.checkAchievements();
    }

    loadState() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...INITIAL_STATE,
            ...parsed,
            tools: { ...INITIAL_STATE.tools, ...(parsed.tools || {}) },
            achievements: { ...INITIAL_STATE.achievements, ...(parsed.achievements || {}) },
            settings: { ...INITIAL_STATE.settings, ...(parsed.settings || {}) }
          };
        }
      } catch (e) {
        console.warn('Error reading saved state', e);
      }
      return JSON.parse(JSON.stringify(INITIAL_STATE));
    }

    saveState() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) {
        console.warn('Failed saving state', e);
      }
    }

    initTheme() {
      const theme = this.state.settings.theme || 'light';
      document.documentElement.setAttribute('data-theme', theme);
      const themeBtn = document.getElementById('theme-toggle-btn');
      if (themeBtn) {
        themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
      }
      if (this.state.settings.classic) {
        document.body.classList.add('classic-lines');
      } else {
        document.body.classList.remove('classic-lines');
      }
    }

    initAudioSettings() {
      if (window.soundEngine) {
        window.soundEngine.enabled = this.state.settings.sound;
        window.soundEngine.hapticsEnabled = this.state.settings.haptics;
      }
    }

    initCanvas() {
      const canvasEl = document.getElementById('maze-canvas');
      this.canvas = new window.MazeCanvas(
        canvasEl,
        (moves) => this.onMove(moves),
        (result) => this.onLevelCompleted(result)
      );
    }

    loadLevel(levelId) {
      if (levelId < 1) levelId = 1;
      if (levelId > 100) levelId = 100;

      const levelData = window.MAZEMINT_LEVELS[levelId - 1];
      if (!levelData) return;

      this.state.currentLevel = levelId;
      this.currentMoves = 0;
      this.elapsedSeconds = 0;
      this.usedToolsInLevel.clear();
      this.isPaused = false;

      this.stopTimer();
      this.startTimer();

      // Update UI elements
      document.getElementById('current-level-title').textContent = levelData.name;
      document.getElementById('current-category-name').textContent = levelData.categoryName;
      document.getElementById('moves-count').textContent = '0';
      document.getElementById('optimal-moves').textContent = `${levelData.optimalMoves}`;
      document.getElementById('timer-display').textContent = '00:00';

      this.updateLevelStarsUI(levelId);
      this.canvas.loadLevel(levelData);
      this.updateToolsUI();
      this.saveState();
    }

    startTimer() {
      this.stopTimer();
      this.timerInterval = setInterval(() => {
        if (!this.isPaused) {
          this.elapsedSeconds++;
          const mins = String(Math.floor(this.elapsedSeconds / 60)).padStart(2, '0');
          const secs = String(this.elapsedSeconds % 60).padStart(2, '0');
          document.getElementById('timer-display').textContent = `${mins}:${secs}`;
        }
      }, 1000);
    }

    stopTimer() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    }

    onMove(moves) {
      this.currentMoves = moves;
      document.getElementById('moves-count').textContent = String(moves);
    }

    onLevelCompleted(result) {
      this.stopTimer();
      const levelId = this.state.currentLevel;
      const levelData = window.MAZEMINT_LEVELS[levelId - 1];

      // Calculate Stars
      let stars = 1;
      if (result.moves <= levelData.optimalMoves && this.elapsedSeconds <= levelData.parTime) {
        stars = 3;
      } else if (result.moves <= levelData.optimalMoves + 3 || this.elapsedSeconds <= levelData.parTime * 1.5) {
        stars = 2;
      }

      // Record best stars & times
      const prevStars = this.state.levelStars[levelId] || 0;
      if (stars > prevStars) {
        this.state.levelStars[levelId] = stars;
      }

      const prevTime = this.state.levelBestTimes[levelId] || 9999;
      if (this.elapsedSeconds < prevTime) {
        this.state.levelBestTimes[levelId] = this.elapsedSeconds;
      }

      // Unlock next level
      if (levelId === this.state.unlockedLevel && levelId < 100) {
        this.state.unlockedLevel = levelId + 1;
      }

      // Rewards
      const earnedCoins = levelData.rewardCoins;
      const earnedCash = levelData.rewardCash;
      this.state.coins += earnedCoins;
      this.state.virtualCash = parseFloat((this.state.virtualCash + earnedCash).toFixed(2));

      // Record demo ledger transaction
      this.state.transactions.unshift({
        id: `MM-LVL-${String(levelId).padStart(3, '0')}`,
        title: `${levelData.name} Reward`,
        amount: `+$${earnedCash.toFixed(2)}`,
        status: "Demo Credited",
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      this.updateBadges();
      this.checkAchievements();
      this.saveState();

      // Show Level Complete Modal
      this.showWinModal(levelId, stars, earnedCoins, earnedCash, result.moves, levelData.optimalMoves);
    }

    showWinModal(levelId, stars, coins, cash, moves, optimal) {
      const modal = document.getElementById('modal-win');
      document.getElementById('win-level-name').textContent = `Level ${levelId} Cleared!`;

      // Stars display
      const starsContainer = document.getElementById('win-stars');
      starsContainer.innerHTML = '';
      for (let i = 1; i <= 3; i++) {
        const span = document.createElement('span');
        span.textContent = i <= stars ? '⭐' : '☆';
        span.style.color = i <= stars ? 'var(--coin-gold)' : 'var(--border-color)';
        starsContainer.appendChild(span);
      }

      document.getElementById('win-coins-val').textContent = `+${coins}`;
      document.getElementById('win-cash-val').textContent = `+$${cash.toFixed(2)}`;
      document.getElementById('win-stats-val').textContent = `Time: ${this.elapsedSeconds}s | Moves: ${moves} (Par: ${optimal})`;

      modal.classList.add('active');
    }

    updateLevelStarsUI(levelId) {
      const stars = this.state.levelStars[levelId] || 0;
      const starEls = document.querySelectorAll('#sub-header-stars .star-item');
      starEls.forEach((el, idx) => {
        if (idx < stars) {
          el.textContent = '⭐';
          el.className = 'star-item star-filled';
        } else {
          el.textContent = '☆';
          el.className = 'star-item star-empty';
        }
      });
    }

    updateBadges() {
      document.getElementById('header-coins').textContent = this.state.coins.toLocaleString();
      document.getElementById('header-cash').textContent = `$${this.state.virtualCash.toFixed(2)}`;
    }

    updateToolsUI() {
      document.getElementById('tool-count-hint').textContent = this.state.tools.hints;
      document.getElementById('tool-count-eraser').textContent = this.state.tools.erasers;
      document.getElementById('tool-count-star').textContent = this.state.tools.stars;
      document.getElementById('tool-count-ruler').textContent = this.state.tools.rulers;

      ['hint', 'eraser', 'star', 'ruler'].forEach(tool => {
        const countEl = document.getElementById(`tool-count-${tool}`);
        if (this.state.tools[`${tool}s`] === 0) {
          countEl.classList.add('zero');
        } else {
          countEl.classList.remove('zero');
        }
      });
    }

    checkAchievements() {
      const ach = this.state.achievements;
      // 1. First Step
      if (this.state.unlockedLevel > 1) ach.first_step.unlocked = true;
      // 2. Arrow Cadet
      if (this.state.unlockedLevel > 20) ach.arrow_cadet.unlocked = true;
      // 3. Speedster
      if (Object.values(this.state.levelBestTimes).some(t => t <= 10)) ach.speedster.unlocked = true;
      // 4. Three Stars
      const threeStarCount = Object.values(this.state.levelStars).filter(s => s === 3).length;
      if (threeStarCount >= 5) ach.three_stars.unlocked = true;
      // 5. Coin Hoarder
      if (this.state.coins >= 1000) ach.coin_hoarder.unlocked = true;
      // 6. Geometric Mind
      if (this.state.unlockedLevel > 50) ach.geometric_mind.unlocked = true;
      // 7. Tool Master
      if (this.usedToolsInLevel.size >= 4) ach.tool_master.unlocked = true;
      // 8. Halfway Hero
      if (this.state.unlockedLevel >= 50) ach.halfway_hero.unlocked = true;
      // 9. Challenge Master
      if (this.state.unlockedLevel >= 76) ach.challenge_master.unlocked = true;
      // 10. Centurion
      if (this.state.unlockedLevel >= 100) ach.centurion.unlocked = true;
      // 11. Virtual High Roller
      if (this.state.virtualCash >= 50) ach.mint_millionaire.unlocked = true;

      this.saveState();
    }

    // Modal helpers
    openModal(modalId) {
      this.isPaused = true;
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.add('active');
    }

    closeModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.remove('active');
      this.isPaused = false;
    }

    initUI() {
      // Top actions
      document.getElementById('btn-withdraw').addEventListener('click', () => {
        window.soundEngine.playClick();
        this.renderWithdrawalUI();
        this.openModal('modal-withdraw');
      });

      document.getElementById('theme-toggle-btn').addEventListener('click', () => {
        window.soundEngine.playClick();
        const current = this.state.settings.theme;
        const next = current === 'dark' ? 'light' : 'dark';
        this.state.settings.theme = next;
        this.initTheme();
        this.canvas.draw();
        this.saveState();
      });

      document.getElementById('btn-settings').addEventListener('click', () => {
        window.soundEngine.playClick();
        this.renderSettingsUI();
        this.openModal('modal-settings');
      });

      // Sub header buttons
      document.getElementById('btn-level-select').addEventListener('click', () => {
        window.soundEngine.playClick();
        this.renderLevelSelectorUI('all');
        this.openModal('modal-levels');
      });

      document.getElementById('btn-daily-challenge').addEventListener('click', () => {
        window.soundEngine.playClick();
        this.renderDailyChallengeUI();
        this.openModal('modal-daily');
      });

      document.getElementById('btn-achievements').addEventListener('click', () => {
        window.soundEngine.playClick();
        this.renderAchievementsUI();
        this.openModal('modal-achievements');
      });

      // Gameplay controls
      document.getElementById('ctrl-undo').addEventListener('click', () => {
        window.soundEngine.playClick();
        this.canvas.undo();
      });

      document.getElementById('ctrl-reset').addEventListener('click', () => {
        window.soundEngine.playClick();
        this.canvas.reset();
      });

      document.getElementById('ctrl-pause').addEventListener('click', () => {
        window.soundEngine.playClick();
        this.openModal('modal-pause');
      });

      // Power-up tools
      document.getElementById('tool-hint').addEventListener('click', () => {
        if (this.state.tools.hints > 0) {
          if (this.canvas.applyHint()) {
            this.state.tools.hints--;
            this.usedToolsInLevel.add('hint');
            window.soundEngine.playTool();
            this.updateToolsUI();
            this.saveState();
            window.showToast("Hint revealed!", "success");
          }
        } else {
          this.offerToolRefill('hint');
        }
      });

      document.getElementById('tool-eraser').addEventListener('click', () => {
        if (this.state.tools.erasers > 0) {
          this.canvas.undo();
          this.canvas.undo();
          this.state.tools.erasers--;
          this.usedToolsInLevel.add('eraser');
          window.soundEngine.playTool();
          this.updateToolsUI();
          this.saveState();
          window.showToast("Mistakes erased!", "success");
        } else {
          this.offerToolRefill('eraser');
        }
      });

      document.getElementById('tool-star').addEventListener('click', () => {
        if (this.state.tools.stars > 0) {
          if (this.canvas.applyStarPower()) {
            this.state.tools.stars--;
            this.usedToolsInLevel.add('star');
            this.updateToolsUI();
            this.saveState();
            window.showToast("Star Power boost!", "success");
          }
        } else {
          this.offerToolRefill('star');
        }
      });

      document.getElementById('tool-ruler').addEventListener('click', () => {
        const isActive = this.canvas.toggleRuler();
        const toolEl = document.getElementById('tool-ruler');
        if (isActive) {
          toolEl.classList.add('active');
          window.showToast("Ruler guides active!", "success");
        } else {
          toolEl.classList.remove('active');
        }
      });

      // Banner click -> Open AdMob Guidance modal
      document.getElementById('ad-banner').addEventListener('click', () => {
        window.soundEngine.playClick();
        this.openModal('modal-admob');
      });

      // Close modal buttons
      document.querySelectorAll('.modal-close, .btn-modal-dismiss').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const overlay = e.target.closest('.modal-overlay');
          if (overlay) overlay.classList.remove('active');
          this.isPaused = false;
        });
      });

      // Win Modal Actions
      document.getElementById('btn-win-next').addEventListener('click', () => {
        window.soundEngine.playClick();
        this.closeModal('modal-win');
        if (this.state.currentLevel < 100) {
          // Trigger AdMob transition interstitial occasionally (every 3 levels)
          if (this.state.currentLevel % 3 === 0 && window.adMobManager) {
            window.adMobManager.showInterstitial(() => {
              this.loadLevel(this.state.currentLevel + 1);
            });
          } else {
            this.loadLevel(this.state.currentLevel + 1);
          }
        } else {
          window.showToast("Congratulations! You mastered all 100 levels!", "success");
        }
      });

      document.getElementById('btn-win-replay').addEventListener('click', () => {
        window.soundEngine.playClick();
        this.closeModal('modal-win');
        this.loadLevel(this.state.currentLevel);
      });

      // Help button
      document.getElementById('btn-help').addEventListener('click', () => {
        window.soundEngine.playClick();
        this.openModal('modal-tutorial');
      });

      // Back handler for Native Android Back Button
      window.onNativeBackPressed = () => {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal) {
          activeModal.classList.remove('active');
          this.isPaused = false;
          return true;
        }
        return false;
      };
    }

    offerToolRefill(toolType) {
      if (this.state.coins >= 100) {
        if (confirm(`You have 0 ${toolType}s left. Buy +3 for 100 coins?`)) {
          this.state.coins -= 100;
          this.state.tools[`${toolType}s`] += 3;
          this.updateBadges();
          this.updateToolsUI();
          this.saveState();
          window.soundEngine.playCoin();
          window.showToast(`+3 ${toolType}s purchased!`, "success");
        }
      } else {
        if (confirm(`Get +3 free ${toolType}s by watching a test rewarded ad?`)) {
          if (window.adMobManager) {
            window.adMobManager.showRewarded(() => {
              this.state.tools[`${toolType}s`] += 3;
              this.updateToolsUI();
              this.saveState();
              window.soundEngine.playTool();
              window.showToast(`+3 ${toolType}s rewarded!`, "success");
            });
          }
        }
      }
    }

    renderLevelSelectorUI(activeCategory = 'all') {
      const container = document.getElementById('levels-grid-container');
      container.innerHTML = '';

      const levels = window.MAZEMINT_LEVELS || [];
      levels.forEach(lvl => {
        if (activeCategory !== 'all' && lvl.category !== activeCategory) return;

        const isUnlocked = lvl.id <= this.state.unlockedLevel;
        const isCurrent = lvl.id === this.state.currentLevel;
        const stars = this.state.levelStars[lvl.id] || 0;

        const cell = document.createElement('div');
        cell.className = `level-cell ${isUnlocked ? 'unlocked' : 'locked'} ${isCurrent ? 'current' : ''}`;

        let starsStr = '';
        if (isUnlocked) {
          for (let s = 1; s <= 3; s++) {
            starsStr += s <= stars ? '★' : '☆';
          }
        } else {
          starsStr = '🔒';
        }

        cell.innerHTML = `
          <div class="cell-num">${lvl.id}</div>
          <div class="cell-stars">${starsStr}</div>
        `;

        if (isUnlocked) {
          cell.addEventListener('click', () => {
            window.soundEngine.playClick();
            this.closeModal('modal-levels');
            this.loadLevel(lvl.id);
          });
        }

        container.appendChild(cell);
      });

      // Filter tabs click
      document.querySelectorAll('.category-tab').forEach(tab => {
        tab.onclick = () => {
          document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          this.renderLevelSelectorUI(tab.dataset.category);
        };
      });
    }

    renderWithdrawalUI() {
      const progressEl = document.getElementById('withdraw-progress-fill');
      const progressText = document.getElementById('withdraw-progress-text');
      const balanceEl = document.getElementById('withdraw-current-balance');

      const balance = this.state.virtualCash;
      const threshold = 100.00;
      const pct = Math.min(100, (balance / threshold) * 100);

      balanceEl.textContent = `$${balance.toFixed(2)}`;
      progressEl.style.width = `${pct}%`;
      progressText.textContent = `$${balance.toFixed(2)} / $${threshold.toFixed(2)} (${Math.round(pct)}%)`;

      // Render transactions history
      const txContainer = document.getElementById('withdraw-tx-list');
      txContainer.innerHTML = '';
      this.state.transactions.slice(0, 5).forEach(tx => {
        const item = document.createElement('div');
        item.style.cssText = "display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-color); font-size:12px;";
        item.innerHTML = `
          <div>
            <div style="font-weight:700;">${tx.title}</div>
            <div style="color:var(--text-muted); font-size:10px;">${tx.date} • ${tx.id}</div>
          </div>
          <div style="text-align:right;">
            <div style="color:var(--cash-green); font-weight:800;">${tx.amount}</div>
            <div style="color:#B45309; font-size:10px;">${tx.status}</div>
          </div>
        `;
        txContainer.appendChild(item);
      });

      // Form submit button
      const submitBtn = document.getElementById('btn-submit-withdraw');
      submitBtn.onclick = () => {
        const accountInput = document.getElementById('withdraw-account-input').value.trim();
        if (!accountInput) {
          window.showToast("Please enter demo payout account / email", "error");
          return;
        }

        if (balance < threshold) {
          alert(`Demo Notice:\n\nYour current virtual balance is $${balance.toFixed(2)}. Complete more maze levels to reach the $100.00 demo payout threshold!\n\nNote: All rewards in MazeMint are virtual play credits.`);
        } else {
          // Demo payout simulation
          alert(`Demo Withdrawal Request Submitted!\n\nSimulated Payout: $100.00\nDestination: ${accountInput}\nStatus: Demo Processing\n\nRemember: This is a demo simulation interface with virtual game credits.`);
          this.state.virtualCash = parseFloat((this.state.virtualCash - 100).toFixed(2));
          this.state.transactions.unshift({
            id: `MM-CSH-${Math.floor(1000 + Math.random() * 9000)}`,
            title: `Demo Cashout (${accountInput})`,
            amount: `-$100.00`,
            status: "Simulated Pending",
            date: "Just now"
          });
          this.updateBadges();
          this.renderWithdrawalUI();
          this.saveState();
        }
      };
    }

    renderSettingsUI() {
      const soundToggle = document.getElementById('setting-sound');
      const hapticsToggle = document.getElementById('setting-haptics');
      const classicToggle = document.getElementById('setting-classic');

      soundToggle.checked = this.state.settings.sound;
      hapticsToggle.checked = this.state.settings.haptics;
      if (classicToggle) {
        classicToggle.checked = !!this.state.settings.classic;
        classicToggle.onchange = (e) => {
          this.state.settings.classic = e.target.checked;
          this.initTheme();
          if (this.canvas) this.canvas.draw();
          this.saveState();
        };
      }

      soundToggle.onchange = (e) => {
        this.state.settings.sound = e.target.checked;
        this.initAudioSettings();
        this.saveState();
      };

      hapticsToggle.onchange = (e) => {
        this.state.settings.haptics = e.target.checked;
        this.initAudioSettings();
        this.saveState();
      };

      document.getElementById('btn-reset-data').onclick = () => {
        if (confirm("Reset all game progress, levels, coins and scores? This cannot be undone.")) {
          localStorage.removeItem(STORAGE_KEY);
          location.reload();
        }
      };
    }

    renderAchievementsUI() {
      const list = document.getElementById('achievements-container');
      list.innerHTML = '';

      Object.entries(this.state.achievements).forEach(([key, ach]) => {
        const card = document.createElement('div');
        card.className = 'achievement-card';

        const icon = ach.unlocked ? '🏆' : '🔒';
        let actionBtn = '';
        if (ach.unlocked && !ach.claimed) {
          actionBtn = `<button class="btn-primary" style="padding:4px 10px; font-size:11px;" id="claim-${key}">Claim +${ach.reward}🪙</button>`;
        } else if (ach.claimed) {
          actionBtn = `<span style="color:var(--cash-green); font-size:11px; font-weight:800;">✓ Claimed</span>`;
        } else {
          actionBtn = `<span style="color:var(--text-muted); font-size:11px;">+${ach.reward}🪙</span>`;
        }

        card.innerHTML = `
          <div class="achievement-icon">${icon}</div>
          <div class="achievement-details">
            <div class="achievement-title">${ach.title}</div>
            <div class="achievement-desc">${ach.desc}</div>
          </div>
          <div>${actionBtn}</div>
        `;

        list.appendChild(card);

        const btnEl = document.getElementById(`claim-${key}`);
        if (btnEl) {
          btnEl.onclick = () => {
            ach.claimed = true;
            this.state.coins += ach.reward;
            this.updateBadges();
            this.saveState();
            window.soundEngine.playCoin();
            this.renderAchievementsUI();
            window.showToast(`+${ach.reward} coins claimed!`, "success");
          };
        }
      });
    }

    renderDailyChallengeUI() {
      const today = new Date().toISOString().slice(0, 10);
      const isDone = this.state.daily.lastDate === today && this.state.daily.completed;

      document.getElementById('daily-streak-val').textContent = `${this.state.daily.streak} Days`;
      const playBtn = document.getElementById('btn-play-daily');

      if (isDone) {
        playBtn.textContent = "Completed Today!";
        playBtn.disabled = true;
      } else {
        playBtn.textContent = "Play Daily Challenge (2x Rewards)";
        playBtn.disabled = false;
        playBtn.onclick = () => {
          this.closeModal('modal-daily');
          // Pick a random challenge level
          const dailyLvl = 50 + (new Date().getDate() % 40);
          this.loadLevel(dailyLvl);
          window.showToast("Daily Challenge loaded! Double rewards active.", "success");
          this.state.daily.lastDate = today;
          this.state.daily.completed = true;
          this.state.daily.streak++;
          this.saveState();
        };
      }
    }
  }

  // Floating toast helper
  window.showToast = function(msg, type = 'info') {
    let toast = document.getElementById('app-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `canvas-toast show ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  };

  window.addEventListener('DOMContentLoaded', () => {
    window.gameApp = new GameApp();
  });

})();

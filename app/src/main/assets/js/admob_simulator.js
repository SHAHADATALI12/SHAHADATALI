/**
 * MazeMint: One Line Quest - Google AdMob Guidance & Simulator
 * Provides official Google test ad unit IDs and non-intrusive transition ad simulator.
 */

const ADMOB_CONFIG = {
  TEST_APP_ID: "ca-app-pub-3940256099942544~3347511713",
  BANNER_UNIT_ID: "ca-app-pub-3940256099942544/6300978111",
  INTERSTITIAL_UNIT_ID: "ca-app-pub-3940256099942544/1033173712",
  REWARDED_UNIT_ID: "ca-app-pub-3940256099942544/5224354917",
  
  BANNER_ADS: [
    { title: "Mint Arcade Pass", tag: "Sponsored", desc: "Enjoy 1,000+ indie puzzles offline. Test banner." },
    { title: "Cloud Backup Vault", tag: "Demo Partner", desc: "Keep your quest progress synchronized." },
    { title: "Retro Maze Champion", tag: "Featured App", desc: "Classic arrow labyrinth challenges." }
  ]
};

class AdMobManager {
  constructor() {
    this.currentBannerIndex = 0;
    this.interstitialCooldown = 0;
    this.initBannerCycle();
  }

  initBannerCycle() {
    setInterval(() => {
      this.currentBannerIndex = (this.currentBannerIndex + 1) % ADMOB_CONFIG.BANNER_ADS.length;
      const ad = ADMOB_CONFIG.BANNER_ADS[this.currentBannerIndex];
      const titleEl = document.querySelector('.ad-title');
      const descEl = document.querySelector('.ad-unit');
      if (titleEl && descEl) {
        titleEl.textContent = `${ad.title} (${ad.tag})`;
        descEl.textContent = ad.desc;
      }
    }, 12000);
  }

  showInterstitial(onDismissed) {
    const overlay = document.getElementById('ad-interstitial-overlay');
    if (!overlay) {
      if (onDismissed) onDismissed();
      return;
    }

    const timerEl = document.getElementById('ad-countdown');
    const closeBtn = document.getElementById('ad-close-btn');

    let seconds = 3;
    timerEl.textContent = `Ad closing in ${seconds}s...`;
    closeBtn.style.display = 'none';
    overlay.classList.add('active');

    const interval = setInterval(() => {
      seconds--;
      if (seconds > 0) {
        timerEl.textContent = `Ad closing in ${seconds}s...`;
      } else {
        clearInterval(interval);
        timerEl.textContent = "Ad completed";
        closeBtn.style.display = 'block';
      }
    }, 1000);

    const closeHandler = () => {
      overlay.classList.remove('active');
      closeBtn.removeEventListener('click', closeHandler);
      if (onDismissed) onDismissed();
    };

    closeBtn.addEventListener('click', closeHandler);
  }

  showRewarded(rewardCallback) {
    this.showInterstitial(() => {
      if (rewardCallback) rewardCallback();
    });
  }
}

window.adMobManager = new AdMobManager();

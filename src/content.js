import { ScraperEngine } from './scraper/ScraperEngine';

function init() {
  const engine = new ScraperEngine();
  engine.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

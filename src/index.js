/* selfie-sprite/index.js */
import APP_CONFIG from "./constants/app-config.js";
import MainView from "./views/main-view.js";
import store from "./store/store.js";
import CustomizeGame from "./views/customize-game.js";
import GamePlayView from "./views/gameplay-view.js";
// stub game scenes for now
const NotImplemented = (title) => (state, emit) =>
  html`<div id="app"><h1 class="pa4 tc">${title} coming soon…</h1></div>`;

const path = APP_CONFIG.srcFolder;
const choo = Choo({ hash: true });

choo.use(store);

// browser
choo.route(`/${path}`, MainView);
console.log(`🛣️  Mounted main view at /${path}/`);
// individual games
choo.route(`/${path}/:game/customize`, CustomizeGame);
choo.route(`/${path}/:game/play`, GamePlayView);
choo.mount("#app");
window.choo = choo;

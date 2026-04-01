/* index.js */
import APP_CONFIG from "./data/app-config.js";
import MainView from "./views/main-view.js";
import store from "./store/store.js";

const path = APP_CONFIG.srcFolder;
const choo = Choo({ hash: true });

choo.use(store);

// browser
choo.route(`/${path}`, MainView);
console.log(`🛣️  Mounted main view at /${path}/`);
// individual games
choo.mount("#app");
window.choo = choo;

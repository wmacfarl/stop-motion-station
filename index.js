/* index.js */
import MainView from "./views/main-view.js";
import store from "./store/store.js";


const choo = Choo({ hash: true });
function getBasePath() {
  return window.location.hostname === "wmacfarl.github.io"
    ? "/stop-motion-station"
    : "";
}
const path = getBasePath();
choo.use(store);

choo.route(`/${path}`, MainView);
console.log(`🛣️  Mounted main view at /${path}/`);
choo.mount("#app");
window.choo = choo;

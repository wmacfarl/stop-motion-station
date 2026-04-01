import mainView from "./views/main-view.js";
import applicationStore from "./stores/application-store.js";
/* index.js */
import MainView from "./views/main-view.js";
import store from "./store/store.js";

const application = Choo();
function getBasePath() {
  return window.location.hostname === "wmacfarl.github.io"
    ? "/stop-motion-station"
    : "";
}
const path = getBasePath();
application.use(applicationStore);
application.route("*", mainView);

export default application;

if (typeof window !== "undefined") {
  application.mount("#app");

  window.requestAnimationFrame(() => {
    application.emitter.emit("application:startup");
  });
}
application.route(`/${path}`, MainView);
console.log(`🛣️  Mounted main view at /${path}/`);
application.mount("#app");
window.application = application;

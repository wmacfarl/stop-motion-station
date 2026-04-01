import mainView from "./views/main-view.js";
import applicationStore from "./stores/application-store.js";
/* index.js */
import MainView from "./views/main-view.js";
import store from "./store/store.js";

const application = Choo();

application.use(applicationStore);
application.route("*", mainView);

export default application;

if (typeof window !== "undefined") {
  application.mount("#app");

  window.requestAnimationFrame(() => {
    application.emitter.emit("application:startup");
  });
}
choo.route(`/${path}`, MainView);
console.log(`🛣️  Mounted main view at /${path}/`);
choo.mount("#app");
window.choo = choo;

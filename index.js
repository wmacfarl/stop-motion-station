import store from "./stores/store.js";
/* index.js */
import MainView from "./views/main-view.js";

const application = Choo();
application.use(store);
application.route("*", MainView);

window.requestAnimationFrame(() => {
  application.emitter.emit("application:startup");
});

application.mount("#app");
window.application = application;

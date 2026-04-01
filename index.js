import applicationStore from "./stores/application-store.js";
/* index.js */
import MainView from "./views/main-view.js";

const application = Choo();
application.use(applicationStore);
application.route("*", MainView);

window.requestAnimationFrame(() => {
  application.emitter.emit("application:startup");
});

application.mount("#app");
window.application = application;

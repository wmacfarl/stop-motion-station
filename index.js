import applicationStore from "./app.js";
import mainView from "./views/main-view.js";

const application = Choo();
application.use(applicationStore);
application.route("*", mainView);
application.mount("#app");

window.requestAnimationFrame(() => {
  application.emitter.emit("application:startup");
});

window.application = application;

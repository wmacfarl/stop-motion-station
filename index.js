import mainView from "./views/main-view.js";
import applicationStore from "./stores/application-store.js";

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

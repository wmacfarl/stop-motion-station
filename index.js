import application from "./app.js";

if (typeof window !== "undefined") {
  application.mount("#app");

  window.requestAnimationFrame(() => {
    application.emitter.emit("application:startup");
  });
}

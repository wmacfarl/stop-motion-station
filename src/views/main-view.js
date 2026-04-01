// selfie-sprite/views/main-view.js
import APP_CONFIG from "../data/constants.js";

export default function MainView(state, emit) {
  return html`
    <div id="app" class="mw8 center pa3">
      <h1 class="tc f3 f2-ns">${APP_CONFIG.appName}</h1>
    </div>
  `;
}

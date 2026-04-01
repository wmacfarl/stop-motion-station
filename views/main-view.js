import renderPreviewPanel from "./render-preview-panel.js";
import renderControlsPanel from "./render-controls-panel.js";
import renderTimelinePanel from "./render-timeline-panel.js";

export default function mainView(state, emit) {
  const applicationSurfaceLayout = state.appSurfaceLayout;

  return html`
    <div id="app" class="application-root">
      <section
        class="application-surface"
        style=${`
          width: ${applicationSurfaceLayout.width}px;
          height: ${applicationSurfaceLayout.height}px;
        `}
      >
        <div class="application-top-row">
          ${renderPreviewPanel(state, emit)}
          ${renderControlsPanel(state, emit)}
        </div>

        ${renderTimelinePanel(state, emit)}
      </section>
    </main>
  `;
}

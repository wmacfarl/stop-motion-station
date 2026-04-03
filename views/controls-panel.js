export default function controlsPanel(state) {
  const { controlsWidth, previewHeight } = state.appSurfaceLayout;
  const automaticCaptureIsEnabled = state.isTimelapseCapturing;
  const automaticCaptureStatusMessage = automaticCaptureIsEnabled
    ? `Taking picture in ${state.autoCaptureCountdownSecondsRemaining ?? 3}...`
    : "Auto-capture is ready.";

  return html`
    <aside class="controls-panel" style=${`width: ${controlsWidth}px; height: ${previewHeight}px;`}>
      <section class="auto-capture-indicator-panel">
        <div class="auto-capture-indicator-title">Auto-capture</div>
        <div class="auto-capture-status-text">
          ${automaticCaptureStatusMessage}
        </div>
        <div class="auto-capture-shortcut-hint">
          Press and release Up and Space together to start auto-capture. Press any other key to stop.
        </div>
      </section>
    </aside>
  `;
}

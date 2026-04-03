export default function controlsPanel(state, emit) {
  const { controlsWidth, previewHeight } = state.appSurfaceLayout;
  const automaticCaptureIsEnabled = state.isTimelapseCapturing;
  const controlsAreDisabledByAutomaticCapture = automaticCaptureIsEnabled;

  const canCaptureFrames = state.cameraStatus === "ready"
    && !state.isPlaying
    && !automaticCaptureIsEnabled;

  const canToggleTimelapseCapture = state.cameraStatus === "ready" && !state.isPlaying;

  const currentlySelectedFrameCanBeDeleted = state.selectedTimelineItem.type === "frame";
  const currentlySelectedInsertionPointCanDeleteFrameBehindIt = state.selectedTimelineItem.type === "gap"
    && state.selectedTimelineItem.index > 0;

  const canDeleteFrame = (
    currentlySelectedFrameCanBeDeleted
    || currentlySelectedInsertionPointCanDeleteFrameBehindIt
  )
    && !state.isPlaying
    && !automaticCaptureIsEnabled;

  const canPlaySequence = state.frames.length > 0
    && !state.isPlaying
    && !automaticCaptureIsEnabled;

  const automaticCaptureStatusMessage = automaticCaptureIsEnabled
    ? `Taking picture in ${state.autoCaptureCountdownSecondsRemaining ?? 3}...`
    : "";

  return html`
    <aside class="controls-panel" style=${`width: ${controlsWidth}px; height: ${previewHeight}px;`}>
      <button
        class="controls-button"
        disabled=${controlsAreDisabledByAutomaticCapture || !canCaptureFrames}
        onclick=${() => emit("frames:capture")}
      >
        Capture
      </button>

      <button
        class="controls-button"
        disabled=${controlsAreDisabledByAutomaticCapture || !canToggleTimelapseCapture}
        onclick=${() => emit(state.isTimelapseCapturing ? "timelapse:stop" : "timelapse:start")}
      >
        ${state.isTimelapseCapturing ? "Auto-Capture Enabled" : "Turn On Auto-Capture"}
      </button>

      <button
        class="controls-button"
        disabled=${controlsAreDisabledByAutomaticCapture || !canDeleteFrame}
        onclick=${() => emit("frames:delete-selected")}
      >
        Delete
      </button>

      <button
        class="controls-button"
        disabled=${controlsAreDisabledByAutomaticCapture || !canPlaySequence}
        onclick=${() => emit("playback:start")}
      >
        Play
      </button>

      ${automaticCaptureIsEnabled
    ? html`<div class="auto-capture-status-text">
        ${automaticCaptureStatusMessage}
        <br />
        Press any key to stop auto-capture.
      </div>`
    : ""}
    </aside>
  `;
}

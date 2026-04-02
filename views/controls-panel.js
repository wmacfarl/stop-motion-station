export default function controlsPanel(state, emit) {
  const { controlsWidth, previewHeight } = state.appSurfaceLayout;

  const canRequestCameraAccess = state.cameraStatus !== "requesting"
    && state.cameraStatus !== "ready"
    && !state.isPlaying
    && !state.isTimelapseCapturing;

  const canCaptureFrames = state.cameraStatus === "ready"
    && !state.isPlaying
    && !state.isTimelapseCapturing;

  const canToggleTimelapseCapture = state.cameraStatus === "ready" && !state.isPlaying;

  const currentlySelectedFrameCanBeDeleted = state.selectedTimelineItem.type === "frame";
  const currentlySelectedInsertionPointCanDeleteFrameBehindIt = state.selectedTimelineItem.type === "gap"
    && state.selectedTimelineItem.index > 0;

  const canDeleteFrame = (
    currentlySelectedFrameCanBeDeleted
    || currentlySelectedInsertionPointCanDeleteFrameBehindIt
  )
    && !state.isPlaying
    && !state.isTimelapseCapturing;

  const canPlaySequence = state.frames.length > 0
    && !state.isPlaying
    && !state.isTimelapseCapturing;

  return html`
    <aside class="controls-panel" style=${`width: ${controlsWidth}px; height: ${previewHeight}px;`}>
      <button
        class="controls-button"
        disabled=${!canRequestCameraAccess}
        onclick=${() => emit("camera:request-access")}
      >
        Start Camera
      </button>

      <button
        class="controls-button"
        disabled=${!canCaptureFrames}
        onclick=${() => emit("frames:capture")}
      >
        Capture
      </button>

      <button
        class="controls-button"
        disabled=${!canToggleTimelapseCapture}
        onclick=${() => emit(state.isTimelapseCapturing ? "timelapse:stop" : "timelapse:start")}
      >
        ${state.isTimelapseCapturing ? "Stop Capturing" : "Start Capturing"}
      </button>

      <button
        class="controls-button"
        disabled=${!canDeleteFrame}
        onclick=${() => emit("frames:delete-selected")}
      >
        Delete
      </button>

      <button
        class="controls-button"
        disabled=${!canPlaySequence}
        onclick=${() => emit("playback:start")}
      >
        Play
      </button>
    </aside>
  `;
}

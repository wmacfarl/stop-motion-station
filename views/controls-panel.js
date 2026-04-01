export default function controlsPanel(state, emit) {
  const { controlsWidth, previewHeight } = state.appSurfaceLayout;

  const canRequestCameraAccess = state.cameraStatus !== "requesting" && state.cameraStatus !== "ready" && !state.isPlaying;
  const canCaptureFrames = state.cameraStatus === "ready" && !state.isPlaying;
  const canDeleteFrame = state.selectedTimelineItem.type === "frame" && !state.isPlaying;
  const canPlaySequence = state.frames.length > 0 && !state.isPlaying;

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


import cameraService from "../services/camera-service.js";

export default function previewPanel(state) {
  const { previewWidth, previewHeight } = state.appSurfaceLayout;

  if (state.cameraStatus === "requesting" || state.cameraStatus === "booting") {
    return html`
      <section
        class="preview-panel"
        style=${`width: ${previewWidth}px; height: ${previewHeight}px;`}
      >
        <div class="preview-status-message">Requesting camera…</div>
      </section>
    `;
  }

  if (state.cameraStatus === "error") {
    return html`
      <section
        class="preview-panel"
        style=${`width: ${previewWidth}px; height: ${previewHeight}px;`}
      >
        <div class="preview-status-message">
          Camera error: ${state.cameraErrorMessage || "Unknown error"}
        </div>
      </section>
    `;
  }

  if (state.isPlaying && state.playbackFrameIndex !== null) {
    const playbackFrameRecord = state.frames[state.playbackFrameIndex];

    return html`
      <section
        class="preview-panel"
        style=${`width: ${previewWidth}px; height: ${previewHeight}px;`}
      >
        <img
          class="playback-preview-image"
          src=${playbackFrameRecord.imageSource}
          draggable="false"
          alt=${`Playback frame ${state.playbackFrameIndex + 1}`}
        />
      </section>
    `;
  }

  cameraService.ensurePreviewIsPlaying();
  const persistentVideoElement = cameraService.getVideoElement();

  return html`
    <section
      class="preview-panel"
      style=${`width: ${previewWidth}px; height: ${previewHeight}px;`}
    >
      <div class="live-video-container">
        ${persistentVideoElement}
      </div>
    </section>
  `;
}
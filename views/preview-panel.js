import cameraService from "../services/camera-service.js";
import mountNodeIntoContainer from "../helpers/mount-node-into-container.js";

function attachLiveVideoElement(previewPanelElement) {
  const liveVideoContainerElement = previewPanelElement.querySelector(".live-video-container");
  mountNodeIntoContainer(liveVideoContainerElement, cameraService.getVideoElement());
}

export default function previewPanel(state) {
  const { previewWidth, previewHeight } = state.appSurfaceLayout;

  if (state.cameraStatus === "requesting" || state.cameraStatus === "booting") {
    return html`
      <section class="preview-panel" style=${`width: ${previewWidth}px; height: ${previewHeight}px;`}>
        <div class="preview-status-message">Requesting camera…</div>
      </section>
    `;
  }

  if (state.cameraStatus === "error") {
    return html`
      <section class="preview-panel" style=${`width: ${previewWidth}px; height: ${previewHeight}px;`}>
        <div class="preview-status-message">
          Camera error: ${state.cameraErrorMessage || "Unknown error"}
        </div>
      </section>
    `;
  }

  if (state.isPlaying && state.playbackFrameIndex !== null) {
    const playbackFrameRecord = state.frames[state.playbackFrameIndex];

    return html`
      <section class="preview-panel" style=${`width: ${previewWidth}px; height: ${previewHeight}px;`}>
        <img
          class="playback-preview-image"
          src=${playbackFrameRecord.imageSource}
          draggable="false"
          alt=${`Playback frame ${state.playbackFrameIndex + 1}`}
        />
      </section>
    `;
  }

  return html`
    <section
      class="preview-panel"
      style=${`width: ${previewWidth}px; height: ${previewHeight}px;`}
      onload=${attachLiveVideoElement}
      onupdate=${attachLiveVideoElement}
    >
      <div class="live-video-container"></div>
    </section>
  `;
}

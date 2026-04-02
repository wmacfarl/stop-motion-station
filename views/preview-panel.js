import cameraService from "../services/camera-service.js";

const previousFrameOnionSkinCanvasElement = document.createElement("canvas");
previousFrameOnionSkinCanvasElement.className = "previous-frame-onion-skin-canvas";

const previousFrameImageElement = new Image();
let mostRecentPreviousFrameImageSource = null;

function drawFrameImageIntoOnionSkinCanvas({
  imageElement,
  frameWidth,
  frameHeight,
  canvasElement,
}) {
  const canvasRenderingContext = canvasElement.getContext("2d");
  if (!canvasRenderingContext) {
    return;
  }

  canvasRenderingContext.clearRect(0, 0, canvasElement.width, canvasElement.height);

  const frameScale = Math.min(
    canvasElement.width / frameWidth,
    canvasElement.height / frameHeight,
  );

  const fittedFrameWidth = frameWidth * frameScale;
  const fittedFrameHeight = frameHeight * frameScale;
  const horizontalOffset = (canvasElement.width - fittedFrameWidth) / 2;
  const verticalOffset = (canvasElement.height - fittedFrameHeight) / 2;

  canvasRenderingContext.drawImage(
    imageElement,
    horizontalOffset,
    verticalOffset,
    fittedFrameWidth,
    fittedFrameHeight,
  );
}

function updatePreviousFrameOnionSkinCanvas({
  previousFrameRecord,
  previewWidth,
  previewHeight,
}) {
  previousFrameOnionSkinCanvasElement.width = previewWidth;
  previousFrameOnionSkinCanvasElement.height = previewHeight;

  if (!previousFrameRecord) {
    const canvasRenderingContext = previousFrameOnionSkinCanvasElement.getContext("2d");
    canvasRenderingContext?.clearRect(0, 0, previewWidth, previewHeight);
    return;
  }

  const renderFrameImageIntoCanvas = () => {
    drawFrameImageIntoOnionSkinCanvas({
      imageElement: previousFrameImageElement,
      frameWidth: previousFrameRecord.width || previousFrameImageElement.naturalWidth,
      frameHeight: previousFrameRecord.height || previousFrameImageElement.naturalHeight,
      canvasElement: previousFrameOnionSkinCanvasElement,
    });
  };

  if (
    previousFrameImageElement.complete
    && previousFrameImageElement.src === previousFrameRecord.previewImageSource
  ) {
    renderFrameImageIntoCanvas();
    return;
  }

  mostRecentPreviousFrameImageSource = previousFrameRecord.previewImageSource;
  previousFrameImageElement.onload = () => {
    if (previousFrameRecord.previewImageSource !== mostRecentPreviousFrameImageSource) {
      return;
    }

    renderFrameImageIntoCanvas();
  };
  previousFrameImageElement.src = previousFrameRecord.previewImageSource;
}

function getPreviousFrameRecordForOnionSkin(state) {
  if (state.frames.length === 0) {
    return null;
  }

  if (state.selectedTimelineItem.type === "frame") {
    return state.frames[Math.max(0, state.selectedTimelineItem.index - 1)] || null;
  }

  if (state.selectedTimelineItem.type === "gap") {
    return state.frames[state.selectedTimelineItem.index - 1] || null;
  }

  return state.frames[state.frames.length - 1] || null;
}

export default function previewPanel(state) {
  const { previewWidth, previewHeight } = state.appSurfaceLayout;

  if (state.cameraStatus === "idle") {
    return html`
      <section
        class="preview-panel"
        style=${`width: ${previewWidth}px; height: ${previewHeight}px;`}
      >
        <div class="preview-status-message">Preparing camera…</div>
      </section>
    `;
  }

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
          src=${playbackFrameRecord.previewImageSource}
          draggable="false"
          alt=${`Playback frame ${state.playbackFrameIndex + 1}`}
        />
      </section>
    `;
  }

  cameraService.ensurePreviewIsPlaying();
  const persistentVideoElement = cameraService.getVideoElement();
  const previousFrameRecord = getPreviousFrameRecordForOnionSkin(state);
  updatePreviousFrameOnionSkinCanvas({
    previousFrameRecord,
    previewWidth,
    previewHeight,
  });

  return html`
    <section
      class="preview-panel"
      style=${`width: ${previewWidth}px; height: ${previewHeight}px;`}
    >
      <div class="live-video-container">
        ${persistentVideoElement}
        ${previousFrameOnionSkinCanvasElement}
      </div>
    </section>
  `;
}

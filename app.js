import cameraService from "./services/camera-service.js";
import playbackController from "./services/playback-controller.js";
import computeLayout from "./helpers/compute-layout.js";
import {
  createInitialApplicationState,
  insertCapturedFrameAtCurrentSelection,
  deleteSelectedFrame,
  canDeleteSelectedFrame,
  canPlayFrames,
} from "./helpers/frame-operations.js";

export default function applicationStore(state, emitter) {
  Object.assign(state, createInitialApplicationState());

  function updateApplicationLayoutFromViewport() {
    state.appSurfaceLayout = computeLayout({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
  }

  updateApplicationLayoutFromViewport();

  emitter.on("application:startup", () => {
    window.addEventListener("resize", () => {
      emitter.emit("application:resize");
    });

    emitter.emit("render");
  });

  emitter.on("camera:request-access", async () => {
    if (state.cameraStatus === "requesting" || state.cameraStatus === "ready") {
      return;
    }

    state.cameraStatus = "requesting";
    state.cameraErrorMessage = null;
    emitter.emit("render");

    try {
      await cameraService.startPreview();
      state.cameraStatus = "ready";
    } catch (cameraStartupError) {
      state.cameraStatus = "error";
      state.cameraErrorMessage = cameraStartupError.message;
    }

    emitter.emit("render");
  });

  emitter.on("application:resize", () => {
    updateApplicationLayoutFromViewport();
    emitter.emit("render");
  });

  emitter.on("timeline:select-gap", (gapIndex) => {
    if (state.isPlaying) {
      return;
    }

    state.selectedTimelineItem = { type: "gap", index: gapIndex };
    emitter.emit("render");
  });

  emitter.on("timeline:select-frame", (frameIndex) => {
    if (state.isPlaying) {
      return;
    }

    state.selectedTimelineItem = { type: "frame", index: frameIndex };
    emitter.emit("render");
  });

  emitter.on("frames:capture", async () => {
    if (state.cameraStatus !== "ready" || state.isPlaying) {
      return;
    }

    try {
      const capturedFrameRecordData = await cameraService.captureFrameRecordData();

      const insertionResult = insertCapturedFrameAtCurrentSelection({
        frames: state.frames,
        selectedTimelineItem: state.selectedTimelineItem,
        capturedFrameRecordData,
      });

      state.frames = insertionResult.frames;
      state.selectedTimelineItem = insertionResult.selectedTimelineItem;
    } catch (captureError) {
      console.error("Failed to capture frame:", captureError);
    }

    emitter.emit("render");
  });

  emitter.on("frames:delete-selected", () => {
    if (state.isPlaying || !canDeleteSelectedFrame(state)) {
      return;
    }

    const deletionResult = deleteSelectedFrame({
      frames: state.frames,
      selectedTimelineItem: state.selectedTimelineItem,
    });

    state.frames = deletionResult.frames;
    state.selectedTimelineItem = deletionResult.selectedTimelineItem;
    emitter.emit("render");
  });

  emitter.on("playback:start", () => {
    if (state.isPlaying || !canPlayFrames(state)) {
      return;
    }

    state.isPlaying = true;
    state.playbackFrameIndex = 0;
    emitter.emit("render");

    playbackController.playFrames({
      frames: state.frames,
      framesPerSecond: 8,
      onFrameChange(frameIndex) {
        state.playbackFrameIndex = frameIndex;
        emitter.emit("render");
      },
      onComplete() {
        state.isPlaying = false;
        state.playbackFrameIndex = null;
        emitter.emit("render");
      },
    });
  });

  emitter.on("playback:stop", () => {
    playbackController.stop();
    state.isPlaying = false;
    state.playbackFrameIndex = null;
    emitter.emit("render");
  });
}

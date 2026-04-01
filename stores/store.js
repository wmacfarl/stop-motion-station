import createInitialState from "../state/create-initial-state.js";
import { computeApplicationSurfaceLayout } from "../layout/compute-application-surface-layout.js";
import cameraService from "../services/camera-service.js";
import playbackController from "../services/playback-controller.js";
import {
  insertCapturedFrameAtCurrentSelection,
  deleteSelectedFrame,
  canDeleteSelectedFrame,
  canPlayFrames,
} from "../state/frame-operations.js";

export default function applicationStore(state, emitter) {
  Object.assign(state, createInitialState());

  function updateApplicationSurfaceLayoutFromViewport() {
    state.appSurfaceLayout = computeApplicationSurfaceLayout({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
  }

  emitter.on("DOMContentLoaded", () => {
    document.title = "Stop Motion";
  });

  emitter.on("application:startup", async () => {
    updateApplicationSurfaceLayoutFromViewport();
    emitter.emit("render");

    window.addEventListener("resize", () => {
      emitter.emit("application:resize");
    });

    state.cameraStatus = "requesting";
    emitter.emit("render");

    try {
      await cameraService.startPreview();
      state.cameraStatus = "ready";
      emitter.emit("render");
    } catch (cameraStartupError) {
      state.cameraStatus = "error";
      state.cameraErrorMessage = cameraStartupError.message;
      emitter.emit("render");
    }
  });

  emitter.on("application:resize", () => {
    updateApplicationSurfaceLayoutFromViewport();
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

  emitter.on("frames:capture", () => {
    if (state.cameraStatus !== "ready" || state.isPlaying) {
      return;
    }

    const capturedFrameImageSource = cameraService.captureCurrentFrameImageSource();

    const insertResult = insertCapturedFrameAtCurrentSelection({
      frames: state.frames,
      selectedTimelineItem: state.selectedTimelineItem,
      capturedFrameImageSource,
    });

    state.frames = insertResult.frames;
    state.selectedTimelineItem = insertResult.selectedTimelineItem;
    emitter.emit("render");
  });

  emitter.on("frames:delete-selected", () => {
    if (state.isPlaying || !canDeleteSelectedFrame(state)) {
      return;
    }

    const deleteResult = deleteSelectedFrame({
      frames: state.frames,
      selectedTimelineItem: state.selectedTimelineItem,
    });

    state.frames = deleteResult.frames;
    state.selectedTimelineItem = deleteResult.selectedTimelineItem;
    emitter.emit("render");
  });

  emitter.on("playback:start", () => {
    if (!canPlayFrames(state) || state.isPlaying) {
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
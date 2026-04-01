import cameraService from "./services/camera-service.js";
import frameStorageService from "./services/frame-storage-service.js";
import playbackController from "./services/playback-controller.js";
import computeLayout from "./helpers/compute-layout.js";
import createFrameId from "./helpers/create-frame-id.js";
import {
  createInitialApplicationState,
  insertCapturedFrameAtCurrentSelection,
  deleteSelectedFrame,
  canDeleteSelectedFrame,
  canPlayFrames,
} from "./helpers/frame-operations.js";

export default function applicationStore(state, emitter) {
  Object.assign(state, createInitialApplicationState());

  let timelapseCaptureInProgress = false;

  function updateApplicationLayoutFromViewport() {
    state.appSurfaceLayout = computeLayout({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
  }

  async function captureAndInsertFrameRecord() {
    const frameIdentifier = createFrameId();
    const capturedFrameData = await cameraService.captureFrameRecordData();

    const originalStorageKey = await frameStorageService.saveOriginalFrameBlob({
      frameId: frameIdentifier,
      blob: capturedFrameData.originalBlob,
    });

    const capturedFrameRecordData = {
      id: frameIdentifier,
      timelineImageSource: capturedFrameData.timelineImageSource,
      previewImageSource: capturedFrameData.previewImageSource,
      originalStorageKey,
      width: capturedFrameData.width,
      height: capturedFrameData.height,
    };

    const insertionResult = insertCapturedFrameAtCurrentSelection({
      frames: state.frames,
      selectedTimelineItem: state.selectedTimelineItem,
      capturedFrameRecordData,
    });

    state.frames = insertionResult.frames;
    state.selectedTimelineItem = insertionResult.selectedTimelineItem;
  }

  async function cleanupDeletedFrameAssets(deletedFrameRecord) {
    if (!deletedFrameRecord) {
      return;
    }

    if (deletedFrameRecord.timelineImageSource?.startsWith("blob:")) {
      URL.revokeObjectURL(deletedFrameRecord.timelineImageSource);
    }

    if (
      deletedFrameRecord.previewImageSource
      && deletedFrameRecord.previewImageSource !== deletedFrameRecord.timelineImageSource
      && deletedFrameRecord.previewImageSource.startsWith("blob:")
    ) {
      URL.revokeObjectURL(deletedFrameRecord.previewImageSource);
    }

    await frameStorageService.deleteOriginalFrame({
      storageKey: deletedFrameRecord.originalStorageKey,
    });
  }

  function stopTimelapseCaptureInterval() {
    if (state.timelapseTimerIdentifier !== null) {
      window.clearInterval(state.timelapseTimerIdentifier);
      state.timelapseTimerIdentifier = null;
    }

    timelapseCaptureInProgress = false;
  }

  updateApplicationLayoutFromViewport();

  emitter.on("application:startup", async () => {
    const handleViewportChange = () => {
      emitter.emit("application:resize");
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);
    document.addEventListener("fullscreenchange", handleViewportChange);

    await frameStorageService.initialize();
    emitter.emit("render");
  });

  emitter.on("camera:request-access", async () => {
    if (
      state.cameraStatus === "requesting"
      || state.cameraStatus === "ready"
      || state.isTimelapseCapturing
    ) {
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
    if (state.isPlaying || state.isTimelapseCapturing) {
      return;
    }

    state.selectedTimelineItem = { type: "gap", index: gapIndex };
    emitter.emit("render");
  });

  emitter.on("timeline:select-frame", (frameIndex) => {
    if (state.isPlaying || state.isTimelapseCapturing) {
      return;
    }

    state.selectedTimelineItem = { type: "frame", index: frameIndex };
    emitter.emit("render");
  });

  emitter.on("frames:capture", async () => {
    if (state.cameraStatus !== "ready" || state.isPlaying || state.isTimelapseCapturing) {
      return;
    }

    try {
      await captureAndInsertFrameRecord();
    } catch (captureError) {
      console.error("Failed to capture frame:", captureError);
    }

    emitter.emit("render");
  });

  emitter.on("timelapse:start", () => {
    if (state.isTimelapseCapturing || state.cameraStatus !== "ready" || state.isPlaying) {
      return;
    }

    state.isTimelapseCapturing = true;

    const captureEveryInterval = async () => {
      if (timelapseCaptureInProgress || !state.isTimelapseCapturing) {
        return;
      }

      timelapseCaptureInProgress = true;

      try {
        await captureAndInsertFrameRecord();
      } catch (captureError) {
        console.error("Failed to capture timelapse frame:", captureError);
      } finally {
        timelapseCaptureInProgress = false;
        emitter.emit("render");
      }
    };

    state.timelapseTimerIdentifier = window.setInterval(
      captureEveryInterval,
      state.timelapseIntervalMilliseconds,
    );

    emitter.emit("render");
  });

  emitter.on("timelapse:stop", () => {
    if (!state.isTimelapseCapturing) {
      return;
    }

    stopTimelapseCaptureInterval();
    state.isTimelapseCapturing = false;
    emitter.emit("render");
  });

  emitter.on("frames:delete-selected", async () => {
    if (state.isPlaying || state.isTimelapseCapturing || !canDeleteSelectedFrame(state)) {
      return;
    }

    const deletionResult = deleteSelectedFrame({
      frames: state.frames,
      selectedTimelineItem: state.selectedTimelineItem,
    });

    state.frames = deletionResult.frames;
    state.selectedTimelineItem = deletionResult.selectedTimelineItem;

    try {
      await cleanupDeletedFrameAssets(deletionResult.deletedFrameRecord);
    } catch (deleteError) {
      console.error("Failed to clean up deleted frame assets:", deleteError);
    }

    emitter.emit("render");
  });

  emitter.on("playback:start", () => {
    if (state.isPlaying || state.isTimelapseCapturing || !canPlayFrames(state)) {
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

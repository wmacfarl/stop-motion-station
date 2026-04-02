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
  moveSelectedFrameByOffset,
  moveTimelineSelectionByOffset,
  ensureTimelineSelectionIsVisible,
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
    const captureFlowStartedAtMilliseconds = performance.now();

    const capturedFrameData = await measureAsyncOperationDuration({
      operationName: "camera-frame-capture",
      frameIdentifier,
      operation: () => cameraService.captureFrameRecordData(),
    });

    const originalFrameSaveResult = await measureAsyncOperationDuration({
      operationName: "original-frame-save",
      frameIdentifier,
      operation: () => frameStorageService.saveOriginalFrameBlob({
        frameId: frameIdentifier,
        blob: capturedFrameData.originalBlob,
      }),
    });

    const totalCaptureFlowDurationMilliseconds = performance.now()
      - captureFlowStartedAtMilliseconds;

    console.info("Frame capture flow timing", {
      frameIdentifier,
      captureDurationMilliseconds: capturedFrameData.captureDurationMilliseconds,
      originalFrameSaveDurationMilliseconds: originalFrameSaveResult.captureDurationMilliseconds,
      totalCaptureFlowDurationMilliseconds,
      originalBlobSizeInBytes: capturedFrameData.originalBlobSizeInBytes,
      timelineBlobSizeInBytes: capturedFrameData.timelineBlobSizeInBytes,
    });

    const capturedFrameRecordData = {
      id: frameIdentifier,
      timelineImageSource: capturedFrameData.timelineImageSource,
      previewImageSource: capturedFrameData.previewImageSource,
      originalStorageKey: originalFrameSaveResult.operationResult,
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
    updateVisibleTimelineWindowFromSelection();

    if (insertionResult.replacedFrameRecord) {
      try {
        await cleanupDeletedFrameAssets(insertionResult.replacedFrameRecord);
      } catch (replaceCleanupError) {
        console.error("Failed to clean up replaced frame assets:", replaceCleanupError);
      }
    }
  }

  async function measureAsyncOperationDuration({ operationName, frameIdentifier, operation }) {
    const operationStartedAtMilliseconds = performance.now();
    const operationResult = await operation();
    const captureDurationMilliseconds = performance.now() - operationStartedAtMilliseconds;

    console.info("Frame operation timing", {
      frameIdentifier,
      operationName,
      captureDurationMilliseconds,
    });

    return {
      operationResult,
      captureDurationMilliseconds,
      ...(typeof operationResult === "object" && operationResult !== null
        ? operationResult
        : {}),
    };
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

  function updateVisibleTimelineWindowFromSelection() {
    state.visibleTimelineStartPosition = ensureTimelineSelectionIsVisible({
      selectedTimelineItem: state.selectedTimelineItem,
      visibleTimelineStartPosition: state.visibleTimelineStartPosition,
      visibleTimelineItemCount: state.visibleTimelineItemCount,
    });
  }

  updateApplicationLayoutFromViewport();

  emitter.on("application:startup", async () => {
    const handleKeyboardShortcuts = (keyboardEvent) => {
      const keyPressed = keyboardEvent.key;

      if (keyboardEvent.code === "Space" || keyPressed === " ") {
        keyboardEvent.preventDefault();
        emitter.emit("frames:capture");
        return;
      }

      if (keyPressed === "ArrowLeft") {
        keyboardEvent.preventDefault();
        emitter.emit("timeline:move-selection-left");
        return;
      }

      if (keyPressed === "ArrowRight") {
        keyboardEvent.preventDefault();
        emitter.emit("timeline:move-selection-right");
        return;
      }

      if (keyPressed === "ArrowUp") {
        keyboardEvent.preventDefault();
        emitter.emit("playback:start");
      if (keyPressed === "ArrowDown") {
        keyboardEvent.preventDefault();
        emitter.emit("frames:delete-selected");
      }
    };

    const handleViewportChange = () => {
      emitter.emit("application:resize");
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);
    window.addEventListener("keydown", handleKeyboardShortcuts);
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
    updateVisibleTimelineWindowFromSelection();
    emitter.emit("render");
  });

  emitter.on("timeline:select-frame", (frameIndex) => {
    if (state.isPlaying || state.isTimelapseCapturing) {
      return;
    }

    state.selectedTimelineItem = { type: "frame", index: frameIndex };
    updateVisibleTimelineWindowFromSelection();
    emitter.emit("render");
  });

  emitter.on("timeline:move-selected-frame-left", () => {
    if (state.isPlaying || state.isTimelapseCapturing) {
      return;
    }

    const movementResult = moveSelectedFrameByOffset({
      frames: state.frames,
      selectedTimelineItem: state.selectedTimelineItem,
      movementOffset: -1,
    });

    if (!movementResult.didMoveFrame) {
      return;
    }

    state.frames = movementResult.frames;
    state.selectedTimelineItem = movementResult.selectedTimelineItem;
    updateVisibleTimelineWindowFromSelection();
    emitter.emit("render");
  });

  emitter.on("timeline:move-selected-frame-right", () => {
    if (state.isPlaying || state.isTimelapseCapturing) {
      return;
    }

    const movementResult = moveSelectedFrameByOffset({
      frames: state.frames,
      selectedTimelineItem: state.selectedTimelineItem,
      movementOffset: 1,
    });

    if (!movementResult.didMoveFrame) {
      return;
    }

    state.frames = movementResult.frames;
    state.selectedTimelineItem = movementResult.selectedTimelineItem;
    updateVisibleTimelineWindowFromSelection();
    emitter.emit("render");
  });

  emitter.on("timeline:move-selection-left", () => {
    if (state.isPlaying || state.isTimelapseCapturing) {
      return;
    }

    const movementResult = moveTimelineSelectionByOffset({
      frames: state.frames,
      selectedTimelineItem: state.selectedTimelineItem,
      movementOffset: -1,
    });

    if (!movementResult.didMoveSelection) {
      return;
    }

    state.selectedTimelineItem = movementResult.selectedTimelineItem;
    updateVisibleTimelineWindowFromSelection();
    emitter.emit("render");
  });

  emitter.on("timeline:move-selection-right", () => {
    if (state.isPlaying || state.isTimelapseCapturing) {
      return;
    }

    const movementResult = moveTimelineSelectionByOffset({
      frames: state.frames,
      selectedTimelineItem: state.selectedTimelineItem,
      movementOffset: 1,
    });

    if (!movementResult.didMoveSelection) {
      return;
    }

    state.selectedTimelineItem = movementResult.selectedTimelineItem;
    updateVisibleTimelineWindowFromSelection();
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
    updateVisibleTimelineWindowFromSelection();

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

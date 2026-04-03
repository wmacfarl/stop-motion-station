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

const ENABLE_KEYBOARD_DEBUG_LOGGING = true;

function attachGlobalKeyboardListener(emitter) {
  function log(...args) {
    if (ENABLE_KEYBOARD_DEBUG_LOGGING) {
      console.log("[KEYBOARD]", ...args);
    }
  }

  function handleKeyboardShortcuts(event) {
    log("keydown event received", {
      key: event.key,
      code: event.code,
      repeat: event.repeat,
      activeElement: document.activeElement?.tagName,
    });

    const key = event.key;
    const code = event.code;

    const isSpace =
      code === "Space" ||
      key === " " ||
      key === "Spacebar" ||
      key === "Space";

    if (isSpace) {
      log("ACTION: capture frame");
      event.preventDefault();
      emitter.emit("frames:capture");
      return;
    }

    if (key === "ArrowLeft") {
      log("ACTION: move left");
      event.preventDefault();
      emitter.emit("timeline:move-selection-left");
      return;
    }

    if (key === "ArrowRight") {
      log("ACTION: move right");
      event.preventDefault();
      emitter.emit("timeline:move-selection-right");
      return;
    }

    log("UNHANDLED KEY", key);
  }

  log("Attaching keyboard listeners");

  // Attach to document (primary)
  document.addEventListener("keydown", handleKeyboardShortcuts, {
    passive: false,
    capture: true,
  });

  // Attach to window (redundancy)
  window.addEventListener("keydown", handleKeyboardShortcuts, {
    passive: false,
    capture: true,
  });

  // Focus logging
  document.addEventListener("focusin", () => {
    log("focusin", document.activeElement);
  });

  document.addEventListener("focusout", () => {
    log("focusout", document.activeElement);
  });

  // Continuous focus visibility
  setInterval(() => {
    log("activeElement snapshot", document.activeElement);
  }, 2000);

  // Ensure body is focusable and focused
  document.body.tabIndex = 0;
  document.body.focus();

  // Re-focus on click (important on Pi)
  document.addEventListener("click", () => {
    log("click → forcing focus back to body");
    document.body.focus();
  });
}

export default function applicationStore(state, emitter) {
  Object.assign(state, createInitialApplicationState());
  attachGlobalKeyboardListener(emitter);

  let timelapseCaptureInProgress = false;
  let animationFrameIdentifierForTimelineScroll = null;

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
    updateTimelineScrollTargetAndClampCurrentOffset();
    animateTimelineScrollOffsetTowardsTargetIfNeeded();

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

  function updateVisibleTimelineScrollTargetFromSelection() {
    state.timelineScrollTargetOffsetInItemUnits = ensureTimelineSelectionIsVisible({
      selectedTimelineItem: state.selectedTimelineItem,
      currentTimelineScrollOffsetInItemUnits: state.timelineScrollTargetOffsetInItemUnits,
      visibleTimelineItemCount: state.visibleTimelineItemCount,
      frameCount: state.frames.length,
    });
  }

  function updateTimelineScrollTargetAndClampCurrentOffset() {
    updateVisibleTimelineScrollTargetFromSelection();

    const maximumTimelineScrollOffset = Math.max(
      0,
      (state.frames.length * 2) - state.visibleTimelineItemCount,
    );
    state.timelineScrollOffsetInItemUnits = Math.min(
      maximumTimelineScrollOffset,
      Math.max(0, state.timelineScrollOffsetInItemUnits),
    );
  }

  function animateTimelineScrollOffsetTowardsTargetIfNeeded() {
    if (animationFrameIdentifierForTimelineScroll !== null) {
      return;
    }

    const animateScrollStep = () => {
      animationFrameIdentifierForTimelineScroll = null;
      const timelineScrollDeltaInItemUnits =
        state.timelineScrollTargetOffsetInItemUnits - state.timelineScrollOffsetInItemUnits;

      if (Math.abs(timelineScrollDeltaInItemUnits) < 0.001) {
        state.timelineScrollOffsetInItemUnits = state.timelineScrollTargetOffsetInItemUnits;
        emitter.emit("render");
        return;
      }

      state.timelineScrollOffsetInItemUnits += timelineScrollDeltaInItemUnits * 0.2;
      emitter.emit("render");
      animationFrameIdentifierForTimelineScroll = window.requestAnimationFrame(animateScrollStep);
    };

    animationFrameIdentifierForTimelineScroll = window.requestAnimationFrame(animateScrollStep);
  }

  function focusApplicationRootForKeyboardInput() {
    const applicationRootElement = document.body;
    if (!applicationRootElement) {
      return;
    }

    if (applicationRootElement.tabIndex !== 0) {
      applicationRootElement.tabIndex = 0;
    }

    if (document.activeElement !== applicationRootElement) {
      applicationRootElement.focus();
    }
  }

  updateApplicationLayoutFromViewport();

  emitter.on("application:startup", async () => {
    const handleViewportChange = () => {
      emitter.emit("application:resize");
    };

    window.addEventListener("load", focusApplicationRootForKeyboardInput);
    window.addEventListener("click", focusApplicationRootForKeyboardInput);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);
    document.addEventListener("fullscreenchange", handleViewportChange);
    window.setInterval(focusApplicationRootForKeyboardInput, 1000);
    focusApplicationRootForKeyboardInput();

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
      window.setTimeout(focusApplicationRootForKeyboardInput, 0);
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
    updateTimelineScrollTargetAndClampCurrentOffset();
    animateTimelineScrollOffsetTowardsTargetIfNeeded();
    emitter.emit("render");
  });

  emitter.on("timeline:select-frame", (frameIndex) => {
    if (state.isPlaying || state.isTimelapseCapturing) {
      return;
    }

    state.selectedTimelineItem = { type: "frame", index: frameIndex };
    updateTimelineScrollTargetAndClampCurrentOffset();
    animateTimelineScrollOffsetTowardsTargetIfNeeded();
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
    updateTimelineScrollTargetAndClampCurrentOffset();
    animateTimelineScrollOffsetTowardsTargetIfNeeded();
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
    updateTimelineScrollTargetAndClampCurrentOffset();
    animateTimelineScrollOffsetTowardsTargetIfNeeded();
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
    updateTimelineScrollTargetAndClampCurrentOffset();
    animateTimelineScrollOffsetTowardsTargetIfNeeded();
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
    updateTimelineScrollTargetAndClampCurrentOffset();
    animateTimelineScrollOffsetTowardsTargetIfNeeded();
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
    updateTimelineScrollTargetAndClampCurrentOffset();
    animateTimelineScrollOffsetTowardsTargetIfNeeded();

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

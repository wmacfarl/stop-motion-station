export function createInitialApplicationState() {
  return {
    cameraStatus: "idle",
    cameraErrorMessage: null,
    frames: [],
    selectedTimelineItem: {
      type: "gap",
      index: 0,
    },
    isPlaying: false,
    playbackFrameIndex: null,
    isTimelapseCapturing: false,
    timelapseIntervalMilliseconds: 500,
    timelapseTimerIdentifier: null,
    appSurfaceLayout: {
      width: 0,
      height: 0,
      previewWidth: 0,
      previewHeight: 0,
      controlsWidth: 0,
      timelineHeight: 0,
    },
  };
}

function createFrameRecord({
  id,
  timelineImageSource,
  previewImageSource,
  originalStorageKey,
  width,
  height,
}) {
  return {
    id,
    timelineImageSource,
    previewImageSource,
    originalStorageKey,
    width,
    height,
  };
}

export function insertCapturedFrameAtCurrentSelection({
  frames,
  selectedTimelineItem,
  capturedFrameRecordData,
}) {
  const newFrameRecord = createFrameRecord(capturedFrameRecordData);

  const insertIndex = selectedTimelineItem.type === "gap"
    ? selectedTimelineItem.index
    : selectedTimelineItem.index + 1;

  const updatedFrames = [...frames];
  updatedFrames.splice(insertIndex, 0, newFrameRecord);

  return {
    frames: updatedFrames,
    selectedTimelineItem: {
      type: "frame",
      index: insertIndex,
    },
  };
}

export function deleteSelectedFrame({ frames, selectedTimelineItem }) {
  if (selectedTimelineItem.type !== "frame") {
    return {
      frames,
      selectedTimelineItem,
      deletedFrameRecord: null,
    };
  }

  const frameIndexToDelete = selectedTimelineItem.index;
  const updatedFrames = [...frames];
  const [deletedFrameRecord] = updatedFrames.splice(frameIndexToDelete, 1);

  return {
    frames: updatedFrames,
    selectedTimelineItem: {
      type: "gap",
      index: frameIndexToDelete,
    },
    deletedFrameRecord,
  };
}

export function canDeleteSelectedFrame(state) {
  return state.selectedTimelineItem.type === "frame";
}

export function canPlayFrames(state) {
  return state.frames.length > 0;
}

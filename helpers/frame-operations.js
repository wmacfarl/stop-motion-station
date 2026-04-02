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
  const updatedFrames = [...frames];
  let capturedFrameIndex = selectedTimelineItem.index;
  let replacedFrameRecord = null;

  if (selectedTimelineItem.type === "gap") {
    updatedFrames.splice(capturedFrameIndex, 0, newFrameRecord);
  } else {
    replacedFrameRecord = updatedFrames[capturedFrameIndex] || null;
    updatedFrames[capturedFrameIndex] = newFrameRecord;
  }

  return {
    frames: updatedFrames,
    selectedTimelineItem: {
      type: "gap",
      index: capturedFrameIndex + 1,
    },
    replacedFrameRecord,
  };
}

export function deleteSelectedFrame({ frames, selectedTimelineItem }) {
  const selectionIsFrame = selectedTimelineItem.type === "frame";
  const selectionIsGapWithFrameBehindIt = selectedTimelineItem.type === "gap"
    && selectedTimelineItem.index > 0;

  if (!selectionIsFrame && !selectionIsGapWithFrameBehindIt) {
    return {
      frames,
      selectedTimelineItem,
      deletedFrameRecord: null,
    };
  }

  const frameIndexToDelete = selectionIsFrame
    ? selectedTimelineItem.index
    : selectedTimelineItem.index - 1;
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
  if (state.selectedTimelineItem.type === "frame") {
    return true;
  }

  return state.selectedTimelineItem.type === "gap"
    && state.selectedTimelineItem.index > 0;
}

export function canPlayFrames(state) {
  return state.frames.length > 0;
}

export function moveSelectedFrameByOffset({ frames, selectedTimelineItem, movementOffset }) {
  if (selectedTimelineItem.type !== "frame") {
    return {
      frames,
      selectedTimelineItem,
      didMoveFrame: false,
    };
  }

  const currentFrameIndex = selectedTimelineItem.index;
  const nextFrameIndex = currentFrameIndex + movementOffset;

  if (nextFrameIndex < 0 || nextFrameIndex >= frames.length) {
    return {
      frames,
      selectedTimelineItem,
      didMoveFrame: false,
    };
  }

  const reorderedFrames = [...frames];
  const frameRecordBeingMoved = reorderedFrames[currentFrameIndex];
  reorderedFrames[currentFrameIndex] = reorderedFrames[nextFrameIndex];
  reorderedFrames[nextFrameIndex] = frameRecordBeingMoved;

  return {
    frames: reorderedFrames,
    selectedTimelineItem: {
      type: "frame",
      index: nextFrameIndex,
    },
    didMoveFrame: true,
  };
}

function getSelectionPositionOnTimeline(selectedTimelineItem) {
  return selectedTimelineItem.type === "gap"
    ? selectedTimelineItem.index * 2
    : (selectedTimelineItem.index * 2) + 1;
}

function createTimelineSelectionFromPosition(selectionPositionOnTimeline) {
  if (selectionPositionOnTimeline % 2 === 0) {
    return {
      type: "gap",
      index: selectionPositionOnTimeline / 2,
    };
  }

  return {
    type: "frame",
    index: (selectionPositionOnTimeline - 1) / 2,
  };
}

export function moveTimelineSelectionByOffset({ frames, selectedTimelineItem, movementOffset }) {
  const currentSelectionPositionOnTimeline = getSelectionPositionOnTimeline(selectedTimelineItem);
  const maximumSelectionPositionOnTimeline = frames.length * 2;
  const nextSelectionPositionOnTimeline = currentSelectionPositionOnTimeline + movementOffset;

  if (
    nextSelectionPositionOnTimeline < 0
    || nextSelectionPositionOnTimeline > maximumSelectionPositionOnTimeline
  ) {
    return {
      selectedTimelineItem,
      didMoveSelection: false,
    };
  }

  return {
    selectedTimelineItem: createTimelineSelectionFromPosition(nextSelectionPositionOnTimeline),
    didMoveSelection: true,
  };
}

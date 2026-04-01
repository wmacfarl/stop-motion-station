export function createInitialApplicationState() {
  return {
    cameraStatus: "booting",
    cameraErrorMessage: null,
    frames: [],
    selectedTimelineItem: {
      type: "gap",
      index: 0,
    },
    isPlaying: false,
    playbackFrameIndex: null,
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

function createFrameRecord(imageSource) {
  return {
    id: `frame-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    imageSource,
  };
}

export function insertCapturedFrameAtCurrentSelection({
  frames,
  selectedTimelineItem,
  capturedFrameImageSource,
}) {
  const newFrameRecord = createFrameRecord(capturedFrameImageSource);

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
    };
  }

  const frameIndexToDelete = selectedTimelineItem.index;
  const updatedFrames = [...frames];
  updatedFrames.splice(frameIndexToDelete, 1);

  return {
    frames: updatedFrames,
    selectedTimelineItem: {
      type: "gap",
      index: frameIndexToDelete,
    },
  };
}

export function canDeleteSelectedFrame(state) {
  return state.selectedTimelineItem.type === "frame";
}

export function canPlayFrames(state) {
  return state.frames.length > 0;
}

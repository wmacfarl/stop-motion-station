export default function createInitialState() {
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

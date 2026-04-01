const applicationAspectRatio = 16 / 9;
const surfaceMarginRatio = 0.04;
const controlsWidthRatio = 0.18;
const timelineHeightRatio = 0.2;

export function computeApplicationSurfaceLayout({
  viewportWidth,
  viewportHeight,
}) {
  const usableViewportWidth = viewportWidth * (1 - surfaceMarginRatio * 2);
  const usableViewportHeight = viewportHeight * (1 - surfaceMarginRatio * 2);

  let applicationSurfaceWidth = usableViewportWidth;
  let applicationSurfaceHeight = applicationSurfaceWidth / applicationAspectRatio;

  if (applicationSurfaceHeight > usableViewportHeight) {
    applicationSurfaceHeight = usableViewportHeight;
    applicationSurfaceWidth = applicationSurfaceHeight * applicationAspectRatio;
  }

  const controlsWidth = Math.round(applicationSurfaceWidth * controlsWidthRatio);
  const timelineHeight = Math.round(applicationSurfaceHeight * timelineHeightRatio);

  const previewWidth = applicationSurfaceWidth - controlsWidth;
  const previewHeight = applicationSurfaceHeight - timelineHeight;

  return {
    width: Math.round(applicationSurfaceWidth),
    height: Math.round(applicationSurfaceHeight),
    previewWidth: Math.round(previewWidth),
    previewHeight: Math.round(previewHeight),
    controlsWidth,
    timelineHeight,
  };
}

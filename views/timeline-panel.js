function renderGapButton(state, emit, gapIndex) {
  const gapIsSelected = state.selectedTimelineItem.type === "gap"
    && state.selectedTimelineItem.index === gapIndex;

  return html`
    <button
      class=${`timeline-gap ${gapIsSelected ? "is-selected" : ""}`}
      onclick=${() => emit("timeline:select-gap", gapIndex)}
      aria-label=${`Select insertion point ${gapIndex}`}
    ></button>
  `;
}

function renderFrameButton(state, emit, frame, frameIndex) {
  const frameIsSelected = state.selectedTimelineItem.type === "frame"
    && state.selectedTimelineItem.index === frameIndex;
  const frameIsPlaying = state.isPlaying && state.playbackFrameIndex === frameIndex;

  const frameButtonClassNames = ["timeline-frame"];

  if (frameIsSelected) {
    frameButtonClassNames.push("is-selected");
  }

  if (frameIsPlaying) {
    frameButtonClassNames.push("is-playing");
  }

  return html`
    <button
      class=${frameButtonClassNames.join(" ")}
      onclick=${() => emit("timeline:select-frame", frameIndex)}
      aria-label=${`Select frame ${frameIndex + 1}`}
    >
      <img
        src=${frame.timelineImageSource}
        draggable="false"
        alt=${`Frame ${frameIndex + 1}`}
      />
    </button>
  `;
}

export default function timelinePanel(state, emit) {
  const { width, timelineHeight } = state.appSurfaceLayout;
  const allTimelineItems = [];

  for (let gapIndex = 0; gapIndex <= state.frames.length; gapIndex += 1) {
    allTimelineItems.push(renderGapButton(state, emit, gapIndex));

    if (gapIndex < state.frames.length) {
      allTimelineItems.push(renderFrameButton(state, emit, state.frames[gapIndex], gapIndex));
    }
  }

  const firstVisibleTimelinePosition = state.visibleTimelineStartPosition;
  const onePastLastVisibleTimelinePosition =
    state.visibleTimelineStartPosition + state.visibleTimelineItemCount;
  const visibleTimelineItems = allTimelineItems.slice(
    firstVisibleTimelinePosition,
    onePastLastVisibleTimelinePosition,
  );

  return html`
    <section class="timeline-panel" style=${`width: ${width}px; height: ${timelineHeight}px;`}>
      <div class="timeline-scroll-strip">
        ${visibleTimelineItems}
      </div>
    </section>
  `;
}

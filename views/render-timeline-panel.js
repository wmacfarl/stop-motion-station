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

  return html`
    <button
      class=${`timeline-frame ${frameIsSelected ? "is-selected" : ""}`}
      onclick=${() => emit("timeline:select-frame", frameIndex)}
      aria-label=${`Select frame ${frameIndex + 1}`}
    >
      <img src=${frame.imageSource} draggable="false" alt=${`Frame ${frameIndex + 1}`} />
    </button>
  `;
}

export default function renderTimelinePanel(state, emit) {
  const { width, timelineHeight } = state.appSurfaceLayout;
  const timelineItems = [];

  for (let gapIndex = 0; gapIndex <= state.frames.length; gapIndex += 1) {
    timelineItems.push(renderGapButton(state, emit, gapIndex));

    if (gapIndex < state.frames.length) {
      timelineItems.push(renderFrameButton(state, emit, state.frames[gapIndex], gapIndex));
    }
  }

  return html`
    <section
      class="timeline-panel"
      style=${`width: ${width}px; height: ${timelineHeight}px;`}
    >
      <div class="timeline-scroll-strip">
        ${timelineItems}
      </div>
    </section>
  `;
}

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
  const timelineItems = [];

  const keepActiveTimelineItemInView = (timelineScrollStripElement) => {
    if (!timelineScrollStripElement) {
      return;
    }

    const selectedTimelineElement = timelineScrollStripElement.querySelector(".is-selected");
    const playbackTimelineElement = timelineScrollStripElement.querySelector(".is-playing");
    const timelineElementToKeepVisible = selectedTimelineElement || playbackTimelineElement;

    if (!timelineElementToKeepVisible) {
      return;
    }

    timelineElementToKeepVisible.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  };

  for (let gapIndex = 0; gapIndex <= state.frames.length; gapIndex += 1) {
    timelineItems.push(renderGapButton(state, emit, gapIndex));

    if (gapIndex < state.frames.length) {
      timelineItems.push(renderFrameButton(state, emit, state.frames[gapIndex], gapIndex));
    }
  }

  return html`
    <section class="timeline-panel" style=${`width: ${width}px; height: ${timelineHeight}px;`}>
      <div
        class="timeline-scroll-strip"
        onload=${(timelineScrollStripElement) => keepActiveTimelineItemInView(timelineScrollStripElement)}
        onupdate=${(timelineScrollStripElement) => keepActiveTimelineItemInView(timelineScrollStripElement)}
      >
        ${timelineItems}
      </div>
    </section>
  `;
}

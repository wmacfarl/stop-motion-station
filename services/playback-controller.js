class PlaybackController {
  constructor() {
    this.timeoutIdentifier = null;
    this.isPlaying = false;
  }

  playFrames({ frames, framesPerSecond, onFrameChange, onComplete }) {
    this.stop();

    if (!frames.length) {
      return;
    }

    this.isPlaying = true;

    const frameDurationInMilliseconds = 1000 / framesPerSecond;
    let currentFrameIndex = 0;

    const continuePlayback = () => {
      if (!this.isPlaying) {
        return;
      }

      onFrameChange(currentFrameIndex);
      currentFrameIndex += 1;

      if (currentFrameIndex >= frames.length) {
        this.isPlaying = false;
        this.timeoutIdentifier = null;
        onComplete();
        return;
      }

      this.timeoutIdentifier = window.setTimeout(
        continuePlayback,
        frameDurationInMilliseconds,
      );
    };

    continuePlayback();
  }

  stop() {
    this.isPlaying = false;

    if (this.timeoutIdentifier !== null) {
      window.clearTimeout(this.timeoutIdentifier);
      this.timeoutIdentifier = null;
    }
  }
}

const playbackController = new PlaybackController();

export default playbackController;

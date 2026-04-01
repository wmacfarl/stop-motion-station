class CameraService {
  constructor() {
    console.log("Initializing camera service...");
    this.videoElement = document.createElement("video");
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;

    this.captureCanvasElement = document.createElement("canvas");
    this.mediaStream = null;
    this.hasStartedPreview = false;
    this.startPreviewPromise = null;
  }

  async startPreview() {
    if (this.hasStartedPreview) {
      return;
    }

    if (this.startPreviewPromise) {
      return this.startPreviewPromise;
    }

    this.startPreviewPromise = this.startPreviewInternal();

    try {
      await this.startPreviewPromise;
      this.hasStartedPreview = true;
    } finally {
      this.startPreviewPromise = null;
    }
  }

  async startPreviewInternal() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        "Camera API unavailable. Use HTTPS or localhost in a supported browser.",
      );
    }
    const requestedAspectRatio = 16 / 9;

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        aspectRatio: { ideal: requestedAspectRatio },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    const videoTrack = this.mediaStream.getVideoTracks()[0];
    console.log("initial settings:", videoTrack.getSettings());

    try {
      await videoTrack.applyConstraints({
        aspectRatio: { ideal: requestedAspectRatio },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      });
      console.log("after applyConstraints:", videoTrack.getSettings());
    } catch (error) {
      console.warn("Could not raise resolution:", error);
    }
    this.videoElement.srcObject = this.mediaStream;
  }

  getVideoElement() {
    return this.videoElement;
  }

  ensurePreviewIsPlaying() {
    if (!this.videoElement.srcObject) {
      return;
    }

    this.videoElement.muted = true;
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;

    if (this.videoElement.paused) {
      this.videoElement.play().catch((previewPlaybackError) => {
        console.error(
          "Failed to start preview playback:",
          previewPlaybackError,
        );
      });
    }
  }

  captureCurrentFrameImageSource() {
    const frameWidth = this.videoElement.videoWidth;
    const frameHeight = this.videoElement.videoHeight;

    this.captureCanvasElement.width = frameWidth;
    this.captureCanvasElement.height = frameHeight;

    const renderingContext = this.captureCanvasElement.getContext("2d");
    renderingContext.drawImage(
      this.videoElement,
      0,
      0,
      frameWidth,
      frameHeight,
    );

    return this.captureCanvasElement.toDataURL("image/png");
  }
}

const cameraService = new CameraService();
window.cameraService = cameraService;
export default cameraService;

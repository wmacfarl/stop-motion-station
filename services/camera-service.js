class CameraService {
  constructor() {
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
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
  //      width: { ideal: 1280 },
  //      height: { ideal: 720 },
      },
      audio: false,
    });

    this.videoElement.srcObject = this.mediaStream;

    try {
      await this.videoElement.play();
    } catch (cameraPreviewPlaybackError) {
      // Some environments only begin playback after the video element is mounted in the document.
      // We intentionally continue and retry from the preview rendering path.
    }
  }

  getVideoElement() {
    return this.videoElement;
  }

  ensurePreviewIsPlaying() {
    if (!this.videoElement.srcObject) {
      return;
    }

    if (this.videoElement.paused) {
      this.videoElement.play().catch(() => {});
    }
  }

  captureCurrentFrameImageSource() {
    const frameWidth = this.videoElement.videoWidth;
    const frameHeight = this.videoElement.videoHeight;

    if (!frameWidth || !frameHeight) {
      throw new Error("Camera preview is not ready to capture a frame yet.");
    }

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

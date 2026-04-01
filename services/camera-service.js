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
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Camera API unavailable. Use HTTPS or localhost in a supported browser.");
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    this.videoElement.srcObject = this.mediaStream;

    await new Promise((resolve, reject) => {
      const handleLoadedMetadata = () => {
        this.videoElement.play().then(resolve).catch(reject);
      };

      this.videoElement.addEventListener(
        "loadedmetadata",
        handleLoadedMetadata,
        {
          once: true,
        },
      );
    });

    await new Promise((resolve) => {
      const verifyVideoIsProducingFrames = () => {
        if (
          this.videoElement.videoWidth > 0 &&
          this.videoElement.videoHeight > 0 &&
          this.videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        ) {
          resolve();
          return;
        }

        window.requestAnimationFrame(verifyVideoIsProducingFrames);
      };

      verifyVideoIsProducingFrames();
    });
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

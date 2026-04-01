export default function createFrameId() {
  return `frame-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

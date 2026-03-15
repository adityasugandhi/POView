/**
 * AudioWorklet processor for mic capture.
 * Converts float32 samples → int16 PCM and posts buffered chunks.
 */
class AudioRecordingProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Int16Array(2048);
    this._bufferIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0];
    for (let i = 0; i < samples.length; i++) {
      // Convert float32 [-1, 1] → int16 [-32768, 32767]
      const s = Math.max(-1, Math.min(1, samples[i]));
      this._buffer[this._bufferIndex++] = s < 0 ? s * 32768 : s * 32767;

      if (this._bufferIndex >= this._buffer.length) {
        // Post a copy — the buffer gets reused
        this.port.postMessage(this._buffer.slice(0));
        this._bufferIndex = 0;
      }
    }
    return true;
  }
}

registerProcessor("audio-recording-processor", AudioRecordingProcessor);

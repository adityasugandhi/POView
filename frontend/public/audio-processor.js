/**
 * AudioWorklet processor for capturing PCM audio from the microphone
 * and sending it as Int16 binary chunks to the WebSocket.
 *
 * Input:  whatever sample rate the AudioContext uses (requested 16kHz)
 * Output: Int16 PCM chunks posted to the main thread via port.postMessage
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(0);
    // Flush every 4096 samples (~256ms at 16kHz)
    this._flushSize = 4096;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // mono

    // Accumulate samples
    const newBuf = new Float32Array(this._buffer.length + channelData.length);
    newBuf.set(this._buffer);
    newBuf.set(channelData, this._buffer.length);
    this._buffer = newBuf;

    // Flush when we have enough
    while (this._buffer.length >= this._flushSize) {
      const chunk = this._buffer.slice(0, this._flushSize);
      this._buffer = this._buffer.slice(this._flushSize);

      // Convert Float32 to Int16
      const int16 = new Int16Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      this.port.postMessage(int16.buffer, [int16.buffer]);
    }

    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);

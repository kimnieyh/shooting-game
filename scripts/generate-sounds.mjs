// Procedurally generates 8-bit chiptune sound effects for Stella Shooter.
// Run with: node scripts/generate-sounds.mjs
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "sounds");
fs.mkdirSync(OUT_DIR, { recursive: true });

// WAV file writer
class WavWriter {
  constructor(sampleRate = 44100, numChannels = 1, bitsPerSample = 16) {
    this.sampleRate = sampleRate;
    this.numChannels = numChannels;
    this.bitsPerSample = bitsPerSample;
    this.samples = [];
  }

  addSample(value) {
    // Clamp to valid range
    const clamped = Math.max(-1, Math.min(1, value));
    const int16 = Math.floor(clamped * 32767);
    this.samples.push(int16);
  }

  getBuffer() {
    const bytesPerSample = this.bitsPerSample / 8;
    const dataSize = this.samples.length * bytesPerSample * this.numChannels;
    const buffer = Buffer.alloc(44 + dataSize);

    // WAV header
    const write = (offset, data, size) => {
      if (typeof data === "string") {
        for (let i = 0; i < data.length; i++) {
          buffer[offset + i] = data.charCodeAt(i);
        }
      } else {
        buffer.writeUIntLE(data, offset, size);
      }
    };

    write(0, "RIFF", 4);
    write(4, 36 + dataSize, 4);
    write(8, "WAVE", 4);
    write(12, "fmt ", 4);
    write(16, 16, 4); // fmt chunk size
    write(20, 1, 2); // PCM format
    write(22, this.numChannels, 2);
    write(24, this.sampleRate, 4);
    write(28, this.sampleRate * this.numChannels * bytesPerSample, 4);
    write(32, this.numChannels * bytesPerSample, 2);
    write(34, this.bitsPerSample, 2);
    write(36, "data", 4);
    write(40, dataSize, 4);

    // Write audio samples
    for (let i = 0; i < this.samples.length; i++) {
      buffer.writeInt16LE(this.samples[i], 44 + i * 2);
    }

    return buffer;
  }
}

// Simple waveform generators
function squareWave(freq, duration, sampleRate) {
  const samples = Math.floor(duration * sampleRate);
  const period = sampleRate / freq;
  const result = [];
  for (let i = 0; i < samples; i++) {
    result.push((i % period) < period / 2 ? 1 : -1);
  }
  return result;
}

function triangleWave(freq, duration, sampleRate) {
  const samples = Math.floor(duration * sampleRate);
  const period = sampleRate / freq;
  const result = [];
  for (let i = 0; i < samples; i++) {
    const phase = (i % period) / period;
    result.push(phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase);
  }
  return result;
}

function sineWave(freq, duration, sampleRate) {
  const samples = Math.floor(duration * sampleRate);
  const result = [];
  for (let i = 0; i < samples; i++) {
    result.push(Math.sin((2 * Math.PI * freq * i) / sampleRate));
  }
  return result;
}

function whiteNoise(duration, sampleRate) {
  const samples = Math.floor(duration * sampleRate);
  const result = [];
  for (let i = 0; i < samples; i++) {
    result.push(Math.random() * 2 - 1);
  }
  return result;
}

// Envelope envelope (ADSR simplified)
function applyEnvelope(samples, attack, decay, sampleRate) {
  const attackSamples = Math.floor(attack * sampleRate);
  const decaySamples = Math.floor(decay * sampleRate);
  const result = [];

  for (let i = 0; i < samples.length; i++) {
    let envelope = 1;

    if (i < attackSamples) {
      // Attack phase
      envelope = i / attackSamples;
    } else if (i < attackSamples + decaySamples) {
      // Decay phase
      const decayProgress = (i - attackSamples) / decaySamples;
      envelope = 1 - decayProgress * 0.7; // Decay to 0.3 sustain
    } else {
      // Release
      const releaseStart = attackSamples + decaySamples;
      envelope = Math.max(0, 0.3 - (i - releaseStart) / (sampleRate * 0.1));
    }

    result.push(samples[i] * envelope);
  }

  return result;
}

function saveWav(samples, filename) {
  const writer = new WavWriter(44100, 1, 16);
  for (const sample of samples) {
    writer.addSample(sample);
  }
  const buffer = writer.getBuffer();
  const filePath = path.join(OUT_DIR, `${filename}.wav`);
  fs.writeFileSync(filePath, buffer);
  console.log("wrote", filePath);
}

// ========== SFX Generators ==========

// 1. UI select sound - bright beep
function generateUISelectSound() {
  const freq = 880; // A5
  const duration = 0.1;
  const samples = squareWave(freq, duration, 44100);
  return applyEnvelope(samples, 0.01, 0.08, 44100);
}

// 2. Player shoot sound - punchy laser
function generatePlayerShootSound() {
  const duration = 0.08;
  // Start high, sweep down slightly
  const sampleRate = 44100;
  const totalSamples = Math.floor(duration * sampleRate);
  const samples = [];

  for (let i = 0; i < totalSamples; i++) {
    const progress = i / totalSamples;
    const freq = 1200 - progress * 300; // Sweep from 1200 to 900 Hz
    const phase = (2 * Math.PI * freq * i) / sampleRate;
    samples.push(Math.sin(phase));
  }

  return applyEnvelope(samples, 0.01, 0.07, sampleRate);
}

// 3. Enemy shoot sound - slightly lower pitch
function generateEnemyShootSound() {
  const duration = 0.12;
  const sampleRate = 44100;
  const totalSamples = Math.floor(duration * sampleRate);
  const samples = [];

  for (let i = 0; i < totalSamples; i++) {
    const progress = i / totalSamples;
    const freq = 900 - progress * 200; // Sweep from 900 to 700 Hz
    const phase = (2 * Math.PI * freq * i) / sampleRate;
    samples.push(Math.sin(phase) * 0.8);
  }

  return applyEnvelope(samples, 0.02, 0.1, sampleRate);
}

// 4. Hit sound (enemy hit but not dead) - short beep
function generateHitSound() {
  const freq = 660; // E5
  const duration = 0.06;
  const samples = squareWave(freq, duration, 44100);
  return applyEnvelope(samples, 0.005, 0.055, 44100);
}

// 5. Explosion sound - noise burst with pitch
function generateExplosionSound() {
  const duration = 0.2;
  const sampleRate = 44100;
  const noise = whiteNoise(duration, sampleRate);
  const totalSamples = Math.floor(duration * sampleRate);

  // Mix in a quick bass rumble
  const bass = [];
  for (let i = 0; i < totalSamples; i++) {
    const freq = 200 - (i / totalSamples) * 150; // Sweep down
    const phase = (2 * Math.PI * freq * i) / sampleRate;
    bass.push(Math.sin(phase) * 0.5);
  }

  const combined = noise.map((n, i) => (n + bass[i]) / 2);
  return applyEnvelope(combined, 0.02, 0.18, sampleRate);
}

// 6. Player damage sound - descending beep
function generatePlayerDamageSound() {
  const duration = 0.15;
  const sampleRate = 44100;
  const totalSamples = Math.floor(duration * sampleRate);
  const samples = [];

  for (let i = 0; i < totalSamples; i++) {
    const progress = i / totalSamples;
    const freq = 600 - progress * 400; // Sweep from 600 to 200 Hz
    samples.push(squareWave(freq, 0.001, sampleRate)[0]);
  }

  return applyEnvelope(samples, 0.01, 0.14, sampleRate);
}

// 7. Shield block sound - rising protective tone
function generateShieldBlockSound() {
  const duration = 0.1;
  const sampleRate = 44100;
  const totalSamples = Math.floor(duration * sampleRate);
  const samples = [];

  for (let i = 0; i < totalSamples; i++) {
    const progress = i / totalSamples;
    const freq = 800 + progress * 400; // Sweep from 800 to 1200 Hz (rising!)
    const phase = (2 * Math.PI * freq * i) / sampleRate;
    samples.push(Math.sin(phase));
  }

  return applyEnvelope(samples, 0.01, 0.09, sampleRate);
}

// 8. Item pickup sound - cheerful ascending
function generateItemPickupSound() {
  const duration = 0.15;
  const sampleRate = 44100;
  const totalSamples = Math.floor(duration * sampleRate);
  const samples = [];

  for (let i = 0; i < totalSamples; i++) {
    const progress = i / totalSamples;
    const freq = 600 + progress * 500; // Sweep from 600 to 1100 Hz
    const phase = (2 * Math.PI * freq * i) / sampleRate;
    samples.push(Math.sin(phase));
  }

  return applyEnvelope(samples, 0.02, 0.13, sampleRate);
}

// 9. Game over sound - sad descending chord
function generateGameOverSound() {
  const duration = 0.4;
  const sampleRate = 44100;
  const totalSamples = Math.floor(duration * sampleRate);
  const samples = [];

  for (let i = 0; i < totalSamples; i++) {
    const progress = i / totalSamples;
    // Play two tones together (chord)
    const freq1 = 400 - progress * 300;
    const freq2 = 300 - progress * 200;
    const phase1 = (2 * Math.PI * freq1 * i) / sampleRate;
    const phase2 = (2 * Math.PI * freq2 * i) / sampleRate;
    samples.push((Math.sin(phase1) + Math.sin(phase2)) / 2);
  }

  return applyEnvelope(samples, 0.05, 0.35, sampleRate);
}

// BGM sounds (simple but musical loops)

// Title BGM - calm and welcoming
function generateTitleBGM() {
  const sampleRate = 44100;
  const duration = 4; // 4 second loop
  const totalSamples = Math.floor(duration * sampleRate);
  const samples = [];

  const melody = [
    { freq: 330, duration: 0.5 }, // E4
    { freq: 392, duration: 0.5 }, // G4
    { freq: 494, duration: 0.5 }, // B4
    { freq: 440, duration: 0.5 }, // A4
    { freq: 392, duration: 1 }, // G4 (longer)
    { freq: 330, duration: 0.5 }, // E4
    { freq: 392, duration: 0.5 }, // G4
    { freq: 440, duration: 1 }, // A4
  ];

  let currentSample = 0;
  for (const note of melody) {
    const noteSamples = Math.floor(note.duration * sampleRate);
    const wave = sineWave(note.freq, note.duration, sampleRate);
    const enveloped = applyEnvelope(wave, 0.05, note.duration - 0.05, sampleRate);

    for (const sample of enveloped) {
      if (currentSample < totalSamples) {
        samples.push(sample * 0.7);
        currentSample++;
      }
    }
  }

  // Pad to full duration
  while (samples.length < totalSamples) {
    samples.push(0);
  }

  return samples.slice(0, totalSamples);
}

// Game BGM - upbeat, energetic
function generateGameBGM() {
  const sampleRate = 44100;
  const duration = 4; // 4 second loop
  const totalSamples = Math.floor(duration * sampleRate);
  const samples = [];

  // Fast paced melody
  const melody = [
    { freq: 440, duration: 0.25 }, // A4
    { freq: 494, duration: 0.25 }, // B4
    { freq: 523, duration: 0.25 }, // C5
    { freq: 587, duration: 0.25 }, // D5
    { freq: 523, duration: 0.25 }, // C5
    { freq: 494, duration: 0.25 }, // B4
    { freq: 440, duration: 0.5 }, // A4
    { freq: 392, duration: 0.5 }, // G4
  ];

  let currentSample = 0;
  for (const note of melody) {
    const noteSamples = Math.floor(note.duration * sampleRate);
    const wave = triangleWave(note.freq, note.duration, sampleRate);
    const enveloped = applyEnvelope(wave, 0.02, note.duration - 0.02, sampleRate);

    for (const sample of enveloped) {
      if (currentSample < totalSamples) {
        samples.push(sample * 0.6);
        currentSample++;
      }
    }
  }

  // Repeat pattern
  const firstLoop = samples.slice(0, currentSample);
  while (samples.length < totalSamples) {
    for (const sample of firstLoop) {
      if (samples.length < totalSamples) {
        samples.push(sample);
      }
    }
  }

  return samples.slice(0, totalSamples);
}


// 10. Boss throw sound - gravelly growl for comic villain
function generateBossThrowSound() {
  const duration = 0.4; // 400ms - short and punchy
  const sampleRate = 44100;
  const totalSamples = Math.floor(duration * sampleRate);
  const samples = [];

  // Main bass growl with sine + square mix and pitch bend
  for (let i = 0; i < totalSamples; i++) {
    const progress = i / totalSamples;
    // Start at 120Hz, sweep down to 80Hz (low, menacing but comic)
    const baseFreq = 120 - progress * 40;
    // Add vibrato for "grumbling" effect - 6 vibrato cycles create the "우어어" tremolo
    const vibrato = Math.sin(progress * Math.PI * 6) * 15;
    const freq = baseFreq + vibrato;
    const phase = (2 * Math.PI * freq * i) / sampleRate;
    
    // Mix sine (smooth, tonal) and square (harsh, gritty)
    const sine = Math.sin(phase);
    const square = (phase % (2 * Math.PI)) < Math.PI ? 1 : -1;
    samples.push(sine * 0.6 + square * 0.2);
  }

  // Mix in white noise for additional grittiness (20% noise for texture)
  for (let i = 0; i < totalSamples; i++) {
    const noise = Math.random() * 2 - 1;
    samples[i] = samples[i] * 0.8 + noise * 0.2;
  }

  return applyEnvelope(samples, 0.02, 0.38, sampleRate);
}

// ========== Generate all sounds ==========

console.log("Generating sound effects...");

saveWav(generateUISelectSound(), "ui_select");
saveWav(generatePlayerShootSound(), "player_shoot");
saveWav(generateEnemyShootSound(), "enemy_shoot");
saveWav(generateHitSound(), "hit");
saveWav(generateExplosionSound(), "explosion");
saveWav(generatePlayerDamageSound(), "player_damage");
saveWav(generateShieldBlockSound(), "shield_block");
saveWav(generateItemPickupSound(), "item_pickup");
saveWav(generateGameOverSound(), "game_over");
saveWav(generateTitleBGM(), "bgm_title");
saveWav(generateGameBGM(), "bgm_game");

saveWav(generateBossThrowSound(), "boss_throw");

console.log("All sounds generated in", OUT_DIR);

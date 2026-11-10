import { Howl, Howler } from 'howler';

export type SoundEffectName =
  | 'dice'
  | 'ak47'
  | 'pistol'
  | 'shotgun'
  | 'sniper'
  | 'reload'
  | 'footstep'
  | 'impact'
  | 'grenade'
  | 'pickup'
  | 'victory'
  | 'defeat'
  | 'click'
  | 'hit'
  | 'kill_voice';

/**
 * Generates an in-memory 16-bit PCM WAV data URI so Howler.js (`Howl`) plays zero-latency,
 * zero-404 procedural military sound effects across all desktop and mobile browsers.
 */
function buildWavDataUri(
  durationSec: number,
  sampleFn: (t: number, i: number, sr: number) => number,
  sampleRate = 22050,
): string {
  const numSamples = Math.max(1, Math.floor(durationSec * sampleRate));
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const raw = Math.max(-1, Math.min(1, sampleFn(t, i, sampleRate)));
    view.setInt16(44 + i * 2, raw < 0 ? raw * 0x8000 : raw * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

class SoundManager {
  private howls: Partial<Record<SoundEffectName, Howl>> = {};
  private bgmHowl: Howl | null = null;
  private initialized = false;
  public sfxVolume = 0.75;
  public musicVolume = 0.35;
  public isMuted = false;
  public isMusicPlaying = false;

  public init() {
    if (this.initialized) return;
    this.initialized = true;

    // 1. Dice Roll clatter
    this.howls.dice = new Howl({
      src: [
        buildWavDataUri(0.55, (t) => {
          const hit1 = t > 0.02 && t < 0.12 ? Math.exp(-(t - 0.02) * 45) * Math.sin(t * 2100) : 0;
          const hit2 = t > 0.18 && t < 0.28 ? Math.exp(-(t - 0.18) * 50) * Math.sin(t * 2600) : 0;
          const hit3 = t > 0.34 && t < 0.5 ? Math.exp(-(t - 0.34) * 35) * Math.sin(t * 1700) : 0;
          const noise = (Math.random() * 2 - 1) * 0.25 * Math.exp(-t * 6);
          return (hit1 + hit2 + hit3 + noise) * 0.8;
        }),
      ],
      volume: this.sfxVolume,
    });

    // 2. AK-47 3-round tactical burst
    this.howls.ak47 = new Howl({
      src: [
        buildWavDataUri(0.42, (t) => {
          const shotTimes = [0, 0.11, 0.22];
          let out = 0;
          for (const st of shotTimes) {
            if (t >= st && t < st + 0.11) {
              const dt = t - st;
              const env = Math.exp(-dt * 38);
              const punch = Math.sin(2 * Math.PI * (190 - dt * 900) * dt);
              const crack = (Math.random() * 2 - 1) * Math.exp(-dt * 55);
              out += (punch * 0.65 + crack * 0.85) * env;
            }
          }
          return out * 0.9;
        }),
      ],
      volume: this.sfxVolume,
    });

    // 3. Pistol double tap
    this.howls.pistol = new Howl({
      src: [
        buildWavDataUri(0.28, (t) => {
          const shotTimes = [0, 0.12];
          let out = 0;
          for (const st of shotTimes) {
            if (t >= st && t < st + 0.1) {
              const dt = t - st;
              out += (Math.sin(dt * 1800) * 0.5 + (Math.random() * 2 - 1) * 0.6) * Math.exp(-dt * 48);
            }
          }
          return out;
        }),
      ],
      volume: this.sfxVolume,
    });

    // 4. Shotgun heavy boom
    this.howls.shotgun = new Howl({
      src: [
        buildWavDataUri(0.45, (t) => {
          const env = Math.exp(-t * 14);
          const low = Math.sin(2 * Math.PI * 85 * t) * 0.7;
          const burst = (Math.random() * 2 - 1) * 0.85;
          return (low + burst) * env;
        }),
      ],
      volume: this.sfxVolume,
    });

    // 5. Sniper supersonic crack
    this.howls.sniper = new Howl({
      src: [
        buildWavDataUri(0.6, (t) => {
          const env = Math.exp(-t * 9);
          const whip = Math.sin(2 * Math.PI * (650 * Math.exp(-t * 8)) * t);
          const noise = (Math.random() * 2 - 1) * 0.75;
          return (whip * 0.6 + noise * 0.7) * env;
        }),
      ],
      volume: this.sfxVolume,
    });

    // 6. Metallic Magazine Reload
    this.howls.reload = new Howl({
      src: [
        buildWavDataUri(0.55, (t) => {
          const magOut = t > 0.04 && t < 0.12 ? Math.sin(t * 3200) * Math.exp(-(t - 0.04) * 50) : 0;
          const magIn = t > 0.24 && t < 0.34 ? Math.sin(t * 2400) * Math.exp(-(t - 0.24) * 45) : 0;
          const bolt = t > 0.4 && t < 0.52 ? Math.sin(t * 3900) * Math.exp(-(t - 0.4) * 40) : 0;
          return (magOut + magIn + bolt) * 0.85;
        }),
      ],
      volume: this.sfxVolume,
    });

    // 7. Footstep thud
    this.howls.footstep = new Howl({
      src: [
        buildWavDataUri(0.11, (t) => {
          return (Math.sin(t * 520) * 0.5 + (Math.random() * 2 - 1) * 0.3) * Math.exp(-t * 38);
        }),
      ],
      volume: this.sfxVolume * 0.5,
    });

    // 8. Bullet Impact / Hit marker
    this.howls.impact = new Howl({
      src: [
        buildWavDataUri(0.18, (t) => {
          const ping = Math.sin(2 * Math.PI * 1450 * t) * Math.exp(-t * 35);
          const thud = (Math.random() * 2 - 1) * Math.exp(-t * 28);
          return (ping * 0.55 + thud * 0.55) * 0.85;
        }),
      ],
      volume: this.sfxVolume,
    });

    this.howls.hit = this.howls.impact;

    // 9. Grenade Explosion
    this.howls.grenade = new Howl({
      src: [
        buildWavDataUri(0.95, (t) => {
          const sub = Math.sin(2 * Math.PI * (62 * Math.exp(-t * 1.8)) * t);
          const rumble = (Math.random() * 2 - 1) * Math.exp(-t * 3.8);
          return (sub * 0.65 + rumble * 0.85) * Math.exp(-t * 2.5);
        }),
      ],
      volume: this.sfxVolume,
    });

    // 10. Health / Loot Pickup Chime
    this.howls.pickup = new Howl({
      src: [
        buildWavDataUri(0.36, (t) => {
          const freq = t < 0.16 ? 587.33 : 880;
          return Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 7) * 0.65;
        }),
      ],
      volume: this.sfxVolume,
    });

    // 11. Victory Fanfare
    this.howls.victory = new Howl({
      src: [
        buildWavDataUri(1.4, (t) => {
          const notes = [523.25, 659.25, 783.99, 1046.5];
          const idx = Math.min(3, Math.floor(t / 0.32));
          const f = notes[idx];
          return (
            (Math.sin(2 * Math.PI * f * t) * 0.5 + Math.sin(4 * Math.PI * f * t) * 0.25) *
            Math.exp(-(t % 0.32) * 3.2)
          );
        }),
      ],
      volume: this.sfxVolume,
    });

    // 12. Defeat Horn
    this.howls.defeat = new Howl({
      src: [
        buildWavDataUri(1.1, (t) => {
          const f = t < 0.5 ? 220 : 164.81;
          return Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 2.2) * 0.65;
        }),
      ],
      volume: this.sfxVolume,
    });

    // 13. Tactical UI Click
    this.howls.click = new Howl({
      src: [
        buildWavDataUri(0.06, (t) => {
          return Math.sin(2 * Math.PI * 1950 * t) * Math.exp(-t * 80) * 0.6;
        }),
      ],
      volume: this.sfxVolume * 0.65,
    });

    // 14. Background Tactical Military Pulse Loop (4-second seamless loop)
    this.bgmHowl = new Howl({
      src: [
        buildWavDataUri(4.0, (t) => {
          const beat = (t * 2) % 1;
          const kick = beat < 0.18 ? Math.sin(2 * Math.PI * (95 - beat * 300) * beat) * Math.exp(-beat * 18) : 0;
          const bassNote = t < 2.0 ? 55 : t < 3.0 ? 65.41 : 49.0;
          const drone = Math.sin(2 * Math.PI * bassNote * t) * 0.22;
          const hat = (t * 4) % 1 < 0.05 ? (Math.random() * 2 - 1) * 0.08 : 0;
          return (kick * 0.45 + drone + hat) * 0.7;
        }),
      ],
      loop: true,
      volume: this.musicVolume,
    });

    // 15. Elimination Opponent Kill Voice Quote: "রাগ করলা?" (Rag Korla)
    this.howls.kill_voice = new Howl({
      src: ['/assets/aistudio/rag-korla_29ac6ab4.mp3'],
      volume: Math.min(1.0, this.sfxVolume * 1.3),
      html5: true,
    });
  }

  public play(name: SoundEffectName) {
    if (this.isMuted) return;
    if (!this.initialized) this.init();
    const h = this.howls[name];
    if (h) {
      h.volume(this.sfxVolume);
      h.play();
    }
  }

  public toggleMusic(force?: boolean) {
    if (!this.initialized) this.init();
    if (!this.bgmHowl) return;
    const next = force !== undefined ? force : !this.isMusicPlaying;
    this.isMusicPlaying = next;
    if (next && !this.isMuted) {
      if (!this.bgmHowl.playing()) {
        this.bgmHowl.volume(this.musicVolume);
        this.bgmHowl.play();
      }
    } else {
      this.bgmHowl.pause();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    Howler.mute(muted);
  }

  public setSfxVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
  }

  public setMusicVolume(vol: number) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    if (this.bgmHowl) {
      this.bgmHowl.volume(this.musicVolume);
    }
  }
}

export const soundManager = new SoundManager();

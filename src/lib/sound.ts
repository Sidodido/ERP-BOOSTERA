"use client";

/**
 * Gestionnaire audio pour les notifications BOOSTERA CRM
 * Utilise la Web Audio API native pour synthétiser un carillon cristallin élégant et doux,
 * sans dépendance externe ni latence réseau, compatible tous navigateurs.
 */

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  try {
    if (!sharedAudioContext) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        sharedAudioContext = new AudioCtx();
      }
    }

    if (sharedAudioContext && sharedAudioContext.state === "suspended") {
      sharedAudioContext.resume().catch(() => {});
    }

    return sharedAudioContext;
  } catch (err) {
    console.warn("AudioContext non initialisable:", err);
    return null;
  }
}

/**
 * Déverrouille le contexte audio lors de la première interaction utilisateur
 */
if (typeof window !== "undefined") {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  };

  window.addEventListener("pointerdown", unlockAudio, { once: true, passive: true });
  window.addEventListener("keydown", unlockAudio, { once: true, passive: true });
}

export function isNotificationSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const item = localStorage.getItem("crm_notif_sound_enabled");
    return item === null ? true : item === "true";
  } catch {
    return true;
  }
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("crm_notif_sound_enabled", enabled ? "true" : "false");
  } catch {}
}

/**
 * Joue le carillon harmonieux de notification
 * Fréquences choisies : accord cristallin majeur doux (Mi5 - Si5 - Mi6)
 */
export function playNotificationSound(force = false): void {
  if (typeof window === "undefined") return;
  if (!force && !isNotificationSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const startTime = ctx.currentTime;

    // Trois notes harmoniques en cascade ultra-douces
    const notes = [
      { freq: 659.25, time: 0.0, duration: 0.28, gain: 0.2 }, // E5
      { freq: 987.77, time: 0.08, duration: 0.35, gain: 0.25 }, // B5
      { freq: 1318.51, time: 0.16, duration: 0.55, gain: 0.3 }, // E6
    ];

    notes.forEach(({ freq, time, duration, gain }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime + time);

      // Enveloppe d'attaque rapide puis extinction exponentielle naturelle
      gainNode.gain.setValueAtTime(0.0001, startTime + time);
      gainNode.gain.exponentialRampToValueAtTime(gain, startTime + time + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + time + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(startTime + time);
      osc.stop(startTime + time + duration);
    });
  } catch (err) {
    console.warn("Échec lecture son notification:", err);
  }
}

/**
 * Joue un son d'avertissement doux (deux notes successives d'alerte)
 */
export function playWarningSound(force = false): void {
  if (typeof window === "undefined") return;
  if (!force && !isNotificationSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const startTime = ctx.currentTime;
    const notes = [
      { freq: 523.25, time: 0.0, duration: 0.18, gain: 0.22 }, // C5
      { freq: 659.25, time: 0.14, duration: 0.28, gain: 0.25 }, // E5
    ];

    notes.forEach(({ freq, time, duration, gain }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime + time);

      gainNode.gain.setValueAtTime(0.0001, startTime + time);
      gainNode.gain.exponentialRampToValueAtTime(gain, startTime + time + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + time + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(startTime + time);
      osc.stop(startTime + time + duration);
    });
  } catch (err) {
    console.warn("Échec lecture son warning:", err);
  }
}

/**
 * Joue un son d'alerte critique / urgent (trois impulsions insistantes)
 */
export function playUrgentSound(force = false): void {
  if (typeof window === "undefined") return;
  if (!force && !isNotificationSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const startTime = ctx.currentTime;
    const pulses = [
      { freq: 880.0, time: 0.0, duration: 0.12, gain: 0.28 },  // A5
      { freq: 880.0, time: 0.16, duration: 0.12, gain: 0.28 }, // A5
      { freq: 1046.5, time: 0.32, duration: 0.30, gain: 0.32 }, // C6
    ];

    pulses.forEach(({ freq, time, duration, gain }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, startTime + time);

      gainNode.gain.setValueAtTime(0.0001, startTime + time);
      gainNode.gain.exponentialRampToValueAtTime(gain, startTime + time + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + time + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(startTime + time);
      osc.stop(startTime + time + duration);
    });
  } catch (err) {
    console.warn("Échec lecture son urgent:", err);
  }
}


import fs from "fs";
import path from "path";

/**
 * Résout de manière permanente et robuste la clé API Google Gemini :
 * 1. Paramètre explicite (ex: session client)
 * 2. process.env.GEMINI_API_KEY en mémoire
 * 3. process.env.NEXT_PUBLIC_GEMINI_API_KEY en mémoire
 * 4. Lecture directe depuis le fichier .env sur disque (garantit la persistance permanente)
 */
export function getResolvedGeminiApiKey(paramKey?: string): string {
  if (paramKey && paramKey.trim().length > 0) {
    return paramKey.trim();
  }

  if (typeof process !== "undefined" && process.env) {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0) {
      return process.env.GEMINI_API_KEY.trim();
    }
    if (process.env.NEXT_PUBLIC_GEMINI_API_KEY && process.env.NEXT_PUBLIC_GEMINI_API_KEY.trim().length > 0) {
      return process.env.NEXT_PUBLIC_GEMINI_API_KEY.trim();
    }
  }

  // Fallback direct sur le fichier .env physique
  try {
    if (typeof process !== "undefined" && process.cwd) {
      const envPath = path.join(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        const match = content.match(/^GEMINI_API_KEY=["']?([^"'\r\n]+)["']?/m);
        if (match && match[1] && match[1].trim().length > 0) {
          const found = match[1].trim();
          if (process.env) {
            process.env.GEMINI_API_KEY = found;
          }
          return found;
        }
      }
    }
  } catch (err) {
    console.warn("Impossible de lire .env pour GEMINI_API_KEY:", err);
  }

  return "";
}

/**
 * Résout de manière permanente et robuste la clé API OpenAI (ChatGPT) :
 * 1. Paramètre explicite (ex: session client)
 * 2. process.env.OPENAI_API_KEY en mémoire
 * 3. process.env.NEXT_PUBLIC_OPENAI_API_KEY en mémoire
 * 4. Lecture directe depuis le fichier .env sur disque (garantit la persistance permanente)
 */
export function getResolvedOpenAiApiKey(paramKey?: string): string {
  if (paramKey && paramKey.trim().length > 0) {
    return paramKey.trim();
  }

  if (typeof process !== "undefined" && process.env) {
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0) {
      return process.env.OPENAI_API_KEY.trim();
    }
    if (process.env.NEXT_PUBLIC_OPENAI_API_KEY && process.env.NEXT_PUBLIC_OPENAI_API_KEY.trim().length > 0) {
      return process.env.NEXT_PUBLIC_OPENAI_API_KEY.trim();
    }
  }

  // Fallback direct sur le fichier .env physique
  try {
    if (typeof process !== "undefined" && process.cwd) {
      const envPath = path.join(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        const match = content.match(/^OPENAI_API_KEY=["']?([^"'\r\n]+)["']?/m);
        if (match && match[1] && match[1].trim().length > 0) {
          const found = match[1].trim();
          if (process.env) {
            process.env.OPENAI_API_KEY = found;
          }
          return found;
        }
      }
    }
  } catch (err) {
    console.warn("Impossible de lire .env pour OPENAI_API_KEY:", err);
  }

  return "";
}

/**
 * Masque une clé API pour un affichage sécurisé
 */
export function maskApiKey(key: string): string {
  const clean = key.trim();
  if (!clean) return "";
  if (clean.length > 10) {
    return `${clean.substring(0, 6)}...${clean.substring(clean.length - 4)}`;
  }
  return "***";
}

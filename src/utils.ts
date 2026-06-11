import { Match, Prediction } from './types';

/**
 * Calcs predictions points based on match outcome:
 * - Exact score inside match: 5 points
 * - Correct outcome along with exact goal difference: 3 points
 * - Correct outcome (winner or draw) but no goal difference: 1 point
 * - Incorrect winner or match not processed: 0 points
 */
export function computePointsEarned(
  homePred: number,
  awayPred: number,
  homeReal: number,
  awayReal: number
): { points: number; type: 'exact' | 'difference' | 'tendency' | 'none' } {
  // If either predictions or results are not recorded, return 0
  if (homePred < 0 || awayPred < 0 || homeReal < 0 || awayReal < 0) {
    return { points: 0, type: 'none' };
  }

  // Resultado Exacto (5 puntos)
  if (homePred === homeReal && awayPred === awayReal) {
    return { points: 5, type: 'exact' };
  }

  // Check Outcome
  const predDiff = homePred - awayPred;
  const realDiff = homeReal - awayReal;

  const predWinner = predDiff > 0 ? 'home' : predDiff < 0 ? 'away' : 'draw';
  const realWinner = realDiff > 0 ? 'home' : realDiff < 0 ? 'away' : 'draw';

  if (predWinner === realWinner) {
    // Diferencia de Goles (3 puntos)
    if (predDiff === realDiff) {
      return { points: 3, type: 'difference' };
    }
    // Tendencia / Ganador (1 punto)
    return { points: 1, type: 'tendency' };
  }

  // Error Total (0 puntos)
  return { points: 0, type: 'none' };
}

/**
 * Formats ISO date string in Spanish local format
 */
export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return isoString;
  }
}

/**
 * Generates a simple random client-side ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Avatar Color Themes
 */
export const AVATAR_COLORS = [
  { name: 'Jade Esmeralda', value: 'emerald', bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500' },
  { name: 'Cielo Claro', value: 'sky', bg: 'bg-sky-500', text: 'text-sky-500', border: 'border-sky-500' },
  { name: 'Naranja Fuego', value: 'orange', bg: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500' },
  { name: 'Violeta Eléctrico', value: 'violet', bg: 'bg-violet-500', text: 'text-violet-500', border: 'border-violet-500' },
  { name: 'Rosa Vibrante', value: 'rose', bg: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-500' },
  { name: 'Amarillo Oro', value: 'amber', bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500' }
];

export function getAvatarConfig(colorName?: string) {
  return AVATAR_COLORS.find(c => c.value === colorName) || AVATAR_COLORS[0];
}

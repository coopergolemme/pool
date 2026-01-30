export type Game = {
  id: string;
  date: string;
  table: string;
  format: "8-ball" | "8-ball-2v2";
  players: [string, string];
  winner: string;
  score: string;
  createdAt: string;
  status: "pending" | "verified";
  submittedBy?: string;
  ballsRemaining?: number | null;
};

export const GLICKO_SCALE = 173.7178;
export const DEFAULT_RATING = 1500;
export const DEFAULT_RD = 350;
export const DEFAULT_VOL = 0.06;
export const TAU = 0.5;

export type GlickoPlayer = {
  rating: number;
  rd: number;
  vol: number;
  wins: number;
  losses: number;
  streak: number;
};

const glickoG = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));

const glickoE = (mu: number, muJ: number, phiJ: number) => {
  return 1 / (1 + Math.exp(-glickoG(phiJ) * (mu - muJ)));
};

const f = (x: number, phi: number, delta: number, v: number, a: number) => {
  const ex = Math.exp(x);
  const num = ex * (delta * delta - phi * phi - v - ex);
  const den = 2 * Math.pow(phi * phi + v + ex, 2);
  return num / den - (x - a) / (TAU * TAU);
};

const updateSigma = (phi: number, sigma: number, delta: number, v: number) => {
  const a = Math.log(sigma * sigma);
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU, phi, delta, v, a) < 0) {
      k += 1;
    }
    B = a - k * TAU;
  }

  let fA = f(A, phi, delta, v, a);
  let fB = f(B, phi, delta, v, a);

  while (Math.abs(B - A) > 1e-6) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C, phi, delta, v, a);
    if (fC * fB < 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
};

const parseTeam = (name: string, is2v2: boolean) => {
  if (!is2v2) return [name];
  return name.split(" & ").map((player) => player.trim()).filter(Boolean);
};

export const computeRatings = (games: Game[]) => {
  const players = new Map<string, GlickoPlayer>();

  const ensurePlayer = (name: string) => {
    if (!players.has(name)) {
      players.set(name, {
        rating: DEFAULT_RATING,
        rd: DEFAULT_RD,
        vol: DEFAULT_VOL,
        wins: 0,
        losses: 0,
        streak: 0,
      });
    }
    return players.get(name)!;
  };

  // Only consider verified games
  const verifiedGames = games.filter(g => g.status === "verified");

  const sorted = [...verifiedGames].sort((a, b) => {
    if (a.date === b.date) {
      return a.createdAt < b.createdAt ? -1 : 1;
    }
    return a.date < b.date ? -1 : 1;
  });

  sorted.forEach((game) => {
    const is2v2 = game.format === "8-ball-2v2";
    const [sideA, sideB] = game.players;
    if (!sideA || !sideB || !game.winner) return;

    const teamAPlayers = parseTeam(sideA, is2v2);
    const teamBPlayers = parseTeam(sideB, is2v2);
    if (teamAPlayers.length === 0 || teamBPlayers.length === 0) return;

    teamAPlayers.forEach(ensurePlayer);
    teamBPlayers.forEach(ensurePlayer);

    const teamARating =
      teamAPlayers.reduce((sum, name) => sum + ensurePlayer(name).rating, 0) / teamAPlayers.length;
    const teamBRating =
      teamBPlayers.reduce((sum, name) => sum + ensurePlayer(name).rating, 0) / teamBPlayers.length;
    const teamARD =
      teamAPlayers.reduce((sum, name) => sum + ensurePlayer(name).rd, 0) / teamAPlayers.length;
    const teamBRD =
      teamBPlayers.reduce((sum, name) => sum + ensurePlayer(name).rd, 0) / teamBPlayers.length;
    const teamAVol =
      teamAPlayers.reduce((sum, name) => sum + ensurePlayer(name).vol, 0) / teamAPlayers.length;
    const teamBVol =
      teamBPlayers.reduce((sum, name) => sum + ensurePlayer(name).vol, 0) / teamBPlayers.length;

    const teamAIsWinner = game.winner === sideA;
    const teamBIsWinner = game.winner === sideB;

    if (!teamAIsWinner && !teamBIsWinner) {
      // Data integrity issue: winner matches neither player/team string.
      // Could happen if names were edited or trailing spaces exist.
      // Try loosely matching if possible, or just skip to avoid corrupting stats.
      return;
    }

    const scoreA = teamAIsWinner ? 1 : 0;
    const scoreB = teamBIsWinner ? 1 : 0;

    const updatePlayer = (playerName: string, oppRating: number, oppRd: number, score: number) => {
      const player = ensurePlayer(playerName);
      const mu = (player.rating - DEFAULT_RATING) / GLICKO_SCALE;
      const phi = player.rd / GLICKO_SCALE;
      const muJ = (oppRating - DEFAULT_RATING) / GLICKO_SCALE;
      const phiJ = oppRd / GLICKO_SCALE;

      const g = glickoG(phiJ);
      const E = glickoE(mu, muJ, phiJ);
      const v = 1 / (g * g * E * (1 - E));
      const delta = v * g * (score - E);

      const sigmaPrime = updateSigma(phi, player.vol, delta, v);
      const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);
      const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
      const muPrime = mu + phiPrime * phiPrime * g * (score - E);

      player.rating = muPrime * GLICKO_SCALE + DEFAULT_RATING;
      player.rd = phiPrime * GLICKO_SCALE;
      player.vol = sigmaPrime;
      if (score === 1) {
        player.wins += 1;
        player.streak = player.streak > 0 ? player.streak + 1 : 1;
      } else {
        player.losses += 1;
        player.streak = player.streak < 0 ? player.streak - 1 : -1;
      }
    };

    teamAPlayers.forEach((name) => updatePlayer(name, teamBRating, teamBRD, scoreA));
    teamBPlayers.forEach((name) => updatePlayer(name, teamARating, teamARD, scoreB));

    // Keep team volatility roughly aligned
    teamAPlayers.forEach((name) => (ensurePlayer(name).vol = teamAVol));
    teamBPlayers.forEach((name) => (ensurePlayer(name).vol = teamBVol));
  });

  return players;
};

export type GameRatingSnapshot = {
  rating: number;
  delta: number;
};

export type RatingHistory = Record<string, Record<string, GameRatingSnapshot>>;

export const computeRatingHistory = (games: Game[]): RatingHistory => {
  const players = new Map<string, GlickoPlayer>();
  const history: RatingHistory = {};

  const ensurePlayer = (name: string) => {
    if (!players.has(name)) {
      players.set(name, {
        rating: DEFAULT_RATING,
        rd: DEFAULT_RD,
        vol: DEFAULT_VOL,
        wins: 0,
        losses: 0,
        streak: 0,
      });
    }
    return players.get(name)!;
  };

  // Only consider verified games
  const verifiedGames = games.filter(g => g.status === "verified");

  // Sort games oldest to newest for processing
  const sorted = [...verifiedGames].sort((a, b) => {
    if (a.date === b.date) {
      return a.createdAt < b.createdAt ? -1 : 1;
    }
    return a.date < b.date ? -1 : 1;
  });

  sorted.forEach((game) => {
    const is2v2 = game.format === "8-ball-2v2";
    const [sideA, sideB] = game.players;
    if (!sideA || !sideB || !game.winner) return;

    const teamAPlayers = parseTeam(sideA, is2v2);
    const teamBPlayers = parseTeam(sideB, is2v2);
    if (teamAPlayers.length === 0 || teamBPlayers.length === 0) return;

    teamAPlayers.forEach(ensurePlayer);
    teamBPlayers.forEach(ensurePlayer);

    // Capture snapshots before update
    const preUpdateRatings = new Map<string, number>();
    [...teamAPlayers, ...teamBPlayers].forEach(name => {
        preUpdateRatings.set(name, ensurePlayer(name).rating);
    });

    const teamARating =
      teamAPlayers.reduce((sum, name) => sum + ensurePlayer(name).rating, 0) / teamAPlayers.length;
    const teamBRating =
      teamBPlayers.reduce((sum, name) => sum + ensurePlayer(name).rating, 0) / teamBPlayers.length;
    const teamARD =
      teamAPlayers.reduce((sum, name) => sum + ensurePlayer(name).rd, 0) / teamAPlayers.length;
    const teamBRD =
      teamBPlayers.reduce((sum, name) => sum + ensurePlayer(name).rd, 0) / teamBPlayers.length;
    const teamAVol =
      teamAPlayers.reduce((sum, name) => sum + ensurePlayer(name).vol, 0) / teamAPlayers.length;
    const teamBVol =
      teamBPlayers.reduce((sum, name) => sum + ensurePlayer(name).vol, 0) / teamBPlayers.length;

    const teamAIsWinner = game.winner === sideA;
    const teamBIsWinner = game.winner === sideB;

    if (!teamAIsWinner && !teamBIsWinner) return;

    const scoreA = teamAIsWinner ? 1 : 0;
    const scoreB = teamBIsWinner ? 1 : 0;

    const updatePlayer = (playerName: string, oppRating: number, oppRd: number, score: number) => {
      const player = ensurePlayer(playerName);
      const mu = (player.rating - DEFAULT_RATING) / GLICKO_SCALE;
      const phi = player.rd / GLICKO_SCALE;
      const muJ = (oppRating - DEFAULT_RATING) / GLICKO_SCALE;
      const phiJ = oppRd / GLICKO_SCALE;

      const g = glickoG(phiJ);
      const E = glickoE(mu, muJ, phiJ);
      const v = 1 / (g * g * E * (1 - E));
      const delta = v * g * (score - E);

      const sigmaPrime = updateSigma(phi, player.vol, delta, v);
      const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);
      const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
      const muPrime = mu + phiPrime * phiPrime * g * (score - E);

      player.rating = muPrime * GLICKO_SCALE + DEFAULT_RATING;
      player.rd = phiPrime * GLICKO_SCALE;
      player.vol = sigmaPrime;
      if (score === 1) {
        player.wins += 1;
        player.streak = player.streak > 0 ? player.streak + 1 : 1;
      } else {
        player.losses += 1;
        player.streak = player.streak < 0 ? player.streak - 1 : -1;
      }
    };

    teamAPlayers.forEach((name) => updatePlayer(name, teamBRating, teamBRD, scoreA));
    teamBPlayers.forEach((name) => updatePlayer(name, teamARating, teamARD, scoreB));

    // Keep team volatility roughly aligned
    teamAPlayers.forEach((name) => (ensurePlayer(name).vol = teamAVol));
    teamBPlayers.forEach((name) => (ensurePlayer(name).vol = teamBVol));

    // Record history
    history[game.id] = {};
    [...teamAPlayers, ...teamBPlayers].forEach(name => {
        const newRating = ensurePlayer(name).rating;
        const oldRating = preUpdateRatings.get(name) || DEFAULT_RATING;
        history[game.id][name] = {
            rating: newRating,
            delta: newRating - oldRating
        };
    });
  });

  return history;
};

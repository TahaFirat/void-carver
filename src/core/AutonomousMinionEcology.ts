/**
 * VOID CARVER — BUILD 12: AUTONOMOUS FREE-ROAMING MINION ECOLOGY ENGINE
 * (`src/core/AutonomousMinionEcology.ts`)
 *
 * Architectural Guarantees:
 * 1. ZERO BORDER CAMPING: When `!player.isCutting` (player is on the safe border), minions are
 *    100% BLIND to `player.pos` AND experience a smooth `borderRepulsionForce` whenever within
 *    `BORDER_REPEL_MARGIN_PX` (38px) of safe walls and `PLAYER_SAFE_BUBBLE_PX` (72px) of the player!
 * 2. CONTINUOUS ORGANIC FREE-ROAM: Every minion maintains minimum autonomous speed inside the open
 *    void using species-specific organic steering (Lissajous Figure-8, Elastic Prism Bounce,
 *    Boss Orbiting, Sinusoidal Wave Gliding, Waypoint Exploration).
 * 3. REACTION GRACE WINDOW: Even after the player leaves the safe wall (`player.isCutting === true`),
 *    hunter minions wait `reactionGraceSec` (e.g. 0.9s on Medium) before smoothly curving (capped
 *    angular turn rate!) toward the exposed trail—never robotic instant-snapping!
 */

import { MinionSpeciesId, computeCrowdingSpeedDampener } from './CampaignProgressionV12';

export interface Vec2 {
  x: number;
  y: number;
}

export interface ArenaBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface PlayerCutSnapshot {
  pos: Vec2;
  isCutting: boolean;
  activeCuttingDurationSec: number;
  trailMidpoint?: Vec2;
}

export interface AutonomousMinionState {
  id: string;
  species: MinionSpeciesId;
  pos: Vec2;
  vel: Vec2;
  baseSpeedPx: number;
  phaseRad: number;
  wanderTarget: Vec2;
  wanderRetargetTimerSec: number;
  orbitAngleRad: number;
  orbitRadiusPx: number;
  dashCooldownSec: number;
  frozenTimerSec: number;
}

export class AutonomousMinionEcology {
  public static readonly BORDER_REPEL_MARGIN_PX = 38;
  public static readonly PLAYER_SAFE_BUBBLE_PX = 72; // Extra push away from player while player is on safe border!
  public static readonly MIN_ROAM_SPEED_FACTOR = 0.72;

  private rngState = 0x51f2a9c3;

  constructor(seed = 0x51f2a9c3) {
    this.rngState = seed >>> 0;
  }

  private rand(): number {
    let t = (this.rngState += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public spawnMinion(
    id: string,
    species: MinionSpeciesId,
    bounds: ArenaBounds,
    bossPos: Vec2,
    speedScale = 1.0
  ): AutonomousMinionState {
    const cx = (bounds.minX + bounds.maxX) * 0.5;
    const cy = (bounds.minY + bounds.maxY) * 0.5;
    const spanX = Math.max(80, (bounds.maxX - bounds.minX) * 0.55);
    const spanY = Math.max(80, (bounds.maxY - bounds.minY) * 0.55);

    const pos = {
      x: cx + (this.rand() - 0.5) * spanX,
      y: cy + (this.rand() - 0.5) * spanY
    };

    const baseSpeedMap: Record<MinionSpeciesId, number> = {
      SCARAB_BEETLE: 122,
      WASP_SWARMER: 142,
      LINE_LEECH: 128,
      POD_TURRET: 92,
      SPLITTER_AMOEBA: 112,
      BORDER_SPARK_CRAB: 135,
      SHIELD_SAPPER: 118,
      MINE_LAYER_DRONE: 104,
      CHARGER_HORN: 136,
      PHASE_GHOST: 108,
      ORBIT_SATELLITE: 145,
      HOMING_SEEKER: 132,
      ANCHOR_BARNACLE: 96,
      KAMIKAZE_SPORE: 138,
      COSMIC_MANTA: 134,
      RICOCHET_CRYSTAL: 148,
      VORTEX_DRIFTER: 115,
      COMET_SEED: 156
    };

    const baseSpeedPx = (baseSpeedMap[species] ?? 120) * speedScale;
    const angle = this.rand() * Math.PI * 2;
    void bossPos;

    return {
      id,
      species,
      pos,
      vel: { x: Math.cos(angle) * baseSpeedPx, y: Math.sin(angle) * baseSpeedPx },
      baseSpeedPx,
      phaseRad: this.rand() * Math.PI * 2,
      wanderTarget: this.pickInteriorWaypoint(bounds),
      wanderRetargetTimerSec: 1.5 + this.rand() * 2.0,
      orbitAngleRad: angle,
      orbitRadiusPx: 62 + this.rand() * 38,
      dashCooldownSec: 2.0 + this.rand() * 2.0,
      frozenTimerSec: 0
    };
  }

  private pickInteriorWaypoint(bounds: ArenaBounds, isClaimedPoint?: (x: number, y: number) => boolean): Vec2 {
    const padX = Math.min(64, (bounds.maxX - bounds.minX) * 0.22);
    const padY = Math.min(64, (bounds.maxY - bounds.minY) * 0.22);
    for (let attempt = 0; attempt < 10; attempt++) {
      const cand = {
        x: bounds.minX + padX + this.rand() * Math.max(16, bounds.maxX - bounds.minX - padX * 2),
        y: bounds.minY + padY + this.rand() * Math.max(16, bounds.maxY - bounds.minY - padY * 2)
      };
      if (!isClaimedPoint || !isClaimedPoint(cand.x, cand.y)) {
        return cand;
      }
    }
    return {
      x: (bounds.minX + bounds.maxX) * 0.5,
      y: (bounds.minY + bounds.maxY) * 0.5
    };
  }

  /**
   * Steps all minions for `dtSec` with guaranteed anti-camping & smooth organic free movement!
   */
  public stepMinions(
    minions: AutonomousMinionState[],
    dtSec: number,
    bounds: ArenaBounds,
    bossPos: Vec2,
    player: PlayerCutSnapshot,
    capturedPercent: number,
    reactionGraceSec: number,
    isClaimedPoint?: (x: number, y: number) => boolean,
    nearestWallSampler?: (x: number, y: number) => { dist: number; normalX: number; normalY: number } | null
  ): void {
    const crowdingDamp = computeCrowdingSpeedDampener(capturedPercent);

    for (const m of minions) {
      if (m.frozenTimerSec > 0) {
        m.frozenTimerSec = Math.max(0, m.frozenTimerSec - dtSec);
        continue;
      }

      m.phaseRad += dtSec * 2.7;
      m.wanderRetargetTimerSec -= dtSec;
      m.dashCooldownSec = Math.max(0, m.dashCooldownSec - dtSec);

      if (m.wanderRetargetTimerSec <= 0) {
        m.wanderTarget = this.pickInteriorWaypoint(bounds, isClaimedPoint);
        m.wanderRetargetTimerSec = 1.8 + this.rand() * 2.2;
      }

      const targetSpeed = m.baseSpeedPx * crowdingDamp;
      let desiredVx = m.vel.x;
      let desiredVy = m.vel.y;

      // 1. SPECIES-SPECIFIC ORGANIC FREE-ROAMING (Active 100% of the time!)
      switch (m.species) {
        case 'ORBIT_SATELLITE': {
          m.orbitAngleRad += dtSec * 2.1 * crowdingDamp;
          const ox = bossPos.x + Math.cos(m.orbitAngleRad) * m.orbitRadiusPx;
          const oy = bossPos.y + Math.sin(m.orbitAngleRad) * m.orbitRadiusPx;
          desiredVx = (ox - m.pos.x) * 4.2;
          desiredVy = (oy - m.pos.y) * 4.2;
          break;
        }
        case 'RICOCHET_CRYSTAL':
        case 'SCARAB_BEETLE':
        case 'COMET_SEED': {
          // Pure lively diagonal bounce + subtle organic sway so it never gets stuck in 1D loops
          const curAngle = Math.atan2(m.vel.y, m.vel.x) + Math.sin(m.phaseRad) * 0.35 * dtSec;
          desiredVx = Math.cos(curAngle) * targetSpeed;
          desiredVy = Math.sin(curAngle) * targetSpeed;
          break;
        }
        case 'COSMIC_MANTA':
        case 'PHASE_GHOST':
        case 'VORTEX_DRIFTER': {
          // Smooth Lissajous / sinusoidal gliding toward shifting interior waypoints
          const toWx = m.wanderTarget.x - m.pos.x;
          const toWy = m.wanderTarget.y - m.pos.y;
          const dist = Math.hypot(toWx, toWy) || 1;
          const baseAng = Math.atan2(toWy, toWx) + Math.sin(m.phaseRad * 1.3) * 0.55;
          desiredVx = Math.cos(baseAng) * targetSpeed;
          desiredVy = Math.sin(baseAng) * targetSpeed;
          if (dist < 28) m.wanderTarget = this.pickInteriorWaypoint(bounds, isClaimedPoint);
          break;
        }
        default: {
          // Autonomous interior waypoint patrol for WASP, LINE_LEECH, CHARGER_HORN, etc.!
          // When player is NOT cutting (or during reaction grace window), they roam freely inside the arena!
          const wx = m.wanderTarget.x - m.pos.x;
          const wy = m.wanderTarget.y - m.pos.y;
          const d = Math.hypot(wx, wy) || 1;
          if (d < 34) {
            m.wanderTarget = this.pickInteriorWaypoint(bounds, isClaimedPoint);
          }
          const sway = Math.cos(m.phaseRad * 1.6) * 0.42;
          const ang = Math.atan2(wy, wx) + sway;
          desiredVx = Math.cos(ang) * targetSpeed;
          desiredVy = Math.sin(ang) * targetSpeed;
          break;
        }
      }

      // 2. FAIR CURVED HUNTER REACTION (ONLY when player is actively cutting PAST grace window!)
      const hunterTypes = new Set<MinionSpeciesId>([
        'WASP_SWARMER',
        'LINE_LEECH',
        'HOMING_SEEKER',
        'CHARGER_HORN',
        'KAMIKAZE_SPORE'
      ]);

      if (
        player.isCutting &&
        player.activeCuttingDurationSec >= reactionGraceSec &&
        hunterTypes.has(m.species)
      ) {
        const aimPoint = m.species === 'LINE_LEECH' && player.trailMidpoint ? player.trailMidpoint : player.pos;
        const dx = aimPoint.x - m.pos.x;
        const dy = aimPoint.y - m.pos.y;
        const distToPlayer = Math.hypot(dx, dy);

        // Only engage within fair sensor radius (260px), and turn smoothly (max 2.4 rad/sec — NEVER instant snap!)
        if (distToPlayer < 260 && distToPlayer > 1) {
          const curAng = Math.atan2(desiredVy, desiredVx);
          const targetAng = Math.atan2(dy, dx);
          const diff = Math.atan2(Math.sin(targetAng - curAng), Math.cos(targetAng - curAng));
          const maxTurn = 2.4 * dtSec;
          const clampedTurn = Math.max(-maxTurn, Math.min(maxTurn, diff));
          const newAng = curAng + clampedTurn;
          const chaseBoost = m.species === 'CHARGER_HORN' ? 1.12 : 1.04;
          desiredVx = Math.cos(newAng) * targetSpeed * chaseBoost;
          desiredVy = Math.sin(newAng) * targetSpeed * chaseBoost;
        }
      }

      // 3. STRICT ANTI-BORDER-CAMPING REPULSION FIELD!
      // Keeps minions away from walls AND pushes them away from a safe border-walking player!
      const margin = AutonomousMinionEcology.BORDER_REPEL_MARGIN_PX;
      if (m.pos.x - bounds.minX < margin) desiredVx += ((margin - (m.pos.x - bounds.minX)) / margin) * targetSpeed * 1.8;
      if (bounds.maxX - m.pos.x < margin) desiredVx -= ((margin - (bounds.maxX - m.pos.x)) / margin) * targetSpeed * 1.8;
      if (m.pos.y - bounds.minY < margin) desiredVy += ((margin - (m.pos.y - bounds.minY)) / margin) * targetSpeed * 1.8;
      if (bounds.maxY - m.pos.y < margin) desiredVy -= ((margin - (bounds.maxY - m.pos.y)) / margin) * targetSpeed * 1.8;

      if (nearestWallSampler) {
        const w = nearestWallSampler(m.pos.x, m.pos.y);
        if (w && w.dist < margin) {
          const pushRatio = (margin - w.dist) / margin;
          desiredVx += w.normalX * pushRatio * targetSpeed * 1.85;
          desiredVy += w.normalY * pushRatio * targetSpeed * 1.85;
        }
      }

      if (!player.isCutting) {
        const pdx = m.pos.x - player.pos.x;
        const pdy = m.pos.y - player.pos.y;
        const pDist = Math.hypot(pdx, pdy) || 1;
        if (pDist < AutonomousMinionEcology.PLAYER_SAFE_BUBBLE_PX) {
          // Actively push minion back toward arena center so it NEVER camps the player's exit!
          const push = ((AutonomousMinionEcology.PLAYER_SAFE_BUBBLE_PX - pDist) / AutonomousMinionEcology.PLAYER_SAFE_BUBBLE_PX) * targetSpeed * 2.6;
          desiredVx += (pdx / pDist) * push;
          desiredVy += (pdy / pDist) * push;
        }
      }

      // Smooth velocity blend + enforce minimum lively roaming speed (never freezes at 0!)
      const blend = Math.min(1, dtSec * 6.5);
      m.vel.x = m.vel.x * (1 - blend) + desiredVx * blend;
      m.vel.y = m.vel.y * (1 - blend) + desiredVy * blend;

      const curSpd = Math.hypot(m.vel.x, m.vel.y);
      const minSpd = targetSpeed * AutonomousMinionEcology.MIN_ROAM_SPEED_FACTOR;
      if (curSpd < minSpd) {
        const fallbackAng = curSpd > 0.01 ? Math.atan2(m.vel.y, m.vel.x) : m.phaseRad;
        m.vel.x = Math.cos(fallbackAng) * minSpd;
        m.vel.y = Math.sin(fallbackAng) * minSpd;
      } else if (curSpd > targetSpeed * 1.22) {
        m.vel.x = (m.vel.x / curSpd) * targetSpeed * 1.22;
        m.vel.y = (m.vel.y / curSpd) * targetSpeed * 1.22;
      }

      const nextX = m.pos.x + m.vel.x * dtSec;
      const nextY = m.pos.y + m.vel.y * dtSec;

      // Elastic reflection against outer arena bounds & claimed polygon regions
      let bouncedX = false;
      let bouncedY = false;
      if (nextX <= bounds.minX + 8 || nextX >= bounds.maxX - 8) {
        m.vel.x = -m.vel.x;
        bouncedX = true;
      }
      if (nextY <= bounds.minY + 8 || nextY >= bounds.maxY - 8) {
        m.vel.y = -m.vel.y;
        bouncedY = true;
      }

      if (!bouncedX && !bouncedY && isClaimedPoint && m.species !== 'PHASE_GHOST') {
        if (isClaimedPoint(nextX, m.pos.y)) {
          m.vel.x = -m.vel.x;
          bouncedX = true;
        }
        if (isClaimedPoint(m.pos.x, nextY)) {
          m.vel.y = -m.vel.y;
          bouncedY = true;
        }
      }

      m.pos.x = Math.max(bounds.minX + 8, Math.min(bounds.maxX - 8, bouncedX ? m.pos.x + m.vel.x * dtSec : nextX));
      m.pos.y = Math.max(bounds.minY + 8, Math.min(bounds.maxY - 8, bouncedY ? m.pos.y + m.vel.y * dtSec : nextY));
    }
  }
}

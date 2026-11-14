import { ENRAGE_CLAIM_PERCENT, PALETTE } from '../../core/Config';
import {
  computeArea,
  pointInPolygonStrict,
  projectPointToSegment,
  resolvePolygonPenetration
} from '../../geometry/PolygonMath';
import { Point } from '../../geometry/Types';
import type { BossSpeciesId, EliteMutationAffix } from '../../levels/EncounterDeck';
import type { BossCombatPhase, BossPhaseBehavior } from '../../levels/EndlessBossDirector';
import {
  blitArenaPixelSprite,
  commitPixelSurface,
  createPixelSurface,
  fillRectPx,
  hexToU32,
  setPx
} from '../../rendering/PixelArtEngine';
import type { ArenaHazardManager } from '../ArenaHazards';
import { InteriorMinion } from '../enemies/BaseMinion';
import { ProjectileManager } from '../Projectiles';

export type BossArchetype =
  | 'CENTIPEDE'
  | 'LOBSTER_MECHA'
  | 'BIO_WHEEL'
  | 'PINCER_BEETLE'
  | 'SNIPER_LADYBIRD'
  | 'PINBALL_FROG'
  | 'MANTIS'
  | 'CRUISER_CORE'
  | 'TWIN_SPLIT'
  | 'MORPHING_CELL'
  | 'CYBER_SKULL'
  | 'OPTIC_NERVE'
  | 'ALIEN_BRAIN'
  | 'TITAN_CORE'
  | 'TWIN_NEXUS'
  | 'IRON_CRUSTACEAN'
  | 'SNIPER_SCARAB'
  | 'SPIRAL_NAUTILUS'
  | 'MAGMA_SERPENT'
  | 'MECHA_TARANTULA'
  | 'HIVE_CARRIER'
  | 'MIRROR_PRISM'
  | 'ELECTRIC_MEDUSA'
  | 'GRAVITY_GOLEM'
  | 'HYDRA_BIO_HEAD'
  | 'SAWBLADE_JUGGERNAUT'
  | 'CHRONO_SPHINX';

export type BossAimMode = 'FIXED_SPREAD' | 'DIRECT_AIM' | 'PREDICTIVE_LEAD_AIM';

export interface BossUpdateContext {
  dt: number;
  timeSeconds: number;
  activePolygon: readonly Point[];
  claimedPercent: number;
  playerPos: Point;
  playerVel?: Point;
  playerState: 'ON_BORDER' | 'CUTTING';
  activeTrail: readonly Point[];
  speedScale: number;
  aimMode?: BossAimMode;
  projectiles: ProjectileManager;
  summonMinion: (minion: InteriorMinion) => void;
  spawnSolidObstacle?: (pos: Point) => void;
  spawnEscortBoss?: (escort: BaseBoss) => void;
  hazards?: ArenaHazardManager;
  currentMinionCount: number;
}

export interface HitCircle {
  x: number;
  y: number;
  radius: number;
}

const cachedMoltenWings: Record<string, HTMLCanvasElement> = {};

function getMoltenPhaseWingsSprite(frame: 0 | 1, overdrive: boolean): HTMLCanvasElement {
  const key = `${frame}_${overdrive ? 'p3' : 'p2'}`;
  if (cachedMoltenWings[key]) return cachedMoltenWings[key];

  const w = 96;
  const h = 48;
  const s = createPixelSurface(w, h);
  const cOutline = hexToU32('#08060A');
  const cRib = hexToU32(overdrive ? '#3C0C18' : '#2C140C');
  const cMid = hexToU32(overdrive ? '#D81838' : '#E04810');
  const cBright = hexToU32(overdrive ? '#FF5830' : '#FF9C18');
  const cCore = hexToU32('#FFF088');

  const flapLift = frame === 0 ? 0 : 4;
  const cx = 48;

  for (const dir of [-1, 1]) {
    for (let xOff = 10; xOff <= 44; xOff++) {
      const t = (xOff - 10) / 34;
      const topY = Math.round(22 - t * (17 + flapLift) + Math.sin(t * Math.PI * 2) * 1.5);
      const jag = ((xOff >> 2) % 3 === 0 ? 4 : 0) + Math.round((1 - t) * 5);
      const botY = Math.round(32 - t * 8 + jag);
      const px = cx + dir * xOff;

      for (let py = topY - 1; py <= botY + 1; py++) {
        if (py === topY - 1 || py === botY + 1 || xOff === 44) {
          setPx(s, px, py, cOutline);
        } else if (py <= topY + 2) {
          setPx(s, px, py, cRib);
        } else if (py <= topY + 5) {
          setPx(s, px, py, cCore);
        } else if (py <= (topY + botY) * 0.58) {
          setPx(s, px, py, cBright);
        } else {
          setPx(s, px, py, cMid);
        }
      }
    }
    fillRectPx(s, cx + dir * 20 - 1, 8 - (flapLift >> 1), 3, 5, cCore);
  }

  cachedMoltenWings[key] = commitPixelSurface(s);
  return cachedMoltenWings[key];
}

/**
 * V7 Law 5 — Strict Circular Collision (`HitCircle`) + Pinball Shrink-Speedup (`0.45x` -> `1.63x` speed)!
 */
export abstract class BaseBoss {
  public x: number;
  public y: number;
  public prevX: number;
  public prevY: number;
  public vx: number;
  public vy: number;
  public readonly baseRadius: number;
  public boundingRadius: number;
  public renderScale = 1.0;
  public pinballSpeedBoost = 1.0;
  public readonly maxHp: number;
  public hp: number;
  public enraged = false;
  public hitFlash = 0;
  public alive = true;
  public crushedInPocket = false;
  public isEscort = false;
  public speciesId?: BossSpeciesId;
  public eliteMutation: EliteMutationAffix = 'NONE';
  public armorDamageReduction = 0;
  public cloneVisualScale = 1.0;

  public combatPhase: BossCombatPhase = 1;
  public phaseBehavior: BossPhaseBehavior | null = null;
  protected orbitBladeAngle = 0;
  protected moltenTrailTimer = 1.1;
  protected spiralPhaseAngle = 0;
  protected eliteWakeTimer = 1.35;
  protected eliteFrenzyTimer = 0;
  private lastKnownPolygon: readonly Point[] = [];

  public abstract readonly archetype: BossArchetype;
  public abstract readonly displayName: string;

  private antiStuckTarget: Point | null = null;
  private antiStuckFramesLeft = 0;
  private pocketCrushTimer = 0;

  constructor(spawn: Point, boundingRadius: number, maxHp = 6, initVx = 160, initVy = 140) {
    this.x = spawn.x;
    this.y = spawn.y;
    this.prevX = spawn.x;
    this.prevY = spawn.y;
    this.vx = initVx;
    this.vy = initVy;
    this.baseRadius = boundingRadius;
    this.boundingRadius = boundingRadius;
    this.maxHp = maxHp;
    this.hp = maxHp;
  }

  public applyPhaseBehavior(behavior: BossPhaseBehavior): void {
    this.combatPhase = behavior.phase;
    this.phaseBehavior = behavior;
  }

  public get position(): Point {
    return { x: this.x, y: this.y };
  }

  public getRenderPos(alpha: number): Point {
    return {
      x: this.prevX + (this.x - this.prevX) * alpha,
      y: this.prevY + (this.y - this.prevY) * alpha
    };
  }

  public takeCannonHit(): boolean {
    if (!this.alive) return false;
    const dmg = Math.max(0.15, 1 - this.armorDamageReduction);
    this.hp = Math.max(0, +(this.hp - dmg).toFixed(2));
    this.hitFlash = 0.09;
    if (this.hp <= 0.01) {
      this.hp = 0;
      this.alive = false;
      return true;
    }
    return false;
  }

  public onPolygonShrunk(activePolygon: readonly Point[]): void {
    this.lastKnownPolygon = activePolygon;
    this.updateCorridorScale(activePolygon, 1.0);

    const solved = resolvePolygonPenetration(
      { x: this.x, y: this.y },
      this.boundingRadius,
      activePolygon
    );

    if (!pointInPolygonStrict({ x: this.x, y: this.y }, activePolygon)) {
      this.x = solved.position.x;
      this.y = solved.position.y;
      this.prevX = this.x;
      this.prevY = this.y;
      return;
    }

    const dist = Math.hypot(solved.position.x - this.x, solved.position.y - this.y);
    if (dist > 0.5) {
      this.antiStuckTarget = solved.position;
      this.antiStuckFramesLeft = 3;
    }
  }

  public getHitCircles(): HitCircle[] {
    const circles: HitCircle[] = [{ x: this.x, y: this.y, radius: this.boundingRadius * 0.88 }];
    if (
      this.phaseBehavior?.specialMechanic === 'ORBITING_SHIELD_BLADES' &&
      this.lastKnownPolygon.length >= 3
    ) {
      const orbitDist = this.boundingRadius * 1.42;
      for (let i = 0; i < 4; i++) {
        const ang = this.orbitBladeAngle + (i * Math.PI) / 2;
        const bx = this.x + Math.cos(ang) * orbitDist;
        const by = this.y + Math.sin(ang) * orbitDist;
        if (pointInPolygonStrict({ x: bx, y: by }, this.lastKnownPolygon)) {
          circles.push({ x: bx, y: by, radius: 10 * this.renderScale });
        }
      }
    }
    return circles;
  }

  /**
   * V7 Law 5 — Pinball Shrink-Speedup (`0.45x` minimum scale -> up to `1.63x` bounce velocity!).
   */
  private updateCorridorScale(activePolygon: readonly Point[], blend: number): number {
    const n = activePolygon.length;
    if (n < 3) return Infinity;

    let minDist = Infinity;
    let secondMinOppositeDist = Infinity;
    let minNormalX = 0;
    let minNormalY = 0;

    for (let i = 0; i < n; i++) {
      const a = activePolygon[i];
      const b = activePolygon[(i + 1) % n];
      const res = projectPointToSegment({ x: this.x, y: this.y }, a, b);
      if (res.distance < minDist) {
        minDist = res.distance;
        const dx = this.x - res.point.x;
        const dy = this.y - res.point.y;
        const len = Math.hypot(dx, dy) || 1;
        minNormalX = dx / len;
        minNormalY = dy / len;
      }
    }

    for (let i = 0; i < n; i++) {
      const a = activePolygon[i];
      const b = activePolygon[(i + 1) % n];
      const res = projectPointToSegment({ x: this.x, y: this.y }, a, b);
      const dx = this.x - res.point.x;
      const dy = this.y - res.point.y;
      const len = Math.hypot(dx, dy) || 1;
      const dot = (dx / len) * minNormalX + (dy / len) * minNormalY;
      if (dot < -0.35 && res.distance < secondMinOppositeDist) {
        secondMinOppositeDist = res.distance;
      }
    }

    const corridorWidth =
      secondMinOppositeDist < Infinity ? minDist + secondMinOppositeDist : Infinity;
    let targetScale = 1.0;
    if (corridorWidth < this.baseRadius * 2.35) {
      targetScale = Math.max(0.45, Math.min(1.0, corridorWidth / (this.baseRadius * 2.35)));
    }

    this.renderScale += (targetScale - this.renderScale) * blend;
    this.boundingRadius = this.baseRadius * this.renderScale * this.cloneVisualScale;
    this.pinballSpeedBoost = 1 + (1 - this.renderScale) * 1.15;
    return corridorWidth;
  }

  public update(bctx: BossUpdateContext): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.lastKnownPolygon = bctx.activePolygon;

    this.enraged = bctx.claimedPercent >= ENRAGE_CLAIM_PERCENT || this.combatPhase >= 2;
    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - bctx.dt);
    }

    const corridorWidth = this.updateCorridorScale(
      bctx.activePolygon,
      Math.min(1, bctx.dt * 10)
    );

    if (this.antiStuckTarget && this.antiStuckFramesLeft > 0) {
      const t = 1 / this.antiStuckFramesLeft;
      const nx = this.x + (this.antiStuckTarget.x - this.x) * t;
      const ny = this.y + (this.antiStuckTarget.y - this.y) * t;
      if (pointInPolygonStrict({ x: nx, y: ny }, bctx.activePolygon)) {
        this.x = nx;
        this.y = ny;
      }
      this.antiStuckFramesLeft--;
      if (this.antiStuckFramesLeft <= 0) {
        this.antiStuckTarget = null;
      }
    }

    const phaseMult = this.phaseBehavior
      ? this.phaseBehavior.speedMultiplier
      : this.enraged
        ? 1.12
        : 1.0;
    let frenzyMult = 1.0;
    if (this.eliteMutation === 'FRENZY_PULSE') {
      this.eliteFrenzyTimer = (this.eliteFrenzyTimer + bctx.dt) % 5.0;
      if (this.eliteFrenzyTimer >= 3.4) {
        frenzyMult = 1.45;
      }
    }
    const effectiveSpeedScale = bctx.speedScale * phaseMult * this.pinballSpeedBoost * frenzyMult;

    if (this.eliteMutation === 'MAGMA_WAKE') {
      this.eliteWakeTimer -= bctx.dt;
      if (this.eliteWakeTimer <= 0) {
        this.eliteWakeTimer = 1.35;
        const dPlayer = Math.hypot(bctx.playerPos.x - this.x, bctx.playerPos.y - this.y);
        if (dPlayer >= 90 && pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) {
          bctx.hazards?.spawnMagmaPool({ x: this.x, y: this.y }, 2.6, 20);
        }
      }
    }

    this.orbitBladeAngle += bctx.dt * (this.combatPhase >= 3 ? 4.4 : 3.0);

    if (this.phaseBehavior?.specialMechanic === 'MOLTEN_TRAIL_HAZARD') {
      this.moltenTrailTimer -= bctx.dt * effectiveSpeedScale;
      if (this.moltenTrailTimer <= 0) {
        this.moltenTrailTimer = this.combatPhase >= 3 ? 0.85 : 1.15;
        const dPlayer = Math.hypot(bctx.playerPos.x - this.x, bctx.playerPos.y - this.y);
        if (dPlayer >= 96 && pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) {
          bctx.projectiles.spawnEnemyBullet(
            { x: this.x, y: this.y },
            0,
            0,
            '#FF5818',
            7,
            0,
            2.1,
            true
          );
        }
      }
    }

    this.updateBehavior(bctx, effectiveSpeedScale);
    this.enforceWallBounce(bctx.activePolygon);

    // 1.8s Pocket Crush failsafe if polygon shrinks smaller than 0.45x radius
    if (bctx.speedScale > 0.05) {
      const moved = Math.hypot(this.x - this.prevX, this.y - this.prevY);
      const polyArea = computeArea(bctx.activePolygon);
      const pocketAreaThreshold = Math.PI * this.boundingRadius * this.boundingRadius * 2.2;
      const wedgedTight =
        (corridorWidth < this.boundingRadius * 1.25 && moved < 1.2) ||
        (polyArea < pocketAreaThreshold && moved < 1.8);

      if (wedgedTight) {
        this.pocketCrushTimer += bctx.dt;
        if (this.pocketCrushTimer >= 1.8) {
          this.crushedInPocket = true;
          this.alive = false;
        }
      } else {
        this.pocketCrushTimer = Math.max(0, this.pocketCrushTimer - bctx.dt * 2);
      }
    }
  }

  /**
   * V7 Difficulty Aim (`FIXED_SPREAD` on `KOLAY`, `DIRECT_AIM` on `ORTA`, `PREDICTIVE_LEAD_AIM` on `ZOR`)!
   */
  protected resolveDifficultyAimAngle(bctx: BossUpdateContext, projSpeed: number): number {
    const mode = bctx.aimMode ?? 'DIRECT_AIM';
    const dx = bctx.playerPos.x - this.x;
    const dy = bctx.playerPos.y - this.y;
    const rawAim = Math.atan2(dy, dx);

    if (mode === 'FIXED_SPREAD') {
      const octant = Math.PI / 4;
      return Math.round(rawAim / octant) * octant;
    }

    if (mode === 'PREDICTIVE_LEAD_AIM' && bctx.playerVel) {
      const dist = Math.hypot(dx, dy);
      const leadSec = Math.min(0.65, dist / Math.max(160, projSpeed));
      const tx = bctx.playerPos.x + bctx.playerVel.x * leadSec;
      const ty = bctx.playerPos.y + bctx.playerVel.y * leadSec;
      return Math.atan2(ty - this.y, tx - this.x);
    }

    return rawAim;
  }

  protected spawnBossBullet(
    bctx: BossUpdateContext,
    vx: number,
    vy: number,
    color: string,
    radius = 5.5,
    homingTurnRate = 0,
    lifeLeftSec = -1,
    bouncesLeft = 0
  ): void {
    const overclock = this.eliteMutation === 'SNIPER_OVERCLOCK' ? 1.28 : 1.0;
    bctx.projectiles.spawnEnemyBullet(
      { x: this.x, y: this.y },
      vx * overclock,
      vy * overclock,
      color,
      radius,
      homingTurnRate,
      lifeLeftSec,
      true,
      bouncesLeft
    );
  }

  protected firePhasePattern(
    bctx: BossUpdateContext,
    speedScale: number,
    baseColor: string = PALETTE.CUT_ORANGE
  ): void {
    const distToPlayer = Math.hypot(bctx.playerPos.x - this.x, bctx.playerPos.y - this.y);
    if (distToPlayer < 100 || !pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) {
      return;
    }

    const pattern = this.phaseBehavior?.projectilePattern ?? 'SPREAD_3';
    const spdBase = 240 * Math.min(1.4, speedScale);
    const aim = this.resolveDifficultyAimAngle(bctx, spdBase);
    const color =
      this.combatPhase >= 3 ? '#FF2838' : this.combatPhase === 2 ? '#FF9018' : baseColor;

    switch (pattern) {
      case 'SINGLE_AIMED': {
        this.spawnBossBullet(bctx, Math.cos(aim) * spdBase, Math.sin(aim) * spdBase, color, 5.5);
        break;
      }
      case 'SPREAD_3': {
        for (const off of [-0.24, 0, 0.24]) {
          const a = aim + off;
          this.spawnBossBullet(bctx, Math.cos(a) * spdBase, Math.sin(a) * spdBase, color, 5.5);
        }
        break;
      }
      case 'SPREAD_5': {
        for (const off of [-0.44, -0.22, 0, 0.22, 0.44]) {
          const a = aim + off;
          this.spawnBossBullet(bctx, Math.cos(a) * spdBase, Math.sin(a) * spdBase, color, 5.5);
        }
        break;
      }
      case 'SPIRAL_RING': {
        this.spiralPhaseAngle += 0.38;
        for (let i = 0; i < 8; i++) {
          const a = this.spiralPhaseAngle + (i * Math.PI) / 4;
          this.spawnBossBullet(
            bctx,
            Math.cos(a) * spdBase,
            Math.sin(a) * spdBase,
            i % 2 === 0 ? color : '#FFE068',
            5.5
          );
        }
        break;
      }
      case 'SWEEPING_BEAM': {
        const sweep = Math.sin(bctx.timeSeconds * 3.8) * 0.28;
        for (let k = 0; k < 3; k++) {
          const a = aim + sweep + (k - 1) * 0.11;
          const s = (250 + k * 24) * Math.min(1.4, speedScale);
          this.spawnBossBullet(bctx, Math.cos(a) * s, Math.sin(a) * s, '#FF3828', 6);
        }
        break;
      }
      case 'TETHER_VOLLEY': {
        for (const off of [-0.36, -0.12, 0.12, 0.36]) {
          const a = aim + off;
          this.spawnBossBullet(bctx, Math.cos(a) * spdBase, Math.sin(a) * spdBase, '#50E8FF', 5.5);
        }
        break;
      }
      case 'HOMING_SWARM': {
        const hSpd = 205 * Math.min(1.3, speedScale);
        for (const off of [-0.35, 0.35]) {
          const a = aim + off;
          this.spawnBossBullet(
            bctx,
            Math.cos(a) * hSpd,
            Math.sin(a) * hSpd,
            '#FF68D8',
            6,
            1.15,
            4.2
          );
        }
        break;
      }
    }
  }

  protected enforceWallBounce(activePolygon: readonly Point[]): void {
    const solved = resolvePolygonPenetration(
      { x: this.x, y: this.y },
      this.boundingRadius,
      activePolygon
    );
    this.x = solved.position.x;
    this.y = solved.position.y;

    if (solved.collidedNormal) {
      const nx = solved.collidedNormal.x;
      const ny = solved.collidedNormal.y;
      const dot = this.vx * nx + this.vy * ny;
      if (dot < 0) {
        this.vx -= 2 * dot * nx;
        this.vy -= 2 * dot * ny;
      }
    }
  }

  protected renderPhaseAuraAndWings(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    timeSeconds: number
  ): void {
    if (this.combatPhase < 2) return;

    const overdrive = this.combatPhase >= 3 || this.phaseBehavior?.visualTint === 'CRIMSON_OVERDRIVE';
    const wingFrame: 0 | 1 = Math.floor(timeSeconds * (overdrive ? 10 : 7)) % 2 === 0 ? 0 : 1;
    const wings = getMoltenPhaseWingsSprite(wingFrame, overdrive);
    blitArenaPixelSprite(
      ctx,
      wings,
      px,
      py - this.boundingRadius * 0.22,
      this.renderScale * 1.48,
      0
    );

    ctx.save();
    const pulseR = Math.round(this.boundingRadius * (0.95 + Math.sin(timeSeconds * 10) * 0.08));
    ctx.strokeStyle = overdrive ? 'rgba(255, 48, 56, 0.65)' : 'rgba(255, 148, 24, 0.58)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(Math.round(px), Math.round(py), pulseR, 0, Math.PI * 2);
    ctx.stroke();

    if (this.phaseBehavior?.specialMechanic === 'ORBITING_SHIELD_BLADES') {
      const orbitDist = this.boundingRadius * 1.42;
      for (let i = 0; i < 4; i++) {
        const ang = this.orbitBladeAngle + (i * Math.PI) / 2;
        const bx = Math.round(px + Math.cos(ang) * orbitDist);
        const by = Math.round(py + Math.sin(ang) * orbitDist);
        ctx.fillStyle = PALETTE.PIXEL_BLACK;
        ctx.fillRect(bx - 10, by - 10, 20, 20);
        ctx.fillStyle = overdrive ? '#FF3830' : '#FF9820';
        ctx.fillRect(bx - 8, by - 8, 16, 16);
        ctx.fillStyle = '#FFF498';
        ctx.fillRect(bx - 4, by - 4, 8, 8);
      }
    }
    ctx.restore();
  }

  protected renderHitPixelFlash(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    radius: number
  ): void {
    if (this.hitFlash <= 0) return;
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#FFF8B8';
    const r = Math.round(radius);
    ctx.fillRect(
      Math.round(px - r * 0.75),
      Math.round(py - r * 0.75),
      Math.round(r * 1.5),
      Math.round(r * 1.5)
    );
    ctx.restore();
  }

  protected renderHealthBar(
    ctx: CanvasRenderingContext2D,
    rx: number,
    ry: number,
    forceVisible = false
  ): void {
    if (this.hp >= this.maxHp && !forceVisible) return;
    const barW = 66;
    const barH = 9;
    const bx = Math.round(rx - barW * 0.5);
    const by = Math.round(ry - this.boundingRadius - 18);

    ctx.save();
    ctx.fillStyle = '#080810';
    ctx.fillRect(bx - 3, by - 3, barW + 6, barH + 6);
    ctx.strokeStyle = '#E8F0FC';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - 1, by - 1, barW + 2, barH + 2);

    const segGap = 2;
    const segW = (barW - segGap * (this.maxHp - 1)) / this.maxHp;
    const ratio = this.hp / this.maxHp;
    const fillCol = ratio > 0.5 ? '#28E038' : ratio > 0.25 ? '#FFD030' : '#FF3020';
    ctx.fillStyle = fillCol;
    const visibleSegs = Math.ceil(this.hp);
    for (let i = 0; i < visibleSegs; i++) {
      ctx.fillRect(Math.round(bx + i * (segW + segGap)), by, Math.max(1, Math.round(segW)), barH);
    }
    ctx.restore();
  }

  protected abstract updateBehavior(bctx: BossUpdateContext, speedScale: number): void;
  public abstract render(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    timeSeconds: number,
    bossCannonArmed?: boolean
  ): void;
}

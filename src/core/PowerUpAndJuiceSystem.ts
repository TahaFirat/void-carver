/**
 * VOID CARVER — BUILD 12: POWER-UP CRYSTALS, 1-HIT TRAIL SHIELD, RESPAWN SHOCKWAVE & ARCADE JUICE
 * (`src/core/PowerUpAndJuiceSystem.ts`)
 *
 * Proactively solves hidden mobile pain points & amplifies arcade dopamine:
 * 1. Collectible Void Power-Up Crystals (captured when enclosed inside a completed polygon cut!):
 *    - `TIME_FREEZE` (5s): Freezes boss & all minions solid (classic 1989 arcade "T" block!).
 *    - `SPEED_BOOST` (6.5s): +60% player cutting speed ("S" block!).
 *    - `TRAIL_SHIELD_1HIT`: Absorbs 1 fatal hit while drawing a trail, safely rewinding ship to border!
 *    - `LASER_CANNON` (6s): Fires twin plasma bolts from the border to stun boss & destroy minions ("L" block!).
 * 2. Respawn Anti-Spawn-Kill Shockwave: Pushes all enemies >= 145px away and grants 3.0s invulnerability.
 * 3. Arcade Reward Moments: `Close-Call (+600)`, `Minion Crush Combo (x2..x6)`, `Mega Cut (>=25%)`.
 */

import { AutonomousMinionState, Vec2 } from './AutonomousMinionEcology';

export type PowerUpType = 'TIME_FREEZE' | 'SPEED_BOOST' | 'TRAIL_SHIELD_1HIT' | 'LASER_CANNON';

export interface FieldCrystal {
  id: string;
  pos: Vec2;
  type: PowerUpType;
  labelTr: string;
  remainingLifetimeSec: number;
}

export interface PlayerPowerState {
  hasOneHitTrailShield: boolean;
  speedBoostRemainingSec: number;
  timeFreezeRemainingSec: number;
  laserCannonRemainingSec: number;
  respawnInvulnRemainingSec: number;
}

export const POWERUP_LABELS_TR: Record<PowerUpType, string> = {
  TIME_FREEZE: '❄️ ZAMAN DONDURMA!',
  SPEED_BOOST: '⚡ TURBO KESİM!',
  TRAIL_SHIELD_1HIT: '🛡️ ÇİZGİ KALKANI!',
  LASER_CANNON: '🔫 PLAZMA LAZERİ!'
};

export class PowerUpAndJuiceSystem {
  public crystals: FieldCrystal[] = [];
  public powerState: PlayerPowerState = {
    hasOneHitTrailShield: false,
    speedBoostRemainingSec: 0,
    timeFreezeRemainingSec: 0,
    laserCannonRemainingSec: 0,
    respawnInvulnRemainingSec: 0
  };

  public spawnCrystal(id: string, pos: Vec2, type: PowerUpType): FieldCrystal {
    const c: FieldCrystal = {
      id,
      pos: { ...pos },
      type,
      labelTr: POWERUP_LABELS_TR[type],
      remainingLifetimeSec: 18.0
    };
    this.crystals.push(c);
    return c;
  }

  public activatePowerUp(type: PowerUpType, minions: AutonomousMinionState[]): string {
    switch (type) {
      case 'TIME_FREEZE':
        this.powerState.timeFreezeRemainingSec = 5.0;
        for (const m of minions) m.frozenTimerSec = Math.max(m.frozenTimerSec, 5.0);
        return POWERUP_LABELS_TR.TIME_FREEZE;
      case 'SPEED_BOOST':
        this.powerState.speedBoostRemainingSec = 6.5;
        return POWERUP_LABELS_TR.SPEED_BOOST;
      case 'TRAIL_SHIELD_1HIT':
        this.powerState.hasOneHitTrailShield = true;
        return POWERUP_LABELS_TR.TRAIL_SHIELD_1HIT;
      case 'LASER_CANNON':
        this.powerState.laserCannonRemainingSec = 6.0;
        return POWERUP_LABELS_TR.LASER_CANNON;
    }
  }

  /**
   * Intercepts a fatal hit on the player's ship or trail:
   * - If respawn invulnerability is active -> ignore hit!
   * - If 1-Hit Trail Shield is active -> consume shield, cancel death, and safely rewind ship to borderOrigin!
   */
  public resolveIncomingPlayerHit(borderOrigin: Vec2): {
    playerDied: boolean;
    shieldAbsorbed: boolean;
    rewindToPos: Vec2 | null;
    bannerTextTr: string | null;
  } {
    if (this.powerState.respawnInvulnRemainingSec > 0) {
      return { playerDied: false, shieldAbsorbed: true, rewindToPos: null, bannerTextTr: null };
    }
    if (this.powerState.hasOneHitTrailShield) {
      this.powerState.hasOneHitTrailShield = false;
      this.powerState.respawnInvulnRemainingSec = 1.6;
      return {
        playerDied: false,
        shieldAbsorbed: true,
        rewindToPos: { ...borderOrigin },
        bannerTextTr: '🛡️ KALKAN SENİ KURTARDI!'
      };
    }
    return { playerDied: true, shieldAbsorbed: false, rewindToPos: null, bannerTextTr: null };
  }

  /**
   * Prevents instant spawn-kill after losing a life on the same level!
   */
  public triggerRespawnShockwave(
    playerSpawnPos: Vec2,
    minions: AutonomousMinionState[],
    minSafeRadiusPx = 145
  ): void {
    this.powerState.respawnInvulnRemainingSec = 3.0;
    for (const m of minions) {
      const dx = m.pos.x - playerSpawnPos.x;
      const dy = m.pos.y - playerSpawnPos.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < minSafeRadiusPx) {
        const nx = dx / d;
        const ny = dy / d;
        m.pos.x = playerSpawnPos.x + nx * minSafeRadiusPx;
        m.pos.y = playerSpawnPos.y + ny * minSafeRadiusPx;
        const spd = Math.hypot(m.vel.x, m.vel.y) || m.baseSpeedPx;
        m.vel.x = nx * spd;
        m.vel.y = ny * spd;
      }
    }
  }

  public computeCutRewards(
    cutAreaDeltaPercent: number,
    crushedMinionCount: number,
    nearestEnemyDistAtClosePx: number
  ): {
    bonusScore: number;
    bonusShieldSec: number;
    calloutsTr: string[];
    triggerHitStopMs: number;
  } {
    let bonusScore = Math.round(cutAreaDeltaPercent * 120);
    let bonusShieldSec = 0;
    const calloutsTr: string[] = [];
    let triggerHitStopMs = 0;

    if (cutAreaDeltaPercent >= 25) {
      bonusScore += 2500;
      bonusShieldSec += 6;
      calloutsTr.push(`🔥 DEV KESİM +%${Math.round(cutAreaDeltaPercent)}!`);
      triggerHitStopMs = Math.max(triggerHitStopMs, 110);
    }

    if (crushedMinionCount > 0) {
      const comboMult = Math.min(6, crushedMinionCount);
      bonusScore += crushedMinionCount * 450 * comboMult;
      bonusShieldSec += crushedMinionCount * 3;
      calloutsTr.push(
        crushedMinionCount >= 2
          ? `💥 ${crushedMinionCount}x EZME KOMBOSU!`
          : '💥 YARATIK EZİLDİ!'
      );
      triggerHitStopMs = Math.max(triggerHitStopMs, 85);
    }

    if (nearestEnemyDistAtClosePx <= 22) {
      bonusScore += 600;
      calloutsTr.push('⚡ KIL PAYI KURTULUŞ +600!');
      triggerHitStopMs = Math.max(triggerHitStopMs, 95);
    }

    return { bonusScore, bonusShieldSec, calloutsTr, triggerHitStopMs };
  }

  public stepTimers(dtSec: number): void {
    this.powerState.speedBoostRemainingSec = Math.max(0, this.powerState.speedBoostRemainingSec - dtSec);
    this.powerState.timeFreezeRemainingSec = Math.max(0, this.powerState.timeFreezeRemainingSec - dtSec);
    this.powerState.laserCannonRemainingSec = Math.max(0, this.powerState.laserCannonRemainingSec - dtSec);
    this.powerState.respawnInvulnRemainingSec = Math.max(0, this.powerState.respawnInvulnRemainingSec - dtSec);

    for (let i = this.crystals.length - 1; i >= 0; i--) {
      this.crystals[i]!.remainingLifetimeSec -= dtSec;
      if (this.crystals[i]!.remainingLifetimeSec <= 0) {
        this.crystals.splice(i, 1);
      }
    }
  }
}

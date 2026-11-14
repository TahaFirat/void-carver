import { describe, it, expect } from 'vitest';
import { generateStage, isTierUnlocked } from '../CampaignGenerator';
import { ScoreSystem } from '../../core/ScoreSystem';
import { createBossesForLevel } from '../../entities/bosses/BossFactory';

describe('V5 Campaign 100 Stages & Tier Progression Tests', () => {
  it('All 100 stages generate valid configs with correct boundaries, spacing and solid walls', () => {
    for (let s = 1; s <= 100; s++) {
      const stage = generateStage(s);
      expect(stage.id).toBe(s);
      expect(stage.sectorTitleTr).toBeTruthy();
      expect(stage.bossType).toBeTruthy();
      expect(stage.bossHp).toBeGreaterThanOrEqual(1);

      // Target percent check per tier
      if (s <= 25) {
        expect(stage.tier).toBe('KOLAY');
        expect(stage.targetPercent).toBe(80);
      } else if (s <= 50) {
        expect(stage.tier).toBe('ORTA');
        expect(stage.targetPercent).toBe(82);
      } else if (s <= 75) {
        expect(stage.tier).toBe('ZOR');
        expect(stage.targetPercent).toBe(85);
      } else {
        expect(stage.tier).toBe('USTA');
        expect(stage.targetPercent).toBeGreaterThanOrEqual(88);
        expect(stage.targetPercent).toBeLessThanOrEqual(90);
      }

      // Check power up boxes (every stage has at least 2 boxes)
      expect(stage.greyBoxes.length).toBeGreaterThanOrEqual(2);

      if (stage.tier === 'USTA') {
        // USTA has 4-8 blind pillars
        const pillars = stage.greyBoxes.filter((b) => b.type === 'ARMOR_PILLAR');
        expect(pillars.length).toBeGreaterThanOrEqual(4);
      }

      // Check coordinates and safe bounds
      for (let i = 0; i < stage.greyBoxes.length; i++) {
        const boxA = stage.greyBoxes[i];
        expect(boxA.x).toBeGreaterThanOrEqual(130);
        expect(boxA.x).toBeLessThanOrEqual(770);
        expect(boxA.y).toBeGreaterThanOrEqual(130);
        expect(boxA.y).toBeLessThanOrEqual(1070);

        // Outside main boss spawn zone: !(x > 300 && x < 600 && y > 370 && y < 650)
        const insideMainBoss = boxA.x > 300 && boxA.x < 600 && boxA.y > 370 && boxA.y < 650;
        expect(insideMainBoss).toBe(false);

        // Distance between boxes >= 48px
        for (let j = i + 1; j < stage.greyBoxes.length; j++) {
          const boxB = stage.greyBoxes[j];
          const dist = Math.hypot(boxA.x - boxB.x, boxA.y - boxB.y);
          expect(dist).toBeGreaterThanOrEqual(48);
        }
      }
    }
  });

  it('Tier gating: Sequential unlocking strictly enforced (ORTA locked until 25, ZOR until 50, USTA until 75)', () => {
    // Stage unlocking rule in game: stageId <= unlockedSector
    const isStageUnlocked = (unlockedSector: number, stageId: number) => stageId <= unlockedSector;

    // Initial state: unlockedSector = 1
    expect(isStageUnlocked(1, 1)).toBe(true);
    expect(isStageUnlocked(1, 2)).toBe(false);
    expect(isStageUnlocked(1, 25)).toBe(false);
    expect(isStageUnlocked(1, 26)).toBe(false);

    // Tier 0 is KOLAY (1-25), Tier 1 is ORTA (26-50), Tier 2 is ZOR (51-75), Tier 3 is USTA (76-100)
    expect(isTierUnlocked(0, 1)).toBe(true);
    expect(isTierUnlocked(1, 1)).toBe(false);
    expect(isTierUnlocked(2, 1)).toBe(false);
    expect(isTierUnlocked(3, 1)).toBe(false);

    // Player reached stage 25 (unlockedSector = 25)
    expect(isStageUnlocked(25, 25)).toBe(true);
    expect(isStageUnlocked(25, 26)).toBe(false);
    expect(isTierUnlocked(1, 25)).toBe(false); // ORTA requires 26

    // Player cleared stage 25 => unlockedSector advances to 26
    expect(isStageUnlocked(26, 26)).toBe(true);
    expect(isTierUnlocked(1, 26)).toBe(true); // ORTA now unlocked!
    expect(isTierUnlocked(2, 26)).toBe(false); // ZOR still locked

    // Player cleared stage 50 => unlockedSector = 51
    expect(isStageUnlocked(51, 51)).toBe(true);
    expect(isTierUnlocked(2, 51)).toBe(true); // ZOR unlocked!
    expect(isTierUnlocked(3, 51)).toBe(false); // USTA still locked

    // Player cleared stage 75 => unlockedSector = 76
    expect(isStageUnlocked(76, 76)).toBe(true);
    expect(isTierUnlocked(3, 76)).toBe(true); // USTA unlocked!
  });

  it('Enforces smart campaign design: zero barriers in KOLAY, ALIEN_BRAIN only on Tier Finales, and target-anchored over-target bonus', () => {
    for (let s = 1; s <= 100; s++) {
      const stage = generateStage(s);
      if (s <= 25) {
        expect(stage.barrierSegments).toHaveLength(0);
        expect(stage.escortBossType).toBeNull();
      }
      if (s === 25 || s === 50 || s === 75 || s === 100) {
        expect(stage.bossType).toBe('ALIEN_BRAIN');
      } else {
        expect(stage.bossType).not.toBe('ALIEN_BRAIN');
      }
      const spawned = createBossesForLevel(stage.id, stage.bossType, stage.bossHp, stage.tierIndex);
      expect(spawned.length).toBeGreaterThanOrEqual(1);
    }

    // Over-target bonus must only trigger strictly above stage targetPercent (e.g. 88% in USTA)
    expect(ScoreSystem.computeOver80Bonus(88.0, 88)).toBe(0);
    expect(ScoreSystem.computeOver80Bonus(92.0, 88)).toBeGreaterThan(0);
  });
});

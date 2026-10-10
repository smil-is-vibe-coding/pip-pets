import type { PoseName } from "../anim/pose";
import { type Vec, bump, chance, clamp, pick, rand } from "../core/math";
import type { Pet } from "../pet";
import type { Needs } from "../sim/life";
import type { Spot, SpotKind } from "../world/types";
import { Trip } from "./trip";

export type ActionId =
  | "idle"
  | "explore"
  | "watch"
  | "perch"
  | "loaf"
  | "groom"
  | "stretch"
  | "sleep"
  | "checkBowl"
  | "eat"
  | "drink"
  | "seekAttention"
  | "petted"
  | "annoyed"
  | "play"
  | "hunt"
  | "batYarn"
  | "scratch"
  | "hide"
  | "cowork"
  | "zoomies"
  | "knead"
  | "meow"
  | "startled"
  // Cue-driven routines (the productivity layer asks for these).
  | "celebrate"
  | "remind"
  | "greet"
  | "stretchRoutine"
  | "drinkBreak"
  | "lookOutside"
  | "focusNap"
  | "goodnight";

export interface ActionInstance {
  /** Return true when finished. `t` = seconds since start. */
  update(t: number, dt: number): boolean | void;
  exit?(): void;
  /** How strongly mood body-language applies during this action (default 1). */
  styleWeight?: number;
}

export interface ActionDef {
  id: ActionId;
  /** Higher-priority actions may interrupt lower ones. */
  priority: number;
  /** Utility for the autonomous brain; omit for reaction/cue-only actions. */
  score?: (pet: Pet) => number;
  /** Allowed while the human is focusing (calm actions only). */
  calm?: boolean;
  start: (pet: Pet, arg?: unknown) => ActionInstance;
}

const DONE: ActionInstance = { update: () => true };

// ---------------------------------------------------------------- helpers

const needs = (pet: Pet) => pet.life.needs;
const lvl = (pet: Pet, need: keyof Needs) => pet.hintLevel(need);
const onFloor = (pet: Pet) => pet.body.surfaceId === "floor";

/** Plan a trip to a spot (or a point on a surface). */
function tripTo(
  pet: Pet,
  target: Spot | { surface: string; x: number },
  speed = 55,
) {
  return new Trip(
    pet,
    pet.world.route({ surface: pet.body.surfaceId, x: pet.body.x }, target),
    speed,
  );
}

/** Arrive at a spot: face sensibly, take its pose, remember the visit. */
function settle(pet: Pet, spot: Spot, pose?: PoseName, stiffness = 70) {
  const b = pet.body;
  b.stop();
  b.faceTo(spot.facing ?? (b.x < pet.world.width / 2 ? 1 : -1));
  b.setPose(pose ?? spot.pose ?? "sit", {}, stiffness);
  pet.world.markVisited(spot.id);
  pet.atSpot = spot.id;
}

/** Small idle quirks: head tilts, bleps, slow blinks, yawns, ear flicks. */
function fidgets(pet: Pet) {
  let next = rand(1.2, 3.5);
  let undo: (() => void) | null = null;
  let until = 0;
  const b = pet.body;
  const temporarily = (
    t: number,
    change: Parameters<typeof b.adjustPose>[0],
    dur: number,
  ) => {
    const prev = Object.fromEntries(
      Object.keys(change).map((k) => [k, b.base[k as keyof typeof change]]),
    );
    b.adjustPose(change);
    undo = () => b.adjustPose(prev);
    until = t + dur;
  };
  return (t: number, dt: number) => {
    if (undo && t > until) {
      undo();
      undo = null;
    }
    next -= dt;
    if (next > 0 || undo) return;
    next = rand(2, 5.5);
    const r = Math.random();
    if (r < 0.22)
      temporarily(
        t,
        { headRot: b.base.headRot + pick([-14, 14]) },
        rand(1, 2.2),
      );
    else if (r < 0.32) temporarily(t, { tongue: 1 }, rand(1.2, 2.6));
    else if (r < 0.46 && needs(pet).affection > 50) b.blink(true);
    else if (r < 0.56 && pet.mood === "playful") pet.think("yarn");
    else if (r < 0.66 && (pet.mood === "sleepy" || needs(pet).energy < 45)) {
      temporarily(
        t,
        { mouthOpen: 1, eyeOpen: 0, eyeHappy: 0.3, earL: 14, earR: 14 },
        1.3,
      );
      pet.sound("yawn");
    } else if (r < 0.74 && chance(pet.personality.vocal * 0.6))
      pet.speak("mew");
    else b.kick(chance(0.5) ? "earL" : "earR", rand(200, 380));
  };
}

/** Look at the cursor while it's moving around, otherwise glance about. */
function attend(pet: Pet) {
  const b = pet.body;
  if (pet.pointerRecent && pet.props.pointer) {
    b.lookMode = "target";
    b.lookTarget = pet.props.pointer;
  } else if (b.lookMode === "target") {
    b.lookMode = "around";
  }
}

/**
 * The common shape of most behaviors: travel to a spot, then do something there.
 * `arrive` runs once on arrival; `stay` runs every frame after and returns true when done.
 */
function visit(
  pet: Pet,
  spot: Spot | undefined,
  opts: {
    speed?: number;
    pose?: PoseName;
    arrive?: (t: number) => void;
    stay: (t: number, dt: number) => boolean | void;
    exit?: () => void;
    styleWeight?: number;
  },
): ActionInstance {
  if (!spot) return DONE;
  const trip = tripTo(pet, spot, opts.speed);
  if (trip.failed) return DONE;
  let arrivedAt = -1;
  return {
    styleWeight: opts.styleWeight,
    update(t, dt) {
      if (arrivedAt < 0) {
        if (!trip.update()) return false;
        arrivedAt = t;
        settle(pet, spot, opts.pose);
        opts.arrive?.(t);
        return false;
      }
      return opts.stay(t - arrivedAt, dt) === true;
    },
    exit() {
      trip.cancel();
      opts.exit?.();
    },
  };
}

const restful = (pet: Pet) => needs(pet).energy < 60;

// ---------------------------------------------------------------- everyday life

const idle: ActionDef = {
  id: "idle",
  priority: 1,
  calm: true,
  score: () => 0.8,
  start(pet) {
    const b = pet.body;
    b.stop();
    b.setPose(
      onFloor(pet)
        ? chance(0.65)
          ? "sit"
          : "stand"
        : chance(0.5)
          ? "sit"
          : "loaf",
    );
    b.lookMode = "around";
    const dur = rand(4, 9) * (1 - pet.personality.chaotic * 0.35);
    const fidget = fidgets(pet);
    return {
      update(t, dt) {
        attend(pet);
        fidget(t, dt);
        return t > dur;
      },
    };
  },
};

const explore: ActionDef = {
  id: "explore",
  priority: 1,
  score: (pet) =>
    needs(pet).energy > 25
      ? 1 + pet.personality.playful * 0.3 - pet.personality.lazy * 0.3
      : 0.15,
  start(pet) {
    const b = pet.body;
    const spot = pet.world.randomSpot(pet.atSpot ?? undefined);
    const fidget = fidgets(pet);
    const linger = rand(3, 8);
    return visit(pet, spot, {
      speed: rand(42, 60),
      pose: "stand",
      arrive: () => {
        b.lookMode = "none";
        pet.sound("sniff");
      },
      stay(t, dt) {
        if (t < 1.3) {
          // Sniff whatever is here.
          b.offsets.headY = 9 + Math.sin(t * 22) * 1.2;
          b.offsets.headRot = 12;
          b.offsets.whisker = Math.sin(t * 30) * 4;
          return false;
        }
        if (t < 1.4) {
          b.setPose(spot?.pose === "sleep" ? "loaf" : (spot?.pose ?? "sit"));
          b.lookMode = "around";
        }
        attend(pet);
        fidget(t, dt);
        return t > linger;
      },
    });
  },
};

const watch: ActionDef = {
  id: "watch",
  priority: 1,
  calm: true,
  score: (pet) =>
    pet.world.spotOf("window")
      ? 0.5 + (pet.world.birds.length ? 3 : 0) + pet.personality.chaotic * 0.2
      : 0,
  start(pet, arg) {
    const b = pet.body;
    const dur = typeof arg === "number" ? arg : rand(8, 18);
    let nextChatter = 1;
    return visit(pet, pet.world.pickSpot("window", 0), {
      stay(t, dt) {
        const bird = pet.world.birds.find((x) => !x.leaving);
        if (bird) {
          b.lookMode = "target";
          b.lookTarget = bird;
          pet.life.needs.fun = clamp(pet.life.needs.fun + dt * 1.5, 0, 100);
          nextChatter -= dt;
          if (nextChatter < 0) {
            // The excited bird-chatter: rapid tiny jaw flutters.
            b.offsets.mouthOpen = Math.max(0, Math.sin(t * 40)) * 0.4;
            if (nextChatter < -0.6) {
              nextChatter = rand(1.5, 4);
              pet.sound("chirp");
            }
          }
          b.offsets.tailSway = 10;
        } else {
          b.lookMode = "around";
        }
        return t > dur;
      },
    });
  },
};

const perch: ActionDef = {
  id: "perch",
  priority: 1,
  calm: true,
  score: (pet) =>
    pet.world.spotOf("perch") && needs(pet).energy > 35
      ? 0.45 + pet.personality.chaotic * 0.4 + pet.personality.playful * 0.2
      : 0,
  start(pet) {
    const fidget = fidgets(pet);
    const dur = rand(10, 22);
    return visit(pet, pet.world.pickSpot("perch"), {
      stay(t, dt) {
        attend(pet);
        fidget(t, dt);
        return t > dur;
      },
    });
  },
};

const loaf: ActionDef = {
  id: "loaf",
  priority: 1,
  calm: true,
  score: (pet) =>
    restful(pet) ? 0.6 + pet.personality.lazy : 0.25 * pet.personality.lazy,
  start(pet) {
    const b = pet.body;
    const dur = rand(8, 18) * (0.6 + pet.personality.lazy);
    let nextBlink = rand(2, 5);
    return visit(pet, pet.world.pickSpot(["sunpatch", "rug", "perch", "bed"]), {
      pose: "loaf",
      stay(t, dt) {
        attend(pet);
        nextBlink -= dt;
        if (nextBlink < 0) {
          b.blink(true);
          nextBlink = rand(3, 7);
        }
        return t > dur;
      },
    });
  },
};

const groom: ActionDef = {
  id: "groom",
  priority: 1,
  calm: true,
  score: () => 0.35,
  start(pet) {
    const b = pet.body;
    b.stop();
    b.setPose("sit");
    b.lookMode = "none";
    const licks = rand(3, 5.5);
    let phase: "settle" | "lick" | "done" = "settle";
    return {
      styleWeight: 0.3,
      update(t) {
        if (phase === "settle" && t > 0.5) {
          phase = "lick";
          b.setPose("groom", {}, 80);
        }
        if (phase === "lick") {
          const lt = t - 0.5;
          // Paw strokes over the face while the tongue flicks.
          b.offsets.fnA = Math.sin(lt * 7) * 10;
          b.offsets.headRot = Math.sin(lt * 7 + 0.6) * 6;
          b.offsets.tongue = Math.max(0, Math.sin(lt * 14)) * 0.9;
          if (lt > licks) {
            phase = "done";
            b.setPose("sit");
          }
        }
        return phase === "done" && t > licks + 1.4;
      },
    };
  },
};

const stretch: ActionDef = {
  id: "stretch",
  priority: 1,
  calm: true,
  score: () => 0.2,
  start(pet) {
    const b = pet.body;
    b.stop();
    b.setPose("stretch", {}, 35);
    b.lookMode = "none";
    pet.sound("yawn");
    return {
      styleWeight: 0,
      update(t) {
        b.offsets.mouthOpen = bump((t - 0.5) / 1.6);
        b.offsets.bnA = -Math.sin(Math.min(t, 2.2) * 1.4) * 4;
        if (t > 2.4) b.setPose("stand", {}, 60);
        return t > 3.2;
      },
    };
  },
};

/** Picks a nap spot: bed usually, the sun patch by day, sometimes the box or a perch. */
function napSpot(pet: Pet) {
  const w = pet.world;
  const r = Math.random();
  const want: SpotKind[] =
    r < 0.6
      ? ["bed"]
      : r < 0.8
        ? ["sunpatch", "bed"]
        : r < 0.9
          ? ["box", "bed"]
          : ["perch", "bed"];
  return w.pickSpot(want, 0) ?? w.pickSpot(["rug", "front"], 0);
}

function sleepAt(
  pet: Pet,
  spot: Spot | undefined,
  until: () => boolean,
  light = false,
): ActionInstance {
  const b = pet.body;
  let settled = -1;
  let nextZ = 1.5;
  let nextDream = rand(5, 12);
  const inner = visit(pet, spot, {
    pose: "loaf",
    arrive: (t) => {
      b.lookMode = "none";
      settled = t;
    },
    stay(t, dt) {
      if (settled >= 0 && t > 1.4 && !pet.life.asleep) {
        pet.life.asleep = true;
        b.setPose("sleep", {}, 28);
        b.blinkEnabled = false;
        b.breathRate = 0.2;
        b.breathDepth = 1.9;
        b.twitchEnabled = false;
      }
      if (!pet.life.asleep) return false;
      nextZ -= dt;
      if (nextZ < 0) {
        pet.emote("z", { vy: -12 });
        nextZ = rand(1.4, 2.2) * (light ? 1.6 : 1);
      }
      nextDream -= dt;
      if (nextDream < 0) {
        // Dream twitches: an ear, a whisker, or a tiny paw kick.
        const r = Math.random();
        if (r < 0.4) b.kick(chance(0.5) ? "earL" : "earR", rand(150, 300));
        else if (r < 0.7) b.kick("fnA", rand(150, 260));
        else b.kick("whisker", rand(-160, 160));
        nextDream = rand(4, 12);
      }
      return until();
    },
  });
  return {
    styleWeight: 0.15,
    update: inner.update,
    exit() {
      inner.exit?.();
      pet.life.asleep = false;
      b.blinkEnabled = true;
      b.breathRate = 0.42;
      b.breathDepth = 1;
      b.twitchEnabled = true;
      pet.effects.clear("z");
    },
  };
}

const sleep: ActionDef = {
  id: "sleep",
  priority: 1,
  calm: true,
  score: (pet) => {
    const e = needs(pet).energy;
    const dark = pet.props.lightsOff ? 6 : 1;
    if (e < 25) return (4 + pet.personality.lazy * 2) * dark;
    if (e < 55) return 0.35 * pet.personality.lazy * dark;
    return pet.props.lightsOff && e < 90 ? 2 : 0;
  },
  start(pet) {
    const inst = sleepAt(
      pet,
      napSpot(pet),
      () => needs(pet).energy >= 96 && !pet.props.lightsOff,
    );
    return {
      ...inst,
      exit() {
        inst.exit?.();
        pet.queue("stretch");
      },
    };
  },
};

// ---------------------------------------------------------------- food, water, attention

const checkBowl: ActionDef = {
  id: "checkBowl",
  priority: 1,
  score: (pet) =>
    pet.world.bowl.food <= 0.05 && lvl(pet, "fullness") >= 1
      ? 1.2 + lvl(pet, "fullness") * 1.2 + pet.personality.foodie
      : 0,
  start(pet) {
    const b = pet.body;
    const bowl = pet.world.spotOf("bowl");
    if (!bowl) return DONE;
    const side = Math.sign(b.x - bowl.x) || -1;
    const spot: Spot = {
      ...bowl,
      id: "bowl-side",
      x: bowl.x + side * 46 * b.size,
      facing: side > 0 ? -1 : 1,
    };
    let nextMeow = 1.6;
    const dur = rand(6, 9);
    return visit(pet, spot, {
      pose: "stand",
      stay(t, dt) {
        if (t < 1.2) {
          // Sniff the empty bowl…
          b.offsets.headY = 16 + Math.sin(t * 20);
          b.offsets.headRot = 16;
          return false;
        }
        if (t < 1.3) {
          // …then look at you, pointedly.
          b.setPose("beg");
          b.lookMode = "forward";
          if (lvl(pet, "fullness") >= 2) pet.think("fish");
        }
        nextMeow -= dt;
        if (nextMeow < 0) {
          pet.speak(lvl(pet, "fullness") >= 2 ? "meow" : "mew");
          nextMeow = rand(2.5, 4.5);
        }
        return t > dur;
      },
    });
  },
};

const eat: ActionDef = {
  id: "eat",
  priority: 3,
  score: (pet) =>
    pet.world.bowl.food > 0.05 && needs(pet).fullness < 85 ? 6 : 0,
  start(pet) {
    const b = pet.body;
    const w = pet.world;
    const bowl = w.spotOf("bowl");
    if (!bowl) return DONE;
    const side = Math.sign(b.x - bowl.x) || -1;
    const spot: Spot = {
      ...bowl,
      id: "bowl-side",
      x: bowl.x + side * 44 * b.size,
      facing: side > 0 ? -1 : 1,
    };
    let phase: "sniff" | "eat" | "refuse" | "lick" = "sniff";
    let phaseAt = 0;
    let nextCrumb = 0;
    let nextMunch = 0;
    const go = (p: typeof phase, t: number) => {
      phase = p;
      phaseAt = t;
    };
    return visit(pet, spot, {
      speed: 75,
      pose: "eat",
      styleWeight: 0.3,
      arrive: () => {
        b.lookMode = "target";
        b.lookTarget = { x: bowl.x, y: -10 };
        b.adjustPose({ eyeOpen: 1, eyeHappy: 0 });
      },
      stay(t, dt) {
        const pt = t - phaseAt;
        if (phase === "sniff") {
          b.offsets.headY = Math.sin(pt * 18) * 1.2;
          if (pt > 0.8) {
            if (needs(pet).fullness > 90) {
              go("refuse", t);
              b.setPose("sit", { headRot: -10 });
              b.faceTo(b.facing === 1 ? -1 : 1);
              pet.emote("puff");
              pet.sound("hmph");
            } else if (w.bowl.food <= 0.05) {
              return true;
            } else {
              go("eat", t);
              b.setPose("eat", {}, 80);
            }
          }
        } else if (phase === "eat") {
          b.offsets.headY = Math.abs(Math.sin(pt * 9)) * 3;
          b.offsets.headRot = Math.sin(pt * 9) * 3;
          const bite = Math.min(w.bowl.food, dt * 1.6);
          w.bowl.food -= bite;
          needs(pet).fullness = clamp(
            needs(pet).fullness + bite * w.bowl.value,
            0,
            100,
          );
          nextCrumb -= dt;
          if (nextCrumb < 0) {
            pet.effects.spawn(
              "crumb",
              { x: bowl.x + rand(-6, 6), y: -14 },
              { size: rand(0.6, 1) },
            );
            nextCrumb = rand(0.25, 0.6);
          }
          nextMunch -= dt;
          if (nextMunch < 0) {
            pet.sound("munch");
            nextMunch = 0.55;
          }
          if (w.bowl.food <= 0.05 || needs(pet).fullness >= 100) {
            go("lick", t);
            b.setPose("sit");
            b.lookMode = "forward";
          }
        } else if (phase === "lick") {
          b.offsets.tongue =
            Math.max(0, Math.sin(pt * 10)) * (pt < 1.2 ? 1 : 0);
          if (pt > 0.3 && pt < 0.36) pet.emote("sparkle");
          return pt > 1.6;
        } else if (phase === "refuse") {
          return pt > 1.8;
        }
        return false;
      },
    });
  },
};

const drink: ActionDef = {
  id: "drink",
  priority: 1,
  score: (pet) => {
    const h = needs(pet).hydration;
    if (h > 65) return 0;
    return pet.world.water > 0.05
      ? 1.5 + (65 - h) / 15
      : lvl(pet, "hydration") >= 1
        ? 1 + lvl(pet, "hydration")
        : 0;
  },
  start(pet, arg) {
    const b = pet.body;
    const w = pet.world;
    const water = w.spotOf("water");
    if (!water) return DONE;
    const side = Math.sign(b.x - water.x) || -1;
    const spot: Spot = {
      ...water,
      id: "water-side",
      x: water.x + side * 44 * b.size,
      facing: side > 0 ? -1 : 1,
    };
    const minDur = typeof arg === "number" ? arg : 0;
    let empty = false;
    return visit(pet, spot, {
      pose: "eat",
      styleWeight: 0.3,
      arrive: () => {
        b.lookMode = "none";
        empty = w.water <= 0.05;
        if (empty) {
          b.setPose("beg");
          b.lookMode = "forward";
          pet.think("water");
          pet.speak("mew");
        }
      },
      stay(t, dt) {
        if (empty) return t > 5;
        // Lapping: quick tongue flicks with tiny head bobs.
        b.offsets.tongue = Math.max(0, Math.sin(t * 16)) * 0.9;
        b.offsets.headY = Math.abs(Math.sin(t * 8)) * 1.5;
        const sip = Math.min(w.water, dt * 0.07);
        w.water -= sip;
        needs(pet).hydration = clamp(needs(pet).hydration + sip * 420, 0, 100);
        if (Math.random() < dt * 2) pet.sound("lap");
        const done = w.water <= 0.05 || needs(pet).hydration >= 100;
        if (done || t > Math.max(minDur, 4.5)) {
          b.setPose("sit");
          return t > Math.max(minDur, 4.5) + 0.8 || done;
        }
        return false;
      },
    });
  },
};

const seekAttention: ActionDef = {
  id: "seekAttention",
  priority: 1,
  score: (pet) =>
    needs(pet).affection < 40
      ? 1 + pet.personality.cuddly * 2 + lvl(pet, "affection")
      : 0,
  start(pet) {
    const b = pet.body;
    const dur = rand(6, 9);
    return visit(pet, pet.world.spotOf("front"), {
      pose: "beg",
      arrive: () => {
        b.faceTo(chance(0.5) ? 1 : -1);
        b.adjustPose({ tailAngle: 30 });
        b.lookMode = "forward";
        if (lvl(pet, "affection") >= 2) pet.think("heart");
        pet.speak("mew");
        b.blink(true);
      },
      stay(t) {
        // Lean toward the screen, hoping for pets.
        b.offsets.headRot = Math.sin(t * 1.6) * 6;
        return t > dur;
      },
    });
  },
};

// ---------------------------------------------------------------- reactions

const petted: ActionDef = {
  id: "petted",
  priority: 3,
  start(pet) {
    const b = pet.body;
    const lying = b.base.lift <= 0 && b.base.bnF > 0.5 && b.base.bodyRot < 20;
    if (!b.jumping) b.stop();
    if (!lying) b.setPose("sit", {}, 70);
    b.lookMode = "none";
    pet.sound("chirp");
    let nextHeart = 0.3;
    const tolerance =
      (5 + pet.personality.cuddly * 16 - pet.personality.grumpy * 6) *
      (0.5 + needs(pet).affection / 100);
    let strokedFor = 0;
    return {
      styleWeight: 0.2,
      update(t, dt) {
        const since = pet.clock - pet.lastStrokeAt;
        const active = since < 0.35;
        if (active) strokedFor += dt;
        // Melt into the pets: eyes squeeze shut, head leans into the hand.
        const melt = clamp(t / 0.5);
        b.offsets.eyeOpen = -melt;
        b.offsets.eyeHappy = melt;
        b.offsets.blush = 0.5 * melt;
        b.offsets.earL = 6 * melt;
        b.offsets.earR = 6 * melt;
        if (pet.props.pointer) {
          const lean =
            clamp((pet.props.pointer.x - b.x) / 60, -1, 1) * b.facing;
          b.offsets.headRot = lean * 10;
          b.offsets.headX = lean * 2;
        }
        nextHeart -= dt;
        if (active && nextHeart < 0) {
          pet.emote("heart", { size: rand(0.7, 1.1) });
          nextHeart = rand(0.45, 0.8);
        }
        if (
          strokedFor > tolerance &&
          chance(dt * (0.4 + pet.personality.grumpy))
        ) {
          pet.queue("annoyed");
          return true;
        }
        return since > 1.6;
      },
      exit: () => {},
    };
  },
};

const annoyed: ActionDef = {
  id: "annoyed",
  priority: 4,
  start(pet) {
    const b = pet.body;
    pet.life.annoyance = Math.min(100, pet.life.annoyance + 35);
    if (!b.jumping) b.stop();
    b.setPose(
      "sit",
      {
        earL: 34,
        earR: 34,
        earFlat: 0.8,
        eyeOpen: 0.55,
        tailSway: 22,
        tailSpeed: 1.6,
        tailAngle: -10,
        whisker: -10,
      },
      120,
    );
    b.lookMode = "forward";
    pet.emote("anger");
    pet.sound(pet.personality.grumpy > 0.6 ? "hiss" : "hmph");
    b.tail.flick(6);
    const swat = chance(0.4 + pet.personality.grumpy * 0.5);
    return {
      styleWeight: 0,
      update(t) {
        if (swat && t > 0.4 && t < 0.75) {
          b.adjustPose({ pawUp: 1, fnP: 0 });
          b.offsets.fnA = bump((t - 0.4) / 0.35) * 120;
        } else if (swat && t >= 0.75 && t < 0.8)
          b.adjustPose({ pawUp: 0, fnP: 1 });
        return t > 2.2;
      },
      exit: () => pet.queue("explore"),
    };
  },
};

const meow: ActionDef = {
  id: "meow",
  priority: 2,
  start(pet) {
    const b = pet.body;
    if (!b.jumping) b.stop();
    b.setPose("sit", { headRot: -6, earL: -6, earR: -6 });
    b.lookMode = "forward";
    let said = false;
    return {
      update(t) {
        if (!said && t > 0.35) {
          said = true;
          pet.speak(chance(0.3) ? "chirp" : "meow");
          pet.emote("note");
        }
        return t > 1.6;
      },
    };
  },
};

const startled: ActionDef = {
  id: "startled",
  priority: 4,
  start(pet) {
    const b = pet.body;
    if (!b.jumping) b.stop();
    b.setPose("scared", {}, 200);
    b.lookMode = "forward";
    pet.emote("exclaim");
    pet.sound("hiss");
    return {
      styleWeight: 0,
      update(t) {
        b.hop = Math.max(0, Math.sin(clamp(t / 0.35) * Math.PI)) * 18;
        if (t > 1.2) b.setPose("stand", { earL: 18, earR: 18 });
        return t > 1.8;
      },
      exit: () => (b.hop = 0),
    };
  },
};

// ---------------------------------------------------------------- play

interface PlayArg {
  /** A fixed or moving point to pounce on instead of the cursor toy. */
  target?: () => Vec | null;
  pounces?: number;
}

const play: ActionDef = {
  id: "play",
  priority: 2,
  score: (pet) =>
    pet.props.toy && needs(pet).energy > 15
      ? 5 + pet.personality.playful * 4
      : 0,
  start(pet, arg) {
    const b = pet.body;
    const opts = (arg ?? {}) as PlayArg;
    const maxPounces = opts.pounces ?? 8;
    const getTarget = opts.target ?? (() => pet.props.toy);
    let phase: "descend" | "chase" | "stalk" | "pounce" | "recover" = onFloor(
      pet,
    )
      ? "chase"
      : "descend";
    let phaseAt = 0;
    let from = 0;
    let to = 0;
    let peak = 30;
    let pounces = 0;
    let stalkFor = 1;
    let trip: Trip | null =
      phase === "descend"
        ? tripTo(pet, { surface: "floor", x: b.x }, 80)
        : null;
    const go = (p: typeof phase, t: number) => {
      phase = p;
      phaseAt = t;
    };
    b.lookMode = "target";
    return {
      styleWeight: 0.2,
      update(t) {
        const toy = getTarget();
        if (!toy) {
          if (!b.jumping) b.stop();
          b.hop = 0;
          return phase !== "pounce";
        }
        b.lookTarget = toy;
        const pt = t - phaseAt;
        if (phase === "descend") {
          if (trip && !trip.update()) return false;
          trip = null;
          go("chase", t);
          return false;
        }
        const dx = toy.x - b.x;
        const reach = 70 * b.size;
        if (phase === "chase") {
          if (Math.abs(dx) > reach * 1.4) {
            b.setPose("walk", { pupil: 1.35 }, 80);
            b.walkTo(toy.x - Math.sign(dx) * reach, 95);
          } else {
            b.stop();
            b.faceToward(toy.x);
            b.setPose("crouch", {}, 110);
            stalkFor = rand(0.9, 1.7);
            go("stalk", t);
          }
        } else if (phase === "stalk") {
          // The butt wiggle.
          const wiggle = Math.sin(pt * 22) * clamp((pt - 0.3) / 0.3);
          b.offsets.bnA = wiggle * 6;
          b.offsets.bfA = -wiggle * 6;
          b.offsets.bodyRot = wiggle * 1.5;
          if (Math.abs(dx) > reach * 2) go("chase", t);
          else if (pt > stalkFor) {
            from = b.x;
            to = clamp(toy.x - Math.sign(dx) * 18, b.bounds.min, b.bounds.max);
            peak = clamp(-toy.y * 0.7, 26, 70);
            b.faceToward(toy.x);
            b.setPose("pounce", {}, 160);
            pet.sound("chirp");
            go("pounce", t);
          }
        } else if (phase === "pounce") {
          const u = clamp(pt / 0.45);
          b.x = from + (to - from) * u;
          b.hop = Math.sin(u * Math.PI) * peak;
          if (u >= 1) {
            b.hop = 0;
            b.kick("bodySy", -2.2);
            b.setPose("crouch", { pupil: 1.2 }, 120);
            pet.emote("sparkle");
            pet.world.startle(toy.x, toy.y);
            pounces++;
            needs(pet).fun = clamp(needs(pet).fun + 9, 0, 100);
            needs(pet).energy = clamp(needs(pet).energy - 1.2, 0, 100);
            go("recover", t);
          }
        } else if (phase === "recover") {
          if (pt > 0.7) go("chase", t);
        }
        return pounces >= maxPounces || needs(pet).energy < 10;
      },
      exit() {
        trip?.cancel();
        b.hop = 0;
        if (!b.jumping) b.stop();
      },
    };
  },
};

/** Self-play when bored: chase a butterfly, or stalk an imaginary bug. */
const hunt: ActionDef = {
  id: "hunt",
  priority: 1,
  score: (pet) =>
    needs(pet).fun < 55 && needs(pet).energy > 30
      ? 0.6 +
        pet.personality.playful * 1.4 +
        lvl(pet, "fun") * 0.5 +
        (pet.world.butterflies.length ? 1.5 : 0)
      : 0,
  start(pet) {
    const b = pet.body;
    const w = pet.world;
    const fly = w.butterflies.length ? pick(w.butterflies) : null;
    if (fly)
      return play.start(pet, {
        target: () => ({ x: fly.x, y: fly.y }),
        pounces: Math.round(rand(2, 4)),
      } satisfies PlayArg);
    const dir = b.x > w.width / 2 ? -1 : 1;
    const target = {
      x: clamp(b.x + dir * rand(80, 140), 40, w.width - 40),
      y: -6,
    };
    pet.effects.spawn("sparkle", target, { life: 1.6, vy: 0, vx: 0 });
    return play.start(pet, {
      target: () => target,
      pounces: Math.round(rand(1, 3)),
    } satisfies PlayArg);
  },
};

const batYarn: ActionDef = {
  id: "batYarn",
  priority: 1,
  score: (pet) =>
    pet.world.spotOf("toys") && needs(pet).fun < 65 && needs(pet).energy > 25
      ? 0.7 + pet.personality.playful + lvl(pet, "fun") * 0.5
      : 0,
  start(pet) {
    const b = pet.body;
    const w = pet.world;
    let swats = Math.round(rand(2, 4));
    let trip: Trip | null = null;
    let swatAt = -1;
    let rest = 0;
    return {
      styleWeight: 0.3,
      update(t) {
        b.lookMode = "target";
        b.lookTarget = { x: w.yarn.x, y: -8 };
        if (swatAt >= 0) {
          // Paw swipe, then watch it roll.
          const st = t - swatAt;
          b.offsets.fnA = bump(st / 0.3) * 70;
          if (st > 0.15 && st < 0.2 && Math.abs(w.yarn.vx) < 10) {
            w.kickYarn(b.facing);
            needs(pet).fun = clamp(needs(pet).fun + 7, 0, 100);
            pet.emote("sparkle", { size: 0.6 });
          }
          if (st > 0.35) {
            b.adjustPose({ pawUp: 0, fnP: 1 });
            swatAt = -1;
            swats--;
            rest = t + rand(0.6, 1.2);
          }
          return false;
        }
        if (swats <= 0) return t > rest;
        if (t < rest || Math.abs(w.yarn.vx) > 15) return false;
        if (!trip) {
          const side = Math.sign(b.x - w.yarn.x) || -1;
          trip = tripTo(pet, { surface: "floor", x: w.yarn.x + side * 36 }, 80);
        }
        if (!trip.update()) return false;
        trip = null;
        b.faceToward(w.yarn.x);
        b.setPose("crouch", {}, 120);
        b.adjustPose({ pawUp: 1, fnP: 0 });
        swatAt = t;
        return false;
      },
      exit() {
        trip?.cancel();
        b.adjustPose({ pawUp: 0, fnP: 1 });
      },
    };
  },
};

const scratch: ActionDef = {
  id: "scratch",
  priority: 1,
  score: (pet) =>
    pet.world.spotOf("scratcher") ? 0.4 + pet.personality.chaotic * 0.3 : 0,
  start(pet) {
    const b = pet.body;
    const dur = rand(3, 5);
    return visit(pet, pet.world.spotOf("scratcher"), {
      pose: "scratch",
      arrive: () => pet.sound("scratch"),
      stay(t) {
        const k = Math.sin(t * 16);
        b.offsets.fnA = k * 12;
        b.offsets.ffA = -k * 12;
        b.offsets.bodyRot = Math.sin(t * 8) * 1.5;
        if (t > dur) b.setPose("stand");
        return t > dur + 0.6;
      },
    });
  },
};

const hide: ActionDef = {
  id: "hide",
  priority: 1,
  calm: true,
  score: (pet) =>
    pet.world.spotOf("box")
      ? 0.35 +
        (pet.mood === "grumpy" || pet.life.annoyance > 30 ? 2 : 0) +
        pet.personality.chaotic * 0.2
      : 0,
  start(pet) {
    const b = pet.body;
    const dur = rand(10, 22);
    return visit(pet, pet.world.spotOf("box"), {
      pose: "loaf",
      arrive: () => {
        b.adjustPose({ lift: -6, pupil: 1.35 });
      },
      stay(t) {
        attend(pet);
        return t > dur;
      },
    });
  },
};

const cowork: ActionDef = {
  id: "cowork",
  priority: 1,
  calm: true,
  score: (pet) =>
    pet.world.spotOf("desk") ? 0.35 + (pet.focusMode ? 3 : 0) : 0,
  start(pet) {
    const b = pet.body;
    const whileFocused = pet.focusMode;
    const dur = rand(15, 30);
    let nextTap = rand(3, 6);
    let tapping = -1;
    return visit(pet, pet.world.spotOf("desk"), {
      pose: chance(0.5) ? "sit" : "loaf",
      arrive: () => {
        b.lookMode = "target";
        b.lookTarget = { x: b.x + 90 * b.facing, y: b.elevation - 25 };
      },
      stay(t, dt) {
        nextTap -= dt;
        if (
          nextTap < 0 &&
          tapping < 0 &&
          b.base.pawUp < 0.5 &&
          b.base.fnP > 0.5
        ) {
          tapping = t;
          b.adjustPose({ pawUp: 1, fnP: 0, fnA: 70, fnF: 0.3 });
        }
        if (tapping >= 0) {
          // "Helping" type on the laptop.
          b.offsets.fnA = Math.abs(Math.sin((t - tapping) * 12)) * -20;
          if (t - tapping > 1.6) {
            b.adjustPose({ pawUp: 0, fnP: 1, fnA: 0, fnF: 0 });
            tapping = -1;
            nextTap = rand(5, 12);
          }
        }
        return whileFocused ? !pet.focusMode : t > dur;
      },
    });
  },
};

const zoomies: ActionDef = {
  id: "zoomies",
  priority: 1,
  score: (pet) =>
    needs(pet).energy > 70 && needs(pet).fun < 70
      ? pet.personality.chaotic * 0.45
      : 0,
  start(pet) {
    const b = pet.body;
    let laps = Math.round(rand(3, 6));
    let trip: Trip | null = onFloor(pet)
      ? null
      : tripTo(pet, { surface: "floor", x: b.x }, 120);
    const next = () => {
      b.setPose(
        "walk",
        { pupil: 1.5, earL: 10, earR: 10, tailAngle: 70, tailPuff: 1.25 },
        120,
      );
      b.walkTo(
        b.x < (b.bounds.min + b.bounds.max) / 2 ? b.bounds.max : b.bounds.min,
        rand(150, 190),
      );
    };
    let started = false;
    b.lookMode = "forward";
    let done = -1;
    return {
      styleWeight: 0,
      update(t) {
        if (trip && !trip.update()) return false;
        trip = null;
        if (!started) {
          started = true;
          next();
          return false;
        }
        if (done < 0 && !b.moving) {
          laps--;
          b.kick("bodySx", 2);
          pet.emote("puff");
          if (laps > 0) next();
          else {
            done = t;
            b.setPose("sit", { mouthOpen: 0.35, tongue: 0.6 });
            needs(pet).fun = clamp(needs(pet).fun + 20, 0, 100);
            needs(pet).energy = clamp(needs(pet).energy - 6, 0, 100);
          }
        }
        if (done >= 0) b.breathRate = 1.1;
        return done >= 0 && t - done > 2.2;
      },
      exit() {
        trip?.cancel();
        b.breathRate = 0.42;
        if (!b.jumping) b.stop();
      },
    };
  },
};

const knead: ActionDef = {
  id: "knead",
  priority: 1,
  calm: true,
  score: (pet) =>
    needs(pet).affection > 70 &&
    (pet.mood === "happy" || pet.mood === "content")
      ? 0.35 + pet.personality.cuddly * 0.5
      : 0,
  start(pet) {
    const b = pet.body;
    const dur = rand(4, 7);
    let nextHeart = 1;
    return visit(pet, pet.world.pickSpot(["bed", "rug"]), {
      pose: "knead",
      styleWeight: 0.2,
      arrive: () => {
        b.lookMode = "none";
        pet.purr("knead", true);
      },
      stay(t, dt) {
        const k = Math.sin(t * 6);
        b.offsets.fnA = k * 14;
        b.offsets.ffA = -k * 14;
        b.offsets.fnF = Math.max(0, k) * 0.25;
        b.offsets.ffF = Math.max(0, -k) * 0.25;
        nextHeart -= dt;
        if (nextHeart < 0) {
          pet.emote("heart", { size: 0.7 });
          nextHeart = rand(1.2, 2);
        }
        return t > dur;
      },
      exit: () => pet.purr("knead", false),
    });
  },
};

// ---------------------------------------------------------------- routines (cues)

/** Text lines may be passed in by whoever cued the routine. */
const textArg = (arg: unknown, fallback: string) =>
  typeof arg === "string" ? arg : fallback;

const celebrate: ActionDef = {
  id: "celebrate",
  priority: 3,
  start(pet, arg) {
    const b = pet.body;
    if (!b.jumping) b.stop();
    b.setPose(
      "stand",
      {
        tailAngle: 80,
        tailCurl: 12,
        eyeOpen: 0,
        eyeHappy: 1,
        earL: -8,
        earR: -8,
      },
      140,
    );
    b.lookMode = "forward";
    if (typeof arg === "string") pet.say(arg, { kind: "cheer", duration: 4 });
    pet.sound("chirp");
    let lastHop = -1;
    return {
      styleWeight: 0,
      update(t) {
        // Two happy hops with sparkles.
        const hopIndex = Math.floor(t / 0.6);
        b.hop = t < 1.2 ? Math.sin(((t % 0.6) / 0.6) * Math.PI) * 16 : 0;
        if (t < 1.2 && hopIndex !== lastHop) {
          lastHop = hopIndex;
          pet.emote("sparkle");
          pet.emote("heart", { size: 0.8 });
        }
        return t > 2.4;
      },
      exit: () => (pet.body.hop = 0),
    };
  },
};

const remind: ActionDef = {
  id: "remind",
  priority: 3,
  start(pet, arg) {
    const b = pet.body;
    pet.say(textArg(arg, "Psst! Don't forget!"), {
      kind: "remind",
      duration: 9,
    });
    pet.speak("meow");
    const spot = pet.world.spotOf("front");
    const far = spot ? Math.abs(spot.x - b.x) > 120 || !onFloor(pet) : false;
    const inner = far
      ? visit(pet, spot, {
          speed: 90,
          pose: "beg",
          arrive: () => (b.lookMode = "forward"),
          stay: (t) => t > 4,
        })
      : null;
    if (!inner) {
      if (!b.jumping) b.stop();
      b.setPose("beg");
      b.lookMode = "forward";
    }
    return {
      update(t, dt) {
        if (inner) return inner.update(t, dt);
        return t > 4;
      },
      exit: () => inner?.exit?.(),
    };
  },
};

const greet: ActionDef = {
  id: "greet",
  priority: 3,
  start(pet, arg) {
    const b = pet.body;
    return visit(pet, pet.world.spotOf("front"), {
      speed: 75,
      pose: "sit",
      arrive: () => {
        b.lookMode = "forward";
        pet.say(textArg(arg, "Hi! 👋"), { kind: "cheer", duration: 6 });
        pet.speak("chirp");
        b.adjustPose({ pawUp: 1, fnP: 0, fnA: 140, fnF: 0.2 });
      },
      stay(t) {
        if (t < 1.8) b.offsets.fnA = Math.sin(t * 10) * 18;
        else if (b.base.pawUp > 0.5)
          b.adjustPose({ pawUp: 0, fnP: 1, fnA: 0, fnF: 0 });
        return t > 3;
      },
    });
  },
};

export interface RoutineStep {
  text: string;
  pose: PoseName;
  dur: number;
  move?: (t: number, pet: Pet) => void;
}

const DEFAULT_STRETCH: RoutineStep[] = [
  { text: "Stretch break! Reach up high with me 🙆", pose: "stretch", dur: 9 },
  {
    text: "Now roll your shoulders back, slowly…",
    pose: "sit",
    dur: 8,
    move: (t, pet) => (pet.body.offsets.headRot = Math.sin(t * 1.6) * 14),
  },
  {
    text: "Close your eyes and take three deep breaths 😌",
    pose: "loaf",
    dur: 9,
    move: (_t, pet) => (pet.body.offsets.eyeOpen = -1),
  },
];

const stretchRoutine: ActionDef = {
  id: "stretchRoutine",
  priority: 3,
  start(pet, arg) {
    const b = pet.body;
    const steps = Array.isArray(arg) ? (arg as RoutineStep[]) : DEFAULT_STRETCH;
    let i = -1;
    let stepAt = 0;
    if (!b.jumping) b.stop();
    b.lookMode = "forward";
    return {
      styleWeight: 0,
      update(t) {
        if (i < 0 || t - stepAt > steps[i].dur) {
          i++;
          stepAt = t;
          if (i >= steps.length) {
            pet.say("Nice! Back to it 💪", { kind: "cheer", duration: 4 });
            pet.emote("sparkle");
            return true;
          }
          b.setPose(steps[i].pose, {}, 50);
          pet.say(steps[i].text, { kind: "routine", duration: steps[i].dur });
        }
        const st = t - stepAt;
        steps[i].move?.(st, pet);
        // Breathe big during the stretch.
        if (steps[i].pose === "stretch")
          b.offsets.mouthOpen = bump((st % 4.5) / 2) * 0.6;
        return false;
      },
    };
  },
};

const drinkBreak: ActionDef = {
  id: "drinkBreak",
  priority: 3,
  start(pet, arg) {
    pet.say(textArg(arg, "Water break! Let's both have a drink 💧"), {
      kind: "routine",
      duration: 7,
    });
    if (pet.world.water < 0.3) pet.world.water = 1;
    return drink.start(pet, 6);
  },
};

const lookOutside: ActionDef = {
  id: "lookOutside",
  priority: 3,
  start(pet, arg) {
    pet.say(
      textArg(arg, "Eye break! Look at something far away for 20 seconds 👀"),
      { kind: "routine", duration: 8 },
    );
    const inner = watch.start(pet, 20);
    return {
      update(t, dt) {
        const done = inner.update(t, dt) === true;
        if (done)
          pet.say("Ahh, much better ✨", { kind: "cheer", duration: 3 });
        return done;
      },
      exit: inner.exit,
    };
  },
};

const focusNap: ActionDef = {
  id: "focusNap",
  priority: 2,
  calm: true,
  score: (pet) => (pet.focusMode ? 4 : 0),
  start(pet) {
    if (pet.world.spotOf("desk") && chance(0.5)) return cowork.start(pet);
    return sleepAt(
      pet,
      pet.world.pickSpot(["bed", "sunpatch", "rug"], 0),
      () => !pet.focusMode,
      true,
    );
  },
};

const goodnight: ActionDef = {
  id: "goodnight",
  priority: 3,
  start(pet, arg) {
    const b = pet.body;
    if (!b.jumping) b.stop();
    b.setPose("sit", { mouthOpen: 1, eyeOpen: 0, earL: 14, earR: 14 }, 60);
    pet.sound("yawn");
    pet.say(textArg(arg, "Great work today! See you tomorrow 🌙"), {
      kind: "cheer",
      duration: 7,
    });
    return {
      update(t) {
        if (t > 1.4 && b.base.mouthOpen > 0.5)
          b.adjustPose({ mouthOpen: 0, eyeOpen: 1 });
        if (t > 3) {
          pet.queue("sleep");
          return true;
        }
        return false;
      },
    };
  },
};

export const ACTIONS: Record<ActionId, ActionDef> = {
  idle,
  explore,
  watch,
  perch,
  loaf,
  groom,
  stretch,
  sleep,
  checkBowl,
  eat,
  drink,
  seekAttention,
  petted,
  annoyed,
  play,
  hunt,
  batYarn,
  scratch,
  hide,
  cowork,
  zoomies,
  knead,
  meow,
  startled,
  celebrate,
  remind,
  greet,
  stretchRoutine,
  drinkBreak,
  lookOutside,
  focusNap,
  goodnight,
};

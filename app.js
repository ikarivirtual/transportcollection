const imageUrl = (file, width = 1200) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file).replace(/'/g, "%27")}?width=${width}`;

const rarityRank = { common: 1, rare: 2, epic: 3, legendary: 4 };
const rarityConfig = {
  common: { stamps: 1, shinyStamps: 3, charter: 15 },
  rare: { stamps: 2, shinyStamps: 6, charter: 25 },
  epic: { stamps: 5, shinyStamps: 12, charter: 40 },
  legendary: { stamps: 10, shinyStamps: 24, charter: 60 },
};

const SHINY_CHANCE = 0.06;
const PITY_EPIC = 10;
const PITY_LEGENDARY = 30;
const REGEN_MINUTES = 15;
const REGEN_MS = REGEN_MINUTES * 60 * 1000;
const REGEN_CAP = 10;
const EXCHANGE_RATE = 8;
const MULTI_COUNT = 10;
const MULTI_COST = 9;
const QUEST_TARGET = 3;
const QUEST_REWARD = 2;

const defaultState = {
  tickets: 12,
  collection: {},
  shinies: {},
  recent: [],
  lastDaily: null,
  streak: 0,
  bestStreak: 0,
  sort: "rarity",
  pityEpic: 0,
  pityLegendary: 0,
  stamps: 0,
  lifetimeStamps: 0,
  xp: 0,
  totalPulls: 0,
  claimed: [],
  lastRegen: Date.now(),
  questDate: null,
  questPulls: 0,
  questClaimed: false,
};

let game = loadGame();
let activeFilter = "ALL";

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem("platform-pulls-save"));
    const state = saved ? { ...defaultState, ...saved } : { ...defaultState };
    state.recent = (state.recent || []).map((entry) =>
      typeof entry === "string" ? { id: entry, shiny: false } : entry,
    );
    return state;
  } catch {
    return { ...defaultState };
  }
}

function saveGame() {
  localStorage.setItem("platform-pulls-save", JSON.stringify(game));
}

function getVehicle(id) {
  return vehicles.find((vehicle) => vehicle.id === id);
}

function modeIcon(mode) {
  return {
    train: "train-front",
    tram: "tram-front",
    bus: "bus-front",
    ferry: "ship",
  }[mode];
}

function brisbaneKey(daysAgo = 0) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() - daysAgo * 86400000));
}

function todayKey() {
  return brisbaneKey(0);
}

function ownedCopies(id) {
  return (game.collection[id] || 0) + (game.shinies[id] || 0);
}

function ownedVehicleCount() {
  return vehicles.filter((vehicle) => ownedCopies(vehicle.id) > 0).length;
}

function ownedShinyCount() {
  return vehicles.filter((vehicle) => (game.shinies[vehicle.id] || 0) > 0).length;
}

function ownedRegularCount() {
  return vehicles.filter((vehicle) => (game.collection[vehicle.id] || 0) > 0).length;
}

// --- Conductor levels -------------------------------------------------------

function levelInfo(xp = game.xp) {
  let level = 1;
  let need = 100;
  let rest = xp;
  while (rest >= need) {
    rest -= need;
    level += 1;
    need = 100 + (level - 1) * 25;
  }
  return { level, into: rest, need };
}

function grantXp(amount) {
  const before = levelInfo().level;
  game.xp += amount;
  const after = levelInfo().level;
  if (after > before) {
    const bonus = (after - before) * 2;
    game.tickets += bonus;
    showToast(`Level up! Conductor level ${after} reached: +${bonus} tickets.`);
  }
}

// --- Achievements -----------------------------------------------------------

const modeSet = (mode) => vehicles.filter((vehicle) => vehicle.mode === mode);
const ownedOfRarity = (rarity) =>
  vehicles.filter((vehicle) => vehicle.rarity === rarity && ownedCopies(vehicle.id) > 0).length;
const ownedOfSet = (set) => set.filter((vehicle) => ownedCopies(vehicle.id) > 0).length;

const achievements = [
  { id: "first-pull", name: "First boarding", desc: "Board your first mystery service.", icon: "door-open", reward: 2, progress: () => [game.totalPulls, 1] },
  { id: "pulls-10", name: "Regular commuter", desc: "Board 10 services.", icon: "ticket", reward: 3, progress: () => [game.totalPulls, 10] },
  { id: "pulls-50", name: "Season ticket", desc: "Board 50 services.", icon: "tickets", reward: 6, progress: () => [game.totalPulls, 50] },
  { id: "pulls-150", name: "Network veteran", desc: "Board 150 services.", icon: "medal", reward: 15, progress: () => [game.totalPulls, 150] },
  { id: "own-3", name: "Trainspotter", desc: "Sight 3 different vehicles.", icon: "binoculars", reward: 3, progress: () => [ownedVehicleCount(), 3] },
  { id: "own-6", name: "Interstate", desc: "Sight 6 different vehicles.", icon: "map-pinned", reward: 5, progress: () => [ownedVehicleCount(), 6] },
  { id: "own-15", name: "Network nerd", desc: "Sight 15 different vehicles.", icon: "telescope", reward: 8, progress: () => [ownedVehicleCount(), 15] },
  { id: "own-30", name: "Half the country", desc: "Sight 30 different vehicles.", icon: "earth", reward: 12, progress: () => [ownedVehicleCount(), 30] },
  { id: "own-all", name: "Full network", desc: "Sight every vehicle in the guide.", icon: "trophy", reward: 30, progress: () => [ownedVehicleCount(), vehicles.length] },
  { id: "epic-1", name: "Purple patch", desc: "Sight your first epic vehicle.", icon: "sparkles", reward: 4, progress: () => [Math.min(ownedOfRarity("epic"), 1), 1] },
  { id: "legend-1", name: "Flagship find", desc: "Sight your first legendary vehicle.", icon: "crown", reward: 6, progress: () => [Math.min(ownedOfRarity("legendary"), 1), 1] },
  { id: "shiny-1", name: "Foil debut", desc: "Pull your first limited livery.", icon: "star", reward: 6, progress: () => [Math.min(ownedShinyCount(), 1), 1] },
  { id: "shiny-5", name: "Foil fanatic", desc: "Collect 5 limited liveries.", icon: "stars", reward: 14, progress: () => [ownedShinyCount(), 5] },
  { id: "shiny-15", name: "Foil financier", desc: "Collect 15 limited liveries.", icon: "gem", reward: 20, progress: () => [ownedShinyCount(), 15] },
  { id: "shiny-all", name: "Golden timetable", desc: "Collect every limited livery.", icon: "crown", reward: 60, progress: () => [ownedShinyCount(), vehicles.length] },
  { id: "streak-3", name: "Three-day tripper", desc: "Reach a 3-day daily streak.", icon: "flame", reward: 4, progress: () => [game.bestStreak, 3] },
  { id: "streak-7", name: "Week of wheels", desc: "Reach a 7-day daily streak.", icon: "calendar-heart", reward: 10, progress: () => [game.bestStreak, 7] },
  { id: "level-5", name: "Senior conductor", desc: "Reach conductor level 5.", icon: "badge-check", reward: 6, progress: () => [levelInfo().level, 5] },
  { id: "level-10", name: "Network controller", desc: "Reach conductor level 10.", icon: "radio-tower", reward: 12, progress: () => [levelInfo().level, 10] },
  { id: "set-tram", name: "Tram enthusiast", desc: "Sight every tram.", icon: "tram-front", reward: 10, progress: () => [ownedOfSet(modeSet("tram")), modeSet("tram").length] },
  { id: "set-train", name: "Heavy rail hero", desc: "Sight every train.", icon: "train-front", reward: 15, progress: () => [ownedOfSet(modeSet("train")), modeSet("train").length] },
  { id: "set-bus", name: "Bus boss", desc: "Sight every bus.", icon: "bus-front", reward: 8, progress: () => [ownedOfSet(modeSet("bus")), modeSet("bus").length] },
  { id: "set-ferry", name: "Sea legs", desc: "Sight every ferry.", icon: "ship", reward: 8, progress: () => [ownedOfSet(modeSet("ferry")), modeSet("ferry").length] },
  { id: "stamps-100", name: "Stamp collector", desc: "Earn 100 stamps in total.", icon: "stamp", reward: 6, progress: () => [game.lifetimeStamps, 100] },
];

function achievementUnlocked(achievement) {
  const [now, target] = achievement.progress();
  return now >= target;
}

function claimableAchievements() {
  return achievements.filter(
    (achievement) => !game.claimed.includes(achievement.id) && achievementUnlocked(achievement),
  );
}

const notifiedAchievements = new Set(
  claimableAchievements().map((achievement) => achievement.id),
);

function notifyClaimable() {
  claimableAchievements().forEach((achievement) => {
    if (notifiedAchievements.has(achievement.id)) return;
    notifiedAchievements.add(achievement.id);
    showToast(`Reward unlocked: ${achievement.name}. Claim it in the Depot.`);
  });
}

function claimAchievement(id) {
  const achievement = achievements.find((entry) => entry.id === id);
  if (!achievement || game.claimed.includes(id) || !achievementUnlocked(achievement)) return;
  game.claimed.push(id);
  game.tickets += achievement.reward;
  grantXp(15);
  saveGame();
  renderAll();
  notifyClaimable();
  showToast(`${achievement.name} claimed: +${achievement.reward} tickets.`);
}

// --- Pulls ------------------------------------------------------------------

function weightedPick(pool) {
  const total = pool.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of pool) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return pool[pool.length - 1];
}

function rollVehicle() {
  game.pityEpic += 1;
  game.pityLegendary += 1;

  let pool = vehicles;
  if (game.pityLegendary >= PITY_LEGENDARY) {
    pool = vehicles.filter((vehicle) => vehicle.rarity === "legendary");
  } else if (game.pityEpic >= PITY_EPIC) {
    pool = vehicles.filter((vehicle) => rarityRank[vehicle.rarity] >= rarityRank.epic);
  }

  const vehicle = weightedPick(pool);
  if (rarityRank[vehicle.rarity] >= rarityRank.epic) game.pityEpic = 0;
  if (vehicle.rarity === "legendary") game.pityLegendary = 0;
  return { vehicle, shiny: Math.random() < SHINY_CHANCE };
}

function pullCost(count) {
  return count === MULTI_COUNT ? MULTI_COST : count;
}

function performPull(count) {
  const cost = pullCost(count);
  if (game.tickets < cost) {
    showToast("Not enough tickets. Wait for the timetable or claim your daily delivery.");
    return;
  }

  game.tickets -= cost;

  const today = todayKey();
  if (game.questDate !== today) {
    game.questDate = today;
    game.questPulls = 0;
    game.questClaimed = false;
  }

  const results = [];
  let stampsEarned = 0;

  for (let index = 0; index < count; index += 1) {
    const { vehicle, shiny } = rollVehicle();
    const newVehicle = ownedCopies(vehicle.id) === 0;
    let isNew;

    if (shiny) {
      isNew = !(game.shinies[vehicle.id] || 0);
      game.shinies[vehicle.id] = (game.shinies[vehicle.id] || 0) + 1;
      if (!isNew) stampsEarned += rarityConfig[vehicle.rarity].shinyStamps;
    } else {
      isNew = !(game.collection[vehicle.id] || 0);
      game.collection[vehicle.id] = (game.collection[vehicle.id] || 0) + 1;
      if (!isNew) stampsEarned += rarityConfig[vehicle.rarity].stamps;
    }

    grantXp(10 + (newVehicle ? 30 : 0) + (shiny ? (isNew ? 40 : 10) : 0));
    results.push({ vehicle, shiny, isNew });
    game.recent.unshift({ id: vehicle.id, shiny });
    game.questPulls += 1;
  }

  game.totalPulls += count;
  game.stamps += stampsEarned;
  game.lifetimeStamps += stampsEarned;

  if (!game.questClaimed && game.questPulls >= QUEST_TARGET) {
    game.questClaimed = true;
    game.tickets += QUEST_REWARD;
    showToast(`Daily commuter bonus complete: +${QUEST_REWARD} tickets.`);
  }

  game.recent = game.recent.slice(0, 12);
  saveGame();
  renderAll();
  openReveal(results, stampsEarned);
  notifyClaimable();
}

function charterVehicle(id) {
  const vehicle = getVehicle(id);
  if (!vehicle || ownedCopies(id) > 0) return;
  const cost = rarityConfig[vehicle.rarity].charter;
  if (game.stamps < cost) {
    showToast(`You need ${cost - game.stamps} more stamps to charter this service.`);
    return;
  }
  game.stamps -= cost;
  game.collection[id] = 1;
  game.recent.unshift({ id, shiny: false });
  game.recent = game.recent.slice(0, 12);
  grantXp(40);
  saveGame();
  renderAll();
  document.querySelector("#detail-dialog").close();
  openReveal([{ vehicle, shiny: false, isNew: true, chartered: true }], 0);
  notifyClaimable();
}

function exchangeStamps(tickets) {
  const cost = EXCHANGE_RATE * tickets;
  if (game.stamps < cost) {
    showToast(`You need ${cost} stamps for that exchange.`);
    return;
  }
  game.stamps -= cost;
  game.tickets += tickets;
  saveGame();
  renderAll();
  showToast(`Exchanged ${cost} stamps for ${tickets} ticket${tickets === 1 ? "" : "s"}.`);
}

// --- Daily + regeneration ---------------------------------------------------

function dailyReward(streak) {
  return Math.min(2 + streak, 7);
}

function collectDaily() {
  const today = todayKey();
  if (game.lastDaily === today) {
    showToast("Today's ticket has already been stamped.");
    return;
  }
  game.streak = game.lastDaily === brisbaneKey(1) ? game.streak + 1 : 1;
  game.bestStreak = Math.max(game.bestStreak, game.streak);
  const reward = dailyReward(game.streak);
  game.tickets += reward;
  game.lastDaily = today;
  grantXp(20);
  saveGame();
  renderAll();
  notifyClaimable();
  showToast(`Day ${game.streak} of your streak: +${reward} tickets collected.`);
}

function applyRegen() {
  const now = Date.now();
  if (game.tickets >= REGEN_CAP) {
    game.lastRegen = now;
    return 0;
  }
  const earned = Math.floor((now - game.lastRegen) / REGEN_MS);
  if (earned <= 0) return 0;
  const grant = Math.min(earned, REGEN_CAP - game.tickets);
  game.tickets += grant;
  game.lastRegen = game.tickets >= REGEN_CAP ? now : game.lastRegen + earned * REGEN_MS;
  saveGame();
  return grant;
}

function regenLabel() {
  if (game.tickets >= REGEN_CAP) return "timetable full";
  const remaining = Math.max(REGEN_MS - (Date.now() - game.lastRegen), 0);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `+1 in ${minutes}:${String(seconds).padStart(2, "0")}`;
}

// --- Rendering --------------------------------------------------------------

function vehicleCard(vehicle, options = {}) {
  const regular = game.collection[vehicle.id] || 0;
  const shinyCopies = game.shinies[vehicle.id] || 0;
  const total = regular + shinyCopies;
  const locked = options.locked ?? total === 0;
  const isNew = options.isNew;
  const shiny = options.shiny ?? false;
  const charterCost = rarityConfig[vehicle.rarity].charter;

  return `
    <article
      class="vehicle-card ${locked ? "locked" : ""} ${shiny ? "shiny" : ""}"
      data-rarity="${vehicle.rarity}"
      data-vehicle-id="${vehicle.id}"
      ${locked ? "" : 'tabindex="0" role="button"'}
    >
      ${isNew ? `<span class="new-ribbon">${shiny ? "NEW LTD" : "NEW"}</span>` : ""}
      ${total > 1 && !options.hideCount ? `<span class="copy-count">×${total}</span>` : ""}
      ${!locked && shinyCopies && !options.hideCount ? `<span class="foil-chip">★ LTD ×${shinyCopies}</span>` : ""}
      <div class="vehicle-image">
        <img
          src="${vehicle.image}"
          alt="${vehicle.name}"
          loading="lazy"
          referrerpolicy="no-referrer"
          onerror="this.onerror=null;this.src='${imageUrl(vehicle.file, 700)}'"
        />
        ${locked ? '<span class="locked-stamp">NOT SIGHTED</span>' : ""}
        ${vehicle.retired && !locked ? '<span class="retired-stamp">FLEET RETIRED</span>' : ""}
        <span class="rarity-stripe"></span>
      </div>
      <div class="vehicle-meta">
        <div class="vehicle-topline">
          <span class="state-tag">${vehicle.state} / ${vehicle.mode}</span>
          <span class="rarity-label">${shiny ? "limited " : ""}${vehicle.rarity}</span>
        </div>
        <h3>${locked ? "Unknown service" : vehicle.shortName}</h3>
        <p>${locked ? `${vehicle.city} - keep boarding` : vehicle.tagline}</p>
        ${options.duplicate ? `<div class="duplicate-note">DUPLICATE / +${shiny ? rarityConfig[vehicle.rarity].shinyStamps : rarityConfig[vehicle.rarity].stamps} STAMPS</div>` : ""}
        ${locked && options.charter ? `
          <button class="charter-button" data-charter="${vehicle.id}" ${game.stamps < charterCost ? "disabled" : ""}>
            <i data-lucide="stamp"></i> Charter for ${charterCost} stamps
          </button>` : ""}
      </div>
    </article>
  `;
}

function renderWallet() {
  document.querySelector("#ticket-count").textContent = game.tickets.toLocaleString();
  document.querySelector("#stamp-count").textContent = game.stamps.toLocaleString();
  document.querySelector("#level-chip").textContent = `LV ${levelInfo().level}`;
  document.querySelector("#regen-timer").textContent = regenLabel();
}

function renderDaily() {
  const claimed = game.lastDaily === todayKey();
  const continuing = game.lastDaily === brisbaneKey(1);
  const button = document.querySelector("#daily-button");
  button.disabled = claimed;
  button.textContent = claimed
    ? "Collected"
    : `Collect +${dailyReward(continuing ? game.streak + 1 : 1)}`;
  document.querySelector("#daily-status").textContent = claimed
    ? `Day ${game.streak} streak — next service tomorrow (+${dailyReward(game.streak + 1)})`
    : continuing
      ? `${game.streak}-day streak on the line — keep it alive!`
      : "Available now";
}

function renderQuest() {
  const today = todayKey();
  const pulls = game.questDate === today ? game.questPulls : 0;
  const done = game.questDate === today && game.questClaimed;
  document.querySelector("#quest-row").innerHTML = done
    ? `<i data-lucide="circle-check"></i> Daily commuter bonus collected (+${QUEST_REWARD} tickets)`
    : `<i data-lucide="target"></i> Daily commuter bonus: <strong>${Math.min(pulls, QUEST_TARGET)}/${QUEST_TARGET}</strong> boardings today (+${QUEST_REWARD} tickets)`;
}

function renderPity() {
  const epicLeft = Math.max(PITY_EPIC - game.pityEpic, 0);
  const legendLeft = Math.max(PITY_LEGENDARY - game.pityLegendary, 0);
  document.querySelector("#pity-epic-label").textContent =
    epicLeft === 0 ? "next pull!" : `within ${epicLeft}`;
  document.querySelector("#pity-legend-label").textContent =
    legendLeft === 0 ? "next pull!" : `within ${legendLeft}`;
  document.querySelector("#pity-epic-fill").style.width =
    `${Math.min((game.pityEpic / PITY_EPIC) * 100, 100)}%`;
  document.querySelector("#pity-legend-fill").style.width =
    `${Math.min((game.pityLegendary / PITY_LEGENDARY) * 100, 100)}%`;
}

function renderRecent() {
  const seen = new Set();
  const uniqueRecent = game.recent.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  }).slice(0, 3);
  const fallback = vehicles
    .filter((vehicle) => ["vlocity", "e-class", "g-link"].includes(vehicle.id))
    .map((vehicle) => ({ id: vehicle.id, shiny: false }));
  const list = uniqueRecent.length ? uniqueRecent : fallback;
  document.querySelector("#recent-grid").innerHTML = list
    .map((entry) => {
      const vehicle = getVehicle(entry.id);
      if (!vehicle) return "";
      return vehicleCard(vehicle, {
        locked: ownedCopies(vehicle.id) === 0,
        shiny: entry.shiny && (game.shinies[vehicle.id] || 0) > 0,
      });
    })
    .join("");
}

function renderFilters() {
  const states = ["ALL", ...Object.keys(stateInfo)];
  document.querySelector("#state-filters").innerHTML = states
    .map(
      (state) =>
        `<button class="filter-chip ${activeFilter === state ? "active" : ""}" data-state="${state}">${state}</button>`,
    )
    .join("");
}

function renderGarage() {
  const search = document.querySelector("#vehicle-search").value.trim().toLowerCase();
  const regularOwned = ownedRegularCount();
  const shinyOwned = ownedShinyCount();
  const totalSlots = vehicles.length * 2;
  const collectedSlots = regularOwned + shinyOwned;
  const percent = Math.round((collectedSlots / totalSlots) * 100);

  document.querySelector("#collection-summary").textContent =
    `${regularOwned} of ${vehicles.length} vehicles • ${shinyOwned} of ${vehicles.length} limited liveries`;
  document.querySelector("#completion-percent").textContent = `${percent}%`;
  document.querySelector("#home-completion").textContent = `${collectedSlots} / ${totalSlots}`;
  document.querySelector("#home-completion-fill").style.width = `${percent}%`;

  let filtered = vehicles.filter((vehicle) => {
    const matchesState = activeFilter === "ALL" || vehicle.state === activeFilter;
    const haystack = `${vehicle.name} ${vehicle.city} ${vehicle.operator} ${vehicle.mode}`.toLowerCase();
    return matchesState && haystack.includes(search);
  });

  filtered = filtered.sort((a, b) => {
    if (game.sort === "name") return a.name.localeCompare(b.name);
    const collectedDiff = Number(ownedCopies(b.id) > 0) - Number(ownedCopies(a.id) > 0);
    if (collectedDiff) return collectedDiff;
    return rarityRank[b.rarity] - rarityRank[a.rarity] || a.name.localeCompare(b.name);
  });

  document.querySelector("#garage-grid").innerHTML = filtered.length
    ? filtered.map((vehicle) => vehicleCard(vehicle, { charter: true })).join("")
    : `<div class="empty-state"><i data-lucide="search-x"></i><br>No services match this search.</div>`;

  refreshIcons();
}

function renderGuide() {
  document.querySelector("#route-map").innerHTML = Object.entries(stateInfo)
    .map(([state, info]) => {
      const stateVehicles = vehicles.filter((vehicle) => vehicle.state === state);
      return `
        <article class="guide-stop">
          <span class="guide-state">${state}</span>
          <h2>${info.name}</h2>
          <p>${info.blurb}</p>
          <div class="guide-vehicles">
            ${stateVehicles
              .map(
                (vehicle) => `
                  <button class="guide-vehicle ${ownedCopies(vehicle.id) ? "sighted" : ""}" data-vehicle-id="${vehicle.id}">
                    <i data-lucide="${modeIcon(vehicle.mode)}"></i>
                    ${vehicle.shortName}
                    ${ownedCopies(vehicle.id) ? '<i data-lucide="check" class="sighted-check"></i>' : ""}
                  </button>
                `,
              )
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderRewards() {
  const { level, into, need } = levelInfo();
  document.querySelector("#depot-level").textContent = `Lv ${level}`;

  document.querySelector("#depot-stats").innerHTML = `
    <span class="kicker">CONDUCTOR RECORD</span>
    <div class="xp-row">
      <strong>Level ${level}</strong>
      <span>${into} / ${need} XP</span>
    </div>
    <div class="xp-bar"><i style="width:${Math.round((into / need) * 100)}%"></i></div>
    <dl class="stat-list">
      <div><dt>Total boardings</dt><dd>${game.totalPulls.toLocaleString()}</dd></div>
      <div><dt>Vehicles sighted</dt><dd>${ownedVehicleCount()} / ${vehicles.length}</dd></div>
      <div><dt>Limited liveries</dt><dd>${ownedShinyCount()} / ${vehicles.length}</dd></div>
      <div><dt>Daily streak</dt><dd>${game.streak} day${game.streak === 1 ? "" : "s"} (best ${game.bestStreak})</dd></div>
      <div><dt>Stamps earned</dt><dd>${game.lifetimeStamps.toLocaleString()}</dd></div>
    </dl>
  `;

  document.querySelector("#stamp-exchange").innerHTML = `
    <span class="kicker">STAMP EXCHANGE</span>
    <p class="exchange-blurb">Duplicate pulls earn stamps. Trade them for tickets, or charter a
    specific vehicle straight from your collection page.</p>
    <div class="exchange-balance"><i data-lucide="stamp"></i><strong>${game.stamps.toLocaleString()}</strong> stamps</div>
    <button class="board-button" data-exchange="1" ${game.stamps < EXCHANGE_RATE ? "disabled" : ""}>
      Exchange ${EXCHANGE_RATE} stamps → 1 ticket
    </button>
    <button class="board-button express" data-exchange="5" ${game.stamps < EXCHANGE_RATE * 5 ? "disabled" : ""}>
      Exchange ${EXCHANGE_RATE * 5} stamps → 5 tickets
    </button>
  `;

  document.querySelector("#achievement-grid").innerHTML = achievements
    .map((achievement) => {
      const claimed = game.claimed.includes(achievement.id);
      const [now, target] = achievement.progress();
      const unlocked = now >= target;
      const percent = Math.min(Math.round((now / target) * 100), 100);
      return `
        <article class="achievement ${claimed ? "claimed" : unlocked ? "claimable" : ""}">
          <span class="ach-icon"><i data-lucide="${achievement.icon}"></i></span>
          <div class="ach-copy">
            <h3>${achievement.name}</h3>
            <p>${achievement.desc}</p>
            <div class="ach-progress"><i style="width:${percent}%"></i></div>
            <span class="ach-progress-label">${Math.min(now, target).toLocaleString()} / ${target.toLocaleString()}</span>
          </div>
          <div class="ach-action">
            ${claimed
              ? '<span class="ach-done"><i data-lucide="check"></i></span>'
              : unlocked
                ? `<button class="claim-button" data-claim="${achievement.id}">Claim +${achievement.reward}</button>`
                : `<span class="ach-reward">+${achievement.reward} <i data-lucide="ticket"></i></span>`}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderBadge() {
  const badge = document.querySelector("#rewards-badge");
  const count = claimableAchievements().length;
  badge.hidden = count === 0;
  badge.textContent = count;
}

function renderButtons() {
  document.querySelectorAll("[data-pull]").forEach((button) => {
    const count = Number(button.dataset.pull);
    button.disabled = game.tickets < pullCost(count);
  });
}

function renderAll() {
  renderWallet();
  renderDaily();
  renderQuest();
  renderPity();
  renderRecent();
  renderFilters();
  renderGarage();
  renderGuide();
  renderRewards();
  renderBadge();
  renderButtons();
  refreshIcons();
}

// --- Reveal -----------------------------------------------------------------

function flipCard(card) {
  card.classList.add("flipped");
}

function openReveal(results, stampsEarned = 0) {
  const dialog = document.querySelector("#reveal-dialog");
  const container = document.querySelector("#reveal-results");
  const newCount = results.filter((result) => result.isNew).length;
  const shinyCount = results.filter((result) => result.shiny).length;
  const chartered = results.some((result) => result.chartered);

  document.querySelector("#reveal-title").textContent = chartered
    ? "Charter confirmed"
    : results.length === 1
      ? "New arrival"
      : "Network arrivals";

  const parts = [];
  if (newCount) parts.push(`${newCount} new sighting${newCount === 1 ? "" : "s"}`);
  if (shinyCount) parts.push(`${shinyCount} limited liver${shinyCount === 1 ? "y" : "ies"}`);
  if (stampsEarned) parts.push(`+${stampsEarned} stamps from duplicates`);
  document.querySelector("#reveal-subtitle").textContent = parts.length
    ? parts.join(" • ")
    : "Tap a card to reveal it early.";

  container.className = `reveal-results ${results.length === 1 ? "single" : ""} ${results.length > 3 ? "many" : ""}`;
  container.innerHTML = results
    .map(
      (result) => `
        <div class="flip-card" data-rarity="${result.vehicle.rarity}"
             data-shiny="${result.shiny}" data-new="${result.isNew}">
          <div class="flip-inner">
            <div class="flip-front">
              ${vehicleCard(result.vehicle, {
                locked: false,
                hideCount: true,
                isNew: result.isNew,
                duplicate: !result.isNew,
                shiny: result.shiny,
              })}
            </div>
            <div class="flip-back">
              <span class="back-track" aria-hidden="true"></span>
              <span class="back-hint">NOW ARRIVING</span>
            </div>
          </div>
        </div>
      `,
    )
    .join("");

  dialog.showModal();
  refreshIcons();

  results.forEach((result, index) => {
    window.setTimeout(() => {
      const card = container.children[index];
      if (card && dialog.open) flipCard(card);
    }, 600 + index * 320);
  });
}

// --- Detail -----------------------------------------------------------------

function openDetail(vehicle) {
  const dialog = document.querySelector("#detail-dialog");
  const copies = game.collection[vehicle.id] || 0;
  const shinyCopies = game.shinies[vehicle.id] || 0;
  const locked = copies + shinyCopies === 0;
  const charterCost = rarityConfig[vehicle.rarity].charter;

  document.querySelector("#detail-content").innerHTML = `
    <article class="detail-card" data-rarity="${vehicle.rarity}">
      <button class="dialog-close" data-close-detail title="Close">
        <i data-lucide="x"></i>
      </button>
      <div class="detail-image">
        <img src="${vehicle.imageLarge}" alt="${vehicle.name}" referrerpolicy="no-referrer"
             onerror="this.onerror=null;this.src='${imageUrl(vehicle.file, 1300)}'" />
      </div>
      <div class="detail-copy">
        <span class="rarity-label">${vehicle.rarity} / ${vehicle.mode}</span>
        <h2>${vehicle.name}</h2>
        <div class="detail-location">${vehicle.city}, ${vehicle.state}</div>
        <p class="detail-description">${vehicle.description}</p>
        <div class="spec-grid">
          <div><span>Operator</span><strong>${vehicle.operator}</strong></div>
          <div><span>In service</span><strong>${vehicle.service}</strong></div>
          <div><span>Top speed</span><strong>${vehicle.speed}</strong></div>
          <div><span>Capacity</span><strong>${vehicle.capacity}</strong></div>
          <div><span>Owned</span><strong>${copies || "Not yet"}</strong></div>
          <div><span>Limited livery</span><strong>${shinyCopies ? `×${shinyCopies}` : "Not yet"}</strong></div>
        </div>
        ${locked ? `
          <button class="board-button charter-detail" data-charter="${vehicle.id}" ${game.stamps < charterCost ? "disabled" : ""}>
            <i data-lucide="stamp"></i> Charter this service — ${charterCost} stamps
          </button>` : ""}
        <a class="source-link" href="${vehicle.source}" target="_blank" rel="noreferrer">
          Read source on Wikipedia <i data-lucide="external-link"></i>
        </a>
      </div>
    </article>
  `;
  dialog.showModal();
  refreshIcons();
}

// --- Shell ------------------------------------------------------------------

function setView(viewName) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `${viewName}-view`);
  });
  document.querySelectorAll("[data-view-link]").forEach((button) => {
    button.classList.toggle("active", button.dataset.viewLink === viewName);
  });
  window.scrollTo(0, 0);
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.querySelector("#toast-region").append(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

document.addEventListener("click", (event) => {
  const flip = event.target.closest(".flip-card");
  if (flip && !flip.classList.contains("flipped")) {
    flipCard(flip);
    return;
  }

  const viewButton = event.target.closest("[data-view-link]");
  if (viewButton) setView(viewButton.dataset.viewLink);

  const pullButton = event.target.closest("[data-pull]");
  if (pullButton) performPull(Number(pullButton.dataset.pull));

  const charterButton = event.target.closest("[data-charter]");
  if (charterButton && !charterButton.disabled) {
    charterVehicle(charterButton.dataset.charter);
    return;
  }

  const claimButton = event.target.closest("[data-claim]");
  if (claimButton) claimAchievement(claimButton.dataset.claim);

  const exchangeButton = event.target.closest("[data-exchange]");
  if (exchangeButton && !exchangeButton.disabled) exchangeStamps(Number(exchangeButton.dataset.exchange));

  const filterButton = event.target.closest("[data-state]");
  if (filterButton) {
    activeFilter = filterButton.dataset.state;
    renderFilters();
    renderGarage();
  }

  const card = event.target.closest("[data-vehicle-id]");
  if (card && !card.classList.contains("locked")) {
    const vehicle = getVehicle(card.dataset.vehicleId);
    if (vehicle) openDetail(vehicle);
  }

  if (event.target.closest("[data-close-dialog]")) {
    document.querySelector("#reveal-dialog").close();
  }

  if (event.target.closest("[data-close-detail]")) {
    document.querySelector("#detail-dialog").close();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".vehicle-card[role='button']");
  if (card) {
    event.preventDefault();
    openDetail(getVehicle(card.dataset.vehicleId));
  }
});

document.querySelector("#daily-button").addEventListener("click", collectDaily);
document.querySelector("#vehicle-search").addEventListener("input", renderGarage);
document.querySelector("#sort-button").addEventListener("click", () => {
  game.sort = game.sort === "rarity" ? "name" : "rarity";
  saveGame();
  renderGarage();
  showToast(`Garage sorted by ${game.sort}.`);
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

window.setInterval(() => {
  const granted = applyRegen();
  if (granted) {
    renderWallet();
    renderButtons();
    showToast(`+${granted} free ticket${granted === 1 ? "" : "s"} from the timetable.`);
  } else {
    document.querySelector("#regen-timer").textContent = regenLabel();
  }
}, 1000);

document.querySelector("#hero-image").style.backgroundImage =
  `url("${getVehicle("vlocity").imageLarge}")`;

applyRegen();
saveGame();
renderAll();

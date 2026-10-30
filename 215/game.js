(() => {
  "use strict";

  const CROPS = {
    carrot: { name: "Carrot", icon: "🥕", seedCost: 3, sellPrice: 8, growDays: 2, stages: ["🌱", "🌿", "🥕"] },
    tomato: { name: "Tomato", icon: "🍅", seedCost: 5, sellPrice: 13, growDays: 3, stages: ["🌱", "🌿", "🍅"] },
    pumpkin: { name: "Pumpkin", icon: "🎃", seedCost: 8, sellPrice: 22, growDays: 4, stages: ["🌱", "🌿", "🎃"] }
  };
  const PLOT_COUNT = 16;
  const SAVE_KEY = "little-acre-save-v1";
  const tools = {
    plant: "Choose a seed, then tap an empty plot.",
    water: "Give thirsty plants a drink before nightfall.",
    harvest: "Tap a glowing, fully grown crop to pick it."
  };
  const weatherTypes = [
    { name: "Sunny skies", icon: "☀️" },
    { name: "A soft breeze", icon: "🌤️" },
    { name: "Gentle rain", icon: "🌧️" }
  ];

  const elements = {
    day: document.querySelector("#day-label"),
    weather: document.querySelector("#weather-label"),
    coins: document.querySelector("#coins-label"),
    seeds: document.querySelector("#seed-total"),
    basket: document.querySelector("#basket-total"),
    plots: document.querySelector("#plot-count"),
    grid: document.querySelector("#garden-grid"),
    seedPicker: document.querySelector("#seed-picker"),
    shop: document.querySelector("#shop-list"),
    basketValue: document.querySelector("#basket-value"),
    sell: document.querySelector("#sell-button"),
    nextDay: document.querySelector("#next-day-button"),
    tip: document.querySelector("#tool-tip"),
    message: document.querySelector("#garden-message"),
    dateIcon: document.querySelector(".date-icon"),
    season: document.querySelector("#season-label"),
    saveStatus: document.querySelector("#save-status"),
    toastRegion: document.querySelector("#toast-region")
  };

  function newGame() {
    return {
      day: 1,
      coins: 30,
      seeds: { carrot: 5, tomato: 0, pumpkin: 0 },
      basket: { carrot: 0, tomato: 0, pumpkin: 0 },
      plots: Array.from({ length: PLOT_COUNT }, () => null),
      weather: weatherTypes[0],
      tool: "plant",
      selectedSeed: "carrot"
    };
  }

  function loadGame() {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (!saved) return newGame();
      const parsed = JSON.parse(saved);
      if (!parsed || !Array.isArray(parsed.plots) || parsed.plots.length !== PLOT_COUNT) return newGame();
      const fresh = newGame();
      return {
        ...fresh,
        ...parsed,
        seeds: { ...fresh.seeds, ...(parsed.seeds || {}) },
        basket: { ...fresh.basket, ...(parsed.basket || {}) },
        plots: parsed.plots.map(plot => {
          if (!plot || !CROPS[plot.crop] || !Number.isFinite(plot.progress)) return null;
          return { crop: plot.crop, progress: Math.max(0, Math.min(plot.progress, CROPS[plot.crop].growDays)), watered: Boolean(plot.watered) };
        }),
        weather: weatherTypes.find(item => item.name === parsed.weather?.name) || fresh.weather,
        tool: ["plant", "water", "harvest"].includes(parsed.tool) ? parsed.tool : fresh.tool,
        selectedSeed: CROPS[parsed.selectedSeed] ? parsed.selectedSeed : fresh.selectedSeed
      };
    } catch (error) {
      console.error("Could not load the saved farm.", error);
      return newGame();
    }
  }

  const state = loadGame();

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      elements.saveStatus.textContent = "Your progress saves automatically.";
    } catch (error) {
      console.error("Could not save the farm.", error);
      elements.saveStatus.textContent = "Unable to save progress in this browser.";
    }
  }

  function toast(message) {
    const item = document.createElement("div");
    item.className = "toast";
    item.textContent = message;
    elements.toastRegion.append(item);
    window.setTimeout(() => item.remove(), 2600);
  }

  function totals(collection) {
    return Object.values(collection).reduce((sum, count) => sum + count, 0);
  }

  function basketWorth() {
    return Object.entries(state.basket).reduce((sum, [crop, count]) => sum + CROPS[crop].sellPrice * count, 0);
  }

  function renderStats() {
    elements.day.textContent = `Day ${state.day}`;
    elements.weather.textContent = state.weather.name;
    elements.dateIcon.textContent = state.weather.icon;
    elements.coins.textContent = state.coins;
    elements.seeds.textContent = totals(state.seeds);
    elements.basket.textContent = totals(state.basket);
    elements.plots.textContent = `${state.plots.filter(Boolean).length} / ${PLOT_COUNT}`;
    elements.basketValue.textContent = `Basket value: ${basketWorth()} coins`;
    elements.sell.disabled = totals(state.basket) === 0;
    elements.season.textContent = state.day > 20 ? "A WHOLE SEASON OF GROWING" : "YOUR COUNTRYSIDE ESCAPE";
  }

  function renderGarden() {
    elements.grid.replaceChildren();
    state.plots.forEach((plot, index) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "plot";
      tile.setAttribute("aria-label", plot ? `${CROPS[plot.crop].name}, growth ${plot.progress} of ${CROPS[plot.crop].growDays}${plot.watered ? ", watered" : ", needs water"}` : "Empty soil plot");
      tile.dataset.index = String(index);

      if (!plot) {
        tile.classList.add("empty");
      } else {
        tile.classList.add("planted");
        if (plot.watered) tile.classList.add("watered");
        const crop = CROPS[plot.crop];
        const stage = Math.min(2, Math.floor((plot.progress / crop.growDays) * 3));
        const plant = document.createElement("span");
        plant.className = `crop crop-stage-${stage + 1}`;
        plant.textContent = crop.stages[stage];
        tile.append(plant);
        if (plot.progress >= crop.growDays) {
          tile.classList.add("plot-ripe");
          tile.title = `Ripe ${crop.name} — ready to harvest`;
        } else if (!plot.watered) {
          const water = document.createElement("span");
          water.className = "plot-water-mark";
          water.textContent = "💧";
          tile.append(water);
        }
      }

      tile.addEventListener("click", () => usePlot(index));
      elements.grid.append(tile);
    });
  }

  function renderSeedPicker() {
    elements.seedPicker.replaceChildren();
    if (state.tool !== "plant") {
      elements.seedPicker.hidden = true;
      return;
    }
    elements.seedPicker.hidden = false;
    Object.entries(CROPS).forEach(([key, crop]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `seed-choice${state.selectedSeed === key ? " selected" : ""}`;
      button.disabled = state.seeds[key] < 1;
      button.innerHTML = `<span>${crop.icon}</span><span>${crop.name}</span><span class="seed-count">×${state.seeds[key]}</span>`;
      button.setAttribute("aria-pressed", String(state.selectedSeed === key));
      button.addEventListener("click", () => {
        state.selectedSeed = key;
        render();
        save();
      });
      elements.seedPicker.append(button);
    });
  }

  function renderShop() {
    elements.shop.replaceChildren();
    Object.entries(CROPS).forEach(([key, crop]) => {
      const row = document.createElement("div");
      row.className = "shop-item";
      const info = document.createElement("div");
      info.className = "shop-crop";
      info.innerHTML = `<span class="shop-crop-icon">${crop.icon}</span><span><strong>${crop.name} seed</strong><small>${crop.growDays} sunny days · sells for ${crop.sellPrice}¢</small></span>`;
      const buy = document.createElement("button");
      buy.type = "button";
      buy.className = "buy-button";
      buy.textContent = `Buy · ${crop.seedCost}¢`;
      buy.disabled = state.coins < crop.seedCost;
      buy.setAttribute("aria-label", `Buy ${crop.name} seed for ${crop.seedCost} coins`);
      buy.addEventListener("click", () => {
        if (state.coins < crop.seedCost) return;
        state.coins -= crop.seedCost;
        state.seeds[key] += 1;
        state.selectedSeed = key;
        state.tool = "plant";
        toast(`${crop.icon} ${crop.name} seed added to your pouch!`);
        render();
        save();
      });
      row.append(info, buy);
      elements.shop.append(row);
    });
  }

  function renderTools() {
    document.querySelectorAll(".tool-button").forEach(button => {
      const active = button.dataset.tool === state.tool;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    elements.tip.textContent = tools[state.tool];
  }

  function render() {
    renderStats();
    renderGarden();
    renderSeedPicker();
    renderShop();
    renderTools();
  }

  function usePlot(index) {
    const plot = state.plots[index];
    if (state.tool === "plant") {
      if (plot) {
        toast("That little patch is already growing something.");
        return;
      }
      const crop = CROPS[state.selectedSeed];
      if (state.seeds[state.selectedSeed] < 1) {
        toast(`No ${crop.name.toLowerCase()} seeds left. Visit the seed shop!`);
        return;
      }
      state.seeds[state.selectedSeed] -= 1;
      state.plots[index] = { crop: state.selectedSeed, progress: 0, watered: false };
      toast(`${crop.icon} ${crop.name} seed planted. Give it a drink!`);
    } else if (state.tool === "water") {
      if (!plot) {
        toast("Nothing planted here just yet.");
        return;
      }
      if (plot.watered) {
        toast("This little plant has had its drink for today.");
        return;
      }
      plot.watered = true;
      toast("A refreshing drink for your plant. 💧");
    } else {
      if (!plot || plot.progress < CROPS[plot.crop].growDays) {
        toast("Not quite ready yet. A little more sunshine!");
        return;
      }
      const crop = CROPS[plot.crop];
      state.basket[plot.crop] += 1;
      state.plots[index] = null;
      toast(`${crop.icon} Lovely! ${crop.name} added to your basket.`);
    }
    render();
    save();
  }

  function endDay() {
    let grew = 0;
    let thirsty = 0;
    const rainy = state.weather.name === "Gentle rain";
    state.plots.forEach(plot => {
      if (!plot) return;
      if (plot.watered || rainy) {
        plot.progress = Math.min(CROPS[plot.crop].growDays, plot.progress + 1);
        grew += 1;
      } else if (plot.progress < CROPS[plot.crop].growDays) {
        thirsty += 1;
      }
      plot.watered = false;
    });
    state.day += 1;
    state.weather = weatherTypes[Math.random() < 0.2 ? 2 : Math.random() < 0.5 ? 1 : 0];
    elements.message.textContent = state.weather.name === "Gentle rain"
      ? "The rain will water your garden today."
      : "A lovely day to get your hands dirty.";
    toast(rainy ? `Rain watered the garden. ${grew} ${grew === 1 ? "plant grew" : "plants grew"}!` : `${grew} ${grew === 1 ? "plant grew" : "plants grew"}${thirsty ? ` · ${thirsty} need water` : ""}`);
    render();
    save();
  }

  document.querySelectorAll(".tool-button").forEach(button => {
    button.addEventListener("click", () => {
      state.tool = button.dataset.tool;
      render();
      save();
    });
  });
  elements.nextDay.addEventListener("click", endDay);
  elements.sell.addEventListener("click", () => {
    const value = basketWorth();
    if (!value) return;
    const quantity = totals(state.basket);
    state.coins += value;
    Object.keys(state.basket).forEach(crop => { state.basket[crop] = 0; });
    toast(`A lovely sale! ${quantity} ${quantity === 1 ? "item" : "items"} sold for ${value} coins.`);
    render();
    save();
  });
  document.querySelector("#sound-button").addEventListener("click", event => {
    const button = event.currentTarget;
    const muted = button.classList.toggle("muted");
    button.setAttribute("aria-pressed", String(!muted));
    button.title = muted ? "Sound is off" : "Sound is on";
    toast(muted ? "Sound turned off." : "Sound turned on. (There are no game sounds yet!)");
  });

  render();
  elements.message.textContent = state.weather.name === "Gentle rain"
    ? "The rain will water your garden today."
    : "A lovely day to get your hands dirty.";
})();

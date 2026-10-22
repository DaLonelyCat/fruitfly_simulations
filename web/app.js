/**
 * Master Application Controller for 3D Drosophila Connectome Simulation
 * Synchronizes 3D Behavioral Terrarium, 3D Connectome Brain, and Dopamine Reward System.
 */

(function () {
  'use strict';

  // DOM Elements
  const btnPause = document.getElementById('btn-pause');
  const pauseIconSvg = document.getElementById('pause-icon-svg');
  const pauseText = document.getElementById('pause-text');
  const speedSlider = document.getElementById('speed-slider');
  const speedVal = document.getElementById('speed-val');
  const btnStartle = document.getElementById('btn-startle');
  const btnAddFly = document.getElementById('btn-add-fly');

  const toolSelect = document.getElementById('tool-select');
  const toolFig = document.getElementById('tool-fig');
  const toolGrapes = document.getElementById('tool-grapes');
  const toolBanana = document.getElementById('tool-banana');
  const toolSugar = document.getElementById('tool-sugar');
  const toolRemoveFood = document.getElementById('tool-remove-food');
  const btnClearFood = document.getElementById('btn-clear-food');
  const btnToggleHitbox = document.getElementById('btn-toggle-hitbox');
  const btnFlyTakeoff = document.getElementById('btn-fly-takeoff');
  const btnResetCamArena = document.getElementById('btn-reset-cam-arena');
  const btnFullscreen = document.getElementById('btn-fullscreen');

  const camOrbit = document.getElementById('cam-orbit');
  const camFollow = document.getElementById('cam-follow');
  const camWasd = document.getElementById('cam-wasd');

  const btnMaximizeArena = document.getElementById('btn-maximize-arena');
  const btnMaximizeBrain = document.getElementById('btn-maximize-brain');
  const arenaViewport = document.querySelector('.arena-viewport');
  const brainViewport = document.querySelector('.brain-viewport');

  const statFlyCount = document.getElementById('stat-fly-count');
  const statCourtshipCount = document.getElementById('stat-courtship-count');
  const statFightCount = document.getElementById('stat-fight-count');
  const statDopamineCount = document.getElementById('stat-dopamine-count');
  const statStepCount = document.getElementById('stat-step-count');
  const eventsTicker = document.getElementById('events-ticker');

  const flySelectDropdown = document.getElementById('fly-select-dropdown');
  const selectedFlyHeading = document.getElementById('selected-fly-heading');
  const selectedFlyGender = document.getElementById('selected-fly-gender');
  const flyThoughtText = document.getElementById('fly-thought-text');
  const dopamineBadge = document.getElementById('dopamine-badge');
  const firingRatesContainer = document.getElementById('firing-rates-container');
  const compassHeadingVal = document.getElementById('compass-heading-val');
  const wedgeBarsContainer = document.getElementById('wedge-bars-container');

  const sliderDa = document.getElementById('slider-da');
  const sliderOa = document.getElementById('slider-oa');
  const slider5ht = document.getElementById('slider-5ht');
  const sliderFru = document.getElementById('slider-fru');
  const sliderFear = document.getElementById('slider-fear');
  const sliderHunger = document.getElementById('slider-hunger');

  const valDa = document.getElementById('val-da');
  const valOa = document.getElementById('val-oa');
  const val5ht = document.getElementById('val-5ht');
  const valFru = document.getElementById('val-fru');
  const valFear = document.getElementById('val-fear');
  const valHunger = document.getElementById('val-hunger');

  const addFlyModal = document.getElementById('add-fly-modal');
  const archetypeSelectionGrid = document.getElementById('archetype-selection-grid');
  const btnCancelSpawn = document.getElementById('btn-cancel-spawn');
  const btnConfirmSpawn = document.getElementById('btn-confirm-spawn');

  // Application State
  let ws = null;
  let currentState = null;
  let selectedFlyId = 1;
  let activeTool = 'select'; // 'select', 'banana', 'sugar'
  let totalDopamineSurges = 0;

  // Viewport Controllers
  let arena3D = null;
  let brain3D = null;
  let brain2DVisualizer = null;
  let availableArchetypes = {};
  let selectedSpawnArchetype = 'Romeo';

  // Default production cloud backend
  const DEFAULT_CLOUD_BACKEND = 'https://fruitfly-simulations.onrender.com';

  // Backend Configuration (Supports localhost, Cloudflare Pages proxy, or standalone cloud host)
  function getBackendConfig() {
    // 1. Check URL query parameters (?backend=https://...)
    const urlParams = new URLSearchParams(window.location.search);
    const paramBackend = urlParams.get('backend');
    if (paramBackend) {
      localStorage.setItem('drosophila_backend_url', paramBackend.replace(/\/+$/, ''));
    }

    // 2. Check localStorage (persisted for Cloudflare Pages visits)
    const saved = localStorage.getItem('drosophila_backend_url');
    if (saved) {
      const clean = saved.replace(/\/+$/, '');
      const wsProto = clean.startsWith('https') ? 'wss:' : 'ws:';
      const wsHost = clean.replace(/^https?:\/\//, '');
      return {
        httpBase: clean,
        wsUrl: `${wsProto}//${wsHost}/ws`
      };
    }

    // 3. If running locally on localhost / 127.0.0.1, use local same-origin server
    const isLocalhost = Boolean(
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]'
    );
    if (isLocalhost) {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return {
        httpBase: '',
        wsUrl: `${proto}//${window.location.host}/ws`
      };
    }

    // 4. Default for Cloudflare Pages (*.pages.dev or public web deployments)
    const clean = DEFAULT_CLOUD_BACKEND.replace(/\/+$/, '');
    const wsProto = clean.startsWith('https') ? 'wss:' : 'ws:';
    const wsHost = clean.replace(/^https?:\/\//, '');
    return {
      httpBase: clean,
      wsUrl: `${wsProto}//${wsHost}/ws`
    };
  }

  // Initialize
  async function init() {
    const backendConfig = getBackendConfig();

    // 1. Initialize 3D Behavioral Terrarium
    arena3D = new window.Arena3DView('arena-3d-container');

    // 2. Initialize 3D Connectome Brain Viewer (DeepMind reconstruction)
    brain3D = new window.Brain3DView('brain-3d-container');

    // 3. Initialize 2D fallback circuit diagram & compass
    brain2DVisualizer = new window.BrainVisualizer('circuit-canvas', 'compass-canvas');

    // 4. Fetch metadata
    try {
      const connRes = await fetch(`${backendConfig.httpBase}/api/connectome`);
      const connData = await connRes.json();
      brain2DVisualizer.setConnectomeData(connData);
      initPopulationBars(connData.subcircuit.populations);

      const archRes = await fetch(`${backendConfig.httpBase}/api/archetypes`);
      availableArchetypes = await archRes.json();
      renderArchetypeGrid();
    } catch (err) {
      console.warn('Metadata fetch notice:', err);
    }

    initWedgeBars();
    setupEvents();
    connectWebSocket();
    requestAnimationFrame(renderLoop);
  }

  function initPopulationBars(popNames) {
    firingRatesContainer.innerHTML = '';
    popNames.forEach((name) => {
      const barItem = document.createElement('div');
      barItem.className = 'pop-bar-item';
      barItem.id = `pop-bar-${name}`;
      barItem.innerHTML = `
        <div class="pop-bar-header">
          <span class="pop-name">${name.replace(/^[A-Z]+_/, '')}</span>
          <span class="pop-rate" id="rate-val-${name}">0.00</span>
        </div>
        <div class="pop-bar-track">
          <div class="pop-bar-fill" id="fill-${name}"></div>
        </div>
      `;
      firingRatesContainer.appendChild(barItem);
    });
  }

  function initWedgeBars() {
    wedgeBarsContainer.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const item = document.createElement('div');
      item.className = 'wedge-item';
      item.innerHTML = `
        <div class="wedge-track">
          <div class="wedge-fill" id="wedge-fill-${i}"></div>
        </div>
        <span>W${i + 1}</span>
      `;
      wedgeBarsContainer.appendChild(item);
    }
  }

  function renderArchetypeGrid() {
    archetypeSelectionGrid.innerHTML = '';
    for (const [key, arch] of Object.entries(availableArchetypes)) {
      const card = document.createElement('div');
      card.className = `archetype-card ${key === selectedSpawnArchetype ? 'selected' : ''}`;
      card.dataset.arch = key;
      card.innerHTML = `
        <div class="archetype-card-title" style="color: ${arch.color}">${arch.name} (${arch.gender})</div>
        <div class="archetype-card-desc">${arch.description}</div>
      `;
      card.addEventListener('click', () => {
        document.querySelectorAll('.archetype-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedSpawnArchetype = key;
      });
      archetypeSelectionGrid.appendChild(card);
    }
  }

  // WebSocket Connection
  function connectWebSocket() {
    const config = getBackendConfig();
    try {
      ws = new WebSocket(config.wsUrl);
    } catch (err) {
      console.warn('WebSocket connection error:', err);
    }

    if (!ws) return;

    ws.onopen = () => {
      console.log('Connectome 3D WebSocket connected to:', config.wsUrl);
    };

    ws.onmessage = (event) => {
      currentState = JSON.parse(event.data);
      updateUI();
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected. Reconnecting in 1.5s...');
      setTimeout(connectWebSocket, 1500);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  function sendCommand(cmd) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(cmd));
    }
  }

  // Event Listeners
  function setupEvents() {
    // Play/Pause
    btnPause.addEventListener('click', () => {
      sendCommand({ action: 'toggle_pause' });
    });

    // Speed Slider
    speedSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      speedVal.textContent = `${val.toFixed(1)}x`;
      sendCommand({ action: 'set_speed', speed: val });
    });

    // Startle Swarm
    btnStartle.addEventListener('click', () => {
      sendCommand({ action: 'startle_all' });
    });

    // Add Fly Modal
    btnAddFly.addEventListener('click', () => {
      addFlyModal.classList.remove('hidden');
    });

    btnCancelSpawn.addEventListener('click', () => {
      addFlyModal.classList.add('hidden');
    });

    btnConfirmSpawn.addEventListener('click', () => {
      sendCommand({ action: 'add_fly', archetype: selectedSpawnArchetype });
      addFlyModal.classList.add('hidden');
    });

    // Fullscreen Toggle
    function toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn('Fullscreen request:', err);
        });
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    }

    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', toggleFullscreen);
    }

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyF' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        toggleFullscreen();
      }
    });

    // Camera Mode Switching
    if (camOrbit) camOrbit.addEventListener('click', () => arena3D && arena3D.setCameraMode('orbit'));
    if (camFollow) camFollow.addEventListener('click', () => arena3D && arena3D.setCameraMode('follow'));
    if (camWasd) camWasd.addEventListener('click', () => arena3D && arena3D.setCameraMode('wasd'));

    // Panel Maximize & Picture-in-Picture
    function updateMaximizeBtn(btn, isRestoring) {
      if (!btn) return;
      const span = btn.querySelector('span');
      if (span) span.textContent = isRestoring ? 'Restore' : 'Maximize';
      btn.setAttribute('aria-label', isRestoring ? 'Restore Viewport' : 'Maximize Viewport');
      btn.setAttribute('title', isRestoring ? 'Restore normal view' : 'Maximize view');
      const svg = btn.querySelector('svg');
      if (svg) {
        if (isRestoring) {
          svg.innerHTML = '<polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="10" y1="14" x2="3" y2="21"></line>';
        } else {
          svg.innerHTML = '<polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>';
        }
      }
    }

    function toggleMaximize(targetPanel) {
      const isArena = (targetPanel === 'arena');
      const primary = isArena ? arenaViewport : brainViewport;
      const secondary = isArena ? brainViewport : arenaViewport;

      if (!primary || !secondary) return;

      if (primary.classList.contains('maximized')) {
        primary.classList.remove('maximized');
        secondary.classList.remove('pip-mode');
        updateMaximizeBtn(btnMaximizeArena, false);
        updateMaximizeBtn(btnMaximizeBrain, false);
      } else {
        primary.classList.add('maximized');
        primary.classList.remove('pip-mode');
        secondary.classList.add('pip-mode');
        secondary.classList.remove('maximized');
        if (isArena) {
          updateMaximizeBtn(btnMaximizeArena, true);
          updateMaximizeBtn(btnMaximizeBrain, false);
        } else {
          updateMaximizeBtn(btnMaximizeBrain, true);
          updateMaximizeBtn(btnMaximizeArena, false);
        }
      }
      setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
    }

    if (btnMaximizeArena) btnMaximizeArena.addEventListener('click', () => toggleMaximize('arena'));
    if (btnMaximizeBrain) btnMaximizeBrain.addEventListener('click', () => toggleMaximize('brain'));

    if (arenaViewport) {
      arenaViewport.addEventListener('click', () => {
        if (arenaViewport.classList.contains('pip-mode')) toggleMaximize('arena');
      });
    }
    if (brainViewport) {
      brainViewport.addEventListener('click', (e) => {
        if (brainViewport.classList.contains('pip-mode')) toggleMaximize('brain');
      });
    }

    // Optogenetic Stimulation Buttons
    document.querySelectorAll('.opto-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pop = btn.dataset.pop;
        if (brain3D) brain3D.stimulateRegion(pop, 2.5);
      });
    });

    window.addEventListener('brain-stimulate-neuropil', (e) => {
      sendCommand({
        action: 'stimulate_neuropil',
        fly_id: selectedFlyId,
        population: e.detail.population,
        intensity: e.detail.intensity || 2.5
      });
    });

    // 3D Tools
    toolSelect.addEventListener('click', () => setTool('select'));
    if (toolFig) toolFig.addEventListener('click', () => setTool('fig'));
    if (toolGrapes) toolGrapes.addEventListener('click', () => setTool('grapes'));
    toolBanana.addEventListener('click', () => setTool('banana'));
    toolSugar.addEventListener('click', () => setTool('sugar'));
    if (toolRemoveFood) {
      toolRemoveFood.addEventListener('click', () => setTool('remove_food'));
    }

    if (btnClearFood) {
      btnClearFood.addEventListener('click', () => {
        sendCommand({ action: 'clear_food' });
      });
    }

    if (btnToggleHitbox) {
      btnToggleHitbox.addEventListener('click', () => {
        if (arena3D) {
          const nextState = !arena3D.showHitboxes;
          arena3D.toggleHitboxes(nextState);
          btnToggleHitbox.classList.toggle('active', nextState);
          btnToggleHitbox.setAttribute('aria-pressed', nextState ? 'true' : 'false');
          btnToggleHitbox.textContent = nextState ? 'Hitboxes: ON' : 'Hitboxes: OFF';
        }
      });
    }

    if (btnFlyTakeoff) {
      btnFlyTakeoff.addEventListener('click', () => {
        sendCommand({ action: 'trigger_flight', fly_id: selectedFlyId });
      });
    }

    btnResetCamArena.addEventListener('click', () => {
      if (arena3D && arena3D.camera && arena3D.controls) {
        arena3D.camera.position.set(100, -140, 160);
        arena3D.controls.target.set(100, 100, 25);
        arena3D.controls.update();
      }
    });

    // 3D Terrarium Custom Events
    window.addEventListener('select-fly-3d', (e) => {
      selectedFlyId = e.detail.flyId;
      sendCommand({ action: 'select_fly', fly_id: selectedFlyId });
    });

    window.addEventListener('food-click-3d', (e) => {
      if (activeTool === 'remove_food') {
        sendCommand({ action: 'remove_food', food_id: e.detail.foodId });
      }
    });

    window.addEventListener('floor-click-3d', (e) => {
      if (activeTool === 'fig') {
        sendCommand({ action: 'add_food', x: e.detail.x, y: e.detail.y, z: e.detail.z, food_type: 'rotting_fig' });
      } else if (activeTool === 'grapes') {
        sendCommand({ action: 'add_food', x: e.detail.x, y: e.detail.y, z: e.detail.z, food_type: 'bruised_grapes' });
      } else if (activeTool === 'banana') {
        sendCommand({ action: 'add_food', x: e.detail.x, y: e.detail.y, z: e.detail.z, food_type: 'banana_slice' });
      } else if (activeTool === 'sugar') {
        sendCommand({ action: 'add_food', x: e.detail.x, y: e.detail.y, z: e.detail.z, food_type: 'sugar_cube' });
      }
    });

    // Fly Selector Dropdown
    flySelectDropdown.addEventListener('change', (e) => {
      selectedFlyId = parseInt(e.target.value, 10);
      sendCommand({ action: 'select_fly', fly_id: selectedFlyId });
    });

    // Tab Navigation
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        const activeTab = document.getElementById(btn.dataset.tab);
        if (activeTab) activeTab.classList.add('active');
        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
      });
    });

    // Sliders
    const sliders = [
      { el: sliderDa, valEl: valDa, key: 'dopamine' },
      { el: sliderOa, valEl: valOa, key: 'octopamine' },
      { el: slider5ht, valEl: val5ht, key: 'serotonin' },
      { el: sliderFru, valEl: valFru, key: 'fruitless' },
      { el: sliderFear, valEl: valFear, key: 'fear' },
      { el: sliderHunger, valEl: valHunger, key: 'hunger' }
    ];

    sliders.forEach(({ el, valEl, key }) => {
      el.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        valEl.textContent = val.toFixed(2);
        sendCommand({
          action: 'update_personality',
          fly_id: selectedFlyId,
          personality: { [key]: val }
        });
      });
    });

    // Presets
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        sendCommand({
          action: 'gene_knockout',
          fly_id: selectedFlyId,
          gene: btn.dataset.mutant
        });
      });
    });
  }

  function setTool(toolName) {
    activeTool = toolName;
    const tools = [
      { el: toolSelect, name: 'select' },
      { el: toolFig, name: 'fig' },
      { el: toolGrapes, name: 'grapes' },
      { el: toolBanana, name: 'banana' },
      { el: toolSugar, name: 'sugar' },
      { el: toolRemoveFood, name: 'remove_food' }
    ];
    tools.forEach(({ el, name }) => {
      if (el) {
        const isActive = (toolName === name);
        el.classList.toggle('active', isActive);
        el.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      }
    });
  }

  // Update UI & Telemetry
  function updateUI() {
    if (!currentState) return;

    // Pass state to 3D Terrarium
    if (arena3D) {
      arena3D.updateState(currentState);
    }

    // Top metrics
    statFlyCount.textContent = currentState.flies.length;
    statStepCount.textContent = currentState.step;

    if (currentState.environment) {
      statCourtshipCount.textContent = currentState.environment.total_courtships || 0;
      statFightCount.textContent = currentState.environment.total_fights || 0;
      updateEventsTicker(currentState.environment.recent_events || []);
      updateSocialMatrix(currentState.environment.interaction_pairs || {});
    }

    // Pause button state
    if (currentState.paused) {
      if (pauseIconSvg) {
        pauseIconSvg.innerHTML = '<polygon points="7,4 19,12 7,20" fill="currentColor"></polygon>';
      }
      pauseText.textContent = 'Resume';
    } else {
      if (pauseIconSvg) {
        pauseIconSvg.innerHTML = '<rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect>';
      }
      pauseText.textContent = 'Pause';
    }

    syncFlyDropdown(currentState.flies);

    // Selected Fly Telemetry
    const selFly = currentState.flies.find((f) => f.id === selectedFlyId) || currentState.flies[0];
    if (selFly) {
      selectedFlyId = selFly.id;
      selectedFlyHeading.textContent = `3D Connectome Brain: Fly #${selFly.id} (${selFly.archetype})`;
      selectedFlyHeading.style.color = selFly.color;
      selectedFlyGender.textContent = `Sex: ${selFly.gender.toUpperCase()} • Position: (${selFly.x.toFixed(0)}, ${selFly.y.toFixed(0)}, ${selFly.z.toFixed(0)}mm) • Action: ${selFly.action.toUpperCase()}`;

      // Dopamine level badge
      dopamineBadge.textContent = `DA: ${selFly.dopamine.toFixed(2)}`;

      if (selFly.dopamine_surge) {
        totalDopamineSurges += 1;
        statDopamineCount.textContent = totalDopamineSurges;
      }

      const telem = selFly.telemetry;
      if (telem) {
        flyThoughtText.textContent = `"${telem.last_thought}"`;
        compassHeadingVal.textContent = `${telem.internal_heading_deg} deg`;

        // Update 3D Connectome Brain Viewer (DeepMind Reconstruction)
        if (brain3D) {
          brain3D.updateTelemetry(telem);
        }

        // Update 2D fallback visualizer
        if (brain2DVisualizer) {
          brain2DVisualizer.updateTelemetry(telem);
        }

        // Update Population Firing Rate Bars
        const rates = telem.firing_rates || {};
        for (const [pName, rVal] of Object.entries(rates)) {
          const rateValEl = document.getElementById(`rate-val-${pName}`);
          const fillEl = document.getElementById(`fill-${pName}`);
          if (rateValEl && fillEl) {
            rateValEl.textContent = rVal.toFixed(2);
            fillEl.style.width = `${Math.min(100, Math.round(rVal * 100))}%`;
          }
        }

        // Update Wedge Bars
        const ring = telem.compass_ring || [];
        ring.forEach((val, i) => {
          const wFill = document.getElementById(`wedge-fill-${i}`);
          if (wFill) {
            wFill.style.height = `${Math.min(100, Math.round(val * 100))}%`;
          }
        });

        // Sync Sliders if not dragging
        if (!document.activeElement.classList.contains('neuro-slider')) {
          const p = telem.personality || {};
          if (p.dopamine !== undefined) {
            sliderDa.value = p.dopamine;
            valDa.textContent = Number(p.dopamine).toFixed(2);
          }
          if (p.octopamine !== undefined) {
            sliderOa.value = p.octopamine;
            valOa.textContent = Number(p.octopamine).toFixed(2);
          }
          if (p.serotonin !== undefined) {
            slider5ht.value = p.serotonin;
            val5ht.textContent = Number(p.serotonin).toFixed(2);
          }
          if (p.fruitless !== undefined) {
            sliderFru.value = p.fruitless;
            valFru.textContent = Number(p.fruitless).toFixed(2);
          }
          if (p.fear !== undefined) {
            sliderFear.value = p.fear;
            valFear.textContent = Number(p.fear).toFixed(2);
          }
          if (p.hunger !== undefined) {
            sliderHunger.value = p.hunger;
            valHunger.textContent = Number(p.hunger).toFixed(2);
          }
        }

        updateLeaderboard(currentState.flies, selFly);
      }
    }
  }

  function syncFlyDropdown(flies) {
    if (flySelectDropdown.options.length !== flies.length) {
      flySelectDropdown.innerHTML = '';
      flies.forEach((f) => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = `Fly #${f.id} (${f.archetype})`;
        flySelectDropdown.appendChild(opt);
      });
    }
    flySelectDropdown.value = selectedFlyId;
  }

  function updateEventsTicker(events) {
    if (!events || events.length === 0) return;
    eventsTicker.innerHTML = '';
    const slice = events.slice(-8).reverse();
    slice.forEach((ev) => {
      const item = document.createElement('div');
      item.className = `ticker-item ${ev.type}`;
      if (ev.type === 'courtship') {
        item.textContent = `Courtship: Fly #${ev.suitor_id} (${ev.suitor_name}) -> Fly #${ev.target_id} (${ev.target_name}) [${ev.wing} wing song]`;
      } else if (ev.type === 'aggression') {
        item.textContent = `Aggression: Fly #${ev.aggressor_id} (${ev.aggressor_name}) lunged at Fly #${ev.target_id} (${ev.target_name})!`;
      }
      eventsTicker.appendChild(item);
    });
  }

  function updateLeaderboard(flies, selFly) {
    const lbContainer = document.getElementById('leaderboard-container');
    const sorted = [...flies].sort((a, b) => (b.fights_won || 0) - (a.fights_won || 0));
    lbContainer.innerHTML = '';
    sorted.slice(0, 5).forEach((f, idx) => {
      const row = document.createElement('div');
      row.className = 'leader-item';
      row.innerHTML = `
        <span><span class="leader-rank">#${idx + 1}</span> Fly #${f.id} (${f.archetype})</span>
        <span>${f.fights_won || 0} wins • DA: ${f.dopamine.toFixed(2)}</span>
      `;
      lbContainer.appendChild(row);
    });

    const statsList = document.getElementById('selected-fly-stats');
    statsList.innerHTML = `
      <div class="leader-item"><span>Archetype:</span><span>${selFly.archetype} (${selFly.gender})</span></div>
      <div class="leader-item"><span>Current Satiety:</span><span>${Math.round(selFly.satiety * 100)}%</span></div>
      <div class="leader-item"><span>Dopamine (DA):</span><span class="text-gold">${selFly.dopamine.toFixed(2)}</span></div>
      <div class="leader-item"><span>Courtship Bouts:</span><span>${selFly.courtship_bouts || 0}</span></div>
      <div class="leader-item"><span>Fights Won:</span><span>${selFly.fights_won || 0}</span></div>
    `;
  }

  function updateSocialMatrix(pairs) {
    const container = document.getElementById('interaction-matrix-view');
    container.innerHTML = '';
    const entries = Object.entries(pairs);
    if (entries.length === 0) {
      container.innerHTML = '<span style="color:#64748b;font-size:10px;">No social contacts recorded yet.</span>';
      return;
    }
    entries.forEach(([pair, count]) => {
      const badge = document.createElement('div');
      badge.className = 'pair-badge';
      badge.textContent = `Fly ${pair.replace('-', ' ⟷ ')}: ${count} interactions`;
      container.appendChild(badge);
    });
  }

  // Render Loop
  function renderLoop() {
    if (arena3D) arena3D.render();
    if (brain3D) brain3D.render();
    if (brain2DVisualizer) brain2DVisualizer.render();
    requestAnimationFrame(renderLoop);
  }

  window.addEventListener('DOMContentLoaded', init);
})();

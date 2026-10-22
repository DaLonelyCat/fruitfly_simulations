/**
 * Master Application Controller for 3D Drosophila Connectome Simulation
 * Synchronizes 3D Behavioral Terrarium, 3D Connectome Brain, and Dopamine Reward System.
 */

(function () {
  'use strict';

  // DOM Elements
  const btnPause = document.getElementById('btn-pause');
  const pauseIcon = document.getElementById('pause-icon');
  const pauseText = document.getElementById('pause-text');
  const speedSlider = document.getElementById('speed-slider');
  const speedVal = document.getElementById('speed-val');
  const btnStartle = document.getElementById('btn-startle');
  const btnAddFly = document.getElementById('btn-add-fly');

  const toolSelect = document.getElementById('tool-select');
  const toolBanana = document.getElementById('tool-banana');
  const toolSugar = document.getElementById('tool-sugar');
  const btnResetCamArena = document.getElementById('btn-reset-cam-arena');

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

  // Initialize
  async function init() {
    // 1. Initialize 3D Behavioral Terrarium
    arena3D = new window.Arena3DView('arena-3d-container');

    // 2. Initialize 3D Connectome Brain Viewer (DeepMind reconstruction)
    brain3D = new window.Brain3DView('brain-3d-container');

    // 3. Initialize 2D fallback circuit diagram & compass
    brain2DVisualizer = new window.BrainVisualizer('circuit-canvas', 'compass-canvas');

    // 4. Fetch metadata
    try {
      const connRes = await fetch('/api/connectome');
      const connData = await connRes.json();
      brain2DVisualizer.setConnectomeData(connData);
      initPopulationBars(connData.subcircuit.populations);

      const archRes = await fetch('/api/archetypes');
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
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connectome 3D WebSocket connected.');
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

    // 3D Tools
    toolSelect.addEventListener('click', () => setTool('select'));
    toolBanana.addEventListener('click', () => setTool('banana'));
    toolSugar.addEventListener('click', () => setTool('sugar'));

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

    window.addEventListener('floor-click-3d', (e) => {
      if (activeTool === 'banana') {
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
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
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
    toolSelect.classList.toggle('active', toolName === 'select');
    toolBanana.classList.toggle('active', toolName === 'banana');
    toolSugar.classList.toggle('active', toolName === 'sugar');
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
      pauseIcon.textContent = '▶';
      pauseText.textContent = 'Resume';
    } else {
      pauseIcon.textContent = '⏸';
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

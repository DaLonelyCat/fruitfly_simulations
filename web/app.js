/**
 * Master Application Controller & Arena Renderer
 * Connects WebSocket, renders Drosophila multi-agent kinematics, and synchronizes telemetry.
 */

(function () {
  'use strict';

  // DOM Elements
  const arenaCanvas = document.getElementById('arena-canvas');
  const arenaCtx = arenaCanvas.getContext('2d');
  const btnPause = document.getElementById('btn-pause');
  const pauseIcon = document.getElementById('pause-icon');
  const pauseText = document.getElementById('pause-text');
  const speedSlider = document.getElementById('speed-slider');
  const speedVal = document.getElementById('speed-val');
  const btnStartle = document.getElementById('btn-startle');
  const btnAddFly = document.getElementById('btn-add-fly');

  const toolSelect = document.getElementById('tool-select');
  const toolFood = document.getElementById('tool-food');
  const toolPheromone = document.getElementById('tool-pheromone');

  const statFlyCount = document.getElementById('stat-fly-count');
  const statCourtshipCount = document.getElementById('stat-courtship-count');
  const statFightCount = document.getElementById('stat-fight-count');
  const statStepCount = document.getElementById('stat-step-count');
  const eventsTicker = document.getElementById('events-ticker');

  const flySelectDropdown = document.getElementById('fly-select-dropdown');
  const selectedFlyHeading = document.getElementById('selected-fly-heading');
  const selectedFlyGender = document.getElementById('selected-fly-gender');
  const flyThoughtText = document.getElementById('fly-thought-text');
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
  let activeTool = 'select'; // 'select', 'food', 'pheromone'
  let brainVisualizer = null;
  let availableArchetypes = {};
  let selectedSpawnArchetype = 'Romeo';

  // Arena Dimensions in Simulation coordinates (300 x 300 mm)
  const SIM_WIDTH = 300.0;
  const SIM_HEIGHT = 300.0;

  // Initialize
  async function init() {
    brainVisualizer = new window.BrainVisualizer('circuit-canvas', 'compass-canvas');

    // Fetch Connectome Metadata and Archetypes
    try {
      const connRes = await fetch('/api/connectome');
      const connData = await connRes.json();
      brainVisualizer.setConnectomeData(connData);
      initPopulationBars(connData.subcircuit.populations);

      const archRes = await fetch('/api/archetypes');
      availableArchetypes = await archRes.json();
      renderArchetypeGrid();
    } catch (err) {
      console.warn('REST fallback initialization notice:', err);
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
      console.log('Connectome WebSocket connected.');
    };

    ws.onmessage = (event) => {
      currentState = JSON.parse(event.data);
      updateUI();
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected. Retrying in 1.5s...');
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

    // Tools
    toolSelect.addEventListener('click', () => setTool('select'));
    toolFood.addEventListener('click', () => setTool('food'));
    toolPheromone.addEventListener('click', () => setTool('pheromone'));

    // Canvas Clicks
    arenaCanvas.addEventListener('click', (e) => {
      const rect = arenaCanvas.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * SIM_WIDTH;
      const clickY = ((e.clientY - rect.top) / rect.height) * SIM_HEIGHT;

      if (activeTool === 'select') {
        // Find nearest fly
        if (currentState && currentState.flies) {
          let nearest = null;
          let minDist = 25.0; // max click radius in mm
          for (const fly of currentState.flies) {
            const d = Math.hypot(fly.x - clickX, fly.y - clickY);
            if (d < minDist) {
              minDist = d;
              nearest = fly;
            }
          }
          if (nearest) {
            selectedFlyId = nearest.id;
            sendCommand({ action: 'select_fly', fly_id: nearest.id });
          }
        }
      } else if (activeTool === 'food') {
        sendCommand({ action: 'add_food', x: clickX, y: clickY });
      } else if (activeTool === 'pheromone') {
        sendCommand({ action: 'add_pheromone', x: clickX, y: clickY, amount: 0.8 });
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

    // Neurochemical Sliders
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

    // Genetic Mutant Presets
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mutant = btn.dataset.mutant;
        sendCommand({
          action: 'gene_knockout',
          fly_id: selectedFlyId,
          gene: mutant
        });
      });
    });
  }

  function setTool(toolName) {
    activeTool = toolName;
    toolSelect.classList.toggle('active', toolName === 'select');
    toolFood.classList.toggle('active', toolName === 'food');
    toolPheromone.classList.toggle('active', toolName === 'pheromone');
  }

  // Update DOM from Simulation State
  function updateUI() {
    if (!currentState) return;

    // Header stats
    statFlyCount.textContent = currentState.flies.length;
    statStepCount.textContent = currentState.step;
    if (currentState.environment) {
      statCourtshipCount.textContent = currentState.environment.total_courtships || 0;
      statFightCount.textContent = currentState.environment.total_fights || 0;
      updateEventsTicker(currentState.environment.recent_events || []);
      updateSocialMatrix(currentState.environment.interaction_pairs || {});
    }

    // Pause state
    if (currentState.paused) {
      pauseIcon.textContent = '▶';
      pauseText.textContent = 'Resume';
    } else {
      pauseIcon.textContent = '⏸';
      pauseText.textContent = 'Pause';
    }

    // Populate / Sync Fly Dropdown
    syncFlyDropdown(currentState.flies);

    // Selected Fly Telemetry
    const selFly = currentState.flies.find((f) => f.id === selectedFlyId) || currentState.flies[0];
    if (selFly) {
      selectedFlyId = selFly.id;
      selectedFlyHeading.textContent = `Connectome Brain Inspector: Fly #${selFly.id} (${selFly.archetype})`;
      selectedFlyHeading.style.color = selFly.color;
      selectedFlyGender.textContent = `Sex: ${selFly.gender.toUpperCase()} | Speed: ${selFly.speed.toFixed(1)} mm/s | Action: ${selFly.action.toUpperCase()}`;

      const telem = selFly.telemetry;
      if (telem) {
        flyThoughtText.textContent = `"${telem.last_thought}"`;
        compassHeadingVal.textContent = `${telem.internal_heading_deg} deg`;

        // Update Brain Visualizer
        brainVisualizer.updateTelemetry(telem);

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

        // Sync Sliders if not currently dragging
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

        // Leaderboard & stats
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
        <span>${f.fights_won || 0} wins</span>
      `;
      lbContainer.appendChild(row);
    });

    const statsList = document.getElementById('selected-fly-stats');
    statsList.innerHTML = `
      <div class="leader-item"><span>Archetype:</span><span>${selFly.archetype} (${selFly.gender})</span></div>
      <div class="leader-item"><span>Current Satiety:</span><span>${Math.round(selFly.satiety * 100)}%</span></div>
      <div class="leader-item"><span>Courtship Bouts:</span><span>${selFly.courtship_bouts || 0}</span></div>
      <div class="leader-item"><span>Fights Won:</span><span>${selFly.fights_won || 0}</span></div>
    `;
  }

  function updateSocialMatrix(pairs) {
    const container = document.getElementById('interaction-matrix-view');
    container.innerHTML = '';
    const entries = Object.entries(pairs);
    if (entries.length === 0) {
      container.innerHTML = '<span style="color:#627896;font-size:11px;">No social contacts recorded yet.</span>';
      return;
    }
    entries.forEach(([pair, count]) => {
      const badge = document.createElement('div');
      badge.className = 'pair-badge';
      badge.textContent = `Fly ${pair.replace('-', ' ⟷ ')}: ${count} interactions`;
      container.appendChild(badge);
    });
  }

  // ==========================================================================
  // Render Loop: High-Performance Arena Drawing
  // ==========================================================================

  function renderLoop() {
    renderArena();
    brainVisualizer.render();
    requestAnimationFrame(renderLoop);
  }

  function renderArena() {
    const ctx = arenaCtx;
    const w = arenaCanvas.width;
    const h = arenaCanvas.height;

    // Scale from Simulation Coordinates (0-300) to Canvas Pixels (0-600)
    const sx = w / SIM_WIDTH;
    const sy = h / SIM_HEIGHT;

    // Clear background
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, w, h);

    // Subtle arena grid
    ctx.strokeStyle = '#0e1624';
    ctx.lineWidth = 1;
    const gridStep = 30 * sx;
    for (let x = gridStep; x < w; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = gridStep; y < h; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (!currentState) return;

    // 1. Draw Food Patches with Odor Plumes
    if (currentState.environment && currentState.environment.food_patches) {
      currentState.environment.food_patches.forEach((fp) => {
        if (fp.amount <= 0) return;
        const fx = fp.x * sx;
        const fy = fp.y * sy;
        const fr = fp.radius * sx;

        // Odor diffusion halo
        const haloGrad = ctx.createRadialGradient(fx, fy, fr * 0.5, fx, fy, fr * 3.2);
        haloGrad.addColorStop(0, 'rgba(255, 204, 0, 0.18)');
        haloGrad.addColorStop(1, 'rgba(255, 204, 0, 0.0)');
        ctx.beginPath();
        ctx.arc(fx, fy, fr * 3.2, 0, 2 * Math.PI);
        ctx.fillStyle = haloGrad;
        ctx.fill();

        // Food core (fermenting yeast drop)
        ctx.beginPath();
        ctx.arc(fx, fy, fr, 0, 2 * Math.PI);
        ctx.fillStyle = '#d49b00';
        ctx.fill();
        ctx.strokeStyle = '#ffdd44';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Food label
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#ffe066';
        ctx.textAlign = 'center';
        ctx.fillText(`Food (${Math.round(fp.amount)}%)`, fx, fy - fr - 4);
      });
    }

    // 2. Draw Acoustic Courtship Song Waves
    if (currentState.environment && currentState.environment.acoustic_waves) {
      currentState.environment.acoustic_waves.forEach((wave) => {
        const wx = wave.x * sx;
        const wy = wave.y * sy;
        const wr = wave.radius * sx;
        const alpha = Math.min(1.0, wave.intensity);

        ctx.beginPath();
        ctx.arc(wx, wy, wr, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(255, 51, 102, ${alpha * 0.6})`;
        ctx.lineWidth = 2.0;
        ctx.stroke();
      });
    }

    // 3. Draw Fruit Flies
    if (currentState.flies) {
      currentState.flies.forEach((fly) => {
        drawFruitFly(ctx, fly, sx, sy, fly.id === selectedFlyId);
      });
    }
  }

  function drawFruitFly(ctx, fly, sx, sy, isSelected) {
    const cx = fly.x * sx;
    const cy = fly.y * sy;
    const heading = fly.heading;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(heading);

    // Selection Halo
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, 2 * Math.PI);
      ctx.strokeStyle = '#00d2ff';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Aggression Aura (during lunge)
    if (fly.action === 'lunging') {
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 85, 0, 0.25)';
      ctx.fill();
    }

    // Leg Gait (6 articulated legs with alternating tripod phase)
    ctx.strokeStyle = '#3a4a5e';
    ctx.lineWidth = 1.2;
    const phase = fly.tripod_phase || 0;

    // 3 Leg Pairs: Front, Mid, Hind
    const legOffsets = [-4, 0, 4];
    legOffsets.forEach((lx, idx) => {
      const legPhase = phase + (idx % 2 === 0 ? 0 : Math.PI);
      const legSpread = Math.sin(legPhase) * 3.5;

      // Left leg
      ctx.beginPath();
      ctx.moveTo(lx, -3);
      ctx.lineTo(lx - 4, -8 - legSpread);
      ctx.lineTo(lx - 2, -13 - legSpread);
      ctx.stroke();

      // Right leg
      ctx.beginPath();
      ctx.moveTo(lx, 3);
      ctx.lineTo(lx - 4, 8 + legSpread);
      ctx.lineTo(lx - 2, 13 + legSpread);
      ctx.stroke();
    });

    // Wings (Translucent with biological veins)
    // Wing extension angles in radians
    const leftWingRad = (fly.wing_left_angle * Math.PI) / 180;
    const rightWingRad = (fly.wing_right_angle * Math.PI) / 180;

    // Left Wing
    ctx.save();
    ctx.translate(-2, -2);
    ctx.rotate(-leftWingRad);
    ctx.beginPath();
    ctx.ellipse(-10, -2, 12, 4, -0.15, 0, 2 * Math.PI);
    ctx.fillStyle = fly.is_singing && fly.singing_wing === 'left' ? 'rgba(255, 100, 150, 0.65)' : 'rgba(200, 225, 255, 0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();

    // Right Wing
    ctx.save();
    ctx.translate(-2, 2);
    ctx.rotate(rightWingRad);
    ctx.beginPath();
    ctx.ellipse(-10, 2, 12, 4, 0.15, 0, 2 * Math.PI);
    ctx.fillStyle = fly.is_singing && fly.singing_wing === 'right' ? 'rgba(255, 100, 150, 0.65)' : 'rgba(200, 225, 255, 0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();

    // Body: Abdomen (Segmented, elongated)
    ctx.beginPath();
    ctx.ellipse(-7, 0, 8, 4, 0, 0, 2 * Math.PI);
    ctx.fillStyle = fly.gender === 'male' ? '#2b2118' : '#3d3020'; // Males have dark pigmentation at abdominal tip
    ctx.fill();
    ctx.strokeStyle = '#1a140e';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Abdominal stripes
    ctx.strokeStyle = 'rgba(255, 200, 100, 0.3)';
    for (let s = -12; s <= -4; s += 2.5) {
      ctx.beginPath();
      ctx.moveTo(s, -3);
      ctx.lineTo(s, 3);
      ctx.stroke();
    }

    // Thorax (Color coded by archetype)
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 3.5, 0, 0, 2 * Math.PI);
    ctx.fillStyle = fly.color || '#445566';
    ctx.fill();
    ctx.strokeStyle = '#223344';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.ellipse(6, 0, 3.5, 3, 0, 0, 2 * Math.PI);
    ctx.fillStyle = '#4a3b2c';
    ctx.fill();

    // Compound Red Eyes (Left & Right)
    ctx.beginPath();
    ctx.arc(6, -2.5, 1.6, 0, 2 * Math.PI);
    ctx.arc(6, 2.5, 1.6, 0, 2 * Math.PI);
    ctx.fillStyle = '#cc1122'; // Drosophila brick red eyes
    ctx.fill();

    // Antennae (Twitching sensory receptors)
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(8.5, -1);
    ctx.lineTo(12, -2.5);
    ctx.moveTo(8.5, 1);
    ctx.lineTo(12, 2.5);
    ctx.stroke();

    // Proboscis (Extended when feeding)
    if (fly.proboscis > 0.1) {
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(8 + fly.proboscis * 5, 0);
      ctx.strokeStyle = '#ffaa44';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();

    // Label above fly
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = isSelected ? '#00d2ff' : '#9cb2cd';
    ctx.textAlign = 'center';
    ctx.fillText(`${fly.archetype} (#${fly.id})`, cx, cy - 18);
  }

  // Start Application
  window.addEventListener('DOMContentLoaded', init);
})();

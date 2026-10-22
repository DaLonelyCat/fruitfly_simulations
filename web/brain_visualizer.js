/**
 * Biological Connectome Brain Visualizer
 * Renders the 21-population circuit graph and the CX_EPG ring attractor compass.
 */

class BrainVisualizer {
  constructor(circuitCanvasId, compassCanvasId) {
    this.circuitCanvas = document.getElementById(circuitCanvasId);
    this.circuitCtx = this.circuitCanvas.getContext('2d');
    
    this.compassCanvas = document.getElementById(compassCanvasId);
    this.compassCtx = this.compassCanvas.getContext('2d');

    this.connectomeData = null;
    this.firingRates = {};
    this.compassRing = [0, 0, 0, 0, 0, 0, 0, 0];
    this.internalHeadingDeg = 0;
    
    // Node layout positions
    this.nodes = {};
    this.hoveredNode = null;

    this.initNodeLayout();
    this.initEvents();
  }

  setConnectomeData(data) {
    this.connectomeData = data;
  }

  initNodeLayout() {
    const w = this.circuitCanvas.width;
    const h = this.circuitCanvas.height;

    // Define 3 biological layers:
    // Left: Sensory (x: 0.18 * w)
    // Center: Central Brain & Neuromodulation (x: 0.50 * w)
    // Right: Descending Motor Commands (x: 0.82 * w)
    const sensory = ['VIS_LC10', 'VIS_LC4', 'VIS_LC11', 'OLF_DA1', 'OLF_FOOD', 'CHE_PHERO'];
    const central = ['CX_EPG', 'CX_PEN', 'CX_FB', 'MB_KC', 'MB_MBON', 'MB_DAN', 'SOC_MAL', 'SOC_P1', 'SOC_AGG'];
    const motor = ['DN_WALK', 'DN_TURN', 'DN_SONG', 'DN_LUNGE', 'DN_FEED', 'DN_ESCAPE'];

    sensory.forEach((name, i) => {
      const y = 30 + (i / (sensory.length - 1)) * (h - 60);
      this.nodes[name] = { x: w * 0.16, y, layer: 'sensory', name, label: name.replace(/^[A-Z]+_/, '') };
    });

    central.forEach((name, i) => {
      const y = 25 + (i / (central.length - 1)) * (h - 50);
      this.nodes[name] = { x: w * 0.50, y, layer: 'central', name, label: name.replace(/^[A-Z]+_/, '') };
    });

    motor.forEach((name, i) => {
      const y = 30 + (i / (motor.length - 1)) * (h - 60);
      this.nodes[name] = { x: w * 0.84, y, layer: 'motor', name, label: name.replace(/^DN_/, '') };
    });
  }

  initEvents() {
    this.circuitCanvas.addEventListener('mousemove', (e) => {
      const rect = this.circuitCanvas.getBoundingClientRect();
      const scaleX = this.circuitCanvas.width / rect.width;
      const scaleY = this.circuitCanvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      let found = null;
      for (const [name, node] of Object.entries(this.nodes)) {
        const d = Math.hypot(mx - node.x, my - node.y);
        if (d < 16) {
          found = name;
          break;
        }
      }
      this.hoveredNode = found;
    });

    this.circuitCanvas.addEventListener('mouseleave', () => {
      this.hoveredNode = null;
    });
  }

  updateTelemetry(telemetry) {
    if (!telemetry) return;
    this.firingRates = telemetry.firing_rates || {};
    this.compassRing = telemetry.compass_ring || [0, 0, 0, 0, 0, 0, 0, 0];
    this.internalHeadingDeg = telemetry.internal_heading_deg || 0;
  }

  render() {
    this.renderCircuit();
    this.renderCompass();
  }

  renderCircuit() {
    const ctx = this.circuitCtx;
    const w = this.circuitCanvas.width;
    const h = this.circuitCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Layer Labels
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#627896';
    ctx.textAlign = 'center';
    ctx.fillText('SENSORY RECEPTORS', w * 0.16, 16);
    ctx.fillText('CENTRAL BRAIN & HUBS', w * 0.50, 16);
    ctx.fillText('DESCENDING MOTOR', w * 0.84, 16);

    // Draw Synaptic Connections
    if (this.connectomeData && this.connectomeData.subcircuit) {
      const conns = this.connectomeData.subcircuit.top_connections;
      for (const edge of conns) {
        const srcNode = this.nodes[edge.source];
        const dstNode = this.nodes[edge.target];
        if (!srcNode || !dstNode) continue;
        if (edge.source === edge.target) continue; // Skip self loops for clarity

        const srcRate = this.firingRates[edge.source] || 0;
        const isHovered = this.hoveredNode && (this.hoveredNode === edge.source || this.hoveredNode === edge.target);

        // Alpha and thickness proportional to synapses & firing rate
        let baseAlpha = 0.08;
        if (srcRate > 0.3) baseAlpha += srcRate * 0.35;
        if (isHovered) baseAlpha = 0.85;

        let strokeColor = `rgba(100, 150, 220, ${baseAlpha})`;
        if (edge.source.includes('SOC_P1')) {
          strokeColor = `rgba(255, 51, 102, ${baseAlpha})`; // Rose for courtship
        } else if (edge.source.includes('SOC_MAL') || edge.source.includes('SOC_AGG')) {
          strokeColor = `rgba(255, 170, 0, ${baseAlpha})`; // Amber for aggression/inhibition
        }

        ctx.beginPath();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = isHovered ? 2.5 : Math.min(3.0, Math.max(0.75, Math.log10(edge.synapses + 1) * 0.6));
        
        // Curved cubic Bezier connection
        const dx = (dstNode.x - srcNode.x) * 0.5;
        ctx.moveTo(srcNode.x, srcNode.y);
        ctx.bezierCurveTo(srcNode.x + dx, srcNode.y, dstNode.x - dx, dstNode.y, dstNode.x, dstNode.y);
        ctx.stroke();
      }
    }

    // Draw Population Nodes
    for (const [name, node] of Object.entries(this.nodes)) {
      const rate = this.firingRates[name] || 0.0;
      const isHovered = this.hoveredNode === name;

      // Glow effect when active
      const radius = isHovered ? 12 : 9 + rate * 4;
      
      let color = '#4a658a';
      if (node.layer === 'sensory') color = '#00d2ff';
      if (node.layer === 'central') {
        if (name.includes('P1')) color = '#ff3366';
        else if (name.includes('AGG') || name.includes('MAL')) color = '#ffaa00';
        else if (name.includes('MB')) color = '#a78bfa';
        else color = '#38bdf8';
      }
      if (node.layer === 'motor') {
        if (name.includes('SONG')) color = '#ff3366';
        else if (name.includes('LUNGE')) color = '#ff5500';
        else if (name.includes('ESCAPE')) color = '#ef4444';
        else color = '#00e676';
      }

      // Outer glow
      if (rate > 0.35) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI);
        ctx.fillStyle = color.replace(')', ', 0.25)').replace('rgb', 'rgba');
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = rate > 0.2 ? color : '#1c2838';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = isHovered ? '#ffffff' : '#9cb2cd';
      ctx.textAlign = node.layer === 'sensory' ? 'right' : (node.layer === 'motor' ? 'left' : 'center');
      const labelX = node.layer === 'sensory' ? node.x - 14 : (node.layer === 'motor' ? node.x + 14 : node.x);
      const labelY = node.layer === 'central' ? node.y - 12 : node.y + 3;
      ctx.fillText(node.label, labelX, labelY);
    }
  }

  renderCompass() {
    const ctx = this.compassCtx;
    const w = this.compassCanvas.width;
    const h = this.compassCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const outerR = cx - 18;
    const innerR = 30;

    ctx.clearRect(0, 0, w, h);

    // Compass Outer Ring
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, 2 * Math.PI);
    ctx.strokeStyle = '#202d42';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner Hole
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
    ctx.fillStyle = '#090d14';
    ctx.fill();
    ctx.strokeStyle = '#202d42';
    ctx.stroke();

    // 8 Wedges
    const numWedges = 8;
    const wedgeAngle = (2 * Math.PI) / numWedges;

    for (let i = 0; i < numWedges; i++) {
      const aStart = i * wedgeAngle - wedgeAngle / 2;
      const aEnd = aStart + wedgeAngle;
      const activity = this.compassRing[i] || 0.0;

      // Arc Sector
      ctx.beginPath();
      ctx.moveTo(cx + innerR * Math.cos(aStart), cy + innerR * Math.sin(aStart));
      ctx.arc(cx, cy, outerR, aStart, aEnd);
      ctx.lineTo(cx + innerR * Math.cos(aEnd), cy + innerR * Math.sin(aEnd));
      ctx.arc(cx, cy, innerR, aEnd, aStart, true);
      ctx.closePath();

      // Fill with luminescence proportional to activity
      const alpha = 0.12 + activity * 0.75;
      ctx.fillStyle = `rgba(0, 210, 255, ${alpha})`;
      ctx.fill();
      ctx.strokeStyle = '#162438';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Wedge Number
      const midAngle = i * wedgeAngle;
      const textR = (innerR + outerR) / 2;
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = activity > 0.4 ? '#ffffff' : '#4a658a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`W${i+1}`, cx + textR * Math.cos(midAngle), cy + textR * Math.sin(midAngle));
    }

    // Compass Heading Needle (Internal Head Direction)
    const headRad = (this.internalHeadingDeg * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (outerR - 6) * Math.cos(headRad), cy + (outerR - 6) * Math.sin(headRad));
    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Center pivot dot
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#ff3366';
    ctx.fill();
  }
}

window.BrainVisualizer = BrainVisualizer;

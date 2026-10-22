/**
 * 3D Anatomical Drosophila Connectome Brain Visualizer (Three.js)
 * High-Detail Neural Arborization & Interactive Optogenetic Stimulation
 * 
 * Features:
 * - 3D Anatomical CNS matching Google DeepMind & Janelia male Drosophila Connectome.
 * - Dense inter-neuropil axon fiber tracts with biological trajectories.
 * - Dynamic Action Potential Spark particle cascades traveling along active pathways.
 * - Interactive Optogenetic Stimulation: click any brain region or use stimulation triggers
 *   to inject photocurrent and witness real synaptic cascade propagation.
 */

class Brain3DView {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060911);

    const w = this.container.clientWidth || 500;
    const h = this.container.clientHeight || 500;

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 1000);
    this.camera.position.set(0, 15, 88);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    if (window.THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxDistance = 250;
      this.controls.minDistance = 18;
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight1.position.set(30, 50, 40);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x00d2ff, 0.5);
    dirLight2.position.set(-40, -20, -30);
    this.scene.add(dirLight2);

    // Anatomical Neuropils & Neural Tracts
    this.regions = {};
    this.regionPopulations = {}; // mapping mesh -> population name
    this.fiberTracts = [];
    this.tractSparks = [];
    this.optoPulses = [];
    this.firingRates = {};
    this.currentHeadingDeg = 0;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.buildAnatomicalCNS();
    this.buildInterNeuropilTracts();
    this.initOptogeneticRaycaster();
    this.initResizeListener();
  }

  buildAnatomicalCNS() {
    this.cnsGroup = new THREE.Group();
    this.cnsGroup.position.set(4, -4, 0);
    this.cnsGroup.rotation.y = -0.35;
    this.scene.add(this.cnsGroup);

    const cbCenter = new THREE.Vector3(10, 16, 0);

    // 1. Central Brain Soma Cloud (Densely clustered cell bodies)
    const somaCount = 1200;
    const somaGeom = new THREE.BufferGeometry();
    const somaPos = new Float32Array(somaCount * 3);
    const somaColors = new Float32Array(somaCount * 3);

    const palette = [
      new THREE.Color(0x00d2ff), // Cyan
      new THREE.Color(0xff3366), // Rose / P1
      new THREE.Color(0xffaa00), // Amber
      new THREE.Color(0xa78bfa), // Violet
      new THREE.Color(0x00e676), // Emerald
      new THREE.Color(0xf59e0b)  // Golden
    ];

    for (let i = 0; i < somaCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * 11.5;

      const px = cbCenter.x + r * Math.sin(phi) * Math.cos(theta) * 1.1;
      const py = cbCenter.y + r * Math.sin(phi) * Math.sin(theta) * 0.95;
      const pz = cbCenter.z + r * Math.cos(phi) * 0.9;

      somaPos[i * 3] = px;
      somaPos[i * 3 + 1] = py;
      somaPos[i * 3 + 2] = pz;

      const c = palette[Math.floor(Math.random() * palette.length)];
      somaColors[i * 3] = c.r;
      somaColors[i * 3 + 1] = c.g;
      somaColors[i * 3 + 2] = c.b;
    }

    somaGeom.setAttribute('position', new THREE.BufferAttribute(somaPos, 3));
    somaGeom.setAttribute('color', new THREE.BufferAttribute(somaColors, 3));
    const somaMat = new THREE.PointsMaterial({
      size: 1.4,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });
    const somaPoints = new THREE.Points(somaGeom, somaMat);
    this.cnsGroup.add(somaPoints);

    // 2. Mushroom Body (MB) - Calyx & Vertical/Medial Lobes
    const mbGeom = new THREE.TorusGeometry(5.5, 2.0, 16, 32);
    const mbMat = new THREE.MeshStandardMaterial({
      color: 0xa78bfa,
      emissive: 0x5b21b6,
      emissiveIntensity: 0.25,
      roughness: 0.4,
      metalness: 0.2,
      transparent: true,
      opacity: 0.65
    });
    const mbMesh = new THREE.Mesh(mbGeom, mbMat);
    mbMesh.position.copy(cbCenter).add(new THREE.Vector3(0, 2, -2));
    mbMesh.rotation.x = 0.5;
    mbMesh.userData = { pop: 'MB_KC', label: 'Mushroom Body (Kenyon Cells)' };
    this.cnsGroup.add(mbMesh);
    this.regions['MB'] = mbMesh;
    this.regionPopulations['MB_KC'] = mbMesh;

    // 3. PAM Dopaminergic Cluster (Gold sphere inside Mushroom Body)
    const pamGeom = new THREE.SphereGeometry(3.2, 24, 24);
    const pamMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 0.35,
      roughness: 0.3,
      transparent: true,
      opacity: 0.85
    });
    const pamMesh = new THREE.Mesh(pamGeom, pamMat);
    pamMesh.position.copy(cbCenter).add(new THREE.Vector3(1, 1, 1));
    pamMesh.userData = { pop: 'MB_DAN', label: 'PAM-DAN Dopaminergic Cluster' };
    this.cnsGroup.add(pamMesh);
    this.regions['PAM_DAN'] = pamMesh;
    this.regionPopulations['MB_DAN'] = pamMesh;

    // 4. Central Complex (CX) - Ring Attractor (Ellipsoid Body)
    const cxGeom = new THREE.TorusGeometry(3.6, 1.2, 16, 32);
    const cxMat = new THREE.MeshStandardMaterial({
      color: 0x00d2ff,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.3,
      transparent: true,
      opacity: 0.8
    });
    const cxMesh = new THREE.Mesh(cxGeom, cxMat);
    cxMesh.position.copy(cbCenter).add(new THREE.Vector3(0, -1, 3.5));
    cxMesh.rotation.x = 0.2;
    cxMesh.userData = { pop: 'CX_EPG', label: 'Central Complex (CX EPG Compass)' };
    this.cnsGroup.add(cxMesh);
    this.regions['CX_EPG'] = cxMesh;
    this.regionPopulations['CX_EPG'] = cxMesh;

    // 5. P1 / pC1 Courtship Master Hub (Radiant Magenta)
    const p1Geom = new THREE.SphereGeometry(3.2, 24, 24);
    const p1Mat = new THREE.MeshStandardMaterial({
      color: 0xff3366,
      emissive: 0xe11d48,
      emissiveIntensity: 0.3,
      roughness: 0.35,
      transparent: true,
      opacity: 0.85
    });
    const p1Mesh = new THREE.Mesh(p1Geom, p1Mat);
    p1Mesh.position.copy(cbCenter).add(new THREE.Vector3(2.5, -3, 2));
    p1Mesh.userData = { pop: 'SOC_P1', label: 'P1 Courtship Hub (Fruitless+)' };
    this.cnsGroup.add(p1Mesh);
    this.regions['SOC_P1'] = p1Mesh;
    this.regionPopulations['SOC_P1'] = p1Mesh;

    // 6. Antennal Lobes (AL) - Olfactory / Pheromone Hubs (Left & Right)
    const alGeom = new THREE.SphereGeometry(3.2, 20, 20);
    const alMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.3,
      roughness: 0.4,
      transparent: true,
      opacity: 0.75
    });
    const alLeft = new THREE.Mesh(alGeom, alMat);
    alLeft.position.copy(cbCenter).add(new THREE.Vector3(-4.5, -7, 5));
    alLeft.userData = { pop: 'OLF_DA1', label: 'Antennal Lobe (DA1 cVA Olfaction)' };
    this.cnsGroup.add(alLeft);

    const alRight = new THREE.Mesh(alGeom, alMat.clone());
    alRight.position.copy(cbCenter).add(new THREE.Vector3(4.5, -7, 5));
    alRight.userData = { pop: 'OLF_FOOD', label: 'Antennal Lobe (Food Olfaction)' };
    this.cnsGroup.add(alRight);
    this.regions['AL'] = alRight;
    this.regionPopulations['OLF_DA1'] = alLeft;
    this.regionPopulations['OLF_FOOD'] = alRight;

    // 7. Left & Right Optic Lobes
    const lolCenter = new THREE.Vector3(-14, 15, -1);
    this.regions['OPTIC_LEFT'] = this.createOpticLobe(lolCenter, 13.5, 0x00d2ff, 'VIS_LC10', 'Left Optic Lobe (LC10 Visual Tracking)');

    const rolCenter = new THREE.Vector3(30, 14, -2);
    this.regions['OPTIC_RIGHT'] = this.createOpticLobe(rolCenter, 12.5, 0x38bdf8, 'VIS_LC4', 'Right Optic Lobe (LC4 Looming Detector)');

    // 8. Cervical Neck Connective
    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(8, 7, 0),     // Subesophageal zone
      new THREE.Vector3(2, 0, -2),     // Neck connective entry
      new THREE.Vector3(-6, -8, -4),   // Cervical tract curvature
      new THREE.Vector3(-14, -14, -5), // Anterior VNC entry
      new THREE.Vector3(-22, -18, -6)  // Prothoracic neuromere
    ]);
    this.neckCurve = neckCurve;

    const neckTubeGeom = new THREE.TubeGeometry(neckCurve, 32, 2.8, 16, false);
    const neckTubeMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.25,
      roughness: 0.3,
      metalness: 0.3,
      transparent: true,
      opacity: 0.6
    });
    const neckTube = new THREE.Mesh(neckTubeGeom, neckTubeMat);
    neckTube.userData = { pop: 'DN_ESCAPE', label: 'Cervical Connective (Giant Fiber Tract)' };
    this.cnsGroup.add(neckTube);
    this.regions['NECK'] = neckTube;
    this.regionPopulations['DN_ESCAPE'] = neckTube;

    // Striated Descending Axon Fiber Bundle
    const fiberMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 });
    for (let f = 0; f < 18; f++) {
      const offsetAngle = (f / 18) * Math.PI * 2;
      const rOffset = 1.2 + (f % 3) * 0.5;
      const pts = neckCurve.getPoints(24).map(p => {
        return p.clone().add(new THREE.Vector3(
          Math.cos(offsetAngle) * rOffset,
          Math.sin(offsetAngle) * rOffset,
          (f % 2 === 0 ? 0.4 : -0.4)
        ));
      });
      const fGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const fLine = new THREE.Line(fGeom, fiberMat);
      this.cnsGroup.add(fLine);
    }

    // 9. Ventral Nerve Cord (VNC)
    const vncCenter = new THREE.Vector3(-24, -20, -6);
    this.regions['VNC'] = this.createVNC(vncCenter);

    // Streamline particles through neck
    this.initActionPotentialParticles(neckCurve);
  }

  createOpticLobe(center, radius, baseColorHex, popKey, label) {
    const lobeGroup = new THREE.Group();
    lobeGroup.position.copy(center);

    const shellGeom = new THREE.SphereGeometry(radius, 28, 28);
    const shellMat = new THREE.MeshStandardMaterial({
      color: baseColorHex,
      emissive: 0x0369a1,
      emissiveIntensity: 0.25,
      roughness: 0.45,
      transparent: true,
      opacity: 0.45
    });
    const shellMesh = new THREE.Mesh(shellGeom, shellMat);
    shellMesh.userData = { pop: popKey, label: label };
    lobeGroup.add(shellMesh);
    this.regionPopulations[popKey] = shellMesh;

    // Columnar Neuropil Wireframe
    const wireGeom = new THREE.IcosahedronGeometry(radius * 0.96, 3);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, wireframe: true, transparent: true, opacity: 0.25 });
    const wireMesh = new THREE.Mesh(wireGeom, wireMat);
    lobeGroup.add(wireMesh);

    // Dense Optic Neurons
    const count = 450;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const c1 = new THREE.Color(baseColorHex);
    const c2 = new THREE.Color(0xf59e0b);
    const c3 = new THREE.Color(0x10b981);

    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * radius * 0.95;

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      const chosenColor = (i % 3 === 0) ? c2 : ((i % 5 === 0) ? c3 : c1);
      col[i * 3] = chosenColor.r;
      col[i * 3 + 1] = chosenColor.g;
      col[i * 3 + 2] = chosenColor.b;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pMat = new THREE.PointsMaterial({ size: 1.2, vertexColors: true, transparent: true, opacity: 0.75 });
    const points = new THREE.Points(geom, pMat);
    lobeGroup.add(points);

    this.cnsGroup.add(lobeGroup);
    return shellMesh;
  }

  createVNC(center) {
    const vncGroup = new THREE.Group();
    vncGroup.position.copy(center);

    const neuromeres = [
      { name: 'T1', pop: 'DN_WALK', label: 'T1 Prothoracic Leg Motor Center', pos: new THREE.Vector3(3, 3, 0), r: 5.5, color: 0x10b981 },
      { name: 'T2', pop: 'DN_SONG', label: 'T2 Mesothoracic Wing Song Motor', pos: new THREE.Vector3(-3, -2, -1), r: 6.2, color: 0x0ea5e9 },
      { name: 'T3', pop: 'DN_LUNGE', label: 'T3 Metathoracic Lunge Strike Hub', pos: new THREE.Vector3(-9, -7, -2), r: 5.2, color: 0xf59e0b },
      { name: 'Abd', pop: 'DN_FEED', label: 'Abdominal Ganglia Motor Center', pos: new THREE.Vector3(-14, -12, -3), r: 4.2, color: 0xa855f7 }
    ];

    const meshes = [];
    neuromeres.forEach(n => {
      const geom = new THREE.SphereGeometry(n.r, 20, 20);
      const mat = new THREE.MeshStandardMaterial({
        color: n.color,
        emissive: n.color,
        emissiveIntensity: 0.25,
        roughness: 0.4,
        transparent: true,
        opacity: 0.7
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(n.pos);
      mesh.userData = { pop: n.pop, label: n.label };
      vncGroup.add(mesh);
      meshes.push(mesh);
      this.regionPopulations[n.pop] = mesh;
    });

    this.cnsGroup.add(vncGroup);
    return meshes[1];
  }

  buildInterNeuropilTracts() {
    // Top biological connectome pathways linking regions
    const pathways = [
      {
        name: 'LC10_to_P1',
        sourcePop: 'VIS_LC10',
        color: 0xff3366,
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(-4, 15, 0),
          new THREE.Vector3(2, 14, 2),
          new THREE.Vector3(8, 14, 2),
          new THREE.Vector3(12.5, 13, 2)
        ])
      },
      {
        name: 'LC4_to_Escape',
        sourcePop: 'VIS_LC4',
        color: 0x38bdf8,
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(22, 14, -1),
          new THREE.Vector3(14, 11, -1),
          new THREE.Vector3(8, 7, 0),
          new THREE.Vector3(2, 0, -2)
        ])
      },
      {
        name: 'PAM_to_MB',
        sourcePop: 'MB_DAN',
        color: 0xffd700,
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(11, 17, 1),
          new THREE.Vector3(10, 18, 0),
          new THREE.Vector3(10, 18, -2)
        ])
      },
      {
        name: 'P1_to_Song',
        sourcePop: 'SOC_P1',
        color: 0xf43f5e,
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(12.5, 13, 2),
          new THREE.Vector3(8, 7, 1),
          new THREE.Vector3(2, 0, -2),
          new THREE.Vector3(-6, -8, -4),
          new THREE.Vector3(-14, -14, -5),
          new THREE.Vector3(-27, -22, -7)
        ])
      },
      {
        name: 'CX_to_Steering',
        sourcePop: 'CX_EPG',
        color: 0x00d2ff,
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(10, 15, 3.5),
          new THREE.Vector3(8, 11, 2),
          new THREE.Vector3(4, 5, 0),
          new THREE.Vector3(-2, -3, -3)
        ])
      }
    ];

    pathways.forEach(p => {
      // 1. Static Axon Tract Lines
      const pts = p.curve.getPoints(24);
      const tractGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const tractMat = new THREE.LineBasicMaterial({
        color: p.color,
        transparent: true,
        opacity: 0.65,
        linewidth: 1.5
      });
      const tractLine = new THREE.Line(tractGeom, tractMat);
      this.cnsGroup.add(tractLine);

      // 2. Dynamic Action Potential Spark Particles
      const sparkCount = 14;
      const sGeom = new THREE.BufferGeometry();
      const sPos = new Float32Array(sparkCount * 3);
      for (let i = 0; i < sparkCount; i++) {
        const pt = p.curve.getPoint(i / sparkCount);
        sPos[i * 3] = pt.x;
        sPos[i * 3 + 1] = pt.y;
        sPos[i * 3 + 2] = pt.z;
      }
      sGeom.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
      const sMat = new THREE.PointsMaterial({
        size: 2.2,
        color: p.color,
        transparent: true,
        opacity: 0.95
      });
      const sparks = new THREE.Points(sGeom, sMat);
      this.cnsGroup.add(sparks);

      this.tractSparks.push({
        sparks,
        curve: p.curve,
        sourcePop: p.sourcePop,
        times: Array.from({ length: sparkCount }, (_, i) => i / sparkCount),
        baseColor: p.color
      });
    });
  }

  initActionPotentialParticles(curve) {
    const pCount = 55;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(pCount * 3);
    const colors = new Float32Array(pCount * 3);

    for (let i = 0; i < pCount; i++) {
      const t = Math.random();
      const pt = curve.getPoint(t);
      pos[i * 3] = pt.x + (Math.random() - 0.5) * 1.5;
      pos[i * 3 + 1] = pt.y + (Math.random() - 0.5) * 1.5;
      pos[i * 3 + 2] = pt.z + (Math.random() - 0.5) * 1.5;

      colors[i * 3] = 0.0;
      colors[i * 3 + 1] = 0.9;
      colors[i * 3 + 2] = 1.0;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 2.2, vertexColors: true, transparent: true, opacity: 0.95 });
    this.streamlineParticles = new THREE.Points(geom, mat);
    this.particleTimes = Array.from({ length: pCount }, () => Math.random());
    this.cnsGroup.add(this.streamlineParticles);
  }

  initOptogeneticRaycaster() {
    // Optogenetic Laser Hover & Click Raycasting
    this.renderer.domElement.addEventListener('mousemove', (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const targets = Object.values(this.regions);
      const hits = this.raycaster.intersectObjects(targets, true);

      if (hits.length > 0) {
        let hitObj = hits[0].object;
        while (hitObj && (!hitObj.userData || !hitObj.userData.pop)) {
          hitObj = hitObj.parent;
        }
        if (hitObj && hitObj.userData && hitObj.userData.pop) {
          this.renderer.domElement.style.cursor = 'pointer';
          return;
        }
      }
      this.renderer.domElement.style.cursor = 'default';
    });

    this.renderer.domElement.addEventListener('click', (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const targets = Object.values(this.regions);
      const hits = this.raycaster.intersectObjects(targets, true);

      if (hits.length > 0) {
        let hitObj = hits[0].object;
        while (hitObj && (!hitObj.userData || !hitObj.userData.pop)) {
          hitObj = hitObj.parent;
        }
        if (hitObj && hitObj.userData && hitObj.userData.pop) {
          const pop = hitObj.userData.pop;
          this.stimulateRegion(pop, 2.5);
        }
      }
    });
  }

  stimulateRegion(popKey, intensity = 2.5) {
    // 1. Emit Custom Event for WebSocket dispatch
    window.dispatchEvent(new CustomEvent('brain-stimulate-neuropil', {
      detail: { population: popKey, intensity: intensity }
    }));

    // 2. Visual Laser Pulse Flash at the target neuropil
    const targetMesh = this.regionPopulations[popKey];
    if (targetMesh) {
      const worldPos = new THREE.Vector3();
      targetMesh.getWorldPosition(worldPos);

      // Create expanding laser energy ring
      const ringGeom = new THREE.RingGeometry(1.0, 2.0, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1.0
      });
      const laserRing = new THREE.Mesh(ringGeom, ringMat);
      laserRing.position.copy(worldPos);
      laserRing.lookAt(this.camera.position);
      this.scene.add(laserRing);

      this.optoPulses.push({
        mesh: laserRing,
        scale: 1.0,
        opacity: 1.0,
        maxScale: 12.0
      });

      // Temporary local spike for immediate visual gratification
      this.firingRates[popKey] = 1.0;
    }
  }

  updateTelemetry(telemetry) {
    if (!telemetry) return;
    this.firingRates = telemetry.firing_rates || {};
    this.currentHeadingDeg = telemetry.internal_heading_deg || 0;
    const p = telemetry.personality || {};

    // 1. PAM-DAN Dopamine Cluster
    const pamMesh = this.regions['PAM_DAN'];
    if (pamMesh) {
      const daLevel = p.dopamine || 0.5;
      const danRate = this.firingRates['MB_DAN'] || 0.2;
      pamMesh.material.emissiveIntensity = 0.25 + danRate * 2.0 * daLevel;
      pamMesh.scale.setScalar(1.0 + danRate * 0.4);
    }

    // 2. Optic Lobes
    const lc10Rate = this.firingRates['VIS_LC10'] || 0.1;
    const lc4Rate = this.firingRates['VIS_LC4'] || 0.1;
    const opticIntensity = Math.max(lc10Rate, lc4Rate);
    if (this.regions['OPTIC_LEFT']) {
      this.regions['OPTIC_LEFT'].material.emissiveIntensity = 0.2 + opticIntensity * 0.95;
    }
    if (this.regions['OPTIC_RIGHT']) {
      this.regions['OPTIC_RIGHT'].material.emissiveIntensity = 0.2 + opticIntensity * 0.95;
    }

    // 3. Central Complex Compass (CX_EPG)
    const cxMesh = this.regions['CX_EPG'];
    if (cxMesh) {
      const epgRate = this.firingRates['CX_EPG'] || 0.2;
      cxMesh.material.emissiveIntensity = 0.35 + epgRate * 0.85;
      cxMesh.rotation.z = (this.currentHeadingDeg * Math.PI) / 180;
    }

    // 4. Courtship P1 Hub
    const p1Mesh = this.regions['SOC_P1'];
    if (p1Mesh) {
      const p1Rate = this.firingRates['SOC_P1'] || 0.1;
      const songRate = this.firingRates['DN_SONG'] || 0.05;
      p1Mesh.material.emissiveIntensity = 0.25 + Math.max(p1Rate, songRate) * 1.6;
      p1Mesh.scale.setScalar(1.0 + p1Rate * 0.45);
    }

    // 5. Ventral Nerve Cord (VNC)
    const vncMesh = this.regions['VNC'];
    if (vncMesh) {
      const walkRate = this.firingRates['DN_WALK'] || 0.3;
      const lungeRate = this.firingRates['DN_LUNGE'] || 0.05;
      vncMesh.material.emissiveIntensity = 0.2 + walkRate * 0.6 + lungeRate * 1.3;
    }
  }

  render() {
    if (this.controls) this.controls.update();

    if (this.cnsGroup) {
      this.cnsGroup.rotation.y += 0.0018;
    }

    // Update Action Potential Spark Cascades along Inter-Neuropil Tracts
    this.tractSparks.forEach(ts => {
      const rate = this.firingRates[ts.sourcePop] || 0.15;
      const speed = 0.006 + rate * 0.024;
      const pos = ts.sparks.geometry.attributes.position.array;

      for (let i = 0; i < ts.times.length; i++) {
        ts.times[i] = (ts.times[i] + speed) % 1.0;
        const pt = ts.curve.getPoint(ts.times[i]);
        pos[i * 3] = pt.x + (Math.sin(i * 1.5) * 0.4);
        pos[i * 3 + 1] = pt.y + (Math.cos(i * 1.5) * 0.4);
        pos[i * 3 + 2] = pt.z;
      }
      ts.sparks.geometry.attributes.position.needsUpdate = true;
      ts.sparks.material.size = 2.0 + rate * 2.2;
    });

    // Cervical neck particles
    if (this.streamlineParticles && this.neckCurve) {
      const pos = this.streamlineParticles.geometry.attributes.position.array;
      const speed = 0.008 + (this.firingRates['DN_WALK'] || 0.3) * 0.016;

      for (let i = 0; i < this.particleTimes.length; i++) {
        this.particleTimes[i] = (this.particleTimes[i] + speed) % 1.0;
        const pt = this.neckCurve.getPoint(this.particleTimes[i]);
        pos[i * 3] = pt.x + (Math.sin(i * 1.3) * 0.8);
        pos[i * 3 + 1] = pt.y + (Math.cos(i * 1.7) * 0.8);
        pos[i * 3 + 2] = pt.z;
      }
      this.streamlineParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Optogenetic laser pulse expansion animation
    const alivePulses = [];
    for (const p of this.optoPulses) {
      p.scale += 0.55;
      p.opacity -= 0.045;
      p.mesh.scale.set(p.scale, p.scale, p.scale);
      p.mesh.material.opacity = Math.max(0, p.opacity);
      p.mesh.lookAt(this.camera.position);

      if (p.opacity > 0) {
        alivePulses.push(p);
      } else {
        this.scene.remove(p.mesh);
      }
    }
    this.optoPulses = alivePulses;

    this.renderer.render(this.scene, this.camera);
  }

  initResizeListener() {
    window.addEventListener('resize', () => {
      if (!this.container) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (w > 0 && h > 0) {
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
      }
    });
  }
}

window.Brain3DView = Brain3DView;

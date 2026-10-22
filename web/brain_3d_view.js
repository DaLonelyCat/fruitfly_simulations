/**
 * 3D Anatomical Drosophila Connectome Brain Visualizer (Three.js)
 * Faithfully reconstructs the full male Drosophila Central Nervous System (CNS)
 * matching the Google DeepMind & Janelia Connectome image:
 * - Left & Right Optic Lobes (intricate spherical columnar neuropil)
 * - Central Brain (Mushroom Body, Central Complex, Antennal Lobes, P1 cluster)
 * - Cervical Neck Connective (thick fiber bundle linking brain to VNC)
 * - Ventral Nerve Cord (VNC leg & wing neuromeres T1-T3 and abdominal ganglia)
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
    this.camera.position.set(0, 15, 85);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    if (window.THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxDistance = 250;
      this.controls.minDistance = 20;
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight1.position.set(30, 50, 40);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x00d2ff, 0.4);
    dirLight2.position.set(-40, -20, -30);
    this.scene.add(dirLight2);

    // Anatomical 3D Neuropil Meshes & Materials
    this.regions = {};
    this.fiberTracts = [];
    this.streamlineParticles = null;
    this.firingRates = {};
    this.currentHeadingDeg = 0;

    this.buildAnatomicalCNS();
    this.initResizeListener();
  }

  buildAnatomicalCNS() {
    this.cnsGroup = new THREE.Group();
    // Position CNS to match the DeepMind perspective (brain upper right, VNC lower left)
    this.cnsGroup.position.set(4, -4, 0);
    this.cnsGroup.rotation.y = -0.35;
    this.scene.add(this.cnsGroup);

    // =========================================================================
    // 1. Central Brain (Dome, Mushroom Body, Central Complex, P1 Courtship Hub)
    // =========================================================================
    const cbCenter = new THREE.Vector3(10, 16, 0);

    // Central Brain Soma Cloud (Hundreds of vibrant cell bodies)
    const somaCount = 900;
    const somaGeom = new THREE.BufferGeometry();
    const somaPos = new Float32Array(somaCount * 3);
    const somaColors = new Float32Array(somaCount * 3);

    const palette = [
      new THREE.Color(0x00d2ff), // Cyan
      new THREE.Color(0xff3366), // Rose / P1
      new THREE.Color(0xffaa00), // Amber / Aggression
      new THREE.Color(0xa78bfa), // Violet / Mushroom Body
      new THREE.Color(0x00e676), // Emerald
      new THREE.Color(0xf59e0b)  // Golden
    ];

    for (let i = 0; i < somaCount; i++) {
      // Ellipsoidal cluster around Central Brain
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * 11.0;

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
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });
    const somaPoints = new THREE.Points(somaGeom, somaMat);
    this.cnsGroup.add(somaPoints);

    // Mushroom Body (MB) - Calyx & Vertical/Medial Lobes
    const mbGeom = new THREE.TorusGeometry(5.5, 2.0, 16, 32);
    const mbMat = new THREE.MeshStandardMaterial({
      color: 0xa78bfa,
      emissive: 0x5b21b6,
      emissiveIntensity: 0.2,
      roughness: 0.4,
      metalness: 0.2,
      transparent: true,
      opacity: 0.65
    });
    const mbMesh = new THREE.Mesh(mbGeom, mbMat);
    mbMesh.position.copy(cbCenter).add(new THREE.Vector3(0, 2, -2));
    mbMesh.rotation.x = 0.5;
    this.cnsGroup.add(mbMesh);
    this.regions['MB'] = mbMesh;

    // PAM Dopaminergic Cluster (Gold sphere inside Mushroom Body)
    const pamGeom = new THREE.SphereGeometry(3.2, 24, 24);
    const pamMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 0.3,
      roughness: 0.3,
      transparent: true,
      opacity: 0.85
    });
    const pamMesh = new THREE.Mesh(pamGeom, pamMat);
    pamMesh.position.copy(cbCenter).add(new THREE.Vector3(1, 1, 1));
    this.cnsGroup.add(pamMesh);
    this.regions['PAM_DAN'] = pamMesh;

    // Central Complex (CX) - Ring Attractor (Ellipsoid Body)
    const cxGeom = new THREE.TorusGeometry(3.6, 1.2, 16, 32);
    const cxMat = new THREE.MeshStandardMaterial({
      color: 0x00d2ff,
      emissive: 0x0284c7,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      transparent: true,
      opacity: 0.8
    });
    const cxMesh = new THREE.Mesh(cxGeom, cxMat);
    cxMesh.position.copy(cbCenter).add(new THREE.Vector3(0, -1, 3.5));
    cxMesh.rotation.x = 0.2;
    this.cnsGroup.add(cxMesh);
    this.regions['CX_EPG'] = cxMesh;

    // P1 / pC1 Courtship Master Hub (Radiant Magenta)
    const p1Geom = new THREE.SphereGeometry(3.0, 24, 24);
    const p1Mat = new THREE.MeshStandardMaterial({
      color: 0xff3366,
      emissive: 0xe11d48,
      emissiveIntensity: 0.25,
      roughness: 0.35,
      transparent: true,
      opacity: 0.85
    });
    const p1Mesh = new THREE.Mesh(p1Geom, p1Mat);
    p1Mesh.position.copy(cbCenter).add(new THREE.Vector3(2.5, -3, 2));
    this.cnsGroup.add(p1Mesh);
    this.regions['SOC_P1'] = p1Mesh;

    // Antennal Lobes (AL) - Glomerular Olfactory Spheres (Left & Right)
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
    this.cnsGroup.add(alLeft);

    const alRight = new THREE.Mesh(alGeom, alMat.clone());
    alRight.position.copy(cbCenter).add(new THREE.Vector3(4.5, -7, 5));
    this.cnsGroup.add(alRight);
    this.regions['AL'] = alRight;

    // =========================================================================
    // 2. Optic Lobes (Massive Left and Right Spherical Intricate Neuropils)
    // =========================================================================
    // Left Optic Lobe (prominently visible on left side in DeepMind render)
    const lolCenter = new THREE.Vector3(-14, 15, -1);
    this.regions['OPTIC_LEFT'] = this.createOpticLobe(lolCenter, 13.5, 0x00d2ff);

    // Right Optic Lobe
    const rolCenter = new THREE.Vector3(30, 14, -2);
    this.regions['OPTIC_RIGHT'] = this.createOpticLobe(rolCenter, 12.5, 0x38bdf8);

    // =========================================================================
    // 3. Cervical Connective (Thick Curved Neck Fiber Tract connecting Brain to VNC)
    // =========================================================================
    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(8, 7, 0),     // Subesophageal zone of brain
      new THREE.Vector3(2, 0, -2),     // Entering cervical neck
      new THREE.Vector3(-6, -8, -4),   // Curving through neck connective
      new THREE.Vector3(-14, -14, -5), // Reaching anterior VNC
      new THREE.Vector3(-22, -18, -6)  // Entering prothoracic neuromere
    ]);

    // Outer fiber sheath
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
    this.cnsGroup.add(neckTube);
    this.regions['NECK'] = neckTube;

    // Parallel Descending & Ascending Axon Streamlines (striated fiber bundle)
    const fiberMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      linewidth: 1.5
    });

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

    // =========================================================================
    // 4. Ventral Nerve Cord (VNC - Thoracic & Abdominal Neuromeres at lower left)
    // =========================================================================
    const vncCenter = new THREE.Vector3(-24, -20, -6);
    this.regions['VNC'] = this.createVNC(vncCenter);

    // Dynamic Action Potential Streamline Particles (pulsing through neck)
    this.initActionPotentialParticles(neckCurve);
  }

  createOpticLobe(center, radius, baseColorHex) {
    const lobeGroup = new THREE.Group();
    lobeGroup.position.copy(center);

    // Volumetric Mesh Shell
    const shellGeom = new THREE.SphereGeometry(radius, 28, 28);
    const shellMat = new THREE.MeshStandardMaterial({
      color: baseColorHex,
      emissive: 0x0369a1,
      emissiveIntensity: 0.25,
      roughness: 0.45,
      transparent: true,
      opacity: 0.45,
      wireframe: false
    });
    const shellMesh = new THREE.Mesh(shellGeom, shellMat);
    lobeGroup.add(shellMesh);

    // Intricate Columnar Neuropil Wireframe (Medulla/Lobula layers)
    const wireGeom = new THREE.IcosahedronGeometry(radius * 0.96, 3);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      wireframe: true,
      transparent: true,
      opacity: 0.25
    });
    const wireMesh = new THREE.Mesh(wireGeom, wireMat);
    lobeGroup.add(wireMesh);

    // Dense Optic Lobe Neurons / Somas
    const count = 450;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const c1 = new THREE.Color(baseColorHex);
    const c2 = new THREE.Color(0xf59e0b); // golden accent
    const c3 = new THREE.Color(0x10b981); // emerald

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

    // Segmented Leg Neuromeres: Prothoracic (T1), Mesothoracic (T2), Metathoracic (T3), Abdominal (Abd)
    const neuromeres = [
      { name: 'T1', pos: new THREE.Vector3(3, 3, 0), r: 5.5, color: 0x10b981 }, // Foreleg motor center
      { name: 'T2', pos: new THREE.Vector3(-3, -2, -1), r: 6.2, color: 0x0ea5e9 }, // Midleg & Wing flight motor center
      { name: 'T3', pos: new THREE.Vector3(-9, -7, -2), r: 5.2, color: 0xf59e0b }, // Hindleg motor center
      { name: 'Abd', pos: new THREE.Vector3(-14, -12, -3), r: 4.2, color: 0xa855f7 } // Abdominal ganglia
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
      vncGroup.add(mesh);
      meshes.push(mesh);
    });

    // Leg Motor Nerve Exits (radiating axon bundles)
    const nerveMat = new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.8 });
    for (let leg = 0; leg < 6; leg++) {
      const side = leg % 2 === 0 ? 1 : -1;
      const segIdx = Math.floor(leg / 2);
      const startP = neuromeres[segIdx].pos.clone();
      const endP = startP.clone().add(new THREE.Vector3(side * 8, -4, -3));
      const lineGeom = new THREE.BufferGeometry().setFromPoints([startP, endP]);
      const line = new THREE.Line(lineGeom, nerveMat);
      vncGroup.add(line);
    }

    this.cnsGroup.add(vncGroup);
    return meshes[1]; // T2 mesothoracic hub as representative
  }

  initActionPotentialParticles(curve) {
    const pCount = 60;
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
    this.neckCurve = curve;
    this.particleTimes = Array.from({ length: pCount }, () => Math.random());
    this.cnsGroup.add(this.streamlineParticles);
  }

  updateTelemetry(telemetry) {
    if (!telemetry) return;
    this.firingRates = telemetry.firing_rates || {};
    this.currentHeadingDeg = telemetry.internal_heading_deg || 0;
    const p = telemetry.personality || {};

    // 1. Dopamine Surge -> Mushroom Body PAM-DAN Cluster Flares Golden!
    const pamMesh = this.regions['PAM_DAN'];
    if (pamMesh) {
      const daLevel = p.dopamine || 0.5;
      const danRate = this.firingRates['MB_DAN'] || 0.2;
      // When eating or dopamine surges, emissive glow intensifies
      pamMesh.material.emissiveIntensity = 0.2 + danRate * 1.8 * daLevel;
      pamMesh.scale.setScalar(1.0 + danRate * 0.35);
    }

    // 2. Optic Lobes -> Glow Electric Cyan when visual tracking / looming
    const lc10Rate = this.firingRates['VIS_LC10'] || 0.1;
    const lc4Rate = this.firingRates['VIS_LC4'] || 0.1;
    const opticIntensity = Math.max(lc10Rate, lc4Rate);
    if (this.regions['OPTIC_LEFT']) {
      this.regions['OPTIC_LEFT'].material.emissiveIntensity = 0.2 + opticIntensity * 0.9;
    }
    if (this.regions['OPTIC_RIGHT']) {
      this.regions['OPTIC_RIGHT'].material.emissiveIntensity = 0.2 + opticIntensity * 0.9;
    }

    // 3. Central Complex Compass (CX_EPG) -> Rotates with internal heading
    const cxMesh = this.regions['CX_EPG'];
    if (cxMesh) {
      const epgRate = this.firingRates['CX_EPG'] || 0.2;
      cxMesh.material.emissiveIntensity = 0.3 + epgRate * 0.8;
      cxMesh.rotation.z = (this.currentHeadingDeg * Math.PI) / 180;
    }

    // 4. Courtship P1 Hub -> Flares Radiant Magenta when courting / singing
    const p1Mesh = this.regions['SOC_P1'];
    if (p1Mesh) {
      const p1Rate = this.firingRates['SOC_P1'] || 0.1;
      const songRate = this.firingRates['DN_SONG'] || 0.05;
      p1Mesh.material.emissiveIntensity = 0.2 + Math.max(p1Rate, songRate) * 1.5;
      p1Mesh.scale.setScalar(1.0 + p1Rate * 0.4);
    }

    // 5. Ventral Nerve Cord (VNC) -> Pulses with leg locomotion and lunges
    const vncMesh = this.regions['VNC'];
    if (vncMesh) {
      const walkRate = this.firingRates['DN_WALK'] || 0.3;
      const lungeRate = this.firingRates['DN_LUNGE'] || 0.05;
      vncMesh.material.emissiveIntensity = 0.2 + walkRate * 0.6 + lungeRate * 1.2;
    }
  }

  render() {
    if (this.controls) this.controls.update();

    // Gentle idle rotation of the CNS
    if (this.cnsGroup) {
      this.cnsGroup.rotation.y += 0.002;
    }

    // Stream action potential particles through cervical neck connective
    if (this.streamlineParticles && this.neckCurve) {
      const pos = this.streamlineParticles.geometry.attributes.position.array;
      const speed = 0.008 + (this.firingRates['DN_WALK'] || 0.3) * 0.015;

      for (let i = 0; i < this.particleTimes.length; i++) {
        this.particleTimes[i] = (this.particleTimes[i] + speed) % 1.0;
        const pt = this.neckCurve.getPoint(this.particleTimes[i]);
        pos[i * 3] = pt.x + (Math.sin(i * 1.3) * 0.8);
        pos[i * 3 + 1] = pt.y + (Math.cos(i * 1.7) * 0.8);
        pos[i * 3 + 2] = pt.z;
      }
      this.streamlineParticles.geometry.attributes.position.needsUpdate = true;
    }

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

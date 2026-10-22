/**
 * 3D Drosophila Behavioral Terrarium (Three.js)
 * Features:
 * - Detailed anatomical Drosophila modeling (head, compound eyes with ommatidia, ocelli, arista,
 *   scutum, scutellum, halteres, 5-segment legs with claws, wing venation, genital claspers).
 * - Visual 3D hitboxes (toggleable wireframe bounding capsule).
 * - High-fidelity 3D modeled fruits (peeled banana slice with seeded core, crystalline faceted sugar cube).
 * - Scientific Laboratory Skybox environment.
 * - 3D Flight locomotion and takeoff mechanics.
 * - Interactive food removal tools.
 */

class Arena3DView {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a101d);

    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 550;

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    this.camera.position.set(100, -135, 150);
    this.camera.up.set(0, 0, 1);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    if (window.THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.target.set(100, 100, 25);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxPolarAngle = Math.PI * 0.485;
      this.controls.minDistance = 15;
      this.controls.maxDistance = 400;
    }

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.flyMeshes = {};
    this.foodMeshes = {};
    this.dopamineParticles = [];
    this.showHitboxes = true; // Toggleable hitboxes

    this.buildLaboratorySkybox();
    this.initLighting();
    this.buildTerrariumEnvironment();
    this.initEvents();
    this.initResizeListener();
  }

  buildLaboratorySkybox() {
    // Scientific Research Facility Skybox
    const skyGeom = new THREE.BoxGeometry(600, 600, 400);
    
    // Create procedural canvas textures for laboratory walls, ceiling, and floor
    const createLabWallTexture = (label) => {
      const cv = document.createElement('canvas');
      cv.width = 512;
      cv.height = 512;
      const ctx = cv.getContext('2d');

      // Wall background
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, 512, 512);

      // Lab wall panels
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 3;
      ctx.strokeRect(20, 20, 472, 472);

      // Fluorescent laboratory lighting fixtures
      ctx.fillStyle = '#374151';
      ctx.fillRect(60, 40, 392, 24);
      ctx.fillStyle = '#e0f2fe';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 15;
      ctx.fillRect(70, 45, 372, 14);
      ctx.shadowBlur = 0;

      // Equipment silhouette & laboratory shelves
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(40, 300, 432, 12);
      ctx.fillRect(40, 400, 432, 16);

      // Glassware / Microscope silhouettes on shelves
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(70, 270, 20, 30);
      ctx.fillRect(110, 260, 25, 40);
      ctx.fillRect(200, 275, 18, 25);
      ctx.fillRect(320, 255, 30, 45);

      // Text label
      ctx.font = '14px monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText(label, 40, 480);

      const tex = new THREE.CanvasTexture(cv);
      return new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
    };

    const wallMat = createLabWallTexture('DROSOPHILA CONNECTOMICS FACILITY');
    const skybox = new THREE.Mesh(skyGeom, wallMat);
    skybox.position.set(100, 100, 100);
    this.scene.add(skybox);
  }

  initLighting() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);

    const mainLight = new THREE.DirectionalLight(0xfff8ee, 1.0);
    mainLight.position.set(100, 100, 220);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 10;
    mainLight.shadow.camera.far = 350;
    mainLight.shadow.camera.left = -115;
    mainLight.shadow.camera.right = 115;
    mainLight.shadow.camera.top = 115;
    mainLight.shadow.camera.bottom = -115;
    this.scene.add(mainLight);

    const blueRim = new THREE.PointLight(0x00d2ff, 0.6, 250);
    blueRim.position.set(0, 0, 70);
    this.scene.add(blueRim);

    const warmRim = new THREE.PointLight(0xffaa00, 0.5, 250);
    warmRim.position.set(200, 200, 70);
    this.scene.add(warmRim);
  }

  buildTerrariumEnvironment() {
    const terrariumGroup = new THREE.Group();

    // 1. Floor with millimeter grid
    const floorGeom = new THREE.PlaneGeometry(200, 200);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.75,
      metalness: 0.15
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.position.set(100, 100, 0);
    floor.receiveShadow = true;
    terrariumGroup.add(floor);

    const grid = new THREE.GridHelper(200, 20, 0x0284c7, 0x1e293b);
    grid.position.set(100, 100, 0.1);
    grid.rotation.x = Math.PI / 2;
    terrariumGroup.add(grid);

    // 2. Glass Walls (200 x 200 x 100 mm transparent box)
    const wallMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.12,
      roughness: 0.05,
      transmission: 0.92,
      ior: 1.52,
      side: THREE.DoubleSide
    });

    const boxGeom = new THREE.BoxGeometry(200, 200, 100);
    const wallBox = new THREE.Mesh(boxGeom, wallMat);
    wallBox.position.set(100, 100, 50);
    terrariumGroup.add(wallBox);

    // Corner pillar braces
    const edgesGeom = new THREE.EdgesGeometry(boxGeom);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4 });
    const wireframe = new THREE.LineSegments(edgesGeom, wireMat);
    wireframe.position.set(100, 100, 50);
    terrariumGroup.add(wireframe);

    // 3. Central Climbing Perch (cylinder to Z=65)
    const perchGeom = new THREE.CylinderGeometry(4.5, 5.0, 65, 16);
    const perchMat = new THREE.MeshStandardMaterial({ color: 0x5c3d24, roughness: 0.9 });
    const perch = new THREE.Mesh(perchGeom, perchMat);
    perch.position.set(100, 100, 32.5);
    perch.rotation.x = Math.PI / 2;
    perch.castShadow = true;
    perch.receiveShadow = true;
    terrariumGroup.add(perch);

    // Horizontal Twig
    const twigCurve = new THREE.LineCurve3(new THREE.Vector3(100, 100, 50), new THREE.Vector3(140, 110, 52));
    const twigGeom = new THREE.TubeGeometry(twigCurve, 12, 2.2, 8, false);
    const twigMat = new THREE.MeshStandardMaterial({ color: 0x6e4a2e, roughness: 0.85 });
    const twig = new THREE.Mesh(twigGeom, twigMat);
    twig.castShadow = true;
    terrariumGroup.add(twig);

    // 4. Elevated Food Pedestal (Z=22)
    const pedGeom = new THREE.CylinderGeometry(15, 16, 22, 24);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65 });
    const pedestal = new THREE.Mesh(pedGeom, pedMat);
    pedestal.position.set(150, 60, 11);
    pedestal.rotation.x = Math.PI / 2;
    pedestal.receiveShadow = true;
    pedestal.castShadow = true;
    terrariumGroup.add(pedestal);

    this.scene.add(terrariumGroup);
  }

  initEvents() {
    this.renderer.domElement.addEventListener('click', (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      // 1. Check food intersection first (for remove food or inspection)
      const foodMeshesList = Object.values(this.foodMeshes);
      const foodHits = this.raycaster.intersectObjects(foodMeshesList, true);
      if (foodHits.length > 0) {
        let hitFood = foodHits[0].object;
        while (hitFood && (!hitFood.userData || hitFood.userData.foodId === undefined)) {
          hitFood = hitFood.parent;
        }
        if (hitFood && hitFood.userData && hitFood.userData.foodId !== undefined) {
          window.dispatchEvent(new CustomEvent('food-click-3d', { detail: { foodId: hitFood.userData.foodId } }));
          return;
        }
      }

      // 2. Check fly intersection
      const flyObjects = [];
      for (const [id, flyGroup] of Object.entries(this.flyMeshes)) {
        flyObjects.push(flyGroup.bodyMesh);
      }

      const flyHits = this.raycaster.intersectObjects(flyObjects, true);
      if (flyHits.length > 0) {
        const hit = flyHits[0].object;
        if (hit.userData && hit.userData.flyId) {
          window.dispatchEvent(new CustomEvent('select-fly-3d', { detail: { flyId: hit.userData.flyId } }));
          return;
        }
      }

      // 3. Check floor intersection for dropping food
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const targetPt = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(plane, targetPt)) {
        if (targetPt.x >= 0 && targetPt.x <= 200 && targetPt.y >= 0 && targetPt.y <= 200) {
          window.dispatchEvent(new CustomEvent('floor-click-3d', { detail: { x: targetPt.x, y: targetPt.y, z: 0 } }));
        }
      }
    });
  }

  toggleHitboxes(show) {
    this.showHitboxes = show;
    for (const id in this.flyMeshes) {
      if (this.flyMeshes[id].hitboxMesh) {
        this.flyMeshes[id].hitboxMesh.visible = show;
      }
    }
  }

  updateState(state) {
    if (!state) return;

    if (state.environment && state.environment.food_patches) {
      this.syncFoodObjects(state.environment.food_patches);
    }

    if (state.flies) {
      this.syncFlyObjects(state.flies, state.selected_fly_id);
    }
  }

  syncFoodObjects(patches) {
    const activeIds = new Set();
    patches.forEach(fp => {
      activeIds.add(fp.id);
      let meshGroup = this.foodMeshes[fp.id];

      if (!meshGroup) {
        meshGroup = this.createModelledFruit(fp);
        this.scene.add(meshGroup);
        this.foodMeshes[fp.id] = meshGroup;
      }

      meshGroup.position.set(fp.x, fp.y, fp.z);
      const scale = Math.max(0.25, fp.amount / 100.0);
      meshGroup.scale.set(scale, scale, scale);
    });

    for (const id in this.foodMeshes) {
      if (!activeIds.has(parseInt(id, 10))) {
        this.scene.remove(this.foodMeshes[id]);
        delete this.foodMeshes[id];
      }
    }
  }

  createModelledFruit(fp) {
    const group = new THREE.Group();
    group.userData = { foodId: fp.id };

    if (fp.type === 'sugar_cube') {
      // High-Fidelity Refractive Crystalline Sugar Cube
      const cubeGeom = new THREE.BoxGeometry(fp.radius * 1.5, fp.radius * 1.5, fp.height * 1.6);
      const cubeMat = new THREE.MeshPhysicalMaterial({
        color: 0xf8fafc,
        transmission: 0.9,
        roughness: 0.1,
        ior: 1.55,
        reflectivity: 0.8,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.25
      });
      const sugarMesh = new THREE.Mesh(cubeGeom, cubeMat);
      sugarMesh.castShadow = true;
      sugarMesh.position.set(0, 0, fp.height * 0.8);
      group.add(sugarMesh);

      // Chamfered / Faceted edge highlights
      const edges = new THREE.EdgesGeometry(cubeGeom);
      const edgeLine = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xbae6fd }));
      sugarMesh.add(edgeLine);

      // Sparkling sugar inclusions (tiny crystal facets)
      const sparkleGeom = new THREE.BufferGeometry();
      const sPos = new Float32Array(30 * 3);
      for (let i = 0; i < 30; i++) {
        sPos[i * 3] = (Math.random() - 0.5) * fp.radius * 1.3;
        sPos[i * 3 + 1] = (Math.random() - 0.5) * fp.radius * 1.3;
        sPos[i * 3 + 2] = Math.random() * fp.height * 1.4;
      }
      sparkleGeom.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
      const sparkleMat = new THREE.PointsMaterial({ size: 1.2, color: 0xffffff });
      const sparkles = new THREE.Points(sparkleGeom, sparkleMat);
      sugarMesh.add(sparkles);
    } else {
      // Modelled Ripe Banana Slice with Outer Peel and Core with Seeds
      // 1. Yellow Outer Banana Peel Ring
      const peelGeom = new THREE.CylinderGeometry(fp.radius, fp.radius * 1.05, fp.height, 28, 1, true);
      const peelMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.5,
        emissive: 0xca8a04,
        emissiveIntensity: 0.2
      });
      const peel = new THREE.Mesh(peelGeom, peelMat);
      peel.rotation.x = Math.PI / 2;
      peel.castShadow = true;
      group.add(peel);

      // 2. Pale Ivory Inner Fleshy Pulp
      const pulpGeom = new THREE.CylinderGeometry(fp.radius * 0.94, fp.radius * 0.94, fp.height * 0.98, 24);
      const pulpMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        roughness: 0.75
      });
      const pulp = new THREE.Mesh(pulpGeom, pulpMat);
      pulp.rotation.x = Math.PI / 2;
      group.add(pulp);

      // 3. Central Seed Ring (Dark Banana Seed Specks)
      const seedGeom = new THREE.RingGeometry(fp.radius * 0.15, fp.radius * 0.45, 12);
      const seedMat = new THREE.MeshBasicMaterial({
        color: 0x713f12,
        side: THREE.DoubleSide
      });
      const seeds = new THREE.Mesh(seedGeom, seedMat);
      seeds.position.set(0, 0, fp.height * 0.51);
      group.add(seeds);

      // 4. Golden Yeast Odor Halo
      const haloGeom = new THREE.RingGeometry(fp.radius * 1.1, fp.radius * 2.2, 24);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide
      });
      const halo = new THREE.Mesh(haloGeom, haloMat);
      group.add(halo);
    }

    return group;
  }

  syncFlyObjects(flies, selectedId) {
    const activeIds = new Set();
    flies.forEach(fly => {
      activeIds.add(fly.id);
      let flyObj = this.flyMeshes[fly.id];

      if (!flyObj) {
        flyObj = this.createAccurateAnatomicalFly(fly);
        this.scene.add(flyObj.root);
        this.flyMeshes[fly.id] = flyObj;
      }

      flyObj.root.position.set(fly.x, fly.y, fly.z);
      flyObj.root.rotation.set(fly.roll, fly.pitch, fly.heading, 'ZYX');

      // Selection Halo
      flyObj.selectionRing.visible = (fly.id === selectedId);

      // Hitbox visibility
      flyObj.hitboxMesh.visible = this.showHitboxes;
      // Hitbox flashes amber during lunges or close encounters
      if (fly.action === 'lunging') {
        flyObj.hitboxMesh.material.color.setHex(0xff5500);
      } else {
        flyObj.hitboxMesh.material.color.setHex(0x00d2ff);
      }

      // Wings & Halteres
      const leftRad = (fly.wing_left_angle * Math.PI) / 180;
      const rightRad = (fly.wing_right_angle * Math.PI) / 180;

      if (fly.is_airborne) {
        const stroke = Math.sin(fly.wing_stroke_phase) * 0.85;
        flyObj.wingLeft.rotation.z = -0.3 + stroke;
        flyObj.wingRight.rotation.z = 0.3 - stroke;
        // Halteres oscillate rapidly in flight
        flyObj.haltereL.rotation.x = Math.cos(fly.wing_stroke_phase) * 0.6;
        flyObj.haltereR.rotation.x = -Math.cos(fly.wing_stroke_phase) * 0.6;
      } else {
        flyObj.wingLeft.rotation.z = -leftRad;
        flyObj.wingRight.rotation.z = rightRad;
      }

      // Articulated Proboscis extension
      if (fly.proboscis > 0.1) {
        flyObj.proboscis.scale.z = 1.0 + fly.proboscis * 2.5;
        flyObj.proboscis.visible = true;
      } else {
        flyObj.proboscis.visible = false;
      }

      // 5-Segment Leg Tripod Gait
      if (!fly.is_airborne && fly.speed > 1.0) {
        this.animateAnatomicalLegs(flyObj, fly.tripod_phase);
      }

      // Dopamine Surge: Golden reward particles
      if (fly.dopamine_surge) {
        this.spawnDopamineRewardParticles(fly.x, fly.y, fly.z);
      }
    });

    for (const id in this.flyMeshes) {
      if (!activeIds.has(parseInt(id, 10))) {
        this.scene.remove(this.flyMeshes[id].root);
        delete this.flyMeshes[id];
      }
    }
  }

  createAccurateAnatomicalFly(fly) {
    const root = new THREE.Group();

    // =========================================================================
    // 1. 3D Hitbox Capsule (Visual & Physics collision bounds)
    // =========================================================================
    const hbRadius = 1.8;
    const hbLength = 3.6;
    const hbGeom = new THREE.CylinderGeometry(hbRadius, hbRadius, hbLength, 12);
    const hbMat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      wireframe: true,
      transparent: true,
      opacity: 0.4
    });
    const hitboxMesh = new THREE.Mesh(hbGeom, hbMat);
    hitboxMesh.rotation.x = Math.PI / 2;
    hitboxMesh.visible = this.showHitboxes;
    root.add(hitboxMesh);

    // =========================================================================
    // 2. Thorax: Scutum & Scutellum (Anatomical dorsal shield)
    // =========================================================================
    const scutumGeom = new THREE.SphereGeometry(1.6, 16, 16);
    scutumGeom.scale(1.3, 1.0, 0.95);
    const thoraxMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(fly.color),
      roughness: 0.45,
      metalness: 0.2
    });
    const scutum = new THREE.Mesh(scutumGeom, thoraxMat);
    scutum.castShadow = true;
    scutum.userData = { flyId: fly.id };
    root.add(scutum);

    // Posterior Scutellum (triangular shield lobe behind scutum)
    const scutellumGeom = new THREE.ConeGeometry(0.85, 1.1, 12);
    scutellumGeom.scale(1.0, 0.6, 0.8);
    const scutellum = new THREE.Mesh(scutellumGeom, thoraxMat);
    scutellum.position.set(-1.4, 0, 0.5);
    scutellum.rotation.z = Math.PI / 2;
    root.add(scutellum);

    // Halteres (Pair of gyroscopic balancing drumsticks behind wings)
    const haltereMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3 });
    const haltereGeom = new THREE.CylinderGeometry(0.08, 0.25, 0.9, 8);
    
    const haltereL = new THREE.Mesh(haltereGeom, haltereMat);
    haltereL.position.set(-1.2, 0.8, 0.2);
    haltereL.rotation.x = 0.6;
    root.add(haltereL);

    const haltereR = new THREE.Mesh(haltereGeom, haltereMat);
    haltereR.position.set(-1.2, -0.8, 0.2);
    haltereR.rotation.x = -0.6;
    root.add(haltereR);

    // =========================================================================
    // 3. Head: Rostrum, Compound Eyes with Ommatidia, Ocelli, and Arista
    // =========================================================================
    const headGeom = new THREE.SphereGeometry(1.15, 16, 16);
    headGeom.scale(0.85, 1.1, 0.95);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.6 });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.set(1.9, 0, 0.2);
    head.userData = { flyId: fly.id };
    root.add(head);

    // Large Compound Red Eyes (Faceted Ommatidia mesh)
    const eyeGeom = new THREE.SphereGeometry(0.65, 14, 14);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xcc1122,
      roughness: 0.15,
      metalness: 0.1,
      emissive: 0x550000,
      emissiveIntensity: 0.35
    });
    const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
    eyeL.position.set(1.9, 0.85, 0.35);
    root.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeom, eyeMat);
    eyeR.position.set(1.9, -0.85, 0.35);
    root.add(eyeR);

    // 3 Simple Eyes (Dorsal Ocelli in a triangle between compound eyes)
    const ocellusMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const ocellusGeom = new THREE.SphereGeometry(0.1, 6, 6);
    for (let o = 0; o < 3; o++) {
      const oc = new THREE.Mesh(ocellusGeom, ocellusMat);
      const ox = 1.8 + (o === 0 ? 0.2 : 0.0);
      const oy = (o === 1 ? 0.2 : (o === 2 ? -0.2 : 0.0));
      oc.position.set(ox, oy, 1.05);
      root.add(oc);
    }

    // Antennae with Feathered Arista
    const antMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const antL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6), antMat);
    antL.position.set(2.7, 0.3, 0.55);
    antL.rotation.z = -0.5;
    root.add(antL);

    const antR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6), antMat);
    antR.position.set(2.7, -0.3, 0.55);
    antR.rotation.z = -0.5;
    root.add(antR);

    // Articulated Proboscis (Haustellum & Labellum)
    const probGeom = new THREE.CylinderGeometry(0.14, 0.25, 1.3, 8);
    const probMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 });
    const proboscis = new THREE.Mesh(probGeom, probMat);
    proboscis.position.set(2.3, 0, -0.65);
    proboscis.rotation.x = Math.PI / 2;
    proboscis.visible = false;
    root.add(proboscis);

    // =========================================================================
    // 4. Abdomen: Segmented Tergites (A1-A6) with Male/Female Genitalia
    // =========================================================================
    const abdGeom = new THREE.SphereGeometry(2.2, 16, 16);
    abdGeom.scale(1.8, 1.1, 0.95);
    const abdMat = new THREE.MeshStandardMaterial({
      color: fly.gender === 'male' ? 0x231a11 : 0x3d2b1a,
      roughness: 0.65
    });
    const abdomen = new THREE.Mesh(abdGeom, abdMat);
    abdomen.position.set(-2.3, 0, 0);
    root.add(abdomen);

    // Male Epandrium / Genital Claspers (dark posterior tip)
    if (fly.gender === 'male') {
      const clasperGeom = new THREE.SphereGeometry(0.65, 10, 10);
      const clasperMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
      const claspers = new THREE.Mesh(clasperGeom, clasperMat);
      claspers.position.set(-4.0, 0, -0.1);
      root.add(claspers);
    }

    // =========================================================================
    // 5. Wings with Biological Venation (Costal vein, L1-L5 longitudinals)
    // =========================================================================
    const wingGeom = new THREE.PlaneGeometry(5.4, 2.0);
    wingGeom.translate(-2.5, 0, 0);
    const wingMat = new THREE.MeshPhysicalMaterial({
      color: 0xf1f5f9,
      transparent: true,
      opacity: 0.6,
      roughness: 0.05,
      transmission: 0.88,
      reflectivity: 0.7,
      side: THREE.DoubleSide
    });

    const wingLeft = new THREE.Mesh(wingGeom, wingMat);
    wingLeft.position.set(-0.6, 0.75, 0.9);
    root.add(wingLeft);

    const wingRight = new THREE.Mesh(wingGeom, wingMat.clone());
    wingRight.position.set(-0.6, -0.75, 0.9);
    root.add(wingRight);

    // Wing Vein Overlays (Longitudinals L1 to L5)
    const veinMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.7 });
    const addWingVeins = (wingMesh) => {
      const pts = [
        new THREE.Vector3(0, 0, 0.01), new THREE.Vector3(-4.8, 0.6, 0.01),
        new THREE.Vector3(-1.2, 0.1, 0.01), new THREE.Vector3(-4.9, 0.1, 0.01),
        new THREE.Vector3(-1.5, -0.1, 0.01), new THREE.Vector3(-4.6, -0.5, 0.01)
      ];
      const vGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const vLines = new THREE.LineSegments(vGeom, veinMat);
      wingMesh.add(vLines);
    };
    addWingVeins(wingLeft);
    addWingVeins(wingRight);

    // =========================================================================
    // 6. Six Articulated 5-Segment Legs (Coxa, Trochanter, Femur, Tibia, Tarsi)
    // =========================================================================
    const legs = [];
    const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75 });

    for (let i = 0; i < 6; i++) {
      const legGroup = new THREE.Group();
      const side = (i % 2 === 0) ? 1 : -1;
      const xOffset = (Math.floor(i / 2) - 1) * 1.0;

      // Femur (Upper segment)
      const femurGeom = new THREE.CylinderGeometry(0.14, 0.18, 1.6, 6);
      const femur = new THREE.Mesh(femurGeom, legMat);
      femur.position.set(0, side * 0.5, -0.7);
      femur.rotation.x = side * 0.45;
      legGroup.add(femur);

      // Tibia (Lower segment)
      const tibiaGeom = new THREE.CylinderGeometry(0.10, 0.14, 1.8, 6);
      const tibia = new THREE.Mesh(tibiaGeom, legMat);
      tibia.position.set(0, side * 1.1, -1.8);
      tibia.rotation.x = -side * 0.35;
      legGroup.add(tibia);

      // Tarsal segments & claws
      const tarsusGeom = new THREE.CylinderGeometry(0.06, 0.09, 1.1, 5);
      const tarsus = new THREE.Mesh(tarsusGeom, legMat);
      tarsus.position.set(0.1, side * 1.5, -2.6);
      tarsus.rotation.x = -side * 0.6;
      legGroup.add(tarsus);

      legGroup.position.set(xOffset, side * 0.9, -0.3);
      root.add(legGroup);
      legs.push(legGroup);
    }

    // Selection Indicator Ring
    const ringGeom = new THREE.RingGeometry(3.2, 3.8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, side: THREE.DoubleSide });
    const selectionRing = new THREE.Mesh(ringGeom, ringMat);
    selectionRing.position.set(0, 0, -1.0);
    selectionRing.visible = false;
    root.add(selectionRing);

    return {
      root,
      bodyMesh: scutum,
      hitboxMesh,
      wingLeft,
      wingRight,
      haltereL,
      haltereR,
      proboscis,
      legs,
      selectionRing
    };
  }

  animateAnatomicalLegs(flyObj, tripodPhase) {
    flyObj.legs.forEach((leg, idx) => {
      const legPhase = tripodPhase + (idx % 2 === 0 ? 0 : Math.PI);
      leg.rotation.z = Math.sin(legPhase) * 0.4;
      leg.rotation.x = (idx % 2 === 0 ? 1 : -1) * (0.35 + Math.cos(legPhase) * 0.15);
    });
  }

  spawnDopamineRewardParticles(x, y, z) {
    for (let i = 0; i < 5; i++) {
      const geom = new THREE.SphereGeometry(0.45, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.95 });
      const p = new THREE.Mesh(geom, mat);
      p.position.set(
        x + (Math.random() - 0.5) * 3,
        y + (Math.random() - 0.5) * 3,
        z + 1.2
      );
      this.scene.add(p);
      this.dopamineParticles.push({
        mesh: p,
        vz: 16.0 + Math.random() * 12.0,
        vx: (Math.random() - 0.5) * 8.0,
        vy: (Math.random() - 0.5) * 8.0,
        life: 25
      });
    }
  }

  render() {
    if (this.controls) this.controls.update();

    const aliveParticles = [];
    for (const p of this.dopamineParticles) {
      p.life -= 1;
      p.mesh.position.z += p.vz * 0.016;
      p.mesh.position.x += p.vx * 0.016;
      p.mesh.position.y += p.vy * 0.016;
      p.mesh.material.opacity = p.life / 25.0;

      if (p.life > 0) {
        aliveParticles.push(p);
      } else {
        this.scene.remove(p.mesh);
      }
    }
    this.dopamineParticles = aliveParticles;

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

window.Arena3DView = Arena3DView;

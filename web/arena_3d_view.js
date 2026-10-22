/**
 * 3D Drosophila Behavioral Terrarium (Three.js)
 * Simulates full 3D space (200 x 200 x 100 mm), 3D articulated fruit fly bodies,
 * interactive 3D climbing perches/branches, and dopamine-reward food objects.
 */

class Arena3DView {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b14);

    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 550;

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    // Position camera viewing the terrarium from an elevated isometric perspective
    this.camera.position.set(100, -140, 160);
    this.camera.up.set(0, 0, 1); // Z is up

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
      this.controls.maxPolarAngle = Math.PI * 0.48; // don't go below floor
    }

    // Raycaster for mouse picking in 3D
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Lighting
    this.initLighting();

    // Terrarium Architecture (Glass walls, floor, objects)
    this.flyMeshes = {};
    this.foodMeshes = {};
    this.objectMeshes = {};
    this.dopamineParticles = [];

    this.buildTerrariumEnvironment();
    this.initEvents();
    this.initResizeListener();
  }

  initLighting() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(ambient);

    const mainLight = new THREE.DirectionalLight(0xfff5e6, 0.9);
    mainLight.position.set(100, 100, 180);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 10;
    mainLight.shadow.camera.far = 300;
    mainLight.shadow.camera.left = -110;
    mainLight.shadow.camera.right = 110;
    mainLight.shadow.camera.top = 110;
    mainLight.shadow.camera.bottom = -110;
    this.scene.add(mainLight);

    const rimLight = new THREE.PointLight(0x00d2ff, 0.5, 300);
    rimLight.position.set(0, 0, 80);
    this.scene.add(rimLight);
  }

  buildTerrariumEnvironment() {
    const terrariumGroup = new THREE.Group();

    // 1. Floor (200 x 200 mm) with measurement grid
    const floorGeom = new THREE.PlaneGeometry(200, 200);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.position.set(100, 100, 0);
    floor.receiveShadow = true;
    terrariumGroup.add(floor);

    // Floor Grid lines
    const grid = new THREE.GridHelper(200, 20, 0x1e3a5f, 0x162438);
    grid.position.set(100, 100, 0.1);
    grid.rotation.x = Math.PI / 2;
    terrariumGroup.add(grid);

    // 2. Glass Walls (200 x 200 x 100 mm transparent box)
    const wallMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.12,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.9,
      ior: 1.5,
      side: THREE.DoubleSide
    });

    const boxGeom = new THREE.BoxGeometry(200, 200, 100);
    const wallBox = new THREE.Mesh(boxGeom, wallMat);
    wallBox.position.set(100, 100, 50);
    terrariumGroup.add(wallBox);

    // Frame edges
    const wireGeom = new THREE.BoxGeometry(200, 200, 100);
    const edgesGeom = new THREE.EdgesGeometry(wireGeom);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.35 });
    const wireframe = new THREE.LineSegments(edgesGeom, wireMat);
    wireframe.position.set(100, 100, 50);
    terrariumGroup.add(wireframe);

    // 3. Central Climbing Perch / Tree Branch (Vertical cylinder to Z=65)
    const perchGeom = new THREE.CylinderGeometry(4.5, 5.0, 65, 16);
    const perchMat = new THREE.MeshStandardMaterial({ color: 0x6e4a2e, roughness: 0.9 });
    const perch = new THREE.Mesh(perchGeom, perchMat);
    perch.position.set(100, 100, 32.5);
    perch.rotation.x = Math.PI / 2;
    perch.castShadow = true;
    perch.receiveShadow = true;
    terrariumGroup.add(perch);

    // Horizontal Twig branch extending from perch
    const twigCurve = new THREE.LineCurve3(new THREE.Vector3(100, 100, 50), new THREE.Vector3(140, 110, 52));
    const twigGeom = new THREE.TubeGeometry(twigCurve, 12, 2.2, 8, false);
    const twigMat = new THREE.MeshStandardMaterial({ color: 0x7d5435, roughness: 0.85 });
    const twig = new THREE.Mesh(twigGeom, twigMat);
    twig.castShadow = true;
    terrariumGroup.add(twig);

    // 4. Elevated Food Pedestal (Z=22)
    const pedGeom = new THREE.CylinderGeometry(15, 16, 22, 24);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
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
      
      // Check fly intersection
      const flyObjects = [];
      for (const [id, flyGroup] of Object.entries(this.flyMeshes)) {
        flyObjects.push(flyGroup.bodyMesh);
      }

      const intersects = this.raycaster.intersectObjects(flyObjects, true);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (hit.userData && hit.userData.flyId) {
          window.dispatchEvent(new CustomEvent('select-fly-3d', { detail: { flyId: hit.userData.flyId } }));
          return;
        }
      }

      // Check floor intersection for dropping food
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const targetPt = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(plane, targetPt)) {
        if (targetPt.x >= 0 && targetPt.x <= 200 && targetPt.y >= 0 && targetPt.y <= 200) {
          window.dispatchEvent(new CustomEvent('floor-click-3d', { detail: { x: targetPt.x, y: targetPt.y, z: 0 } }));
        }
      }
    });
  }

  updateState(state) {
    if (!state) return;

    // 1. Sync Food Objects
    if (state.environment && state.environment.food_patches) {
      this.syncFoodObjects(state.environment.food_patches);
    }

    // 2. Sync 3D Fruit Flies
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
        meshGroup = this.createFoodMesh(fp);
        this.scene.add(meshGroup);
        this.foodMeshes[fp.id] = meshGroup;
      }

      meshGroup.position.set(fp.x, fp.y, fp.z);
      // Scale down when eaten
      const scale = Math.max(0.2, fp.amount / 100.0);
      meshGroup.scale.set(scale, scale, scale);
    });

    // Remove deleted food
    for (const id in this.foodMeshes) {
      if (!activeIds.has(parseInt(id, 10))) {
        this.scene.remove(this.foodMeshes[id]);
        delete this.foodMeshes[id];
      }
    }
  }

  createFoodMesh(fp) {
    const group = new THREE.Group();

    if (fp.type === 'sugar_cube') {
      // Crystalline Translucent Sugar Cube
      const geom = new THREE.BoxGeometry(fp.radius * 1.5, fp.radius * 1.5, fp.height * 2.5);
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 0.85,
        roughness: 0.15,
        emissive: 0x00d2ff,
        emissiveIntensity: 0.2
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = true;
      group.add(mesh);
    } else {
      // Banana Slice or Yeast Drop
      const geom = new THREE.CylinderGeometry(fp.radius, fp.radius * 1.05, fp.height, 24);
      const mat = new THREE.MeshStandardMaterial({
        color: fp.type === 'banana_slice' ? 0xffcc00 : 0xd97706,
        roughness: 0.7,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.25
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.x = Math.PI / 2;
      mesh.castShadow = true;
      group.add(mesh);

      // Golden Yeast Halo / Odor aura
      const haloGeom = new THREE.RingGeometry(fp.radius * 1.1, fp.radius * 2.2, 24);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.22,
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
        flyObj = this.createArticulatedFly(fly);
        this.scene.add(flyObj.root);
        this.flyMeshes[fly.id] = flyObj;
      }

      // Update 3D Coordinates & Orientation
      flyObj.root.position.set(fly.x, fly.y, fly.z);
      flyObj.root.rotation.set(fly.roll, fly.pitch, fly.heading, 'ZYX');

      // Selection Halo
      flyObj.selectionRing.visible = (fly.id === selectedId);

      // Wings Articulation:
      // Left and Right wing independent rotation
      const leftRad = (fly.wing_left_angle * Math.PI) / 180;
      const rightRad = (fly.wing_right_angle * Math.PI) / 180;

      if (fly.is_airborne) {
        // High-frequency flight stroke
        const stroke = Math.sin(fly.wing_stroke_phase) * 0.75;
        flyObj.wingLeft.rotation.z = -0.3 + stroke;
        flyObj.wingRight.rotation.z = 0.3 - stroke;
      } else {
        flyObj.wingLeft.rotation.z = -leftRad;
        flyObj.wingRight.rotation.z = rightRad;
      }

      // Proboscis extension when feeding
      if (fly.proboscis > 0.1) {
        flyObj.proboscis.scale.z = 1.0 + fly.proboscis * 2.2;
        flyObj.proboscis.visible = true;
      } else {
        flyObj.proboscis.visible = false;
      }

      // Tripod Leg Walking Animation (if grounded & moving)
      if (!fly.is_airborne && fly.speed > 1.0) {
        this.animateLegs(flyObj, fly.tripod_phase);
      }

      // DOPAMINE REWARD SURGE: Spawn golden sparks when eating food!
      if (fly.dopamine_surge) {
        this.spawnDopamineRewardParticles(fly.x, fly.y, fly.z);
      }
    });

    // Remove deleted flies
    for (const id in this.flyMeshes) {
      if (!activeIds.has(parseInt(id, 10))) {
        this.scene.remove(this.flyMeshes[id].root);
        delete this.flyMeshes[id];
      }
    }
  }

  createArticulatedFly(fly) {
    const root = new THREE.Group();

    // 1. Thorax (Color coded by archetype)
    const thoraxGeom = new THREE.SphereGeometry(1.6, 16, 16);
    thoraxGeom.scale(1.3, 1.0, 0.9);
    const thoraxMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(fly.color),
      roughness: 0.5,
      metalness: 0.2
    });
    const thorax = new THREE.Mesh(thoraxGeom, thoraxMat);
    thorax.castShadow = true;
    thorax.userData = { flyId: fly.id };
    root.add(thorax);

    // 2. Head & Compound Red Eyes
    const headGeom = new THREE.SphereGeometry(1.1, 14, 14);
    headGeom.scale(0.9, 1.1, 0.95);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.6 });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.set(1.9, 0, 0.2);
    head.userData = { flyId: fly.id };
    root.add(head);

    // Brick-Red Eyes (Left & Right)
    const eyeGeom = new THREE.SphereGeometry(0.55, 12, 12);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xcc1122,
      roughness: 0.2,
      emissive: 0x660000,
      emissiveIntensity: 0.4
    });
    const eyeLeft = new THREE.Mesh(eyeGeom, eyeMat);
    eyeLeft.position.set(1.9, 0.85, 0.35);
    root.add(eyeLeft);

    const eyeRight = new THREE.Mesh(eyeGeom, eyeMat);
    eyeRight.position.set(1.9, -0.85, 0.35);
    root.add(eyeRight);

    // Antennae
    const antGeom = new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6);
    const antMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const antL = new THREE.Mesh(antGeom, antMat);
    antL.position.set(2.7, 0.3, 0.6);
    antL.rotation.z = -0.5;
    root.add(antL);

    const antR = new THREE.Mesh(antGeom, antMat);
    antR.position.set(2.7, -0.3, 0.6);
    antR.rotation.z = -0.5;
    root.add(antR);

    // Proboscis
    const probGeom = new THREE.CylinderGeometry(0.12, 0.2, 1.2, 8);
    const probMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 });
    const proboscis = new THREE.Mesh(probGeom, probMat);
    proboscis.position.set(2.3, 0, -0.7);
    proboscis.rotation.x = Math.PI / 2;
    proboscis.visible = false;
    root.add(proboscis);

    // 3. Abdomen (Segmented, elongated)
    const abdGeom = new THREE.SphereGeometry(2.1, 16, 16);
    abdGeom.scale(1.8, 1.1, 1.0);
    const abdMat = new THREE.MeshStandardMaterial({
      color: fly.gender === 'male' ? 0x231a11 : 0x3d2b1a,
      roughness: 0.65
    });
    const abdomen = new THREE.Mesh(abdGeom, abdMat);
    abdomen.position.set(-2.2, 0, 0);
    root.add(abdomen);

    // 4. Wings (Translucent with biological vein texture)
    const wingGeom = new THREE.PlaneGeometry(5.2, 1.8);
    wingGeom.translate(-2.4, 0, 0); // pivot at base
    const wingMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.55,
      roughness: 0.1,
      transmission: 0.85,
      side: THREE.DoubleSide
    });

    const wingLeft = new THREE.Mesh(wingGeom, wingMat);
    wingLeft.position.set(-0.6, 0.7, 0.85);
    root.add(wingLeft);

    const wingRight = new THREE.Mesh(wingGeom, wingMat.clone());
    wingRight.position.set(-0.6, -0.7, 0.85);
    root.add(wingRight);

    // 5. Six Articulated Legs
    const legs = [];
    const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
    for (let i = 0; i < 6; i++) {
      const legGroup = new THREE.Group();
      const femur = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.8, 6), legMat);
      femur.position.set(0, 0, -0.9);
      legGroup.add(femur);

      const side = (i % 2 === 0) ? 1 : -1;
      const xOffset = (Math.floor(i / 2) - 1) * 1.0;
      legGroup.position.set(xOffset, side * 1.1, -0.4);
      legGroup.rotation.x = side * 0.4;
      root.add(legGroup);
      legs.push(legGroup);
    }

    // Selection Ring
    const ringGeom = new THREE.RingGeometry(3.2, 3.7, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, side: THREE.DoubleSide });
    const selectionRing = new THREE.Mesh(ringGeom, ringMat);
    selectionRing.position.set(0, 0, -0.8);
    selectionRing.visible = false;
    root.add(selectionRing);

    return {
      root,
      bodyMesh: thorax,
      wingLeft,
      wingRight,
      proboscis,
      legs,
      selectionRing
    };
  }

  animateLegs(flyObj, tripodPhase) {
    flyObj.legs.forEach((leg, idx) => {
      const legPhase = tripodPhase + (idx % 2 === 0 ? 0 : Math.PI);
      leg.rotation.z = Math.sin(legPhase) * 0.35;
    });
  }

  spawnDopamineRewardParticles(x, y, z) {
    // Golden sparks radiating upward from food
    for (let i = 0; i < 4; i++) {
      const geom = new THREE.SphereGeometry(0.4, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.95 });
      const p = new THREE.Mesh(geom, mat);
      p.position.set(
        x + (Math.random() - 0.5) * 3,
        y + (Math.random() - 0.5) * 3,
        z + 1.0
      );
      this.scene.add(p);
      this.dopamineParticles.push({
        mesh: p,
        vz: 15.0 + Math.random() * 12.0,
        vx: (Math.random() - 0.5) * 6.0,
        vy: (Math.random() - 0.5) * 6.0,
        life: 25
      });
    }
  }

  render() {
    if (this.controls) this.controls.update();

    // Animate Dopamine Reward Particles
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

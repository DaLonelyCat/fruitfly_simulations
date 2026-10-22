/**
 * 3D Drosophila Behavioral Terrarium (Three.js)
 * Naturalistic Fruit Orchard Vivarium with:
 * - Three-Mode Camera System: Orbit Inspection, Fly Follow Chase Cam, and WASD Freecam.
 * - Naturalistic Vivarium: Loam soil, mossy climbing twigs, fallen orchard leaves, canopy skybox.
 * - High-fidelity 3D food items: Split rotting figs with golden seeds, bruised vineyard grapes, ripe banana slice, crystalline sugar cube.
 * - Authentic Drosophila anatomical modeling + CurlyWing OBJ scan integration.
 * - 3D Hitbox collision wireframes and flight takeoff kinematics.
 */

class Arena3DView {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e171f);

    const w = this.container.clientWidth || 600;
    const h = this.container.clientHeight || 550;

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1200);
    this.camera.position.set(100, -135, 140);
    this.camera.up.set(0, 0, 1);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // OrbitControls
    if (window.THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.target.set(100, 100, 25);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxPolarAngle = Math.PI * 0.485;
      this.controls.minDistance = 12;
      this.controls.maxDistance = 500;
    }

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.flyMeshes = {};
    this.foodMeshes = {};
    this.dopamineParticles = [];
    this.showHitboxes = true;

    // Camera Modes: 'orbit', 'follow', 'wasd'
    this.cameraMode = 'orbit';
    this.selectedFlyId = 1;
    this.keysDown = {};
    this.isMouseDragging = false;
    this.prevMousePos = { x: 0, y: 0 };
    this.freecamYaw = 0.0;
    this.freecamPitch = -0.35;
    this.lastFrameTime = performance.now();

    // CurlyWing High-Poly OBJ Template
    this.curlyWingTemplate = null;
    this.loadCurlyWingModel();

    this.buildNaturalisticSkybox();
    this.initLighting();
    this.buildNaturalisticVivarium();
    this.initEvents();
    this.initKeyboardControls();
    this.initResizeListener();
  }

  loadCurlyWingModel() {
    if (!window.THREE.OBJLoader) return;
    const loader = new THREE.OBJLoader();
    loader.load('/CurlyWing/Curly_Female.obj', (obj) => {
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Target fly body length ~3.6mm
      const maxDim = Math.max(size.x, size.y, size.z);
      const s = 3.6 / maxDim;
      obj.scale.set(s, s, s);
      obj.position.set(-center.x * s, -center.y * s, -center.z * s);

      const wrapper = new THREE.Group();
      wrapper.add(obj);
      // Reorient ZBrush axis so dorsal is +Z and anterior is +X
      wrapper.rotation.x = Math.PI / 2;
      wrapper.rotation.z = Math.PI / 2;

      // Assign realistic chitin & wing materials
      obj.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          const gName = child.name || '';
          if (gName.includes('Group13193')) {
            // Curly Wings
            child.material = new THREE.MeshPhysicalMaterial({
              color: 0xcfd8dc,
              roughness: 0.15,
              transmission: 0.72,
              opacity: 0.82,
              transparent: true,
              side: THREE.DoubleSide
            });
          } else if (gName.includes('Group9153') || gName.includes('Group36462')) {
            // Faceted Eyes & Head
            child.material = new THREE.MeshStandardMaterial({
              color: 0x991b1b,
              roughness: 0.35,
              metalness: 0.15
            });
          } else {
            // Thorax / Abdomen / Legs
            child.material = new THREE.MeshStandardMaterial({
              color: 0xb45309,
              roughness: 0.5,
              metalness: 0.2
            });
          }
        }
      });

      this.curlyWingTemplate = wrapper;
      console.log('CurlyWing 3D Model initialized.');
    }, undefined, (err) => {
      console.warn('CurlyWing OBJ loading note:', err);
    });
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    if (this.controls) {
      this.controls.enabled = (mode === 'orbit');
    }
    // Update active HUD buttons
    ['cam-orbit', 'cam-follow', 'cam-wasd'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
    const activeEl = document.getElementById(`cam-${mode}`);
    if (activeEl) activeEl.classList.add('active');
  }

  buildNaturalisticSkybox() {
    // Natural Organic Orchard Canopy Skybox
    const skyGeom = new THREE.BoxGeometry(800, 800, 500);

    const createCanopyTexture = (faceType) => {
      const cv = document.createElement('canvas');
      cv.width = 512;
      cv.height = 512;
      const ctx = cv.getContext('2d');

      if (faceType === 'top') {
        // Overhead orchard foliage canopy with dappled sunlight
        const grad = ctx.createRadialGradient(256, 256, 30, 256, 256, 320);
        grad.addColorStop(0, '#fef08a');
        grad.addColorStop(0.35, '#84cc16');
        grad.addColorStop(0.75, '#166534');
        grad.addColorStop(1, '#052e16');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);

        // Dappled leaf shadows
        ctx.fillStyle = 'rgba(5, 46, 22, 0.45)';
        for (let i = 0; i < 90; i++) {
          const lx = Math.random() * 512;
          const ly = Math.random() * 512;
          const lr = Math.random() * 35 + 15;
          ctx.beginPath();
          ctx.arc(lx, ly, lr, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (faceType === 'bottom') {
        // Deep forest loam
        ctx.fillStyle = '#1c130d';
        ctx.fillRect(0, 0, 512, 512);
      } else {
        // Horizon: gentle distant orchard trees and soft atmosphere
        const grad = ctx.createLinearGradient(0, 0, 0, 512);
        grad.addColorStop(0, '#14532d');
        grad.addColorStop(0.45, '#1e3a1e');
        grad.addColorStop(0.75, '#2e241c');
        grad.addColorStop(1, '#1c130d');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);

        // Distant fruit tree trunks
        ctx.fillStyle = 'rgba(28, 19, 13, 0.6)';
        for (let i = 0; i < 8; i++) {
          ctx.fillRect(40 + i * 60, 200, 18, 312);
        }
      }

      const tex = new THREE.CanvasTexture(cv);
      return new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
    };

    const mats = [
      createCanopyTexture('side'),
      createCanopyTexture('side'),
      createCanopyTexture('side'),
      createCanopyTexture('side'),
      createCanopyTexture('top'),
      createCanopyTexture('bottom')
    ];

    const skybox = new THREE.Mesh(skyGeom, mats);
    skybox.position.set(100, 100, 100);
    this.scene.add(skybox);
  }

  initLighting() {
    // Ambient light with soft leaf-filtered tone
    const ambient = new THREE.AmbientLight(0xfef9c3, 0.65);
    this.scene.add(ambient);

    // Warm golden sunlight filtered through canopy
    const sunLight = new THREE.DirectionalLight(0xffedd5, 1.15);
    sunLight.position.set(120, 80, 240);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 380;
    sunLight.shadow.camera.left = -120;
    sunLight.shadow.camera.right = 120;
    sunLight.shadow.camera.top = 120;
    sunLight.shadow.camera.bottom = -120;
    this.scene.add(sunLight);

    // Soft sky fill
    const skyFill = new THREE.DirectionalLight(0x86efac, 0.4);
    skyFill.position.set(-80, -60, 150);
    this.scene.add(skyFill);

    // Natural soil warm bounce
    const soilBounce = new THREE.PointLight(0xd97706, 0.45, 220);
    soilBounce.position.set(100, 100, 8);
    this.scene.add(soilBounce);
  }

  createLoamSoilTexture() {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 512;
    const ctx = cv.getContext('2d');

    // Base rich humus loam
    ctx.fillStyle = '#261b14';
    ctx.fillRect(0, 0, 512, 512);

    // Soil granules & earth tonal variations
    for (let i = 0; i < 4500; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = Math.random() * 2.8 + 0.4;
      const tones = ['#1a120c', '#33231a', '#3d2c20', '#4a3627', '#1f2e1a', '#2d3d1e'];
      ctx.fillStyle = tones[Math.floor(Math.random() * tones.length)];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Micro moss specks
    for (let i = 0; i < 800; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.fillStyle = Math.random() > 0.5 ? '#3f6212' : '#4d7c0f';
      ctx.fillRect(x, y, 2.5, 2.5);
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }

  buildNaturalisticVivarium() {
    const vivariumGroup = new THREE.Group();

    // 1. Organic Loam Soil Terrain (200 x 200 mm)
    const floorGeom = new THREE.PlaneGeometry(200, 200, 32, 32);
    // Slight natural terrain micro-undulations
    const posAttr = floorGeom.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const px = posAttr.getX(i);
      const py = posAttr.getY(i);
      const microHeight = Math.sin(px * 0.08) * Math.cos(py * 0.08) * 0.8;
      posAttr.setZ(i, microHeight);
    }
    floorGeom.computeVertexNormals();

    const soilTex = this.createLoamSoilTexture();
    const floorMat = new THREE.MeshStandardMaterial({
      map: soilTex,
      roughness: 0.9,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.position.set(100, 100, 0);
    floor.receiveShadow = true;
    vivariumGroup.add(floor);

    // 2. Clear Naturalistic Enclosure Walls (200 x 200 x 100 mm)
    const boxGeom = new THREE.BoxGeometry(200, 200, 100);
    const wallMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      roughness: 0.04,
      transmission: 0.94,
      ior: 1.5,
      side: THREE.DoubleSide
    });
    const wallBox = new THREE.Mesh(boxGeom, wallMat);
    wallBox.position.set(100, 100, 50);
    vivariumGroup.add(wallBox);

    // Natural wooden corner posts
    const postMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.85 });
    const postCorners = [
      [0, 0], [200, 0], [0, 200], [200, 200]
    ];
    postCorners.forEach(([cx, cy]) => {
      const pGeom = new THREE.CylinderGeometry(1.6, 1.8, 100, 8);
      const post = new THREE.Mesh(pGeom, postMat);
      post.position.set(cx, cy, 50);
      post.rotation.x = Math.PI / 2;
      vivariumGroup.add(post);
    });

    // 3. Mossy Climbing Tree Boughs & Twigs
    // Main curved climbing trunk reaching up to Z=65
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(85, 90, 0),
      new THREE.Vector3(92, 95, 25),
      new THREE.Vector3(100, 100, 48),
      new THREE.Vector3(112, 108, 65)
    ]);
    const trunkGeom = new THREE.TubeGeometry(trunkCurve, 20, 4.2, 12, false);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3d24, roughness: 0.85 });
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    vivariumGroup.add(trunk);

    // Moss clusters on trunk
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.95 });
    for (let m = 0; m < 6; m++) {
      const mGeom = new THREE.SphereGeometry(2.4, 8, 8);
      const moss = new THREE.Mesh(mGeom, mossMat);
      const tPoint = trunkCurve.getPoint(0.2 + m * 0.14);
      moss.position.copy(tPoint).add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 1));
      moss.scale.set(1.4, 1.2, 0.6);
      vivariumGroup.add(moss);
    }

    // Lateral perch branch crossing over to elevated pedestal
    const branchCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(100, 100, 48),
      new THREE.Vector3(125, 85, 42),
      new THREE.Vector3(145, 65, 26)
    ]);
    const branchGeom = new THREE.TubeGeometry(branchCurve, 16, 2.2, 8, false);
    const branch = new THREE.Mesh(branchGeom, trunkMat);
    branch.castShadow = true;
    vivariumGroup.add(branch);

    // 4. Natural Orchard Feeding Rock (Pedestal at Z=22)
    const rockGeom = new THREE.CylinderGeometry(14, 16, 22, 16);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });
    const rock = new THREE.Mesh(rockGeom, rockMat);
    rock.position.set(150, 60, 11);
    rock.rotation.x = Math.PI / 2;
    rock.receiveShadow = true;
    rock.castShadow = true;
    vivariumGroup.add(rock);

    // 5. Fallen Autumn Orchard Leaves scattered on ground
    const leafColors = [0x991b1b, 0xb45309, 0x65a30d, 0x78350f];
    const leafOffsets = [
      [40, 45, 0.2, 0.4], [75, 120, 0.2, -0.6], [160, 130, 0.2, 1.2],
      [120, 40, 0.2, 2.1], [80, 75, 0.2, -1.8], [170, 80, 0.2, 0.9]
    ];
    leafOffsets.forEach(([lx, ly, lz, lRot], i) => {
      const leafGeom = new THREE.ConeGeometry(5.0, 11.0, 4);
      const leafMat = new THREE.MeshStandardMaterial({
        color: leafColors[i % leafColors.length],
        roughness: 0.8,
        side: THREE.DoubleSide
      });
      const leaf = new THREE.Mesh(leafGeom, leafMat);
      leaf.position.set(lx, ly, lz + 0.3);
      leaf.rotation.set(Math.PI / 2 + 0.1, 0, lRot);
      leaf.scale.set(1.0, 0.15, 1.0);
      leaf.receiveShadow = true;
      vivariumGroup.add(leaf);
    });

    this.scene.add(vivariumGroup);
  }

  initKeyboardControls() {
    window.addEventListener('keydown', (e) => {
      this.keysDown[e.code] = true;

      // Hotkey 'C' cycles camera modes
      if (e.code === 'KeyC' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        if (this.cameraMode === 'orbit') this.setCameraMode('follow');
        else if (this.cameraMode === 'follow') this.setCameraMode('wasd');
        else this.setCameraMode('orbit');
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown[e.code] = false;
    });

    // WASD Mouse Drag for pitch and yaw
    this.renderer.domElement.addEventListener('mousedown', (e) => {
      if (this.cameraMode === 'wasd') {
        this.isMouseDragging = true;
        this.prevMousePos = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.cameraMode === 'wasd' && this.isMouseDragging) {
        const dx = e.clientX - this.prevMousePos.x;
        const dy = e.clientY - this.prevMousePos.y;
        this.prevMousePos = { x: e.clientX, y: e.clientY };

        const lookSpeed = 0.0035;
        this.freecamYaw -= dx * lookSpeed;
        this.freecamPitch = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, this.freecamPitch - dy * lookSpeed));

        // Update camera look direction
        const dir = new THREE.Vector3(
          Math.cos(this.freecamPitch) * Math.sin(this.freecamYaw),
          Math.cos(this.freecamPitch) * Math.cos(this.freecamYaw),
          Math.sin(this.freecamPitch)
        );
        const lookTarget = this.camera.position.clone().add(dir);
        this.camera.lookAt(lookTarget);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDragging = false;
    });
  }

  initEvents() {
    this.renderer.domElement.addEventListener('click', (e) => {
      if (this.cameraMode === 'wasd' && this.isMouseDragging) return;

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
          this.selectedFlyId = hit.userData.flyId;
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

    if (state.selected_fly_id) {
      this.selectedFlyId = state.selected_fly_id;
    }

    if (state.environment && state.environment.food_patches) {
      this.syncFoodObjects(state.environment.food_patches);
    }

    if (state.flies) {
      this.syncFlyObjects(state.flies, this.selectedFlyId);
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

      // Chamfered edge highlights
      const edges = new THREE.EdgesGeometry(cubeGeom);
      const edgeLine = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xbae6fd }));
      sugarMesh.add(edgeLine);

      // Sparkling facets
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
    } else if (fp.type === 'rotting_fig') {
      // Split Rotting Fig: Outer dark violet skin, fleshy ruby-pink pulp, golden seeds, yeast bloom
      const skinGeom = new THREE.SphereGeometry(fp.radius, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
      const skinMat = new THREE.MeshStandardMaterial({
        color: 0x3b0764, // deep violet-black
        roughness: 0.65,
        emissive: 0x2e1065,
        emissiveIntensity: 0.15,
        side: THREE.DoubleSide
      });
      const skinMesh = new THREE.Mesh(skinGeom, skinMat);
      skinMesh.rotation.x = Math.PI;
      skinMesh.position.set(0, 0, fp.height * 0.9);
      skinMesh.castShadow = true;
      group.add(skinMesh);

      // Fleshy red-pink core pulp
      const pulpGeom = new THREE.CylinderGeometry(fp.radius * 0.88, fp.radius * 0.35, fp.height * 0.8, 20);
      const pulpMat = new THREE.MeshStandardMaterial({
        color: 0xbe123c, // ruby pulp
        roughness: 0.7,
        emissive: 0x9f1239,
        emissiveIntensity: 0.2
      });
      const pulp = new THREE.Mesh(pulpGeom, pulpMat);
      pulp.rotation.x = Math.PI / 2;
      pulp.position.set(0, 0, fp.height * 0.45);
      group.add(pulp);

      // Golden fig seed specks
      const seedGeom = new THREE.BufferGeometry();
      const sPos = new Float32Array(50 * 3);
      for (let i = 0; i < 50; i++) {
        const theta = Math.random() * Math.PI * 2;
        const rad = Math.sqrt(Math.random()) * fp.radius * 0.75;
        sPos[i * 3] = Math.cos(theta) * rad;
        sPos[i * 3 + 1] = Math.sin(theta) * rad;
        sPos[i * 3 + 2] = fp.height * 0.85 + (Math.random() - 0.5) * 1.0;
      }
      seedGeom.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
      const seedMat = new THREE.PointsMaterial({ size: 1.8, color: 0xfacc15 });
      const seeds = new THREE.Points(seedGeom, seedMat);
      group.add(seeds);

      // Fermenting yeast halo
      const haloGeom = new THREE.RingGeometry(fp.radius * 1.1, fp.radius * 2.1, 24);
      const haloMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
      const halo = new THREE.Mesh(haloGeom, haloMat);
      halo.position.set(0, 0, 0.2);
      group.add(halo);
    } else if (fp.type === 'bruised_grapes') {
      // Cluster of 8 spherical translucent grapes on vine stem
      const grapeMat = new THREE.MeshPhysicalMaterial({
        color: 0x581c87, // violet grape
        roughness: 0.2,
        transmission: 0.75,
        opacity: 0.9,
        ior: 1.45,
        reflectivity: 0.6
      });
      const grapeOffsets = [
        [0, 0, 4.5], [4.5, 2.5, 3.5], [-4.0, 3.0, 3.5], [3.0, -4.0, 3.5],
        [-3.5, -3.5, 3.5], [2.0, 1.5, 8.0], [-2.0, -1.0, 8.0], [0, 2.5, 7.5]
      ];
      grapeOffsets.forEach(([gx, gy, gz]) => {
        const gGeom = new THREE.SphereGeometry(3.6, 16, 16);
        const gMesh = new THREE.Mesh(gGeom, grapeMat);
        gMesh.position.set(gx, gy, gz);
        gMesh.castShadow = true;
        group.add(gMesh);
      });
      // Vine stem
      const stemCurve = new THREE.LineCurve3(new THREE.Vector3(0, 0, 11), new THREE.Vector3(0, 0, 4));
      const stemGeom = new THREE.TubeGeometry(stemCurve, 6, 0.8, 6, false);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.8 });
      const stem = new THREE.Mesh(stemGeom, stemMat);
      group.add(stem);
    } else {
      // Modelled Ripe Banana Slice with Outer Peel and Core with Seeds
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

      const pulpGeom = new THREE.CylinderGeometry(fp.radius * 0.94, fp.radius * 0.94, fp.height * 0.98, 24);
      const pulpMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        roughness: 0.75
      });
      const pulp = new THREE.Mesh(pulpGeom, pulpMat);
      pulp.rotation.x = Math.PI / 2;
      group.add(pulp);

      const seedGeom = new THREE.RingGeometry(fp.radius * 0.15, fp.radius * 0.45, 12);
      const seedMat = new THREE.MeshBasicMaterial({ color: 0x713f12, side: THREE.DoubleSide });
      const seeds = new THREE.Mesh(seedGeom, seedMat);
      seeds.position.set(0, 0, fp.height * 0.51);
      group.add(seeds);
    }

    return group;
  }

  syncFlyObjects(flies, selectedId) {
    const activeIds = new Set();

    flies.forEach(fly => {
      activeIds.add(fly.id);
      let flyObj = this.flyMeshes[fly.id];

      if (!flyObj) {
        flyObj = this.createFlyMesh(fly);
        this.scene.add(flyObj.root);
        this.flyMeshes[fly.id] = flyObj;
      }

      // Update 3D position & smooth orientation
      flyObj.root.position.set(fly.x, fly.y, fly.z);
      flyObj.root.rotation.z = fly.heading;
      flyObj.root.rotation.y = -(fly.pitch || 0);
      flyObj.root.rotation.x = (fly.roll || 0);

      // Selection Ring
      flyObj.selectionRing.visible = (fly.id === selectedId);

      // Hitbox visibility & action highlight
      flyObj.hitboxMesh.visible = this.showHitboxes;
      if (fly.action === 'lunging') {
        flyObj.hitboxMesh.material.color.setHex(0xff5500);
      } else {
        flyObj.hitboxMesh.material.color.setHex(0x00d2ff);
      }

      // Wings & Halteres
      const t = performance.now() * 0.001;
      if (fly.is_airborne || fly.action === 'flying' || fly.action === 'takeoff') {
        const wingFlap = Math.sin(t * 70.0) * 0.65;
        flyObj.wingLeft.rotation.y = wingFlap;
        flyObj.wingRight.rotation.y = -wingFlap;
        if (flyObj.haltereL) flyObj.haltereL.rotation.z = -wingFlap * 0.8;
        if (flyObj.haltereR) flyObj.haltereR.rotation.z = wingFlap * 0.8;
      } else if (fly.action === 'courting') {
        const degToRad = Math.PI / 180;
        flyObj.wingLeft.rotation.z = (fly.wing_left_angle || 12) * degToRad;
        flyObj.wingRight.rotation.z = -(fly.wing_right_angle || 12) * degToRad;
      } else {
        flyObj.wingLeft.rotation.set(0, 0, 12 * Math.PI / 180);
        flyObj.wingRight.rotation.set(0, 0, -12 * Math.PI / 180);
        if (flyObj.haltereL) flyObj.haltereL.rotation.set(0, 0, 0);
        if (flyObj.haltereR) flyObj.haltereR.rotation.set(0, 0, 0);
      }

      // Legs walking tripod gait
      if (fly.is_walking) {
        const walkPhase = t * 18.0;
        flyObj.legs.forEach((legGroup, idx) => {
          const side = (idx % 2 === 0) ? 1 : -1;
          const tripodPhase = (idx % 2 === 0) ? walkPhase : walkPhase + Math.PI;
          legGroup.rotation.y = Math.sin(tripodPhase) * 0.28 * side;
        });
      }

      // Dopamine surge particles
      if (fly.dopamine_surge) {
        this.emitDopamineSurge(fly.x, fly.y, fly.z);
      }
    });

    for (const id in this.flyMeshes) {
      if (!activeIds.has(parseInt(id, 10))) {
        this.scene.remove(this.flyMeshes[id].root);
        delete this.flyMeshes[id];
      }
    }
  }

  createFlyMesh(fly) {
    const root = new THREE.Group();
    root.userData = { flyId: fly.id };

    // 1. 3D Collision Hitbox (Capsule: radius 1.8mm, total length 3.6mm)
    const hbGeom = new THREE.CylinderGeometry(1.8, 1.8, 2.0, 12, 1, false);
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

    // Check if Curly archetype and high-poly model loaded
    if (this.curlyWingTemplate && fly.archetype === 'Curly') {
      const curlyClone = this.curlyWingTemplate.clone(true);
      root.add(curlyClone);

      const selGeom = new THREE.RingGeometry(2.4, 2.8, 24);
      const selMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
      const selectionRing = new THREE.Mesh(selGeom, selMat);
      selectionRing.position.set(0, 0, 0.1);
      root.add(selectionRing);

      return {
        root,
        bodyMesh: curlyClone,
        hitboxMesh,
        wingLeft: new THREE.Group(),
        wingRight: new THREE.Group(),
        haltereL: new THREE.Group(),
        haltereR: new THREE.Group(),
        legs: [],
        selectionRing
      };
    }

    // Standard High-Fidelity Procedural Drosophila Anatomy
    const flyColor = new THREE.Color(fly.color || 0xca8a04);
    const darkChitin = new THREE.Color(0x3e2723);

    // Thorax: Scutum
    const scutumGeom = new THREE.SphereGeometry(1.3, 16, 14);
    scutumGeom.scale(1.2, 0.95, 0.9);
    const scutumMat = new THREE.MeshStandardMaterial({ color: flyColor, roughness: 0.45, metalness: 0.25 });
    const scutum = new THREE.Mesh(scutumGeom, scutumMat);
    scutum.castShadow = true;
    scutum.userData = { flyId: fly.id };
    root.add(scutum);

    // Scutellum
    const scutGeom = new THREE.ConeGeometry(0.7, 0.9, 12);
    scutGeom.rotateX(-Math.PI / 2);
    const scutMesh = new THREE.Mesh(scutGeom, scutumMat);
    scutMesh.position.set(-1.1, 0, 0.2);
    root.add(scutMesh);

    // Head
    const headGeom = new THREE.SphereGeometry(0.9, 14, 14);
    headGeom.scale(0.85, 1.1, 0.9);
    const headMat = new THREE.MeshStandardMaterial({ color: darkChitin, roughness: 0.5 });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.set(1.4, 0, 0.1);
    head.castShadow = true;
    root.add(head);

    // Compound Eyes (Deep faceted red)
    const eyeGeom = new THREE.SphereGeometry(0.55, 14, 14);
    eyeGeom.scale(0.7, 1.0, 1.2);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.25, metalness: 0.3 });
    const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
    eyeL.position.set(1.45, 0.72, 0.2);
    root.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeom, eyeMat);
    eyeR.position.set(1.45, -0.72, 0.2);
    root.add(eyeR);

    // Arista Antennae
    const aristaGeom = new THREE.CylinderGeometry(0.04, 0.08, 0.9, 6);
    const aristaMat = new THREE.MeshBasicMaterial({ color: 0x1c1917 });
    const antL = new THREE.Mesh(aristaGeom, aristaMat);
    antL.position.set(2.0, 0.35, 0.5);
    antL.rotation.set(0.3, 0.4, 0.2);
    root.add(antL);

    const antR = new THREE.Mesh(aristaGeom, aristaMat);
    antR.position.set(2.0, -0.35, 0.5);
    antR.rotation.set(-0.3, 0.4, -0.2);
    root.add(antR);

    // Abdomen
    const abdGeom = new THREE.SphereGeometry(1.6, 16, 14);
    abdGeom.scale(1.4, 0.85, 0.8);
    const abdMat = new THREE.MeshStandardMaterial({ color: darkChitin, roughness: 0.6 });
    const abdomen = new THREE.Mesh(abdGeom, abdMat);
    abdomen.position.set(-2.2, 0, -0.1);
    abdomen.castShadow = true;
    root.add(abdomen);

    // Wings
    const wingGeom = new THREE.PlaneGeometry(3.6, 1.3, 6, 2);
    wingGeom.translate(1.8, 0, 0);
    const wingMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.55,
      roughness: 0.15,
      transmission: 0.8,
      side: THREE.DoubleSide
    });

    const wingLeft = new THREE.Mesh(wingGeom, wingMat);
    wingLeft.position.set(0.1, 0.55, 0.65);
    wingLeft.rotation.set(0, 0, 12 * Math.PI / 180);
    root.add(wingLeft);

    const wingRight = new THREE.Mesh(wingGeom, wingMat);
    wingRight.position.set(0.1, -0.55, 0.65);
    wingRight.rotation.set(0, 0, -12 * Math.PI / 180);
    root.add(wingRight);

    // Halteres
    const haltereGeom = new THREE.CylinderGeometry(0.06, 0.08, 0.8, 6);
    const knobGeom = new THREE.SphereGeometry(0.2, 8, 8);
    const haltereMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.5 });

    const haltereL = new THREE.Group();
    const stemL = new THREE.Mesh(haltereGeom, haltereMat);
    stemL.position.y = 0.4;
    haltereL.add(stemL);
    const knobL = new THREE.Mesh(knobGeom, haltereMat);
    knobL.position.y = 0.8;
    haltereL.add(knobL);
    haltereL.position.set(-0.8, 0.65, 0.1);
    root.add(haltereL);

    const haltereR = new THREE.Group();
    const stemR = new THREE.Mesh(haltereGeom, haltereMat);
    stemR.position.y = -0.4;
    haltereR.add(stemR);
    const knobR = new THREE.Mesh(knobGeom, haltereMat);
    knobR.position.y = -0.8;
    haltereR.add(knobR);
    haltereR.position.set(-0.8, -0.65, 0.1);
    root.add(haltereR);

    // 6 Articulated 5-Segment Legs
    const legs = [];
    const legOffsets = [
      { x: 0.8, y: 0.65, name: 'fore_L' },
      { x: 0.8, y: -0.65, name: 'fore_R' },
      { x: 0.0, y: 0.75, name: 'mid_L' },
      { x: 0.0, y: -0.75, name: 'mid_R' },
      { x: -0.8, y: 0.65, name: 'hind_L' },
      { x: -0.8, y: -0.65, name: 'hind_R' }
    ];

    const legMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 });

    legOffsets.forEach((pos, idx) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(pos.x, pos.y, -0.3);

      const side = (idx % 2 === 0) ? 1 : -1;
      const femurGeom = new THREE.CylinderGeometry(0.12, 0.14, 1.4, 6);
      const femur = new THREE.Mesh(femurGeom, legMat);
      femur.position.set(0, side * 0.7, -0.2);
      femur.rotation.x = side * 0.4;
      legGroup.add(femur);

      const tibiaGeom = new THREE.CylinderGeometry(0.08, 0.1, 1.6, 6);
      const tibia = new THREE.Mesh(tibiaGeom, legMat);
      tibia.position.set(0, side * 1.5, -0.9);
      tibia.rotation.x = side * 0.9;
      legGroup.add(tibia);

      root.add(legGroup);
      legs.push(legGroup);
    });

    // Selection Halo
    const selGeom = new THREE.RingGeometry(2.4, 2.8, 24);
    const selMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const selectionRing = new THREE.Mesh(selGeom, selMat);
    selectionRing.position.set(0, 0, 0.1);
    root.add(selectionRing);

    return {
      root,
      bodyMesh: scutum,
      hitboxMesh,
      wingLeft,
      wingRight,
      haltereL,
      haltereR,
      legs,
      selectionRing
    };
  }

  emitDopamineSurge(x, y, z) {
    for (let i = 0; i < 4; i++) {
      const pGeom = new THREE.SphereGeometry(0.45, 8, 8);
      const pMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.9 });
      const p = new THREE.Mesh(pGeom, pMat);
      p.position.set(
        x + (Math.random() - 0.5) * 1.5,
        y + (Math.random() - 0.5) * 1.5,
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

  updateCamera(dt) {
    if (this.cameraMode === 'follow') {
      const selFlyObj = this.flyMeshes[this.selectedFlyId];
      if (selFlyObj) {
        const flyPos = selFlyObj.root.position;
        const flyHeading = selFlyObj.root.rotation.z;

        // Chase camera 22mm behind and 10mm above the fly
        const distBehind = 24.0;
        const heightAbove = 11.0;

        const targetCamPos = new THREE.Vector3(
          flyPos.x - Math.cos(flyHeading) * distBehind,
          flyPos.y - Math.sin(flyHeading) * distBehind,
          flyPos.z + heightAbove
        );

        this.camera.position.lerp(targetCamPos, 0.08);

        const lookTarget = new THREE.Vector3(
          flyPos.x + Math.cos(flyHeading) * 8.0,
          flyPos.y + Math.sin(flyHeading) * 8.0,
          flyPos.z + 2.0
        );
        this.camera.lookAt(lookTarget);
      }
    } else if (this.cameraMode === 'wasd') {
      const speed = (this.keysDown['ShiftLeft'] || this.keysDown['ShiftRight'] ? 65.0 : 35.0) * dt;

      // Compute forward vector from camera orientation
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      forward.z = 0; // maintain horizontal strafe
      forward.normalize();

      const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();

      if (this.keysDown['KeyW']) this.camera.position.addScaledVector(forward, speed);
      if (this.keysDown['KeyS']) this.camera.position.addScaledVector(forward, -speed);
      if (this.keysDown['KeyA']) this.camera.position.addScaledVector(right, -speed);
      if (this.keysDown['KeyD']) this.camera.position.addScaledVector(right, speed);
      if (this.keysDown['Space'] || this.keysDown['KeyE']) this.camera.position.z += speed;
      if (this.keysDown['KeyQ']) this.camera.position.z -= speed;

      // Bound within enclosure vicinity
      this.camera.position.x = Math.max(-60, Math.min(260, this.camera.position.x));
      this.camera.position.y = Math.max(-60, Math.min(260, this.camera.position.y));
      this.camera.position.z = Math.max(5, Math.min(280, this.camera.position.z));
    } else {
      if (this.controls) this.controls.update();
    }
  }

  render() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrameTime) * 0.001);
    this.lastFrameTime = now;

    this.updateCamera(dt);

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

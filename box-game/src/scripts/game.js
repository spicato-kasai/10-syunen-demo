class BoxGame {
	constructor(boxId, floorId) {
		this.boxElement = document.getElementById(boxId);
		this.floorElement = document.getElementById(floorId);
		this.clearElement = document.querySelector(".clear");

		this.stones = [];
		this.staticBodies = [];
		this.totalStones = 10;

		this.draggingStone = null;
		this.offsetX = 0;
		this.offsetY = 0;
		this.lastFrameTime = performance.now();

		this.physicsWorld = null;
		this.ammo = null;
		this.tmpTransform = null;
		this.dragTransform = null;

		this.gravity = 1800;
		this.restitution = 0.35;
		this.friction = 0.65;

		if (!this.boxElement || !this.floorElement) return;
		this.initializeGame();
	}

	async initializeGame() {
		await this.initializePhysics();
		this.createStones();
		this.createBounds();
		this.setupDragEvents();
		window.addEventListener("resize", () => this.createBounds());
		this.startPhysicsLoop();
	}

	async initializePhysics() {
		this.ammo = await this.loadAmmo();

		const collisionConfig = new this.ammo.btDefaultCollisionConfiguration();
		const dispatcher = new this.ammo.btCollisionDispatcher(collisionConfig);
		const broadphase = new this.ammo.btDbvtBroadphase();
		const solver = new this.ammo.btSequentialImpulseConstraintSolver();

		this.physicsWorld = new this.ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfig);
		this.physicsWorld.setGravity(new this.ammo.btVector3(0, this.gravity, 0));

		this.tmpTransform = new this.ammo.btTransform();
		this.dragTransform = new this.ammo.btTransform();
	}

	loadAmmo() {
		const ensureAmmo = () => {
			if (!window.Ammo) return Promise.reject(new Error("Ammo.js の読み込みに失敗しました"));
			if (typeof window.Ammo === "function") {
				return window.Ammo().then((ammoLib) => {
					window.Ammo = ammoLib;
					return ammoLib;
				});
			}
			return Promise.resolve(window.Ammo);
		};

		if (window.Ammo) {
			return ensureAmmo();
		}

		return new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = "https://cdn.jsdelivr.net/npm/ammo.js@0.0.10/ammo.js";
			script.async = true;
			script.onload = () => ensureAmmo().then(resolve).catch(reject);
			script.onerror = () => reject(new Error("Ammo.js の読み込みに失敗しました"));
			document.head.appendChild(script);
		});
	}

	createStones() {
		const floorRect = this.floorElement.getBoundingClientRect();

		for (let i = 0; i < this.totalStones; i++) {
			const stone = document.createElement("div");
			stone.classList.add("stone");
			stone.innerHTML = `
				<span class="stone-face">
					<span class="stone-eyes">
						<span class="eye"></span>
						<span class="eye"></span>
					</span>
					<span class="stone-mouth"></span>
				</span>
			`;

			const x = Math.random() * (window.innerWidth - 80);
			const y = floorRect.top + Math.random() * Math.max(1, floorRect.height - 80);

			stone.style.left = `${x}px`;
			stone.style.top = `${y}px`;

			document.body.appendChild(stone);

			const body = this.createStoneBody(stone, x, y);
			this.stones.push({ el: stone, body });
		}
	}

	createStoneBody(stone, x, y) {
		const radius = (stone.offsetWidth || 150) / 2;
		const mass = 1;

		const shape = new this.ammo.btSphereShape(radius);
		shape.setMargin(0.05);

		const transform = new this.ammo.btTransform();
		transform.setIdentity();
		transform.setOrigin(new this.ammo.btVector3(x + radius, y + radius, 0));

		const motionState = new this.ammo.btDefaultMotionState(transform);
		const localInertia = new this.ammo.btVector3(0, 0, 0);
		shape.calculateLocalInertia(mass, localInertia);

		const rbInfo = new this.ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
		const body = new this.ammo.btRigidBody(rbInfo);
		body.setFriction(this.friction);
		body.setRestitution(this.restitution);
		body.setDamping(0.08, 0.8);
		body.setLinearFactor(new this.ammo.btVector3(1, 1, 0));
		body.setAngularFactor(new this.ammo.btVector3(0, 0, 1));

		this.physicsWorld.addRigidBody(body);
		stone._physicsBody = body;

		return body;
	}

	createBounds() {
		if (!this.physicsWorld) return;

		this.staticBodies.forEach((body) => this.physicsWorld.removeRigidBody(body));
		this.staticBodies = [];

		const wallThickness = 30;
		const depth = 50;
		const screenW = window.innerWidth;
		const screenH = window.innerHeight;

		this.addStaticBox(screenW / 2, wallThickness / 2, depth / 2, screenW / 2, -wallThickness / 2, 0);
		this.addStaticBox(screenW / 2, wallThickness / 2, depth / 2, screenW / 2, screenH + wallThickness / 2, 0);
		this.addStaticBox(wallThickness / 2, screenH / 2, depth / 2, -wallThickness / 2, screenH / 2, 0);
		this.addStaticBox(wallThickness / 2, screenH / 2, depth / 2, screenW + wallThickness / 2, screenH / 2, 0);

		const boxRect = this.boxElement.getBoundingClientRect();
		this.addStaticBox(wallThickness / 2, boxRect.height / 2, depth / 2, boxRect.left, boxRect.top + boxRect.height / 2, 0);
		this.addStaticBox(wallThickness / 2, boxRect.height / 2, depth / 2, boxRect.right, boxRect.top + boxRect.height / 2, 0);
		this.addStaticBox(boxRect.width / 2, wallThickness / 2, depth / 2, boxRect.left + boxRect.width / 2, boxRect.bottom, 0);
	}

	addStaticBox(halfX, halfY, halfZ, centerX, centerY, centerZ) {
		const shape = new this.ammo.btBoxShape(new this.ammo.btVector3(halfX, halfY, halfZ));
		const transform = new this.ammo.btTransform();
		transform.setIdentity();
		transform.setOrigin(new this.ammo.btVector3(centerX, centerY, centerZ));

		const motionState = new this.ammo.btDefaultMotionState(transform);
		const rbInfo = new this.ammo.btRigidBodyConstructionInfo(0, motionState, shape, new this.ammo.btVector3(0, 0, 0));
		const body = new this.ammo.btRigidBody(rbInfo);
		body.setRestitution(0.3);
		body.setFriction(0.8);

		this.physicsWorld.addRigidBody(body);
		this.staticBodies.push(body);
	}

	setupDragEvents() {
		document.addEventListener("mousedown", (e) => {
			const stoneElement = e.target.closest(".stone");
			if (!stoneElement) return;

			const stoneData = this.stones.find((s) => s.el === stoneElement);
			if (!stoneData) return;

			this.draggingStone = stoneData;
			const body = stoneData.body;
			body.setLinearVelocity(new this.ammo.btVector3(0, 0, 0));
			body.setAngularVelocity(new this.ammo.btVector3(0, 0, 0));
			body.setCollisionFlags(body.getCollisionFlags() | 2);
			body.setActivationState(4);

			this.offsetX = e.clientX - parseFloat(stoneData.el.style.left);
			this.offsetY = e.clientY - parseFloat(stoneData.el.style.top);
			stoneData.el.style.zIndex = "100";
			stoneData.el.classList.add("is-dragging");
		});

		document.addEventListener("mousemove", (e) => {
			if (!this.draggingStone) return;

			const x = e.clientX - this.offsetX;
			const y = e.clientY - this.offsetY;
			const stoneSize = this.draggingStone.el.offsetWidth || 150;
			const centerX = x + stoneSize / 2;
			const centerY = y + stoneSize / 2;

			this.draggingStone.el.style.left = `${x}px`;
			this.draggingStone.el.style.top = `${y}px`;

			this.dragTransform.setIdentity();
			this.dragTransform.setOrigin(new this.ammo.btVector3(centerX, centerY, 0));
			this.draggingStone.body.setWorldTransform(this.dragTransform);
			this.draggingStone.body.getMotionState().setWorldTransform(this.dragTransform);
		});

		document.addEventListener("mouseup", () => {
			if (!this.draggingStone) return;

			const body = this.draggingStone.body;
			body.setCollisionFlags(body.getCollisionFlags() & ~2);
			body.setActivationState(1);

			this.draggingStone.el.style.zIndex = "10";
			this.draggingStone.el.classList.remove("is-dragging");
			this.updateClearState();
			this.draggingStone = null;
		});
	}

	updateClearState() {
		const boxRect = this.boxElement.getBoundingClientRect();

		const inCount = this.stones.reduce((count, stone) => {
			const stoneRect = stone.el.getBoundingClientRect();
			const centerX = stoneRect.left + stoneRect.width / 2;
			const centerY = stoneRect.top + stoneRect.height / 2;
			const inside = centerX >= boxRect.left && centerX <= boxRect.right && centerY >= boxRect.top && centerY <= boxRect.bottom;

			stone.el.classList.toggle("in-box", inside);
			return inside ? count + 1 : count;
		}, 0);

		if (inCount === this.totalStones) {
			this.showClear();
		} else if (this.clearElement) {
			this.clearElement.style.display = "none";
		}
	}

	startPhysicsLoop() {
		const loop = () => {
			if (!this.physicsWorld) {
				requestAnimationFrame(loop);
				return;
			}

			const now = performance.now();
			const dt = Math.min(1 / 30, (now - this.lastFrameTime) / 1000);
			this.lastFrameTime = now;

			this.physicsWorld.stepSimulation(dt, 10);

			this.stones.forEach((stone) => {
				if (this.draggingStone && this.draggingStone.el === stone.el) return;

				const motionState = stone.body.getMotionState();
				if (!motionState) return;

				motionState.getWorldTransform(this.tmpTransform);
				const origin = this.tmpTransform.getOrigin();
				const stoneSize = stone.el.offsetWidth || 150;
				const x = origin.x() - stoneSize / 2;
				const y = origin.y() - stoneSize / 2;

				stone.el.style.left = `${x}px`;
				stone.el.style.top = `${y}px`;
			});

			this.updateClearState();

			requestAnimationFrame(loop);
		};

		requestAnimationFrame(loop);
	}

	showClear() {
		if (this.clearElement) {
			this.clearElement.style.display = "block";
		}
	}
}

document.addEventListener("DOMContentLoaded", () => {
	new BoxGame("box", "floor");
});

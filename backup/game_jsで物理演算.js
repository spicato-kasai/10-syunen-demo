class BoxGame {
	constructor(boxId, floorId) {
		this.boxElement = document.getElementById(boxId);
		this.floorElement = document.getElementById(floorId);
		this.clearElement = document.querySelector(".clear");

		this.stonesInBox = [];
		this.totalStones = 10;

		this.draggingStone = null;
		this.offsetX = 0;
		this.offsetY = 0;

		this.gravity = 0.5;
		this.friction = 0.4;

		if (!this.boxElement || !this.floorElement) return;
		this.initializeGame();
	}

	initializeGame() {
		this.createStones();
		this.setupDragEvents();
		this.startPhysicsLoop();
	}

	createStones() {
		const floorRect = this.floorElement.getBoundingClientRect();

		for (let i = 0; i < this.totalStones; i++) {
			const stone = document.createElement("div");
			stone.classList.add("stone");

			const x = Math.random() * (window.innerWidth - 80);
			const y = floorRect.top + Math.random() * Math.max(1, floorRect.height - 80);

			stone.style.left = `${x}px`;
			stone.style.top = `${y}px`;

			document.body.appendChild(stone);
		}
	}

	setupDragEvents() {
		document.addEventListener("mousedown", (e) => {
			if (!e.target.classList.contains("stone")) return;

			this.draggingStone = e.target;

			// 物理演算中の石を掴んだら停止
			const existing = this.stonesInBox.find((s) => s.el === this.draggingStone);
			if (existing) {
				existing.vx = 0;
				existing.vy = 0;
				existing.active = false;
			}

			// 箱内から掴んだ場合はbody座標へ戻す
			if (this.draggingStone.parentElement !== document.body) {
				const boxRect = this.boxElement.getBoundingClientRect();
				const stoneLeft = parseFloat(this.draggingStone.style.left);
				const stoneTop = parseFloat(this.draggingStone.style.top);

				this.draggingStone.style.left = `${stoneLeft + boxRect.left}px`;
				this.draggingStone.style.top = `${stoneTop + boxRect.top}px`;

				document.body.appendChild(this.draggingStone);
				this.draggingStone.classList.remove("in-box");
			}

			this.offsetX = e.clientX - parseFloat(this.draggingStone.style.left);
			this.offsetY = e.clientY - parseFloat(this.draggingStone.style.top);
			this.draggingStone.style.zIndex = "100";
		});

		document.addEventListener("mousemove", (e) => {
			if (!this.draggingStone) return;

			this.draggingStone.style.left = `${e.clientX - this.offsetX}px`;
			this.draggingStone.style.top = `${e.clientY - this.offsetY}px`;
		});

		document.addEventListener("mouseup", () => {
			if (!this.draggingStone) return;

			this.checkDropInBox(this.draggingStone);
			this.draggingStone.style.zIndex = "10";
			this.draggingStone = null;
		});
	}

	checkDropInBox(stone) {
		const boxRect = this.boxElement.getBoundingClientRect();
		const stoneRect = stone.getBoundingClientRect();

		// 小石の中心が箱の中にあるか判定
		const stoneCenterX = stoneRect.left + stoneRect.width / 2;
		const stoneCenterY = stoneRect.top + stoneRect.height / 2;

		const insideBox = stoneCenterX >= boxRect.left && stoneCenterX <= boxRect.right && stoneCenterY >= boxRect.top && stoneCenterY <= boxRect.bottom;

		if (!insideBox) return;

		const relX = stoneRect.left - boxRect.left;
		const relY = Math.max(0, stoneRect.top - boxRect.top);

		stone.style.left = `${relX}px`;
		stone.style.top = `${relY}px`;
		stone.classList.add("in-box");
		this.boxElement.appendChild(stone);

		const existing = this.stonesInBox.find((s) => s.el === stone);
		if (!existing) {
			this.stonesInBox.push({ el: stone, vx: 0, vy: 0, active: true });
			if (this.stonesInBox.length === this.totalStones) this.showClear();
		} else {
			existing.active = true;
			existing.vx = 0;
			existing.vy = 0;
		}
	}

	startPhysicsLoop() {
		const loop = () => {
			const boxW = this.boxElement.clientWidth;
			const boxH = this.boxElement.clientHeight;

			this.stonesInBox.forEach((s) => {
				if (!s.active) return;

				const stoneSize = s.el.offsetWidth || 30;
				let x = parseFloat(s.el.style.left);
				let y = parseFloat(s.el.style.top);

				s.vy += this.gravity;
				x += s.vx;
				y += s.vy;

				// 底
				if (y + stoneSize >= boxH) {
					y = boxH - stoneSize;
					s.vy *= -this.friction;
					s.vx *= 0.9;

					if (Math.abs(s.vy) < 0.5) s.vy = 0;
					if (Math.abs(s.vx) < 0.1) s.vx = 0;
				}

				// 左右壁
				if (x <= 0) {
					x = 0;
					s.vx *= -this.friction;
				}
				if (x + stoneSize >= boxW) {
					x = boxW - stoneSize;
					s.vx *= -this.friction;
				}

				// 天井
				if (y <= 0) {
					y = 0;
					s.vy *= -this.friction;
				}

				// 石同士の衝突
				this.stonesInBox.forEach((other) => {
					if (other === s) return;

					const oSize = other.el.offsetWidth || 30;
					const ox = parseFloat(other.el.style.left);
					const oy = parseFloat(other.el.style.top);

					const dx = x + stoneSize / 2 - (ox + oSize / 2);
					const dy = y + stoneSize / 2 - (oy + oSize / 2);
					const dist = Math.hypot(dx, dy);
					const minDist = (stoneSize + oSize) / 2;

					if (dist > 0 && dist < minDist) {
						const angle = Math.atan2(dy, dx);
						const overlap = minDist - dist;

						x += Math.cos(angle) * (overlap / 2);
						y += Math.sin(angle) * (overlap / 2);

						const speed = Math.hypot(s.vx, s.vy);
						s.vx = Math.cos(angle) * speed * 0.5;
						s.vy = Math.sin(angle) * speed * 0.5;
					}
				});

				if (s.vy === 0 && s.vx === 0 && y + stoneSize >= boxH) {
					s.active = false;
				}

				s.el.style.left = `${x}px`;
				s.el.style.top = `${y}px`;
			});

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

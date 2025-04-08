// player.js (Refactored Internally - Increased Air Control)
import * as THREE from 'three';
import {
    GRAVITY, MOVE_SPEED, JUMP_FORCE, ATTACK_DAMAGE, BASE_KNOCKBACK,
    KNOCKBACK_SCALING, ATTACK_RATE, ATTACK_DURATION, HITBOX_WIDTH, HITBOX_HEIGHT,
    HITBOX_OFFSET_X, KNOCKBACK_CONTROL_LOCKOUT_DURATION, AIR_FRICTION, MAX_AIR_SPEED
} from './config.js';

export class Player {
    constructor(scene, startPos, color, controls, isPlayer1, hudP1, hudP2) {
        this.scene = scene;
        this.controls = controls;
        this.isPlayer1 = isPlayer1;
        this.color = color;
        this.hudP1 = hudP1;
        this.hudP2 = hudP2;

        const geometry = new THREE.BoxGeometry(0.8, 1.5, 0.5);
        const material = new THREE.MeshLambertMaterial({ color: this.color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(startPos);
        this.mesh.userData.player = this;
        this.scene.add(this.mesh);

        this.velocity = new THREE.Vector2(0, 0);
        this.isOnGround = false;
        this.damagePercent = 0;
        this.facingRight = true;
        this.isKnockedBack = false;
        this.knockbackTimer = 0;
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.attackBox = new THREE.Box3();
        this.hurtBox = new THREE.Box3();
        this.attackVisualMesh = null;
        this.attackVisualMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
        this.attackVisualGeometry = new THREE.BoxGeometry(HITBOX_WIDTH, HITBOX_HEIGHT, 0.1);
    }

    // --- Main Update Method ---
    update(deltaTime, inputHandler, platforms, otherPlayer) {
        const moveInput = this.handleInput(inputHandler);
        this.updateState(deltaTime);
        this.updateMovement(deltaTime, moveInput);
        this.applyVelocityAndCollisions(deltaTime, platforms);
        this.updateAttack(deltaTime, inputHandler, otherPlayer);
        this.updateHurtbox();
        this.checkBoundaries(platforms);
        this.updateHUD();
    }

    // --- Input Handling ---
    handleInput(inputHandler) {
        let moveInput = 0;
        if (inputHandler.isDown(this.controls.left)) moveInput = -1;
        if (inputHandler.isDown(this.controls.right)) moveInput = 1;
        return moveInput;
    }

    // --- State Updates (Knockback Timer, etc.) ---
    updateState(deltaTime) {
        if (this.isKnockedBack) {
            this.knockbackTimer -= deltaTime;
            if (this.knockbackTimer <= 0) {
                this.isKnockedBack = false;
            }
        }
    }

    // --- Movement Logic (Velocity Calculation) ---
    updateMovement(deltaTime, moveInput) {
        // Apply Gravity
        this.velocity.y -= GRAVITY * deltaTime;

        // Ground Movement Logic
        if (this.isOnGround) {
            if (moveInput !== 0) {
                this.velocity.x = moveInput * MOVE_SPEED;
                this.facingRight = moveInput > 0;
            } else if (!this.isKnockedBack) {
                this.velocity.x = 0;
            }
            if (this.isKnockedBack) { // Friction during knockback recovery on ground
                this.velocity.x *= AIR_FRICTION;
            }
        }
        // Air Movement Logic
        else {
            // Apply air friction first
            if (!this.isKnockedBack) {
                 this.velocity.x *= AIR_FRICTION;
            } else {
                 this.velocity.x *= AIR_FRICTION; // Friction during knockback
                 if (moveInput !== 0) { // Directional Influence (DI) during knockback
                      this.velocity.x += moveInput * MOVE_SPEED * 0.02;
                 }
            }
            // Apply air control acceleration
            if (!this.isKnockedBack && moveInput !== 0) {
                // *** INCREASED THIS VALUE FOR MORE AIR CONTROL ***
                const airControlFactor = 0.28; // (Was 0.08) Try tuning this (e.g., 0.1, 0.12, 0.15, 0.2)
                this.velocity.x += moveInput * MOVE_SPEED * airControlFactor;
                this.facingRight = moveInput > 0;
            }
        }

        // Stop drifting if velocity is very low
         if (Math.abs(this.velocity.x) < 0.1 && moveInput === 0 && !this.isKnockedBack) {
             this.velocity.x = 0;
         }

        // Clamp Horizontal Velocity (applied AFTER calculating changes)
        this.velocity.x = Math.max(-MAX_AIR_SPEED, Math.min(MAX_AIR_SPEED, this.velocity.x));
    }

    // --- Position Update & Collision Handling ---
    applyVelocityAndCollisions(deltaTime, platforms) {
        // --- Horizontal Movement & Collision ---
        this.mesh.position.x += this.velocity.x * deltaTime;
        platforms.forEach(platform => {
            const pBox = platform.userData.box;
            const playerBox = new THREE.Box3().setFromObject(this.mesh);

            if (playerBox.intersectsBox(pBox)) {
                const overlapX = Math.min(playerBox.max.x, pBox.max.x) - Math.max(playerBox.min.x, pBox.min.x);
                const overlapY = Math.min(playerBox.max.y, pBox.max.y) - Math.max(playerBox.min.y, pBox.min.y);

                 if (overlapY > overlapX && overlapX > 0.001) {
                    if (this.velocity.x > 0) this.mesh.position.x -= overlapX;
                    else if (this.velocity.x < 0) this.mesh.position.x += overlapX;
                    this.velocity.x = 0;
                 }
             }
        });

        // --- Vertical Movement & Collision ---
        this.mesh.position.y += this.velocity.y * deltaTime;
        let landedThisFrame = false;

        platforms.forEach(platform => {
            const pBox = platform.userData.box;
            const playerBox = new THREE.Box3().setFromObject(this.mesh); // Update player box after Y move

            if (playerBox.intersectsBox(pBox)) {
                 const overlapX = Math.min(playerBox.max.x, pBox.max.x) - Math.max(playerBox.min.x, pBox.min.x);
                 const overlapY = Math.min(playerBox.max.y, pBox.max.y) - Math.max(playerBox.min.y, pBox.min.y);
                 const minHorizontalOverlapForVertical = this.mesh.geometry.parameters.width * 0.2;

                if (overlapX >= minHorizontalOverlapForVertical && overlapY > 0.001) {
                     if (this.velocity.y <= 0) { // Potentially landing
                        const previousBottomY = (this.mesh.position.y - (this.velocity.y * deltaTime)) - (this.mesh.geometry.parameters.height / 2);
                        if (previousBottomY >= pBox.max.y - 0.01) {
                             this.mesh.position.y += overlapY;
                             if (this.velocity.y < 0) this.velocity.y = 0;
                             landedThisFrame = true;
                        }
                    } else { // Potentially hitting head
                         const previousTopY = (this.mesh.position.y - (this.velocity.y * deltaTime)) + (this.mesh.geometry.parameters.height / 2);
                          if (previousTopY <= pBox.min.y + 0.01) {
                            this.mesh.position.y -= overlapY;
                            if (this.velocity.y > 0) this.velocity.y = 0;
                         }
                    }
                 }
             }
        });
         this.isOnGround = landedThisFrame;
    }

    // --- Attack Logic ---
    updateAttack(deltaTime, inputHandler, otherPlayer) {
        this.attackCooldown -= deltaTime;

        if (inputHandler.isDown(this.controls.attack) && this.attackCooldown <= 0 && !this.isAttacking) {
            this.initiateAttack();
        }

        if (this.isAttacking) {
            this.updateAttackBox();
            this.updateAttackVisualPosition();
            if (otherPlayer && !otherPlayer.isKnockedBack && this.attackBox.intersectsBox(otherPlayer.hurtBox)) {
                this.handleAttackHit(otherPlayer);
            }
        }

        // Check for Jump Input after collisions are resolved
        if (this.isOnGround && inputHandler.isDown(this.controls.up)) {
             this.jump();
        }
    }

    initiateAttack() {
        this.isAttacking = true;
        this.attackCooldown = ATTACK_RATE;
        this.showAttackVisual();
        setTimeout(() => {
            if (this.isAttacking) {
                this.endAttack();
            }
        }, ATTACK_DURATION * 1000);
    }

    handleAttackHit(otherPlayer) {
        let knockbackStrength = BASE_KNOCKBACK + (otherPlayer.damagePercent * KNOCKBACK_SCALING);
        let knockbackDirection = otherPlayer.mesh.position.clone().sub(this.mesh.position).normalize();
        let horizontalDist = Math.abs(otherPlayer.mesh.position.x - this.mesh.position.x);
        let baseUpwardRatio = 0.4;
        let closenessFactor = Math.max(0, 1 - (horizontalDist / 3));
        knockbackDirection.y = Math.max(knockbackDirection.y, baseUpwardRatio + (0.4 * closenessFactor));
        knockbackDirection.normalize();
        otherPlayer.applyKnockback(knockbackDirection.multiplyScalar(knockbackStrength));
        otherPlayer.damagePercent += ATTACK_DAMAGE;
        this.endAttack();
    }

    endAttack() {
        this.isAttacking = false;
        this.hideAttackVisual();
    }

    jump() {
         this.velocity.y = JUMP_FORCE;
         this.isOnGround = false;
    }

    // --- Hurtbox Update ---
    updateHurtbox() {
        this.hurtBox.setFromObject(this.mesh);
    }

    // --- Boundary Checks ---
    checkBoundaries(platforms) {
        if (this.mesh.position.y < -15) {
            this.resetPosition(platforms);
            this.damagePercent = 0;
        }
    }

    // --- Visuals and Utility ---
    updateAttackBox() {
        const centerOffset = new THREE.Vector3(this.facingRight ? HITBOX_OFFSET_X : -HITBOX_OFFSET_X, 0, 0);
        const center = this.mesh.position.clone().add(centerOffset);
        const size = new THREE.Vector3(HITBOX_WIDTH, HITBOX_HEIGHT, this.mesh.geometry.parameters.depth);
        this.attackBox.setFromCenterAndSize(center, size);
    }

    showAttackVisual() {
        if (!this.attackVisualMesh) {
            this.attackVisualMesh = new THREE.Mesh(this.attackVisualGeometry, this.attackVisualMaterial);
        }
        this.updateAttackVisualPosition();
        if (!this.attackVisualMesh.parent) this.scene.add(this.attackVisualMesh);
    }

    hideAttackVisual() {
        if (this.attackVisualMesh?.parent) this.scene.remove(this.attackVisualMesh);
    }

    updateAttackVisualPosition() {
        if (!this.attackVisualMesh) return;
        const centerOffset = new THREE.Vector3(this.facingRight ? HITBOX_OFFSET_X : -HITBOX_OFFSET_X, 0, 0);
        const center = this.mesh.position.clone().add(centerOffset);
        center.z = this.mesh.position.z + 0.1;
        this.attackVisualMesh.position.copy(center);
    }

    applyKnockback(force) {
        this.velocity.x = force.x;
        this.velocity.y = force.y;
        this.isOnGround = false;
        this.isKnockedBack = true;
        this.knockbackTimer = KNOCKBACK_CONTROL_LOCKOUT_DURATION;
        this.endAttack();
    }

    resetPosition(platforms) {
        let spawnY = 2;
        if (platforms && platforms.length > 0) {
            let highestY = -Infinity;
            platforms.forEach(p => highestY = Math.max(highestY, p.position.y));
            spawnY = highestY + 3;
        }
        const spawnX = this.isPlayer1 ? -3 : 3;
        this.mesh.position.set(spawnX, spawnY, 0);
        this.velocity.set(0, 0);
        this.isOnGround = false;
        this.isKnockedBack = false;
        this.knockbackTimer = 0;
        this.endAttack();
    }

    updateHUD() {
        const hudElement = this.isPlayer1 ? this.hudP1 : this.hudP2;
        hudElement.textContent = `P${this.isPlayer1 ? 1 : 2}: ${Math.floor(this.damagePercent)}%`;
    }

    dispose() {
        if (this.mesh) this.scene.remove(this.mesh);
        this.hideAttackVisual();
    }
}
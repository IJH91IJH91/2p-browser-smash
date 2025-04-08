// player.js (Refactored Internally - Increased Air Control)
import * as THREE from 'three';
import {
    GRAVITY, MOVE_SPEED, JUMP_FORCE, ATTACK_DAMAGE, BASE_KNOCKBACK,
    KNOCKBACK_SCALING, ATTACK_RATE, ATTACK_DURATION, HITBOX_WIDTH, HITBOX_HEIGHT,
    HITBOX_OFFSET_X, KNOCKBACK_CONTROL_LOCKOUT_DURATION, AIR_FRICTION, RANGED_ATTACK_RATE, MAX_AIR_SPEED
} from './config.js';
import { Projectile } from './projectile.js';

export class Player {
    constructor(scene, startPos, color, controls, isPlayer1, hudP1, hudP2, heartsElement) {
        // ... (constructor code remains the same) ...
        this.scene = scene;
        this.controls = controls;
        this.isPlayer1 = isPlayer1;
        this.color = color;
        this.hudP1 = hudP1;
        this.hudP2 = hudP2;
        this.heartsElement = heartsElement;

        const geometry = new THREE.BoxGeometry(0.8, 1.5, 0.5);
        const material = new THREE.MeshLambertMaterial({ color: this.color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(startPos);
        this.mesh.userData.player = this;
        this.scene.add(this.mesh);

        this.velocity = new THREE.Vector2(0, 0);
        this.jumpsLeft = 2; // Or fetch from config
        this.maxJumps = 2;
        this.isOnGround = false;

        this.damagePercent = 0;
        this.lives = 3;
        this.facingRight = true;
        this.isKnockedBack = false;
        this.knockbackTimer = 0;
        this.isAttacking = false;
        this.rangedAttackCooldown = 0;
        this.attackCooldown = 0;
        this.attackBox = new THREE.Box3();
        this.hurtBox = new THREE.Box3();
        this.attackVisualMesh = null;
        this.attackVisualMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
        this.attackVisualGeometry = new THREE.BoxGeometry(HITBOX_WIDTH, HITBOX_HEIGHT, 0.1);
        // --- Add a player identifier for easier debugging ---
        this.playerId = isPlayer1 ? "P1" : "P2";
        console.log(`${this.playerId} initialized.`);
        this.updateHeartsUI(); 
    }

    // --- Main Update Method ---
    update(deltaTime, inputHandler, platforms, otherPlayer, projectiles) {
        // console.log(`${this.playerId} update start - isOnGround: ${this.isOnGround}, jumpsLeft: ${this.jumpsLeft}, velocity.y: ${this.velocity.y.toFixed(2)}`); // Optional: General update start log
        const moveInput = this.handleInput(inputHandler); // handleInput now contains the jump check
        this.updateState(deltaTime);
        this.updateMovement(deltaTime, moveInput);
        this.applyVelocityAndCollisions(deltaTime, platforms);
        this.updateAttack(deltaTime, inputHandler, otherPlayer);
        this.handleRangedInput(deltaTime, inputHandler, projectiles);
        this.updateHurtbox();
        this.checkBoundaries(platforms);
        this.updateHUD();
    }

    // --- Input Handling ---
    handleInput(inputHandler) {
        let moveInput = 0;
        if (inputHandler.isDown(this.controls.left)) moveInput = -1;
        if (inputHandler.isDown(this.controls.right)) moveInput = 1;

        // --- DEBUG JUMP INPUT ---
        if (inputHandler.wasJustPressed(this.controls.up)) {
            this.jump(); // Call jump immediately
        }
        // Removed 'aw' typo from the original code provided in the prompt
        return moveInput;
    }

    // --- State Updates (Knockback Timer, etc.) ---
    updateState(deltaTime) {
        // ... (state update code remains the same) ...
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
        const previousVelocityY = this.velocity.y;
        this.velocity.y -= GRAVITY * deltaTime;

        // Ground Movement Logic
        if (this.isOnGround) {
             // ... (ground movement code remains the same) ...
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
                const airControlFactor = 0.28;
                this.velocity.x += moveInput * MOVE_SPEED * airControlFactor;
                this.facingRight = moveInput > 0;
            }
        }

        // Stop drifting if velocity is very low
        if (Math.abs(this.velocity.x) < 0.1 && moveInput === 0 && !this.isKnockedBack) {
             this.velocity.x = 0;
        }

        // Clamp Horizontal Velocity
        this.velocity.x = Math.max(-MAX_AIR_SPEED, Math.min(MAX_AIR_SPEED, this.velocity.x));
        }

    // --- Position Update & Collision Handling ---
    applyVelocityAndCollisions(deltaTime, platforms) {
        // ... (Horizontal collision code remains the same) ...
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
             // ... (collision box calculation remains the same) ...
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
                             this.jumpsLeft = this.maxJumps;
                         }
                     } else { // Potentially hitting head
                          // ... (hitting head code remains the same) ...
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
         // ... (attack code remains the same) ...
         // NOTE: The jump input check was moved to handleInput
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
    }

    // ... (initiateAttack, handleAttackHit, endAttack methods remain the same) ...
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


    // ... (handleRangedInput, fireRangedAttack, applyProjectileHit methods remain the same) ...
    handleRangedInput(deltaTime, inputHandler, projectiles) { // Add projectiles parameter
        //this.rangedAttackCooldown -= clock.getDelta(); // Use clock delta or pass deltaTime
        this.rangedAttackCooldown -= deltaTime;

        if (inputHandler.isDown(this.controls.ranged) && this.rangedAttackCooldown <= 0) {
            this.fireRangedAttack(projectiles); // Pass projectiles array
        }
    }

    fireRangedAttack(projectiles) { // Add projectiles parameter
        console.log(`Player ${this.isPlayer1 ? 1 : 2} fires ranged!`);
        this.rangedAttackCooldown = RANGED_ATTACK_RATE; // Use config

        const projectileOffset = new THREE.Vector3(this.facingRight ? 0.6 : -0.6, 0.5, 0); // Start slightly in front/above
        const startPos = this.mesh.position.clone().add(projectileOffset);
        const direction = new THREE.Vector3(this.facingRight ? 1 : -1, 0, 0); // Straight horizontal

        // Import Projectile class at the top of player.js
        // import { Projectile } from './projectile.js'; // Adjust path if needed

        const newProjectile = new Projectile(this.scene, startPos, direction, this);
        projectiles.push(newProjectile); // Add to the global array passed from game.js
    }

    applyProjectileHit(projectile) {
        console.log(`Player ${this.isPlayer1 ? 1 : 2} hit by projectile!`);
        this.damagePercent += projectile.damage;

        // Calculate knockback
        let knockbackDirection = this.mesh.position.clone().sub(projectile.mesh.position).normalize();
        knockbackDirection.y = Math.max(0.2, knockbackDirection.y); // Ensure some upward pop
        knockbackDirection.normalize();

        // Ensure KNOCKBACK_SCALING is imported from config.js if used here
        let knockbackStrength = projectile.knockback + (this.damagePercent * KNOCKBACK_SCALING * 0.5); // Adjust scaling as needed

        this.applyKnockback(knockbackDirection.multiplyScalar(knockbackStrength));
        this.updateHUD(); // Update HUD immediately
    }


    jump() {
        if (this.jumpsLeft > 0) { // Check if jumps are available
            this.velocity.y = JUMP_FORCE; // Use JUMP_FORCE from config.js
            this.isOnGround = false; // Set airborne immediately
            this.jumpsLeft--; // Decrement jumps left
        }
    }

    // --- Hurtbox Update ---
    updateHurtbox() {
         // ... (hurtbox code remains the same) ...
         this.hurtBox.setFromObject(this.mesh);
    }

    // --- Boundary Checks ---
    checkBoundaries(platforms) {
        if (this.mesh.position.y < -20) {
            return this.loseLifeAndReset(platforms);
        }
        return true;
    }

    updateHeartsUI() {
        if (!this.heartsElement) {
            console.error(`${this.playerId}: heartsElement not found!`);
            return;
        }
        // Get all the heart spans within this player's heart container
        const heartSpans = this.heartsElement.querySelectorAll('.heart');

        // Loop through the heart spans
        heartSpans.forEach((heartSpan, index) => {
            // If the index is less than the current number of lives, it's a full heart
            if (index < this.lives) {
                heartSpan.classList.remove('lost'); // Make sure it doesn't have the 'lost' class
            } else {
                // Otherwise, it's a lost heart
                heartSpan.classList.add('lost'); // Add the 'lost' class
            }
        });
    }

    loseLifeAndReset(platforms) {
        this.lives--; // <-- This is where the life is deducted!
        this.updateHeartsUI();
        console.log(`${this.playerId}: Lost a life. Lives remaining: ${this.lives}`);
    
        if (this.lives <= 0) {
            console.log(`${this.playerId}: Out of lives!`);
            return false; // Signal that the player is out
        } else {
            // Reset position and damage only if lives remain
            this.resetPosition(platforms);
            this.damagePercent = 0; // Reset damage on respawn
            this.updateHUD(); // Update damage text display
            return true; // Signal successful reset
        }
    }

    // ... (Visuals and Utility methods like updateAttackBox, show/hideAttackVisual, applyKnockback, resetPosition, updateHUD, dispose remain the same) ...
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
        // Update the text display for damage percentage
        const hudTextElement = this.isPlayer1 ? this.hudP1 : this.hudP2;
        hudTextElement.textContent = `P${this.isPlayer1 ? 1 : 2}: ${Math.floor(this.damagePercent)}%`;

        // Get the correct health bar foreground element
        const healthBarElement = document.getElementById(this.isPlayer1 ? 'p1-health-bar' : 'p2-health-bar');

        if (healthBarElement) {
            // Calculate remaining health (damage percent increases, so health decreases)
            // Ensure health doesn't visually go below 0%
            const remainingHealthPercent = Math.max(0, 100 - this.damagePercent);

            // Set the width of the health bar foreground
            healthBarElement.style.width = `${remainingHealthPercent}%`;

            // Update color based on health (matches CSS classes in index.html)
            healthBarElement.classList.remove('low-health', 'medium-health'); // Reset classes
            if (remainingHealthPercent < 30) {
                healthBarElement.classList.add('low-health');
            } else if (remainingHealthPercent < 70) {
                healthBarElement.classList.add('medium-health');
            }
            // Optional: You could directly set style.backgroundColor here too,
            // but using classes is generally cleaner if styles are defined in CSS.
            // Example:
            // if (remainingHealthPercent < 30) {
            //     healthBarElement.style.backgroundColor = '#cc0000'; // Low health color
            // } else if (remainingHealthPercent < 70) {
            //     healthBarElement.style.backgroundColor = '#cccc00'; // Medium health color
            // } else {
            //     healthBarElement.style.backgroundColor = '#00cc00'; // High health color
            // }
        } else {
            console.error(`Health bar element not found for ${this.isPlayer1 ? 'P1' : 'P2'}`);
        }
    }

    dispose() {
        if (this.mesh) this.scene.remove(this.mesh);
        this.hideAttackVisual();
    }
}
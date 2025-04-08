// projectile.js (or inside game.js)
import * as THREE from 'three';
import { PROJECTILE_SPEED, PROJECTILE_LIFETIME, PROJECTILE_DAMAGE, PROJECTILE_KNOCKBACK } from './config.js'; //

export class Projectile {
    constructor(scene, startPos, direction, owner) {
        this.scene = scene;
        this.owner = owner; // Reference to the player who shot it
        this.lifetime = PROJECTILE_LIFETIME;
        this.damage = PROJECTILE_DAMAGE;
        this.knockback = PROJECTILE_KNOCKBACK;

        const geometry = new THREE.SphereGeometry(0.2, 8, 8); // Small sphere
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // Yellow
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(startPos);
         // Add bounding box for collisions
        this.mesh.userData.box = new THREE.Box3().setFromObject(this.mesh);
        this.scene.add(this.mesh);


        this.velocity = direction.normalize().multiplyScalar(PROJECTILE_SPEED);
    }

    update(deltaTime) {
        this.mesh.position.x += this.velocity.x * deltaTime;
        this.mesh.position.y += this.velocity.y * deltaTime;
        this.lifetime -= deltaTime;

        // Update bounding box
        this.mesh.userData.box.setFromObject(this.mesh);
    }
}
// game.js
import * as THREE from 'three';
import { GameState, CHARACTERS, MAPS } from './config.js';
import { Player } from './player.js';
import { Projectile } from './projectile.js';

let scene, camera, renderer, clock, inputHandler;
let gameState = GameState.CHARACTER_SELECT;
let player1 = null;
let player2 = null;
let platforms = [];
let selectedCharP1 = null;
let selectedCharP2 = null;
let selectedMap = null;
let projectiles = [];

const charSelectOverlay = document.getElementById('char-select-overlay');
const mapSelectOverlay = document.getElementById('map-select-overlay');
const charGrid = document.getElementById('char-grid');
const mapGrid = document.getElementById('map-grid');
const charReadyButton = document.getElementById('char-ready-button');
const mapReadyButton = document.getElementById('map-ready-button');
const charSelectStatus = document.getElementById('char-select-status');
const hud = document.getElementById('hud');
const hudP1 = document.getElementById('hud-p1');
const hudP2 = document.getElementById('hud-p2');

class InputHandler {
    constructor() {
        this.keys = {};
        this.prevKeys = {};
        window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
        window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    }
    // Call this at the END of your main game loop (animate function)
    updatePrevKeys() { this.prevKeys = { ...this.keys };     }
    isDown(keyCode) {  return this.keys[keyCode] === true;    }
    wasJustPressed(keyCode) {
        return this.keys[keyCode] === true && this.prevKeys[keyCode] === false;
    } 

}

function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();
    inputHandler = new InputHandler();

    const aspectRatio = window.innerWidth / window.innerHeight;
    const cameraHeight = 12;
    const cameraWidth = cameraHeight * aspectRatio;
    camera = new THREE.OrthographicCamera(cameraWidth / -2, cameraWidth / 2, cameraHeight / 2, cameraHeight / -2, 0.1, 100);
    camera.position.z = 10;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    setupUI();
    animate();
    window.addEventListener('resize', onWindowResize);
}

function setupUI() {
    charGrid.innerHTML = '';
    CHARACTERS.forEach(char => {
        const div = document.createElement('div');
        div.classList.add('select-item');
        div.dataset.charId = char.id;
        div.textContent = char.name;
        const bgColor = new THREE.Color(char.color).lerp(new THREE.Color(0xffffff), 0.5);
        div.style.backgroundColor = `#${bgColor.getHexString()}`;
        div.style.color = '#000';
        div.style.border = `2px solid #${new THREE.Color(char.color).getHexString()}`;
        div.addEventListener('click', (event) => handleCharSelect(char.id, event.ctrlKey));
        charGrid.appendChild(div);
    });
    charReadyButton.addEventListener('click', confirmCharacterSelection);

    mapGrid.innerHTML = '';
    MAPS.forEach(map => {
        const div = document.createElement('div');
        div.classList.add('select-item');
        div.dataset.mapId = map.id;
        div.textContent = map.name;
        const bgColor = new THREE.Color(map.bgColor).lerp(new THREE.Color(0xffffff), 0.5);
        div.style.backgroundColor = `#${bgColor.getHexString()}`;
        div.style.color = '#000';
        div.style.border = `2px solid #${new THREE.Color(map.bgColor).getHexString()}`;
        div.addEventListener('click', () => handleMapSelect(map.id));
        mapGrid.appendChild(div);
    });
    mapReadyButton.addEventListener('click', startGame);

    updateUIState();
}

function handleCharSelect(charId, isPlayer2) {
    if (gameState !== GameState.CHARACTER_SELECT) return;

    const targetPlayer = isPlayer2 ? 'P2' : 'P1';
    const otherPlayer = isPlayer2 ? 'P1' : 'P2';
    const currentSelection = isPlayer2 ? selectedCharP2 : selectedCharP1;
    const otherSelection = isPlayer2 ? selectedCharP1 : selectedCharP2;
    const selectedClass = isPlayer2 ? 'selected-p2' : 'selected-p1';

    if (otherSelection === charId) {
        charSelectStatus.textContent = `Character already selected by ${otherPlayer}`;
        return;
    }

    charSelectStatus.textContent = '';

    if (currentSelection) {
        const prevDiv = charGrid.querySelector(`[data-char-id="${currentSelection}"]`);
        if (prevDiv) prevDiv.classList.remove(selectedClass);
    }

    const newDiv = charGrid.querySelector(`[data-char-id="${charId}"]`);
    if (newDiv) {
        newDiv.classList.add(selectedClass);
        if (isPlayer2) {
            selectedCharP2 = charId;
        } else {
            selectedCharP1 = charId;
        }
    }

    charReadyButton.disabled = !(selectedCharP1 && selectedCharP2 && selectedCharP1 !== selectedCharP2);
}

function confirmCharacterSelection() {
    if (selectedCharP1 && selectedCharP2) {
        gameState = GameState.MAP_SELECT;
        updateUIState();
    }
}

function handleMapSelect(mapId) {
    if (gameState !== GameState.MAP_SELECT) return;

    if (selectedMap) {
        const prevDiv = mapGrid.querySelector(`[data-map-id="${selectedMap}"]`);
        if (prevDiv) prevDiv.classList.remove('selected-p1');
    }

    selectedMap = mapId;
    const newDiv = mapGrid.querySelector(`[data-map-id="${mapId}"]`);
    if (newDiv) newDiv.classList.add('selected-p1');

    mapReadyButton.disabled = false;
}

function startGame() {
    if (!selectedCharP1 || !selectedCharP2 || !selectedMap) return;

    gameState = GameState.LOADING;
    updateUIState();

    clearGameObjects();

    const charDataP1 = CHARACTERS.find(c => c.id === selectedCharP1);
    const charDataP2 = CHARACTERS.find(c => c.id === selectedCharP2);
    const mapData = MAPS.find(m => m.id === selectedMap);

    scene.background = new THREE.Color(mapData.bgColor);

    platforms = [];
    mapData.platforms.forEach(p => {
        const platGeo = new THREE.BoxGeometry(p.w, p.h, 2);
        const platMat = new THREE.MeshLambertMaterial({ color: 0x664422 });
        const platform = new THREE.Mesh(platGeo, platMat);
        platform.position.set(p.x, p.y, 0);
        platform.userData.box = new THREE.Box3().setFromObject(platform);
        scene.add(platform);
        platforms.push(platform);
    });

    const controlsP1 = { left: 'KeyA', right: 'KeyD', up: 'KeyW', attack: 'KeyF', ranged: 'KeyG' };
    const controlsP2 = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', attack: 'Enter', ranged: 'Slash' };

    const heartsElementP1 = document.getElementById('p1-hearts');
    const heartsElementP2 = document.getElementById('p2-hearts');

    // Pass the HUD elements to the Player constructor
    player1 = new Player(scene, new THREE.Vector3(-3, 2, 0), charDataP1.color, controlsP1, true, hudP1, hudP2, heartsElementP1);
    player2 = new Player(scene, new THREE.Vector3(3, 2, 0), charDataP2.color, controlsP2, false, hudP1, hudP2, heartsElementP2);

    setTimeout(() => {
        gameState = GameState.GAMEPLAY;
        updateUIState();
         // Initial HUD update on game start
        player1?.updateHUD();
        player2?.updateHUD();
    }, 100);
}

function clearGameObjects() {
    if (player1) player1.dispose();
    if (player2) player2.dispose();
    platforms.forEach(p => {
        scene.remove(p);
        // Dispose geometry and material if needed (not strictly necessary for BoxGeometry/MeshLambertMaterial reused like this)
        // p.geometry.dispose();
        // p.material.dispose();
    });
    platforms = [];
    player1 = null;
    player2 = null;
}

function updateUIState() {
    charSelectOverlay.classList.toggle('hidden', gameState !== GameState.CHARACTER_SELECT);
    mapSelectOverlay.classList.toggle('hidden', gameState !== GameState.MAP_SELECT);
    hud.classList.toggle('hidden', gameState !== GameState.GAMEPLAY);

    if (gameState === GameState.CHARACTER_SELECT) {
        selectedCharP1 = null;
        selectedCharP2 = null;
        selectedMap = null;
        charReadyButton.disabled = true;
        mapReadyButton.disabled = true;
        charGrid.querySelectorAll('.select-item').forEach(el => el.classList.remove('selected-p1', 'selected-p2'));
        mapGrid.querySelectorAll('.select-item').forEach(el => el.classList.remove('selected-p1'));
        charSelectStatus.textContent = ''; // Clear status message
    }
}

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.1);//prevents large jumps

    // --- Update Projectiles ---
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const proj = projectiles[i];
        proj.update(deltaTime);

        // Check collision with players
        let hit = false;
        if (player1 && proj.owner !== player1 && proj.mesh.userData.box.intersectsBox(player1.hurtBox)) {
           player1.applyProjectileHit(proj); // Need to add this method to Player
           hit = true;
        } else if (player2 && proj.owner !== player2 && proj.mesh.userData.box.intersectsBox(player2.hurtBox)) {
           player2.applyProjectileHit(proj); // Need to add this method to Player
           hit = true;
        }
        // Check collision with platforms (optional: destroy on impact)
        if (!hit) {
            for (const platform of platforms) {
                if (proj.mesh.userData.box.intersectsBox(platform.userData.box)) {
                    hit = true;
                    break; // Stop checking platforms once hit
        }            }        }
        // Remove projectile if it hit something or lifetime expired
        if (hit || proj.lifetime <= 0) {
            scene.remove(proj.mesh); // Remove visual from scene
            // proj.mesh.geometry.dispose(); // Optional cleanup
            // proj.mesh.material.dispose(); // Optional cleanup
            projectiles.splice(i, 1); // Remove from array
    }    }

    // --- Update Players ---
    if (gameState === GameState.GAMEPLAY && player1 && player2) {
        player1.update(deltaTime, inputHandler, platforms, player2, projectiles);
        player2.update(deltaTime, inputHandler, platforms, player1, projectiles);
    }
    renderer.render(scene, camera);

    inputHandler.updatePrevKeys();
}

   

function onWindowResize() {
    const newAspectRatio = window.innerWidth / window.innerHeight;
    // Use the existing camera height to calculate the new width
    const cameraHeight = camera.top - camera.bottom;
    const newCameraWidth = cameraHeight * newAspectRatio;

    camera.left = newCameraWidth / -2;
    camera.right = newCameraWidth / 2;
    // camera.top and camera.bottom remain the same if height is constant
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}


// Start the application
init();
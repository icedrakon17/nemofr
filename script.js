const countries = {
    "Coralia Reef": { x: 21, y: 47, hints: ["Nemo is near the vibrant pink corals.", "This place is on the western side of the map.", "It is home to many clownfish families."] },
    "Shipwreck Isles": { x: 48, y: 19, hints: ["Look near the old sunken pirate ships.", "It's in the northern waters.", "Watch out for rusty anchors!"] },
    "Seahorse Atoll": { x: 80, y: 28, hints: ["The water here is calm and turquoise.", "It's in the northeastern corner.", "Seahorses love to race here!"] },
    "Volcano Island": { x: 50, y: 60, hints: ["The water is warm near the bubbling lava.", "It's right in the center of the ocean.", "Look for the giant mountain peak."] },
    "Sunken City": { x: 82, y: 52, hints: ["Look inside the ancient underwater castle.", "It's on the eastern edge.", "Atlantis might be just around the corner."] },
    "Abyssal Deep": { x: 20, y: 84, hints: ["It's very dark and mysterious down here.", "Look in the southwestern trenches.", "You might need a flashlight!"] },
    "Glowworm Cave": { x: 75, y: 84, hints: ["The caves are lit by glowing creatures.", "It's in the southern reefs.", "Look for the bioluminescent entrance."] }
};

const modes = {
    easy: { label: "Easy", lives: 5, time: 90, hitRadius: 5 },
    normal: { label: "Normal", lives: 3, time: 60, hitRadius: 4 },
    hard: { label: "Hard", lives: 2, time: 40, hitRadius: 3 }
};
const countryNames = Object.keys(countries);
const linkSecret = 0x5a3;

window.onload = function () {
    const fileName = window.location.pathname.split('/').pop() || 'index.html';
    if (fileName === 'index.html') initHome();
    else if (fileName === 'hider.html') initHider();
    else if (fileName === 'seeker.html') initSeeker();
    else if (fileName === 'gameover.html') initGameOver();
};

function getModeConfig(modeParam) {
    const key = (modeParam || "normal").toLowerCase();
    return { key: modes[key] ? key : "normal", ...modes[modes[key] ? key : "normal"] };
}

function encodeCountryToken(countryName) {
    const index = countryNames.indexOf(countryName);
    if (index < 0) return "";

    const salt = Math.floor(Math.random() * 46656);
    const masked = ((index + 1) * 131 + salt) ^ linkSecret;
    const checksum = ((index + 3) * 17 + salt) % 97;
    return `${masked.toString(36)}.${salt.toString(36)}.${checksum.toString(36)}`;
}

function decodeCountryToken(token) {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const masked = Number.parseInt(parts[0], 36);
    const salt = Number.parseInt(parts[1], 36);
    const checksum = Number.parseInt(parts[2], 36);
    if (![masked, salt, checksum].every(Number.isFinite)) return null;

    const raw = (masked ^ linkSecret) - salt;
    if (raw % 131 !== 0) return null;

    const index = (raw / 131) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= countryNames.length) return null;

    const expectedChecksum = ((index + 3) * 17 + salt) % 97;
    if (checksum !== expectedChecksum) return null;

    return countryNames[index];
}

function basePath() {
    return `${window.location.origin}${window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'))}`;
}

function initHome() {
    const modeSelect = document.getElementById('modeSelect');
    const startHiderButton = document.getElementById('startHiderButton');
    if (!modeSelect || !startHiderButton) return;

    startHiderButton.onclick = function () {
        window.location.href = `hider.html?mode=${encodeURIComponent(modeSelect.value)}`;
    };
}

function initHider() {
    const select = document.getElementById('countrySelect');
    const modeSummary = document.getElementById('modeSummary');
    const backHomeButton = document.getElementById('backHomeButton');
    if (!select) return;

    const params = new URLSearchParams(window.location.search);
    const mode = getModeConfig(params.get('mode'));
    if (modeSummary) modeSummary.innerText = `Mode: ${mode.label}`;

    select.innerHTML = '';
    Object.keys(countries).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.innerText = name;
        select.appendChild(opt);
    });

    document.getElementById('hideButton').onclick = function () {
        const encodedRegion = encodeCountryToken(select.value);
        const seekerUrl = `${basePath()}/seeker.html?n=${encodeURIComponent(encodedRegion)}&mode=${encodeURIComponent(mode.key)}`;
        document.getElementById('generatedUrl').innerText = seekerUrl;
        document.getElementById('linkSection').style.display = 'block';
    };

    document.getElementById('copyButton').onclick = function () {
        const link = document.getElementById('generatedUrl').innerText;
        if (!link) {
            alert("Generate a seeker link first.");
            return;
        }
        navigator.clipboard.writeText(link).then(() => {
            alert("Link copied. Share it with Player 2.");
        }).catch(() => {
            alert("Could not copy automatically. Please copy the link manually.");
        });
    };

    if (backHomeButton) {
        backHomeButton.onclick = function () {
            window.location.href = 'index.html';
        };
    }
}

function initSeeker() {
    let lives = 3;
    let hintIndex = 0;
    let gameActive = true;

    const params = new URLSearchParams(window.location.search);
    const target = decodeCountryToken(params.get('n')) || params.get('country');
    const mode = getModeConfig(params.get('mode'));
    if (!target || !countries[target]) {
        window.location.href = 'index.html';
        return;
    }

    lives = mode.lives;

    const mapContainer = document.getElementById('map-container');
    const marlin = document.getElementById('marlin');
    const modeDisplay = document.getElementById('modeDisplay');
    const heartsDisplay = document.getElementById('heartsDisplay');
    const timerDisplay = document.getElementById('timerDisplay');
    const sharkStatus = document.getElementById('sharkStatus');
    if (!mapContainer || !marlin || !heartsDisplay || !timerDisplay || !sharkStatus) {
        window.location.href = 'index.html';
        return;
    }
    const activeMarkers = [];
    let playerX = 50, playerY = 50;
    let timeRemaining = mode.time;
    let timerId = null;

    if (modeDisplay) modeDisplay.innerText = `Mode: ${mode.label}`;
    heartsDisplay.innerText = `Lives: ${lives}`;

    function formatTime(seconds) {
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        return `${mins}:${secs}`;
    }

    function updateTimerUi() {
        const warningThreshold = Math.max(8, Math.floor(mode.time * 0.2));
        const cautionThreshold = Math.max(15, Math.floor(mode.time * 0.45));
        timerDisplay.innerText = `Time: ${formatTime(timeRemaining)}`;
        if (timeRemaining <= warningThreshold) sharkStatus.innerText = "Shark is very close!";
        else if (timeRemaining <= cautionThreshold) sharkStatus.innerText = "Shark is getting closer...";
        else sharkStatus.innerText = "Shark is far away";
    }

    function stopTimer() {
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
    }

    function startTimer() {
        updateTimerUi();
        timerId = setInterval(() => {
            if (!gameActive) {
                stopTimer();
                return;
            }
            timeRemaining--;
            updateTimerUi();
            if (timeRemaining <= 0) {
                gameActive = false;
                stopTimer();
                goToGameOver("lose", "Time ran out.", mode.key);
            }
        }, 1000);
    }

    function goToGameOver(result, reason, modeKey) {
        const gameOverUrl = `${basePath()}/gameover.html?result=${encodeURIComponent(result)}&reason=${encodeURIComponent(reason)}&mode=${encodeURIComponent(modeKey)}`;
        window.location.href = gameOverUrl;
    }

    function moveTowards(x, y) {
        if (!gameActive) return;
        playerX = Math.max(0, Math.min(100, x));
        playerY = Math.max(0, Math.min(100, y));
        marlin.style.left = `${playerX}%`;
        marlin.style.top = `${playerY}%`;
        if (Math.random() > 0.7) createBubble(playerX, playerY);
        checkCollisions();
    }

    function createBubble(x, y) {
        const b = document.createElement('div');
        b.className = 'bubble'; b.style.left = `${x}%`; b.style.top = `${y}%`;
        mapContainer.appendChild(b); setTimeout(() => b.remove(), 1000);
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveTowards(playerX, playerY - 3);
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveTowards(playerX, playerY + 3);
        }
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            moveTowards(playerX - 3, playerY);
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            moveTowards(playerX + 3, playerY);
        }
    });

    mapContainer.onpointermove = (e) => {
        if (e.buttons > 0) {
            const r = mapContainer.getBoundingClientRect();
            moveTowards(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
        }
    };

    // MediaPipe Hand Tracking
    if (window.Hands) {
        try {
            const hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
            hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
            hands.onResults((res) => {
                if (res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
                    const tip = res.multiHandLandmarks[0][8];
                    moveTowards((1 - tip.x) * 100, tip.y * 100);
                }
            });
            const cam = new Camera(document.getElementById('input_video'), {
                onFrame: async () => { await hands.send({ image: document.getElementById('input_video') }); },
                width: 640, height: 480
            });
            cam.start();
        } catch (_err) {
            sharkStatus.innerText = "Camera unavailable. Use keyboard or mouse.";
        }
    } else {
        sharkStatus.innerText = "Hand tracking unavailable. Use keyboard or mouse.";
    }

    Object.keys(countries).forEach(name => {
        const data = countries[name];
        const m = document.createElement('div');
        m.className = 'marker'; m.style.left = `${data.x}%`; m.style.top = `${data.y}%`;
        mapContainer.appendChild(m);
        activeMarkers.push({ name, x: data.x, y: data.y, el: m, hit: false });
    });

    function checkCollisions() {
        for (const m of activeMarkers) {
            if (m.hit || !gameActive) continue;
            const distance = Math.hypot(playerX - m.x, playerY - m.y);
            if (distance >= mode.hitRadius) continue;

            m.hit = true;
            if (m.name === target) {
                gameActive = false;
                stopTimer();
                goToGameOver("win", "You found Nemo.", mode.key);
                return;
            }

            lives--;
            m.el.classList.add('disabled');
            heartsDisplay.innerText = `Lives: ${lives}`;
            if (lives <= 0) {
                gameActive = false;
                stopTimer();
                goToGameOver("lose", "You ran out of lives.", mode.key);
                return;
            }
            revealHint();
            return;
        }
    }

    function revealHint() {
        const li = document.createElement('li');
        li.innerText = countries[target].hints[hintIndex++ % 3];
        document.getElementById('hintsList').appendChild(li);
    }

    startTimer();
}

function initGameOver() {
    const params = new URLSearchParams(window.location.search);
    const result = (params.get('result') || 'lose').toLowerCase();
    const reason = params.get('reason') || 'The round has ended.';
    const mode = getModeConfig(params.get('mode'));

    const resultTitle = document.getElementById('resultTitle');
    const resultMessage = document.getElementById('resultMessage');
    const resultMode = document.getElementById('resultMode');
    const playAgainButton = document.getElementById('playAgainButton');
    const homeButton = document.getElementById('homeButton');

    if (!resultTitle) return;

    resultTitle.innerText = result === 'win' ? 'You Win' : 'Game Over';
    resultMessage.innerText = reason;
    resultMode.innerText = `Mode: ${mode.label}`;

    if (playAgainButton) {
        playAgainButton.onclick = function () {
            window.location.href = `hider.html?mode=${encodeURIComponent(mode.key)}`;
        };
    }

    if (homeButton) {
        homeButton.onclick = function () {
            window.location.href = 'index.html';
        };
    }
    
}

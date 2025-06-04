// Update these variables and remove flames-related code
let visitorCount = 0;
let startTime = new Date();
let gameOver = false;
let liveTimeSeconds = 0;
let currentScoreType = 'allTime'; // 'allTime' or 'daily'
let currentMode = 'normal'; // 'normal' or 'hard'
let hardModeInterval = null;
let hardModeSizeInterval = null; // Track the size change interval
let hasPlayedOnce = false; // Track if user has played at least once

// Cache for high scores to avoid repeated API calls
let cachedAllTimeScores = [];
let cachedDailyScores = [];
let cachedHardAllTimeScores = [];
let cachedHardDailyScores = [];
let scoresLoaded = false;

// Get elements
const body = document.body;
const image = document.getElementById('main-image');
const imageContainer = document.getElementById('image-container');
const message = document.getElementById('message');
const audio = document.getElementById('gravestone-audio');
const scoreSubmission = document.getElementById('score-submission');
const playerNameInput = document.getElementById('player-name');
const submitScoreBtn = document.getElementById('submit-score');
const submissionStatus = document.getElementById('submission-status');
const clickInstruction = document.getElementById('click-instruction');
const highScoresContainer = document.getElementById('high-scores-container');
const highScoresTitle = document.getElementById('high-scores-title');
const gameControls = document.getElementById('game-controls');

// Preload high scores when page loads
window.addEventListener('load', () => {
  preloadHighScores();
});

let hardModeAudio = null;

// Update the setMode function to play scary music in hard mode
function setMode(mode) {
  currentMode = mode;
  
  // Update body class for hard mode
  body.classList.toggle('hard-mode', mode === 'hard');
  
  // Handle hard mode specific effects
  if (mode === 'hard') {
    // Create floating Collins
    createFloatingCollins();
    
    // Start size changes and movement interval
    startHardModeSizeChanges();
    startHardModeMovementInterval();
    
    // Play scary music
    if (!hardModeAudio) {
      hardModeAudio = new Audio('scary_music.mp3');
      hardModeAudio.loop = true;
      hardModeAudio.volume = 0.7; // Set volume to 70%
    }
    
    hardModeAudio.play().catch(error => {
      console.error('Error playing hard mode audio:', error);
    });
  } else {
    // Stop hard mode effects when switching to normal
    if (hardModeSizeInterval) {
      clearInterval(hardModeSizeInterval);
      hardModeSizeInterval = null;
    }
    
    if (hardModeMovementInterval) {
      clearInterval(hardModeMovementInterval);
      hardModeMovementInterval = null;
    }
    
    // Stop scary music
    if (hardModeAudio) {
      hardModeAudio.pause();
      hardModeAudio.currentTime = 0;
    }
    
    // Reset image styling
    image.style.width = '';
    image.style.clipPath = '';
  }
  
  // Update high scores title
  highScoresTitle.textContent = mode === 'hard' ? 
    'Records for Fastest Collin Disappearance (HARD MODE 🔥)' : 
    'Records for Fastest Collin Disappearance';
  
  // Reset game when switching modes
  resetGame();
  
  // Hide the game controls after selection
  gameControls.style.display = 'none';
  
  // Update displayed scores if high scores are visible
  if (highScoresContainer.style.display === 'block') {
    displayCurrentScores();
  }
}

// Add click event listener to the image
image.addEventListener('click', () => {
  if (gameOver) return;
  
  visitorCount++;
  
  // In hard mode, also jump to a new position on every click
  if (currentMode === 'hard' && !gameOver) {
    moveCollinToRandomPosition();
  }

  // Calculate opacity
  const opacity = Math.max(1 - visitorCount / 15, 0);

  if (opacity > 0) {
    // Update image opacity
    image.style.opacity = opacity;
  } else {
    gameOver = true;
    image.src = "rip.png";
    image.style.opacity = 1;
    
    // Reset image position to center after game over
    imageContainer.style.position = 'relative';
    imageContainer.style.left = 'auto';
    imageContainer.style.top = 'auto';
    
    // Hide click instruction
    clickInstruction.style.display = 'none';
    
    // Show game controls after game is over
    hasPlayedOnce = true;
    gameControls.style.display = 'flex';
    
    // Calculate time and show message
    const endTime = new Date();
    liveTimeSeconds = (endTime - startTime) / 1000;
    const modeText = currentMode === 'hard' ? ' (HARD MODE 🔥)' : '';
    message.innerHTML = `RIP COLLIN${modeText} <br>he was alive for ${liveTimeSeconds.toFixed(3)} seconds.`;

    // Show high scores
    highScoresContainer.style.display = 'block';
    
    // Display cached scores or load if not available
    if (scoresLoaded) {
      displayCurrentScores();
    } else {
      loadHighScores();
    }
    
    // Check if qualifies for high score
    checkIfQualifiesForHighScore(liveTimeSeconds);
    
    // Play random song
    const songs = ['duster.mp3', 'angel.mp3', 'taps.mp3'];
    const randomSong = songs[Math.floor(Math.random() * songs.length)];
    audio.src = randomSong;
    audio.play();
  }
});

submitScoreBtn.addEventListener('click', submitScore);
playerNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    submitScore();
  }
});

function resetGame() {
  // Reset game state
  visitorCount = 0;
  gameOver = false;
  liveTimeSeconds = 0;
  
  // Clear intervals
  if (hardModeSizeInterval) {
    clearInterval(hardModeSizeInterval);
    hardModeSizeInterval = null;
  }
  
  if (hardModeMovementInterval) {
    clearInterval(hardModeMovementInterval);
    hardModeMovementInterval = null;
  }
  
  // Stop all audio
  audio.pause();
  audio.currentTime = 0;
  
  // Stop hard mode audio if the game is reset but we're not in hard mode
  if (currentMode !== 'hard' && hardModeAudio) {
    hardModeAudio.pause();
    hardModeAudio.currentTime = 0;
  }
  
  // Restart hard mode audio if we're in hard mode
  if (currentMode === 'hard' && hardModeAudio) {
    hardModeAudio.play().catch(error => {
      console.error('Error playing hard mode audio:', error);
    });
  }
  
  // Reset image position and size
  imageContainer.style.position = 'relative';
  imageContainer.style.left = 'auto';
  imageContainer.style.top = 'auto';
  image.style.width = '';
  image.style.clipPath = '';
  
  // Reset UI
  image.src = "collin.PNG";
  image.style.opacity = 1;
  message.innerHTML = '';
  clickInstruction.style.display = 'block';
  highScoresContainer.style.display = 'none';
  scoreSubmission.style.display = 'none';
  submissionStatus.innerHTML = '';
  playerNameInput.value = '';
  
  // Restart intervals if in hard mode
  if (currentMode === 'hard' && !gameOver) {
    startHardModeSizeChanges();
    startHardModeMovementInterval();
  }
  
  // Reset start time
  startTime = new Date();
}

function switchTab(scoreType) {
  currentScoreType = scoreType;
  
  // Update tab appearance
  document.getElementById('all-time-tab').classList.toggle('active', scoreType === 'allTime');
  document.getElementById('daily-tab').classList.toggle('active', scoreType === 'daily');
  
  // Display appropriate cached scores
  displayCurrentScores();
}

function getApiEndpoints(mode, scoreType) {
  const prefix = mode === 'hard' ? 'Hard' : '';
  const suffix = scoreType === 'daily' ? 'Daily' : '';
  
  return {
    get: `/api/get${prefix}${suffix}HighScores`,
    submit: `/api/submit${prefix}${suffix}Score` // Fixed: Prefix → prefix
  };
}

// Preload both score types in the background
async function preloadHighScores() {
  try {
    const [normalAllTime, normalDaily, hardAllTime, hardDaily] = await Promise.all([
      fetch('/api/getHighScores'),
      fetch('/api/getDailyHighScores'),
      fetch('/api/getHardHighScores'),
      fetch('/api/getHardDailyHighScores')
    ]);
    
    if (normalAllTime.ok) cachedAllTimeScores = await normalAllTime.json();
    if (normalDaily.ok) cachedDailyScores = await normalDaily.json();
    if (hardAllTime.ok) cachedHardAllTimeScores = await hardAllTime.json();
    if (hardDaily.ok) cachedHardDailyScores = await hardDaily.json();
    
    scoresLoaded = true;
  } catch (error) {
    console.error('Error preloading high scores:', error);
    cachedAllTimeScores = [];
    cachedDailyScores = [];
    cachedHardAllTimeScores = [];
    cachedHardDailyScores = [];
    scoresLoaded = true;
  }
}

// Separated loading function - now just refreshes the cache
async function loadHighScores() {
  try {
    const [normalAllTime, normalDaily, hardAllTime, hardDaily] = await Promise.all([
      fetch('/api/getHighScores'),
      fetch('/api/getDailyHighScores'),
      fetch('/api/getHardHighScores'),
      fetch('/api/getHardDailyHighScores')
    ]);
    
    if (normalAllTime.ok) cachedAllTimeScores = await normalAllTime.json();
    if (normalDaily.ok) cachedDailyScores = await normalDaily.json();
    if (hardAllTime.ok) cachedHardAllTimeScores = await hardAllTime.json();
    if (hardDaily.ok) cachedHardDailyScores = await hardDaily.json();
    
    scoresLoaded = true;
    displayCurrentScores();
  } catch (error) {
    console.error('Error loading high scores:', error);
    displayCurrentScores();
  }
}

// Separated display function - uses cached data
function displayCurrentScores() {
  let scores;
  if (currentMode === 'hard') {
    scores = currentScoreType === 'allTime' ? cachedHardAllTimeScores : cachedHardDailyScores;
  } else {
    scores = currentScoreType === 'allTime' ? cachedAllTimeScores : cachedDailyScores;
  }
  displayHighScores(scores);
}

function displayHighScores(highScores) {
  const highScoresContainer = document.getElementById('high-scores-list');

  if (!highScoresContainer) {
    console.error('High scores container element not found in the DOM.');
    return;
  }

  highScoresContainer.innerHTML = '';

  if (highScores.length === 0) {
    highScoresContainer.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No scores yet!</div>';
    return;
  }

  highScores.forEach((score, index) => {
    const scoreElement = document.createElement('div');
    scoreElement.className = 'score-item';
    scoreElement.innerHTML = `
      <span><span class="rank">#${index + 1}</span> ${score.playerName}</span>
      <span>${score.time}s</span>
    `;
    highScoresContainer.appendChild(scoreElement);
  });
}

async function checkIfQualifiesForHighScore(time) {
  try {
    let allTimeScores, dailyScores;
    
    if (currentMode === 'hard') {
      allTimeScores = cachedHardAllTimeScores;
      dailyScores = cachedHardDailyScores;
    } else {
      allTimeScores = cachedAllTimeScores;
      dailyScores = cachedDailyScores;
    }
    
    if (!scoresLoaded) {
      const endpoints = getApiEndpoints(currentMode, 'allTime');
      const dailyEndpoints = getApiEndpoints(currentMode, 'daily');
      
      const [allTimeResponse, dailyResponse] = await Promise.all([
        fetch(endpoints.get),
        fetch(dailyEndpoints.get)
      ]);
      
      allTimeScores = allTimeResponse.ok ? await allTimeResponse.json() : [];
      dailyScores = dailyResponse.ok ? await dailyResponse.json() : [];
    }
    
    const qualifiesAllTime = allTimeScores.length < 10 || time < allTimeScores[allTimeScores.length - 1]?.time;
    const qualifiesDaily = dailyScores.length < 10 || time < dailyScores[dailyScores.length - 1]?.time;
    
    if (qualifiesAllTime || qualifiesDaily) {
      scoreSubmission.style.display = 'block';
      const modeText = currentMode === 'hard' ? ' (HARD MODE 🔥)' : '';
      const message = qualifiesAllTime && qualifiesDaily ? 
        `🎉 You qualified for both all-time AND daily high scores${modeText}!` :
        qualifiesAllTime ? `🎉 You qualified for an all-time high score${modeText}!` :
        `🎉 You qualified for a daily high score${modeText}!`;
      submissionStatus.innerHTML = `<div class="success">${message}</div>`;
    } else {
      submissionStatus.innerHTML = '<div class="error">Your time didn\'t make the top 10. Try again!</div>';
    }
  } catch (error) {
    console.error('Error checking high score qualification:', error);
    scoreSubmission.style.display = 'block';
    submissionStatus.innerHTML = '<div class="error">Could not check qualification. You can still try to submit.</div>';
  }
}

async function submitScore() {
  const playerName = playerNameInput.value.trim();
  
  if (!playerName) {
    submissionStatus.innerHTML = '<div class="error">Please enter your name</div>';
    return;
  }

  submitScoreBtn.disabled = true;
  submitScoreBtn.textContent = 'Submitting...';
  
  try {
    const allTimeEndpoints = getApiEndpoints(currentMode, 'allTime');
    const dailyEndpoints = getApiEndpoints(currentMode, 'daily');
    
    // Submit to both all-time and daily endpoints
    const [allTimeResponse, dailyResponse] = await Promise.all([
      fetch(allTimeEndpoints.submit, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, time: liveTimeSeconds })
      }),
      fetch(dailyEndpoints.submit, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, time: liveTimeSeconds })
      })
    ]);

    const allTimeResult = allTimeResponse.ok ? await allTimeResponse.json() : { success: false };
    const dailyResult = dailyResponse.ok ? await dailyResponse.json() : { success: false };
    
    if (allTimeResult.success || dailyResult.success) {
      const messages = [];
      if (allTimeResult.success) messages.push('all-time record');
      if (dailyResult.success) messages.push('daily record');
      
      const modeText = currentMode === 'hard' ? ' (HARD MODE 🔥)' : '';
      const updateText = (allTimeResult.updated || dailyResult.updated) ? ' (Updated your previous best!)' : '';
      submissionStatus.innerHTML = `<div class="success">✅ Score submitted for ${messages.join(' and ')}${modeText}!${updateText}</div>`;
      scoreSubmission.style.display = 'none';
      
      // Refresh the cache and display after successful submission
      setTimeout(() => {
        loadHighScores();
      }, 1000);
    } else {
      submissionStatus.innerHTML = '<div class="error">Score did not qualify for records</div>';
    }
  } catch (error) {
    console.error('Error submitting score:', error);
    submissionStatus.innerHTML = '<div class="error">Failed to submit score. Please try again.</div>';
  } finally {
    submitScoreBtn.disabled = false;
    submitScoreBtn.textContent = 'Submit Score';
  }
}

// Create floating Collins for hard mode background
function createFloatingCollins() {
  // Create container if it doesn't exist
  let container = document.querySelector('.floating-collins-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'floating-collins-container';
    document.body.appendChild(container);
  }
  
  // Clear existing floating Collins
  container.innerHTML = '';
  
  // Create 15 random floating Collins
  for (let i = 0; i < 15; i++) {
    const collin = document.createElement('div');
    collin.className = 'floating-collin';
    
    // Random position, size, and animation duration
    const size = 30 + Math.random() * 40;
    const left = Math.random() * 100;
    const delay = Math.random() * 10;
    const duration = 10 + Math.random() * 20;
    
    collin.style.width = `${size}px`;
    collin.style.height = `${size}px`;
    collin.style.left = `${left}%`;
    collin.style.animationDuration = `${duration}s`;
    collin.style.animationDelay = `${delay}s`;
    
    container.appendChild(collin);
  }
}

// Add this function to randomly change Collin's size
function startHardModeSizeChanges() {
  if (currentMode !== 'hard' || gameOver) return;
  
  // Clear any existing interval first
  if (hardModeSizeInterval) {
    clearInterval(hardModeSizeInterval);
  }
  
  hardModeSizeInterval = setInterval(() => {
    if (gameOver) {
      clearInterval(hardModeSizeInterval);
      return;
    }
    
    // Random size between 50% and 130% of original
    const randomSize = 10 + Math.random() * 50;
    image.style.width = `${randomSize}%`;
    image.style.height = 'auto'; 
    
    
  }, 400 + Math.random() * 600); // Change size every 1.2-2 seconds
}

// Add this variable to track the movement interval
let hardModeMovementInterval = null;

// Add function for time-based movement
function startHardModeMovementInterval() {
  if (currentMode !== 'hard' || gameOver) return;
  
  // Clear any existing interval first
  if (hardModeMovementInterval) {
    clearInterval(hardModeMovementInterval);
  }
  
  hardModeMovementInterval = setInterval(() => {
    if (gameOver) {
      clearInterval(hardModeMovementInterval);
      return;
    }
    
    // Move to a random position
    moveCollinToRandomPosition();
    
  }, 1000 + Math.random() * 1500); // Move every 2.5-4 seconds
}

// Create a function to handle the random movement logic
function moveCollinToRandomPosition() {
  if (gameOver) return;
  
  const maxX = window.innerWidth - imageContainer.offsetWidth;
  const maxY = window.innerHeight - imageContainer.offsetHeight - 100; // Leave space for UI
  
  const newX = Math.random() * Math.max(maxX, 0);
  const newY = Math.random() * Math.max(maxY, 100) + 100; // Keep some space from top
  
  imageContainer.style.position = 'absolute';
  imageContainer.style.left = newX + 'px';
  imageContainer.style.top = newY + 'px';
}
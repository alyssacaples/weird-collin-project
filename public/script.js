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

function switchTab(tabType) {
  currentScoreType = tabType;
  
  // Update active tab UI
  const allTimeTab = document.getElementById('all-time-tab');
  const dailyTab = document.getElementById('daily-tab');
  
  if (tabType === 'allTime') {
    allTimeTab.classList.add('active');
    dailyTab.classList.remove('active');
  } else {
    dailyTab.classList.add('active');
    allTimeTab.classList.remove('active');
  }
  
  // Display the appropriate scores for the selected tab and current mode
  displayCurrentScores();
}

// Check or update your getApiEndpoints function
function getApiEndpoints(mode, scoreType) {
  const prefix = mode === 'hard' ? 'Hard' : '';
  const suffix = scoreType === 'daily' ? 'Daily' : '';
  
  return {
    get: `/api/get${prefix}${suffix}HighScores`,
    submit: `/api/submit${prefix}Score`  // Make sure this matches your API paths
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

// Update the loadHighScores function
function loadHighScores() {
  const endpoints = getApiEndpoints(currentMode, currentScoreType);
  debugLog(`Loading scores for mode: ${currentMode}, type: ${currentScoreType}`, endpoints);
  
  const scoresList = document.getElementById('high-scores-list');
  
  // Show loading message
  scoresList.innerHTML = '<div class="loading">Loading high scores...</div>';
  
  fetch(endpoints.get)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      // Store in cache based on mode and score type
      if (currentMode === 'hard') {
        if (currentScoreType === 'daily') {
          cachedHardDailyScores = data;
        } else {
          cachedHardAllTimeScores = data;
        }
      } else {
        if (currentScoreType === 'daily') {
          cachedDailyScores = data;
        } else {
          cachedAllTimeScores = data;
        }
      }
      
      // Update scoresLoaded flag
      scoresLoaded = true;
      
      // Display the scores
      displayHighScores(data);
    })
    .catch(error => {
      console.error('Error loading high scores:', error);
      scoresList.innerHTML = '<div class="error">Error loading high scores. Please try again later.</div>';
    });
}

// Separated display function - uses cached data
function displayCurrentScores() {
  let cachedScores;
  
  // Choose the correct cached scores based on current mode and type
  if (currentMode === 'hard') {
    cachedScores = currentScoreType === 'daily' ? cachedHardDailyScores : cachedHardAllTimeScores;
  } else {
    cachedScores = currentScoreType === 'daily' ? cachedDailyScores : cachedAllTimeScores;
  }
  
  if (cachedScores && cachedScores.length > 0) {
    displayHighScores(cachedScores);
  } else {
    loadHighScores();
  }
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

// Update the checkIfQualifiesForHighScore function
function checkIfQualifiesForHighScore(time) {
  // Get the appropriate cached scores based on current mode
  let cachedScores;
  
  if (currentMode === 'hard') {
    cachedScores = currentScoreType === 'daily' ? cachedHardDailyScores : cachedHardAllTimeScores;
  } else {
    cachedScores = currentScoreType === 'daily' ? cachedDailyScores : cachedAllTimeScores;
  }
  
  // If no scores loaded yet, show the form
  if (!cachedScores || cachedScores.length === 0) {
    scoreSubmission.style.display = 'block';
    return;
  }
  
  // Check if the current score qualifies for the leaderboard
  const lowestScore = cachedScores[cachedScores.length - 1];
  
  // If less than 10 scores or better than the lowest score
  if (cachedScores.length < 10 || time < lowestScore.time) {
    scoreSubmission.style.display = 'block';
  }
}

const DEBUG = true;

// Add this helper function for logging
function debugLog(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

// Update your submitScore function if needed
function submitScore() {
  const playerName = playerNameInput.value.trim();
  
  if (!playerName) {
    submissionStatus.innerHTML = '<div class="error">Please enter your name</div>';
    return;
  }
  
  submitScoreBtn.disabled = true;
  submissionStatus.innerHTML = '<div class="loading">Submitting score...</div>';
  
  // Make sure field names match what your API expects
  const scoreData = {
    playerName: playerName,  // Use playerName to match API
    time: liveTimeSeconds    // Use time to match API
  };
  
  console.log(`Submitting score for mode: ${currentMode}`, scoreData);
  
  const endpoints = getApiEndpoints(currentMode, 'allTime');
  console.log(`Using endpoint: ${endpoints.submit}`);
  
  fetch(endpoints.submit, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(scoreData)
  })
  .then(response => {
    console.log(`Response status: ${response.status}`);
    if (!response.ok) {
      return response.text().then(text => {
        console.error(`Error response: ${text}`);
        throw new Error(`Network response was not ok: ${response.status}`);
      });
    }
    return response.json();
  })
  .then(data => {
    console.log('Submit success:', data);
    submissionStatus.innerHTML = '<div class="success">Score submitted successfully!</div>';
    
    // Clear cached scores to force reload
    if (currentMode === 'hard') {
      cachedHardAllTimeScores = null;
      cachedHardDailyScores = null;
    } else {
      cachedAllTimeScores = null;
      cachedDailyScores = null;
    }
    
    // Force reload high scores with a slight delay to allow server processing
    setTimeout(() => {
      loadHighScores();
    }, 500);
    
    // Hide submission form after delay
    setTimeout(() => {
      scoreSubmission.style.display = 'none';
    }, 2000);
  })
  .catch(error => {
    console.error('Error submitting score:', error);
    submissionStatus.innerHTML = `<div class="error">Error submitting score. Please try again.</div>`;
    submitScoreBtn.disabled = false;
  });
}

// Create floating Collins for hard mode background
function createFloatingCollins() {
  console.log('Creating floating Collins');
  
  // Remove existing container if any
  const existingContainer = document.querySelector('.floating-collins-container');
  if (existingContainer) {
    existingContainer.remove();
  }
  
  // Create new container
  const container = document.createElement('div');
  container.className = 'floating-collins-container';
  document.body.appendChild(container);
  
  console.log('Container created:', container);
  
  // Create 15 random floating Collins with better styling
  for (let i = 0; i < 15; i++) {
    const collin = document.createElement('div');
    collin.className = 'floating-collin';
    
    // Add actual image to each collin
    const collinImg = document.createElement('img');
    collinImg.src = 'collin.PNG';
    collinImg.alt = 'Floating Collin';
    collinImg.style.width = '100%';
    collinImg.style.height = '100%';
    collin.appendChild(collinImg);
    
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
    collin.style.opacity = '0.2'; // Start with some opacity
    
    container.appendChild(collin);
    console.log(`Collin ${i+1} created`);
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
    const randomSize = 10 + (Math.random() * 40);
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
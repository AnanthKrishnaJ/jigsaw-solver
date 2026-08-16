// JigsawPlanet Auto-Solver Extension Popup JS
document.addEventListener('DOMContentLoaded', () => {
    const btnElapsed = document.getElementById('btn-solve-elapsed');
    const btnCustom = document.getElementById('btn-solve-custom');
    const inputCustom = document.getElementById('custom-time-input');
    const statusBox = document.getElementById('status-box');
    
    // GIF Looping Logic
    let dancingGif = document.getElementById('dancing-girl-gif');
    if (dancingGif) {
        const gifs = ['dance1.gif', 'dance2.gif', 'dance3.gif'];
        let currentGifIndex = 0;
        
        setInterval(() => {
            currentGifIndex = (currentGifIndex + 1) % gifs.length;
            
            // Re-trigger CSS animation by cloning and replacing
            const newGif = dancingGif.cloneNode(true);
            newGif.src = gifs[currentGifIndex];
            dancingGif.parentNode.replaceChild(newGif, dancingGif);
            
            // Update reference so next loop replaces the right element
            dancingGif = newGif;
        }, 4000);
    }

    function showStatus(msg, isError = false) {
        statusBox.textContent = msg;
        statusBox.className = 'status-box' + (isError ? ' error' : '');
        statusBox.style.display = 'block';
    }

    function parseTimeString(str) {
        if (!str) return null;
        str = str.trim();
        if (str.includes(':')) {
            const parts = str.split(':');
            const m = parseInt(parts[0], 10) || 0;
            const s = parseInt(parts[1], 10) || 0;
            return m * 60 + s;
        }
        const num = parseInt(str, 10);
        return isNaN(num) ? null : num;
    }

    async function sendSolveRequest(targetSeconds = null) {
        try {
            showStatus('⏳ Solving puzzle...');
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab || !tab.url || !tab.url.includes('jigsawplanet.com')) {
                showStatus('⚠️ Open a JigsawPlanet puzzle page first!', true);
                return;
            }

            // Execute script in tab MAIN world to trigger solver
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: (seconds) => {
                    if (window.__jp_solve_puzzle) {
                        return window.__jp_solve_puzzle(seconds);
                    } else {
                        return { error: 'JigsawPlanet solver not initialized on page.' };
                    }
                },
                args: [targetSeconds]
            });

            const res = results[0]?.result;
            if (res && res.error) {
                showStatus('❌ ' + res.error, true);
            } else if (res && res.success) {
                showStatus(`🎉 Solved 100% (${res.timeStr})!`);
            } else {
                showStatus('🎉 Solve command sent!');
            }
        } catch (err) {
            showStatus('❌ Error: ' + err.message, true);
        }
    }

    btnElapsed.addEventListener('click', () => {
        sendSolveRequest(null);
    });

    btnCustom.addEventListener('click', () => {
        const val = inputCustom.value;
        const secs = parseTimeString(val);
        if (secs === null) {
            showStatus('⚠️ Enter time like 02:30 or 150', true);
            return;
        }
        sendSolveRequest(secs);
    });
});

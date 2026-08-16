// background.js - service worker
// Injects the solver into the page using chrome.scripting (most reliable MV3 method)

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'loading' && tab.url && tab.url.includes('jigsawplanet.com')) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            world: 'MAIN',
            injectImmediately: true,
            func: function() {
                let hooked = false;
                let timer = setInterval(function() {
                    if (window.tibo && window.tibo.jp && window.tibo.jp.game && window.tibo.jp.game.putPuzzle) {
                        if (!hooked) {
                            hooked = true;
                            let original = window.tibo.jp.game.putPuzzle;
                            window.tibo.jp.game.putPuzzle = function() {
                                let args = Array.from(arguments);
                                if (args[1]) {
                                    args[1].puzzleNx = 1;
                                    args[1].puzzleNy = 1;
                                }
                                return original.apply(this, args);
                            };
                            clearInterval(timer);
                            console.log('[JigsawSolver] Hooked! Puzzle will be 1 piece.');
                        }
                    }
                }, 1);
            }
        });
    }
});

(function() {
    console.log("[JigsawSolver] Inject script loaded.");
    
    // We need to intercept `tibo.jp.game.putPuzzle`.
    // Since `tibo` is created dynamically by the page scripts, we use Object.defineProperty
    // to deeply hook into window.tibo.jp.game.putPuzzle as it gets created.

    let _tibo = window.tibo;
    Object.defineProperty(window, 'tibo', {
        get: function() {
            return _tibo;
        },
        set: function(val) {
            _tibo = val;
            hookTibo(_tibo);
        },
        configurable: true
    });
    
    function hookTibo(tiboObj) {
        if (!tiboObj) return;
        
        let _jp = tiboObj.jp;
        Object.defineProperty(tiboObj, 'jp', {
            get: function() { return _jp; },
            set: function(val) {
                _jp = val;
                hookJp(_jp);
            },
            configurable: true
        });
        
        if (_jp) hookJp(_jp);
    }
    
    function hookJp(jpObj) {
        if (!jpObj) return;
        
        let _game = jpObj.game;
        Object.defineProperty(jpObj, 'game', {
            get: function() { return _game; },
            set: function(val) {
                _game = val;
                hookGame(_game);
            },
            configurable: true
        });
        
        if (_game) hookGame(_game);
    }
    
    function hookGame(gameObj) {
        if (!gameObj) return;
        
        let originalPutPuzzle = gameObj.putPuzzle;
        
        Object.defineProperty(gameObj, 'putPuzzle', {
            get: function() {
                return function(...args) {
                    console.log("[JigsawSolver] Intercepted putPuzzle:", args);
                    
                    // We modify the third argument which contains game settings
                    if (args.length > 2 && args[2]) {
                        console.log("[JigsawSolver] Auto-enabling Ghost and Image settings.");
                        args[2].gmShowImageOnStart = true;
                        args[2].gmShowGhostOnStart = true;
                        args[2].gmGhostOpacity = 75; // Make the ghost quite visible
                        args[2].gmShowGhostOutlineIfHidden = true;
                    }
                    
                    if (originalPutPuzzle) {
                        return originalPutPuzzle.apply(this, args);
                    }
                };
            },
            set: function(val) {
                originalPutPuzzle = val;
            },
            configurable: true
        });
    }
    
    // In case tibo is already defined before our script runs
    if (_tibo) hookTibo(_tibo);
})();

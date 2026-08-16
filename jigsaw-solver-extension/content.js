// JigsawPlanet Auto-Solver Extension Content Script (MAIN World)
(function() {
    if (window.__jp_solver_injected) return;
    window.__jp_solver_injected = true;

    console.log("[JigsawPlanet Solver Extension] Content script active in MAIN world.");

    window.__jp_page_start_time = Date.now();
    let origPutPuzzle = null;

    function hookPutPuzzle() {
        if (window.tibo && window.tibo.jp && window.tibo.jp.game && window.tibo.jp.game.putPuzzle) {
            if (window.tibo.jp.game.putPuzzle.__hooked) return;
            origPutPuzzle = window.tibo.jp.game.putPuzzle;
            window.tibo.jp.game.putPuzzle = function(...args) {
                console.log("[JigsawPlanet Solver] Capturing putPuzzle promise...");
                const p = origPutPuzzle.apply(this, args);
                window.__jp_instance_promise = p;
                return p;
            };
            window.tibo.jp.game.putPuzzle.__hooked = true;
        }
    }

    const timer = setInterval(() => {
        hookPutPuzzle();
        if (window.__jp_instance_promise) clearInterval(timer);
    }, 1);

    function formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    // Expose global solver function for extension toolbar popup
    window.__jp_solve_puzzle = async function solvePuzzle(targetSeconds = null) {
        try {
            let putRes = null;
            if (window.__jp_instance_promise) {
                putRes = await window.__jp_instance_promise;
            }

            // Fallback: If not captured on load, capture via targetLine
            if (!putRes) {
                const scripts = Array.from(document.querySelectorAll('script'));
                let targetLine = '';
                for (const s of scripts) {
                    if (s.textContent && s.textContent.includes('tibo.jp.game.putPuzzle')) {
                        const lines = s.textContent.split('\n');
                        for (const l of lines) {
                            if (l.includes('tibo.jp.game.putPuzzle')) {
                                targetLine = l.trim();
                                break;
                            }
                        }
                    }
                }
                if (targetLine && window.tibo && window.tibo.jp) {
                    let captured = null;
                    const orig = window.tibo.jp.game.putPuzzle;
                    window.tibo.jp.game.putPuzzle = function(...args) {
                        return orig.apply(this, args).then(res => { captured = res; return res; });
                    };
                    eval(targetLine);
                    for (let t = 0; t < 40; t++) {
                        if (captured) break;
                        await new Promise(r => setTimeout(r, 100));
                    }
                    putRes = captured;
                }
            }

            if (!putRes || !putRes.instance) {
                return { error: 'Could not capture game instance.' };
            }

            const nKInst = putRes.instance;
            const FJ = nKInst.i;
            const YH = FJ.h.find(c => c && c.constructor && c.constructor.name === 'YH');

            if (!YH) {
                return { error: 'Game engine YH not found.' };
            }

            // Wait for piece objects (rG) to populate in YH.h
            let pieces = [];
            for (let t = 0; t < 60; t++) {
                pieces = YH.h ? YH.h.filter(c => c && c.constructor && c.constructor.name === 'rG') : [];
                if (pieces.length > 0) break;
                await new Promise(r => setTimeout(r, 100));
            }

            console.log(`[JigsawPlanet Solver] Loaded ${pieces.length} piece objects.`);

            if (pieces.length === 0) {
                return { error: 'No puzzle pieces found to solve.' };
            }

            // Calculate finish time if not specified
            if (targetSeconds === null) {
                targetSeconds = Math.max(1, Math.floor((Date.now() - window.__jp_page_start_time) / 1000));
            }

            // Set Stopwatch YH.F time by backdating start timestamp
            if (YH.F) {
                YH.F.h = true; // active
                YH.F.i = 0;
                const now = (YH.F.l ? (window.performance ? performance.now() : Date.now()) : Date.now());
                YH.F.o = now - (targetSeconds * 1000);
            }

            // 1. Reset rotation (g = 0) and set target position (ga.x, ga.y)
            pieces.forEach(p => {
                p.g = 0;
                p.Y(p.ga.x, p.ga.y);
            });

            // 2. Perform passes of ma() and D() until 1 group remains
            let passes = 0;
            while (passes < 30) {
                passes++;
                const parents = new Set();
                pieces.forEach(p => {
                    let par = p;
                    while (par.getParent && par.getParent() !== YH && par.getParent() !== null) {
                        par = par.getParent();
                    }
                    parents.add(par);
                });

                if (parents.size <= 1) break;

                parents.forEach(g => {
                    if (typeof g.ma === 'function') g.ma();
                    if (typeof g.D === 'function') g.D();
                });
            }

            const timeStr = formatTime(targetSeconds);
            console.log(`[JigsawPlanet Solver] Solved 100% in ${timeStr} (${targetSeconds}s)!`);

            return {
                success: true,
                piecesCount: pieces.length,
                targetSeconds,
                timeStr
            };
        } catch (e) {
            console.error('[JigsawPlanet Solver Error]', e);
            return { error: e.message };
        }
    };
})();

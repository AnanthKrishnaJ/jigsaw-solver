// JigsawPlanet Auto-Solver Extension Content Script (MAIN World)
(function () {
    if (window.__jp_solver_injected) return;
    window.__jp_solver_injected = true;

    console.log("[JigsawPlanet Solver Extension] Content script active in MAIN world.");

    window.__jp_page_start_time = Date.now();

    let origPutPuzzle = null;

    // ------------------------------------------------------------
    // Capture JigsawPlanet's putPuzzle() result
    // ------------------------------------------------------------
    function hookPutPuzzle() {
        const game =
            window.tibo &&
            window.tibo.jp &&
            window.tibo.jp.game;

        if (!game || typeof game.putPuzzle !== "function") {
            return false;
        }

        if (game.putPuzzle.__jp_solver_hooked) {
            return true;
        }

        origPutPuzzle = game.putPuzzle;

        game.putPuzzle = function (...args) {
            console.log("[JigsawPlanet Solver] Capturing putPuzzle promise...");

            const result = origPutPuzzle.apply(this, args);

            window.__jp_instance_promise = Promise.resolve(result);

            return result;
        };

        game.putPuzzle.__jp_solver_hooked = true;

        console.log("[JigsawPlanet Solver] putPuzzle hooked successfully.");

        return true;
    }

    // Try to hook as early as possible.
    hookPutPuzzle();

    const timer = setInterval(() => {
        if (hookPutPuzzle()) {
            clearInterval(timer);
        }
    }, 1);

    // ------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function formatTime(sec) {
        sec = Math.max(0, Math.floor(sec));

        const m = Math.floor(sec / 60);
        const s = sec % 60;

        return `${m}:${s < 10 ? "0" : ""}${s}`;
    }

    // ------------------------------------------------------------
    // Get the current JigsawPlanet puzzle engine
    //
    // Older version:
    //     instance.i.h -> YH
    //
    // Current version:
    //     instance.i.g -> ZH
    //
    // We deliberately do NOT depend on constructor names.
    // ------------------------------------------------------------

    function getGameEngine(instance) {
        const game = instance?.i;

        if (!game) {
            return null;
        }

        // Current JigsawPlanet implementation.
        //
        // The current engine contains:
        //     Ha = puzzle pieces
        //
        if (
            game.g &&
            typeof game.g === "object" &&
            Array.isArray(game.g.Ha)
        ) {
            return game.g;
        }

        // Compatibility fallback.
        if (Array.isArray(game.h)) {
            const engine = game.h.find(
                obj =>
                    obj &&
                    typeof obj === "object" &&
                    Array.isArray(obj.Ha)
            );

            if (engine) {
                return engine;
            }
        }

        return null;
    }

    // ------------------------------------------------------------
    // Wait for the puzzle engine and pieces
    // ------------------------------------------------------------

    async function waitForGameEngine(instance) {
        for (let attempt = 0; attempt < 100; attempt++) {
            const engine = getGameEngine(instance);

            if (engine) {
                return engine;
            }

            await sleep(100);
        }

        return null;
    }

    async function waitForPieces(engine) {
        for (let attempt = 0; attempt < 100; attempt++) {
            if (Array.isArray(engine.Ha) && engine.Ha.length > 0) {
                const pieces = engine.Ha.filter(
                    p =>
                        p &&
                        typeof p.Y === "function" &&
                        typeof p.getParent === "function"
                );

                if (pieces.length > 0) {
                    return pieces;
                }
            }

            await sleep(100);
        }

        return [];
    }

    // ------------------------------------------------------------
    // Find the root group of a puzzle piece
    // ------------------------------------------------------------

    function getRoot(piece, engine) {
        let current = piece;

        for (let guard = 0; guard < 100; guard++) {
            if (
                !current ||
                typeof current.getParent !== "function"
            ) {
                break;
            }

            const parent = current.getParent();

            if (
                !parent ||
                parent === current ||
                parent === engine
            ) {
                break;
            }

            current = parent;
        }

        return current;
    }

    // ------------------------------------------------------------
    // Count current puzzle groups
    // ------------------------------------------------------------

    function getGroups(pieces, engine) {
        const groups = new Set();

        for (const piece of pieces) {
            groups.add(getRoot(piece, engine));
        }

        return groups;
    }

    // ------------------------------------------------------------
    // Expose solver to popup
    // ------------------------------------------------------------

    window.__jp_solve_puzzle = async function solvePuzzle(
        targetSeconds = null
    ) {
        try {
            console.log("[JigsawPlanet Solver] Starting solver...");

            // --------------------------------------------------------
            // 1. Get the game instance
            // --------------------------------------------------------

            let putRes = null;

            if (window.__jp_instance_promise) {
                try {
                    putRes = await window.__jp_instance_promise;
                } catch (error) {
                    console.error(
                        "[JigsawPlanet Solver] putPuzzle promise failed:",
                        error
                    );
                }
            }

            if (!putRes || !putRes.instance) {
                return {
                    error:
                        "Could not capture the JigsawPlanet game instance. " +
                        "Reload the puzzle and try again."
                };
            }

            const instance = putRes.instance;

            console.log(
                "[JigsawPlanet Solver] Game instance:",
                instance
            );

            // --------------------------------------------------------
            // 2. Find current game engine
            // --------------------------------------------------------

            const engine = await waitForGameEngine(instance);

            if (!engine) {
                return {
                    error:
                        "JigsawPlanet game engine was not initialized. " +
                        "Make sure the puzzle is fully loaded and the browser " +
                        "window is large enough, then reload the page."
                };
            }

            console.log(
                "[JigsawPlanet Solver] Current game engine:",
                engine
            );

            console.log(
                "[JigsawPlanet Solver] Engine constructor:",
                engine.constructor?.name
            );

            // --------------------------------------------------------
            // 3. Get puzzle pieces
            // --------------------------------------------------------

            const pieces = await waitForPieces(engine);

            console.log(
                `[JigsawPlanet Solver] Loaded ${pieces.length} puzzle pieces.`
            );

            if (pieces.length === 0) {
                return {
                    error: "No puzzle pieces found to solve."
                };
            }

            // --------------------------------------------------------
            // 4. Determine target finish time
            // --------------------------------------------------------

            if (targetSeconds === null) {
                targetSeconds = Math.max(
                    1,
                    Math.floor(
                        (Date.now() - window.__jp_page_start_time) / 1000
                    )
                );
            }

            targetSeconds = Math.max(
                1,
                Math.floor(Number(targetSeconds) || 1)
            );

            console.log(
                `[JigsawPlanet Solver] Target time: ${formatTime(targetSeconds)}`
            );

            // --------------------------------------------------------
            // 5. Reset rotations and put pieces at their solution
            //    coordinates.
            //
            // Current JigsawPlanet pieces use:
            //     g  = rotation
            //     ga = target position
            //     Y  = position setter
            // --------------------------------------------------------

            let positioned = 0;

            for (const piece of pieces) {
                try {
                    piece.g = 0;

                    if (
                        piece.ga &&
                        typeof piece.ga.x === "number" &&
                        typeof piece.ga.y === "number"
                    ) {
                        piece.Y(
                            piece.ga.x,
                            piece.ga.y
                        );

                        positioned++;
                    }
                } catch (error) {
                    console.warn(
                        "[JigsawPlanet Solver] Failed to position piece:",
                        error
                    );
                }
            }

            console.log(
                `[JigsawPlanet Solver] Positioned ${positioned}/${pieces.length} pieces.`
            );

            // Give JigsawPlanet a moment to update its internal state.
            await sleep(100);

            // --------------------------------------------------------
            // 6. Merge pieces
            //
            // The current JigsawPlanet implementation uses the group's
            // la() method to find/merge compatible pieces.
            // --------------------------------------------------------

            let previousGroupCount = Infinity;

            for (let pass = 1; pass <= 100; pass++) {
                const groupsBefore = getGroups(
                    pieces,
                    engine
                );

                console.log(
                    `[JigsawPlanet Solver] Pass ${pass}: ` +
                    `${groupsBefore.size} groups.`
                );

                if (groupsBefore.size <= 1) {
                    break;
                }

                let changed = false;

                for (const group of groupsBefore) {
                    try {
                        if (
                            group &&
                            typeof group.la === "function"
                        ) {
                            const result = group.la();

                            if (result) {
                                changed = true;
                            }
                        }
                    } catch (error) {
                        console.warn(
                            "[JigsawPlanet Solver] Group merge error:",
                            error
                        );
                    }
                }

                await sleep(50);

                const groupsAfter = getGroups(
                    pieces,
                    engine
                );

                console.log(
                    `[JigsawPlanet Solver] After pass ${pass}: ` +
                    `${groupsAfter.size} groups.`
                );

                if (groupsAfter.size <= 1) {
                    break;
                }

                if (
                    !changed &&
                    groupsAfter.size >= previousGroupCount
                ) {
                    console.log(
                        "[JigsawPlanet Solver] No further automatic merges."
                    );
                    break;
                }

                previousGroupCount = groupsAfter.size;
            }

            // --------------------------------------------------------
            // 7. Final group check
            // --------------------------------------------------------

            const finalGroups = getGroups(
                pieces,
                engine
            );

            console.log(
                `[JigsawPlanet Solver] Final groups: ${finalGroups.size}`
            );

            // --------------------------------------------------------
            // 8. Report result
            // --------------------------------------------------------

            const timeStr = formatTime(targetSeconds);

            if (finalGroups.size <= 1) {
                console.log(
                    `[JigsawPlanet Solver] Solved 100% in ${timeStr}!`
                );

                return {
                    success: true,
                    piecesCount: pieces.length,
                    groups: 1,
                    targetSeconds,
                    timeStr
                };
            }

            console.warn(
                `[JigsawPlanet Solver] Pieces positioned, ` +
                `but ${finalGroups.size} groups remain.`
            );

            return {
                success: false,
                piecesCount: pieces.length,
                groups: finalGroups.size,
                targetSeconds,
                timeStr,
                error:
                    `Pieces were positioned but ${finalGroups.size} ` +
                    "groups remain."
            };

        } catch (error) {
            console.error(
                "[JigsawPlanet Solver Error]",
                error
            );

            return {
                error:
                    error?.message ||
                    String(error)
            };
        }
    };
})();

function shouldShowAnalysis() {
    if (!analysisEnabled) return false;
    if (lichessGameActive) {
        return game.turn() === userColor;
    }
    if (reviewMode) {
        return true;
    }
    return false;
}


// Motor de Análisis en tiempo real (Lichess Cloud + Fallback Stockfish Online)
async function fetchRealTimeAnalysis(fen) {
    if (!shouldShowAnalysis()) {
        currentGoldSuggestion = null;
        redrawGoldArrowsOnly();
        return;
    }

    if (currentAnalysisAbortController) {
        currentAnalysisAbortController.abort();
    }
    currentAnalysisAbortController = new AbortController();
    const signal = currentAnalysisAbortController.signal;

    // 1. Intentar con Lichess Cloud Evaluation primero
    try {
        const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}`;
        const response = await fetch(url, { signal });
        if (response.ok) {
            const data = await response.json();
            if (data.pvs && data.pvs.length > 0) {
                currentGoldSuggestion = data.pvs.map(pv => pv.moves.split(' ')[0]);
                redrawGoldArrowsOnly();
                return;
            }
        }
    } catch (e) {
        if (e.name === 'AbortError') return;
        console.log("Lichess Cloud Eval desestimado/error. Usando fallback...");
    }

    // 2. Fallback a Stockfish Online (Profundidad 10 para máxima velocidad de respuesta)
    try {
        const url = `https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(fen)}&depth=10`;
        const response = await fetch(url, { signal });
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.bestmove) {
                const parts = data.bestmove.split(' ');
                if (parts[1] && parts[1] !== '(none)') {
                    currentGoldSuggestion = [parts[1]];
                    redrawGoldArrowsOnly();
                }
            }
        }
    } catch (e) {
        if (e.name === 'AbortError') return;
        console.error("Stockfish Online falló:", e);
    }
}

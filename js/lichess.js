function toggleTokenVisibility() {
    const input = document.getElementById('lichess-token-input');
    const icon = document.getElementById('token-eye-icon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function handleTokenInput(val) {
    lichessToken = val.trim();
    localStorage.setItem('lichess_token', lichessToken);
}

// Lógica de Lichess API
async function startLichessGame() {
    if (!lichessToken) {
        alert("Por favor ingresa un Lichess Token válido en la configuración.");
        return;
    }

    const level = document.getElementById('lichess-level-select').value;
    const color = document.getElementById('lichess-color-select').value;
    const timeVal = document.getElementById('lichess-time-select').value.split(',');
    const limit = parseInt(timeVal[0]);
    const increment = parseInt(timeVal[1]);

    const btn = document.getElementById('start-game-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i> Creando partida en Lichess...`;

    try {
        const response = await fetch('https://lichess.org/api/challenge/ai', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${lichessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                'level': level,
                'color': color,
                'clock.limit': limit,
                'clock.increment': increment,
                'variant': 'standard'
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        
        // Configurar estado
        lichessGameActive = true;
        lichessGameId = data.id;
        // Determinar el color del usuario de forma robusta a partir de los datos de los jugadores de Lichess
        let userColorVal = 'w';
        const whitePlayer = data.white || (data.players && data.players.white);
        const blackPlayer = data.black || (data.players && data.players.black);

        if (whitePlayer && blackPlayer) {
            const isWhiteAi = !!(whitePlayer.ai || whitePlayer.aiLevel || (!whitePlayer.user && !whitePlayer.id));
            const isBlackHuman = !!(blackPlayer.user || (blackPlayer.id && blackPlayer.id !== 'lichess-ai'));
            
            if (isWhiteAi || isBlackHuman) {
                userColorVal = 'b';
            } else {
                userColorVal = 'w';
            }
        } else if (data.color) {
            userColorVal = data.color === 'white' ? 'w' : 'b';
        } else {
            userColorVal = color === 'black' ? 'b' : 'w';
        }
        
        userColor = userColorVal;
        isFlipped = (userColor === 'b');

        // Mostrar interfaz de juego activo
        document.getElementById('lichess-config-panel').classList.add('hidden');
        const activePanel = document.getElementById('lichess-active-panel');
        activePanel.classList.remove('hidden');

        document.getElementById('lichess-game-link').href = data.url;
        
        // Limpiar juego local
        game.reset();
        selectedSquare = null;
        renderBoard();

        // Comenzar stream y polling
        startLichessStream(data.id);

    } catch (e) {
        alert("Error al iniciar partida en Lichess: " + e.message);
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-play-circle text-lg"></i> Iniciar Partida contra Bot`;
    }
}

async function sendMoveToLichess(moveUci) {
    try {
        const response = await fetch(`https://lichess.org/api/board/game/${lichessGameId}/move/${moveUci}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${lichessToken}`
            }
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error("Lichess move error:", err);
            alert("Jugada rechazada por Lichess: " + (err.error || response.statusText));
            game.undo();
            renderBoard();
        }
    } catch (e) {
        console.error("Error al enviar jugada:", e);
        alert("Error de conexión al enviar jugada a Lichess.");
        game.undo();
        renderBoard();
    }
}

async function resignLichessGame() {
    if (!lichessGameActive || !lichessGameId) return;
    if (!confirm("¿Estás seguro de que deseas abandonar la partida en Lichess?")) return;

    try {
        const response = await fetch(`https://lichess.org/api/board/game/${lichessGameId}/resign`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${lichessToken}`
            }
        });

        if (response.ok) {
            stopLichessSession();
            document.getElementById('lichess-game-status').innerText = "Abandonaste la partida.";
            alert("Partida abandonada correctamente.");
        } else {
            const err = await response.json().catch(() => ({}));
            alert("Error al abandonar partida: " + (err.error || response.statusText));
        }
    } catch (e) {
        console.error("Resign error:", e);
        stopLichessSession();
    }
}

function stopLichessSession() {
    lichessGameActive = false;
    if (streamAbortController) {
        streamAbortController.abort();
        streamAbortController = null;
    }
    if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
    }

    document.getElementById('lichess-active-panel').classList.add('hidden');
    document.getElementById('lichess-config-panel').classList.remove('hidden');
    renderBoard();
}

// Conectar al Stream de Lichess
async function startLichessStream(gameId) {
    if (streamAbortController) {
        streamAbortController.abort();
    }
    streamAbortController = new AbortController();
    const signal = streamAbortController.signal;

    // Iniciar polling reactivo en paralelo como contingencia de velocidad/proxy de inmediato
    startLichessPolling(gameId);

    try {
        const response = await fetch(`https://lichess.org/api/board/game/stream/${gameId}`, {
            headers: {
                'Authorization': `Bearer ${lichessToken}`
            },
            signal
        });

        if (!response.ok) {
            throw new Error("Fallo en la conexión del stream.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const event = JSON.parse(line);
                        handleLichessEvent(event);
                    } catch (e) {
                        console.error("Error al procesar línea de stream:", e);
                    }
                }
            }
        }

    } catch (e) {
        if (e.name === 'AbortError') return;
        console.warn("Stream cerrado, operando bajo modo polling.");
    }
}

// Contingencia de Polling inteligente y rápido
function startLichessPolling(gameId) {
    if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
    }

    pollingIntervalId = setInterval(async () => {
        if (!lichessGameActive || lichessGameId !== gameId) {
            clearInterval(pollingIntervalId);
            return;
        }

        try {
            const response = await fetch(`https://lichess.org/game/export/${gameId}`, {
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                // Actualizar nombres y determinar color del usuario
                if (data.players) {
                    const whiteIsAi = !!(data.players.white.aiLevel || data.players.white.ai || (!data.players.white.user && !data.players.white.id));
                    const blackIsAi = !!(data.players.black.aiLevel || data.players.black.ai || (!data.players.black.user && !data.players.black.id));
                    
                    let detectedColor = 'w';
                    if (whiteIsAi) {
                        detectedColor = 'b';
                    } else if (blackIsAi) {
                        detectedColor = 'w';
                    } else {
                        detectedColor = userColor || 'w';
                    }

                    if (userColor !== detectedColor) {
                        userColor = detectedColor;
                        isFlipped = (userColor === 'b');
                        renderBoard();
                    }

                    const whiteName = data.players.white.user ? data.players.white.user.name : `Stockfish Nivel ${data.players.white.aiLevel}`;
                    const blackName = data.players.black.user ? data.players.black.user.name : `Stockfish Nivel ${data.players.black.aiLevel}`;
                    const playersEl = document.getElementById('lichess-players');
                    if (playersEl) {
                        playersEl.innerText = `${whiteName} vs ${blackName}`;
                    }
                }

                const event = {
                    type: 'gameState',
                    moves: data.moves || '',
                    status: data.status
                };
                handleLichessEvent(event);
            }
        } catch (e) {
            console.error("Error en polling de contingencia:", e);
        }
    }, 2000);
}

function handleLichessEvent(event) {
    let movesStr = "";
    let status = "";
    let colorChanged = false;

    if (event.type === 'gameFull') {
        movesStr = event.state.moves;
        status = event.state.status;

        // Determinar el color del usuario de forma extremadamente robusta
        const whiteIsAi = !!(event.white.aiLevel || event.white.ai || (!event.white.user && !event.white.id) || (event.white.id && event.white.id.toLowerCase().includes('ai')));
        const blackIsAi = !!(event.black.aiLevel || event.black.ai || (!event.black.user && !event.black.id) || (event.black.id && event.black.id.toLowerCase().includes('ai')));
        
        let detectedColor = 'w';
        if (whiteIsAi) {
            detectedColor = 'b';
        } else if (blackIsAi) {
            detectedColor = 'w';
        } else {
            detectedColor = userColor || 'w';
        }

        if (userColor !== detectedColor) {
            userColor = detectedColor;
            isFlipped = (userColor === 'b');
            colorChanged = true;
        }

        // Formatear los nombres de forma legible
        const whiteName = event.white.user ? event.white.user.name : (event.white.name || `Stockfish Nivel ${event.white.aiLevel || 1}`);
        const blackName = event.black.user ? event.black.user.name : (event.black.name || `Stockfish Nivel ${event.black.aiLevel || 1}`);
        
        const playersEl = document.getElementById('lichess-players');
        if (playersEl) {
            playersEl.innerText = `${whiteName} vs ${blackName}`;
        }
    } else if (event.type === 'gameState') {
        movesStr = event.moves;
        status = event.status;
    } else {
        return;
    }

    const movesArray = movesStr.trim() ? movesStr.split(' ') : [];
    
    // Evitar que respuestas desactualizadas (por desfase de red o de polling de contingencia)
    // deshagan movimientos locales ya confirmados o más recientes en el tablero.
    if (movesArray.length < game.history().length) {
        return;
    }
    
    // Replay de todas las jugadas para asegurar la precisión
    const tempGame = new Chess();
    for (const m of movesArray) {
        tempGame.move(m, { sloppy: true });
    }

    // Si hay diferencias o cambió el color, aplicar movimientos y actualizar UI
    if (tempGame.fen() !== game.fen() || colorChanged) {
        // Detectar si fue un movimiento del bot para animar
        const historyVerbose = tempGame.history({ verbose: true });
        const lastMove = historyVerbose[historyVerbose.length - 1];
        const isNewMove = tempGame.history().length > game.history().length;
        if (lichessGameActive && isNewMove && lastMove && lastMove.color !== userColor) {
            botTransition = {
                from: lastMove.from,
                to: lastMove.to
            };
        }

        game.reset();
        for (const m of movesArray) {
            game.move(m, { sloppy: true });
        }
        selectedSquare = null;
        renderBoard();
    } else {
        updateStatus();
    }

    // Gestionar estado
    if (status && status !== 'started') {
        lichessGameActive = false;
        if (pollingIntervalId) clearInterval(pollingIntervalId);
        if (streamAbortController) streamAbortController.abort();

        let endMsg = "Partida finalizada: " + status;
        if (status === 'mate') endMsg = "¡Jaque mate! Partida finalizada.";
        else if (status === 'resign') endMsg = "Abandono. Partida finalizada.";
        else if (status === 'draw') endMsg = "Tablas. Partida finalizada.";
        
        document.getElementById('lichess-game-status').innerText = endMsg;
    } else {
        const isMyTurn = (game.turn() === userColor);
        document.getElementById('lichess-game-status').innerHTML = isMyTurn 
            ? `<span class="text-emerald-400 font-bold"><i class="fas fa-play animate-pulse mr-1"></i> ¡Tu turno!</span>`
            : `<span class="text-yellow-400"><i class="fas fa-spinner fa-spin mr-1"></i> Pensando Bot...</span>`;
    }
}

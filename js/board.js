function getCoords(square) {
    const fileIndex = square.charCodeAt(0) - 97; // 'a' = 0, 'b' = 1...
    const rankIndex = parseInt(square[1]) - 1;   // '1' = 0, '8' = 7...
    
    const x = isFlipped ? (7 - fileIndex) : fileIndex;
    const y = isFlipped ? rankIndex : (7 - rankIndex);
    
    return { x, y };
}

function flipBoard() {
    isFlipped = !isFlipped;
    renderBoard();
}

// Control de pestañas en interfaz
function switchTab(tab) {
    const analysisBtn = document.getElementById('tab-analysis-btn');
    const lichessBtn = document.getElementById('tab-lichess-btn');
    const historyBtn = document.getElementById('tab-history-btn');
    const analysisContent = document.getElementById('tab-analysis');
    const lichessContent = document.getElementById('tab-lichess');
    const historyContent = document.getElementById('tab-history');

    // Clases base desactivadas y activadas
    const inactiveClass = "flex-1 pb-2 font-bold text-xs sm:text-sm text-gray-400 border-b-2 border-transparent hover:text-white transition-colors";
    const activeClass = "flex-1 pb-2 font-bold text-xs sm:text-sm text-blue-400 border-b-2 border-blue-500 transition-colors";

    analysisBtn.className = inactiveClass;
    lichessBtn.className = inactiveClass;
    historyBtn.className = inactiveClass;

    analysisContent.classList.add('hidden');
    lichessContent.classList.add('hidden');
    historyContent.classList.add('hidden');

    if (tab === 'analysis') {
        analysisBtn.className = activeClass;
        analysisContent.classList.remove('hidden');
    } else if (tab === 'lichess') {
        lichessBtn.className = activeClass;
        lichessContent.classList.remove('hidden');
    } else if (tab === 'history') {
        historyBtn.className = activeClass;
        historyContent.classList.remove('hidden');
        renderHistoryList();
    }
}


function toggleAnalysis(checked) {
    analysisEnabled = checked;
    renderBoard();
}

function renderBoard() {
    if (reviewMode || (lichessGameActive && game.turn() !== userColor)) {
        boardEl.classList.add('board-disabled');
    } else {
        boardEl.classList.remove('board-disabled');
    }

    boardEl.innerHTML = '';
    const board = game.board(); // Matriz 8x8 del estado actual
    
    // Obtener TODAS las jugadas legales del turno actual
    const moves = game.moves({ verbose: true });
    
    // Mapas para saber qué casillas están atacadas globalmente (solo para el pulso rojo extra)
    const globalCaptures = new Set();

    moves.forEach(m => {
        if (m.flags.includes('c') || m.flags.includes('e')) {
            globalCaptures.add(m.to);
        }
    });

    // Si hay una pieza seleccionada, filtramos sus capturas
    let activePieceCaptures = [];
    if (selectedSquare) {
        const specificMoves = game.moves({ square: selectedSquare, verbose: true });
        specificMoves.forEach(m => {
            if (m.flags.includes('c') || m.flags.includes('e')) {
                activePieceCaptures.push(m.to);
            }
        });
    }

    // Construir los 64 cuadrados
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const fileIndex = isFlipped ? (7 - c) : c;
            const rankIndex = isFlipped ? r : (7 - r);
            
            const squareId = String.fromCharCode(97 + fileIndex) + (rankIndex + 1);
            const isDark = (fileIndex + rankIndex) % 2 === 0;
            
            const squareEl = document.createElement('div');
            squareEl.className = `square ${isDark ? 'dark' : 'light'}`;
            squareEl.dataset.square = squareId;

            if (r === 7) {
                const colLabel = document.createElement('span');
                colLabel.innerText = String.fromCharCode(97 + fileIndex);
                colLabel.className = 'absolute bottom-0.5 right-1 text-[10px] font-bold opacity-80';
                squareEl.appendChild(colLabel);
            }
            if (c === 0) {
                const rowLabel = document.createElement('span');
                rowLabel.innerText = rankIndex + 1;
                rowLabel.className = 'absolute top-0.5 left-1 text-[10px] font-bold opacity-80';
                squareEl.appendChild(rowLabel);
            }

            squareEl.addEventListener('click', () => handleSquareClick(squareId));

            if (selectedSquare === squareId) {
                squareEl.classList.add('selected');
            }

            if (!selectedSquare) {
                if (globalCaptures.has(squareId)) squareEl.classList.add('global-capture');
            } else {
                if (activePieceCaptures.includes(squareId)) squareEl.classList.add('global-capture');
            }

            // Dibujar la pieza si existe
            const piece = board[7 - rankIndex][fileIndex];
            if (piece) {
                const pieceEl = document.createElement('div');
                pieceEl.className = 'piece';
                const pieceKey = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
                pieceEl.style.backgroundImage = `url(${pieceImages[pieceKey]})`;
                squareEl.appendChild(pieceEl);
            }

            boardEl.appendChild(squareEl);
        }
    }
    
    // Dibujar las flechas por encima del tablero recién generado
    drawArrows(moves);

    // Gestionar Sugerencias Oro en tiempo real de forma segura y optimizada
    if (shouldShowAnalysis()) {
        const fen = game.fen();
        if (fen !== lastAnalyzedFen) {
            lastAnalyzedFen = fen;
            currentGoldSuggestion = null;
            fetchRealTimeAnalysis(fen);
        } else if (currentGoldSuggestion) {
            drawGoldArrows(currentGoldSuggestion);
        }
    } else {
        currentGoldSuggestion = null;
        lastAnalyzedFen = '';
        redrawGoldArrowsOnly();
    }

    updateStatus();
    updateMoveHistory();
    animateBotMove();
}

function drawArrows(moves) {
    const svgEl = document.getElementById('arrows-svg');
    const defsEl = document.getElementById('arrow-defs');
    
    defsEl.innerHTML = '';
    const lines = svgEl.querySelectorAll('line');
    lines.forEach(l => {
        if (!l.classList.contains('golden-arrow')) l.remove();
    });

    const palette = [
        '#f59e0b', '#3b82f6', '#10b981', '#ec4899', 
        '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', 
        '#14b8a6', '#d946ef', '#ef4444', '#eab308'
    ];

    const movesByOrigin = {};
    moves.forEach(m => {
        if (selectedSquare && m.from !== selectedSquare) return;
        if (!movesByOrigin[m.from]) movesByOrigin[m.from] = [];
        movesByOrigin[m.from].push(m);
    });

    const processedMoves = [];

    Object.keys(movesByOrigin).forEach(origin => {
        const originMoves = movesByOrigin[origin];
        originMoves.forEach((m, index) => {
            const fromCoords = getCoords(m.from);
            const toCoords = getCoords(m.to);
            
            const dx = toCoords.x - fromCoords.x;
            const dy = toCoords.y - fromCoords.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance === 0) return;
            
            const color = palette[index % palette.length];
            const markerId = 'arrowhead-' + color.replace('#', '');

            if (!document.getElementById(markerId)) {
                const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                marker.setAttribute('id', markerId);
                marker.setAttribute('viewBox', '0 0 10 10');
                marker.setAttribute('refX', '7');
                marker.setAttribute('refY', '5');
                marker.setAttribute('markerWidth', '4');
                marker.setAttribute('markerHeight', '4');
                marker.setAttribute('orient', 'auto');
                
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', 'M 0 2 L 10 5 L 0 8 z');
                path.setAttribute('fill', color);
                marker.appendChild(path);
                defsEl.appendChild(marker);
            }
            
            const startOffset = 0.15; 
            const endOffset = 0.45;
            const ratioStart = startOffset / distance;
            const ratioEnd = 1 - (endOffset / distance);
            
            processedMoves.push({
                x1: (fromCoords.x + 0.5) + dx * ratioStart,
                y1: (fromCoords.y + 0.5) + dy * ratioStart,
                x2: (fromCoords.x + 0.5) + dx * ratioEnd,
                y2: (fromCoords.y + 0.5) + dy * ratioEnd,
                distance: distance,
                color: color,
                markerId: markerId
            });
        });
    });

    processedMoves.sort((a, b) => b.distance - a.distance);

    processedMoves.forEach(pm => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', pm.x1);
        line.setAttribute('y1', pm.y1);
        line.setAttribute('x2', pm.x2);
        line.setAttribute('y2', pm.y2);
        line.setAttribute('stroke', pm.color);
        line.setAttribute('stroke-width', '0.12');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('marker-end', `url(#${pm.markerId})`);
        line.setAttribute('opacity', '0.85');
        
        svgEl.appendChild(line);
    });
}

// Dibuja las flechas doradas intermitentes sobre el SVG existente
function drawGoldArrows(bestMoves) {
    const svgEl = document.getElementById('arrows-svg');
    const defsEl = document.getElementById('arrow-defs');
    
    if (!document.getElementById('arrowhead-gold')) {
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead-gold');
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '7');
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '4.5');
        marker.setAttribute('markerHeight', '4.5');
        marker.setAttribute('orient', 'auto');
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M 0 2 L 10 5 L 0 8 z');
        path.setAttribute('fill', '#fbbf24');
        marker.appendChild(path);
        defsEl.appendChild(marker);
    }

    bestMoves.forEach(moveStr => {
        if (moveStr.length < 4) return;
        const fromSquare = moveStr.substring(0, 2);
        const toSquare = moveStr.substring(2, 4);

        const fromCoords = getCoords(fromSquare);
        const toCoords = getCoords(toSquare);
        
        const dx = toCoords.x - fromCoords.x;
        const dy = toCoords.y - fromCoords.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return;
        
        const startOffset = 0.15; 
        const endOffset = 0.45;
        const ratioStart = startOffset / distance;
        const ratioEnd = 1 - (endOffset / distance);

        const x1 = (fromCoords.x + 0.5) + dx * ratioStart;
        const y1 = (fromCoords.y + 0.5) + dy * ratioStart;
        const x2 = (fromCoords.x + 0.5) + dx * ratioEnd;
        const y2 = (fromCoords.y + 0.5) + dy * ratioEnd;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', '#fbbf24');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('marker-end', 'url(#arrowhead-gold)');
        line.classList.add('golden-arrow');
        
        svgEl.appendChild(line);
    });
}

// Limpia y redibuja únicamente las flechas doradas en tiempo real
function redrawGoldArrowsOnly() {
    const svgEl = document.getElementById('arrows-svg');
    const goldLines = svgEl.querySelectorAll('.golden-arrow');
    goldLines.forEach(l => l.remove());

    if (shouldShowAnalysis() && currentGoldSuggestion) {
        drawGoldArrows(currentGoldSuggestion);
    }
}

function handleSquareClick(squareId) {
    if (reviewMode) return; // Deshabilitar jugadas en modo repaso
    if (game.game_over()) return;

    // Restricción si partida activa de Lichess
    if (lichessGameActive) {
        if (game.turn() !== userColor) {
            return; // No es su turno
        }
    }

    // Si hay una pieza previamente seleccionada, intentar mover a la nueva casilla
    if (selectedSquare) {
        const moves = game.moves({ square: selectedSquare, verbose: true });
        const move = moves.find(m => m.to === squareId);

        if (move) {
            // Ejecutar el movimiento
            const moveObj = game.move({
                from: selectedSquare,
                to: squareId,
                promotion: 'q' // Para análisis simplificado, corona a Reina por defecto
            });
            
            selectedSquare = null;
            renderBoard();
            
            // Si partida de Lichess activa, subir el movimiento
            if (lichessGameActive && moveObj) {
                const moveUci = moveObj.from + moveObj.to + (moveObj.promotion || '');
                sendMoveToLichess(moveUci);
            }
            return; // Fin del turno
        }
    }

    // Seleccionar pieza (solo si pertenece al jugador en turno)
    const piece = game.get(squareId);
    if (piece && piece.color === game.turn()) {
        selectedSquare = (selectedSquare === squareId) ? null : squareId;
    } else {
        selectedSquare = null;
    }
    
    renderBoard();
}

function updateStatus() {
    const statusEl = document.getElementById('status');
    const turnIndEl = document.getElementById('turn-indicator');
    
    let statusText = '';
    let moveColor = game.turn() === 'w' ? 'Blancas' : 'Negras';

    if (game.turn() === 'w') {
        turnIndEl.innerText = 'Juegan Blancas';
        turnIndEl.className = 'px-3 py-1.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-900 shadow';
    } else {
        turnIndEl.innerText = 'Juegan Negras';
        turnIndEl.className = 'px-3 py-1.5 rounded-full text-sm font-semibold bg-gray-900 text-gray-100 shadow border border-gray-700';
    }

    if (game.in_checkmate()) {
        statusText = `<span class="text-red-500 font-bold"><i class="fas fa-skull"></i> ¡Jaque Mate! Ganan las ${game.turn() === 'w' ? 'Negras' : 'Blancas'}.</span>`;
    } else if (game.in_draw()) {
        statusText = '<span class="text-yellow-500 font-bold"><i class="fas fa-handshake"></i> Partida finalizada en empate (Tablas).</span>';
    } else {
        statusText = `Es el turno de analizar a las <strong>${moveColor}</strong>.`;
        if (game.in_check()) {
            statusText += ' <span class="text-red-400 font-bold ml-1"><i class="fas fa-exclamation-triangle"></i> ¡Jaque!</span>';
        }
    }
    statusEl.innerHTML = statusText;
}

function updateMoveHistory() {
    const listEl = document.getElementById('move-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    
    let movesToDisplay = [];
    let highlightIndex = -1;
    
    if (reviewMode && reviewGame) {
        movesToDisplay = reviewGame.moves;
        highlightIndex = reviewIndex;
    } else {
        movesToDisplay = game.history();
        highlightIndex = movesToDisplay.length - 1;
    }
    
    for (let i = 0; i < movesToDisplay.length; i += 2) {
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center px-2 py-1.5 border-b border-slate-700/50 hover:bg-slate-800 transition-colors';
        
        const num = document.createElement('span');
        num.className = 'text-gray-500 w-8 font-bold';
        num.innerText = `${Math.floor(i/2) + 1}.`;
        
        const wMove = document.createElement('span');
        wMove.className = 'w-20 cursor-pointer rounded px-1.5 py-0.5 transition-colors';
        wMove.innerText = movesToDisplay[i];
        if (i === highlightIndex) {
            wMove.className += ' bg-blue-500/40 text-blue-300 font-bold border border-blue-500/30';
        } else {
            wMove.className += ' text-white hover:bg-slate-700';
        }
        if (reviewMode) {
            wMove.addEventListener('click', () => setReviewMoveIndex(i));
        }
        
        const bMove = document.createElement('span');
        bMove.className = 'w-20 text-right cursor-pointer rounded px-1.5 py-0.5 transition-colors';
        bMove.innerText = movesToDisplay[i+1] ? movesToDisplay[i+1] : '';
        if (movesToDisplay[i+1]) {
            if (i + 1 === highlightIndex) {
                bMove.className += ' bg-blue-500/40 text-blue-300 font-bold border border-blue-500/30';
            } else {
                bMove.className += ' text-white hover:bg-slate-700';
            }
            if (reviewMode) {
                bMove.addEventListener('click', () => setReviewMoveIndex(i+1));
            }
        }
        
        row.appendChild(num);
        row.appendChild(wMove);
        row.appendChild(bMove);
        listEl.appendChild(row);
    }
    
    // Auto-scroll logic
    const activeEl = listEl.querySelector('.bg-blue-500\\/40');
    if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
        listEl.scrollTop = listEl.scrollHeight;
    }
}

function undoMove() {
    if (lichessGameActive) {
        alert("No es posible deshacer movimientos en una partida en línea contra el bot de Lichess. Si lo deseas, puedes abandonar la partida.");
        return;
    }
    game.undo();
    selectedSquare = null;
    renderBoard();
}

function resetBoard() {
    if (lichessGameActive) {
        alert("No es posible reiniciar el tablero en una partida en línea activa. Usa el botón de Rendirse para finalizar.");
        return;
    }
    game.reset();
    selectedSquare = null;
    renderBoard();
}

function exportPGN() {
    const pgn = game.pgn();
    if (!pgn) {
        alert("La partida está vacía. Realiza algún movimiento para exportar.");
        return;
    }
    
    const blob = new window.Blob([pgn], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    const date = new Date();
    const dateString = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
    
    a.href = url;
    a.download = `analisis_lichess_${dateString}.pgn`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function copyPGN() {
    const pgn = game.pgn();
    if (!pgn) {
        alert("La partida está vacía. Realiza algún movimiento para copiar.");
        return;
    }

    const copyBtn = document.getElementById('copy-pgn-btn');
    const copyIcon = document.getElementById('copy-icon');
    const copyText = document.getElementById('copy-text');

    function showSuccessFeedback() {
        if (copyBtn && copyIcon && copyText) {
            // Guardar estado original
            const originalIconClass = copyIcon.className;
            const originalText = copyText.innerText;

            // Cambiar temporalmente a estado de éxito (verde/esmeralda)
            copyBtn.classList.remove('bg-slate-700', 'hover:bg-slate-600', 'text-blue-300');
            copyBtn.classList.add('bg-emerald-600', 'hover:bg-emerald-500', 'text-white');
            copyIcon.className = 'fas fa-check';
            copyText.innerText = '¡Copiado!';

            setTimeout(() => {
                // Revertir a estado original
                copyBtn.classList.remove('bg-emerald-600', 'hover:bg-emerald-500', 'text-white');
                copyBtn.classList.add('bg-slate-700', 'hover:bg-slate-600', 'text-blue-300');
                copyIcon.className = originalIconClass;
                copyText.innerText = originalText;
            }, 2000);
        }
    }

    navigator.clipboard.writeText(pgn).then(() => {
        showSuccessFeedback();
    }).catch(err => {
        console.warn('Fallo navigator.clipboard, usando fallback...', err);
        // Fallback usando un textarea temporal
        try {
            const textarea = document.createElement('textarea');
            textarea.value = pgn;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);
            
            if (successful) {
                showSuccessFeedback();
            } else {
                alert("No se pudo copiar la partida automáticamente.");
            }
        } catch (fallbackErr) {
            alert("No se pudo copiar la partida automáticamente. Por favor expórtala como archivo.");
        }
    });
}

function animateBotMove() {
    if (typeof botTransition !== 'undefined' && botTransition) {
        const fromSquareEl = document.querySelector(`[data-square="${botTransition.from}"]`);
        const toSquareEl = document.querySelector(`[data-square="${botTransition.to}"]`);
        if (fromSquareEl && toSquareEl) {
            const pieceEl = toSquareEl.querySelector('.piece');
            if (pieceEl) {
                const fromRect = fromSquareEl.getBoundingClientRect();
                const toRect = toSquareEl.getBoundingClientRect();
                const deltaX = fromRect.left - toRect.left;
                const deltaY = fromRect.top - toRect.top;

                // Preparar la pieza para la animación (comienza en la casilla inicial)
                pieceEl.style.transition = 'none';
                pieceEl.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                pieceEl.classList.add('bot-moving');

                // Forzar reflujo
                pieceEl.offsetHeight;

                // Animar a la casilla de destino con una curva suave
                pieceEl.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
                pieceEl.style.transform = 'translate(0, 0)';

                // Limpiar estilos después de la animación
                setTimeout(() => {
                    pieceEl.style.transition = '';
                    pieceEl.style.transform = '';
                    pieceEl.classList.remove('bot-moving');
                }, 450);
            }
        }
        botTransition = null;
    }
}

// Iniciar el tablero al cargar la página
window.onload = function() {
    // Cargar token previamente guardado
    const savedToken = localStorage.getItem('lichess_token');
    if (savedToken) {
        document.getElementById('lichess-token-input').value = savedToken;
        lichessToken = savedToken;
    }
    
    // Cargar el historial en la UI al iniciar
    renderHistoryList();
    
    renderBoard();
};

// --- LOGICA DE HISTORIAL Y REPASO ---

// Renderizar la lista de partidas del historial
function renderHistoryList() {
    const listEl = document.getElementById('history-list');
    if (!listEl) return;
    
    const history = JSON.parse(localStorage.getItem('chess_bot_history') || '[]');
    listEl.innerHTML = '';
    
    if (history.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-12 text-gray-500 text-sm flex flex-col items-center justify-center gap-2">
                <i class="fas fa-history text-4xl opacity-30"></i>
                <span>No hay partidas completadas en el historial.</span>
            </div>
        `;
        return;
    }
    
    history.forEach(g => {
        const dateStr = new Date(g.date).toLocaleString('es-ES', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let resultText = '';
        let badgeClass = '';
        
        if (g.result === '1/2-1/2') {
            resultText = 'Tablas';
            badgeClass = 'bg-slate-700 text-slate-300 border border-slate-600';
        } else {
            const userWon = (g.userColor === 'w' && g.result === '1-0') || (g.userColor === 'b' && g.result === '0-1');
            if (userWon) {
                resultText = 'Victoria';
                badgeClass = 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80';
            } else {
                resultText = 'Derrota';
                badgeClass = 'bg-red-950/80 text-red-400 border border-red-800/80';
            }
        }
        
        const card = document.createElement('div');
        card.className = 'bg-slate-900/60 border border-slate-700/50 rounded-xl p-3.5 flex flex-col gap-2.5 hover:border-slate-600 transition-all duration-200';
        
        card.innerHTML = `
            <div class="flex justify-between items-center text-[10px] sm:text-xs">
                <span class="text-slate-400 font-medium">${dateStr}</span>
                <span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${badgeClass}">
                    ${resultText}
                </span>
            </div>
            <div class="flex flex-col gap-1.5 py-1">
                <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-sm bg-white border border-slate-300 flex-shrink-0"></span>
                    <span class="text-xs sm:text-sm font-semibold text-white truncate ${g.userColor === 'w' ? 'text-blue-300 font-bold' : ''}">${g.white}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-sm bg-slate-950 border border-slate-800 flex-shrink-0"></span>
                    <span class="text-xs sm:text-sm font-semibold text-white truncate ${g.userColor === 'b' ? 'text-blue-300 font-bold' : ''}">${g.black}</span>
                </div>
            </div>
            <div class="flex gap-2 mt-1 pt-2 border-t border-slate-800/50">
                <button onclick="startReviewGame('${g.id}')" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white transition-colors py-1.5 px-3 rounded-lg text-xs font-bold flex justify-center items-center gap-1.5 shadow">
                    <i class="fas fa-play text-[8px]"></i> Repasar
                </button>
                <a href="https://lichess.org/${g.id}" target="_blank" class="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-blue-300 hover:text-white transition-colors py-1.5 px-2.5 rounded-lg text-xs font-bold flex justify-center items-center gap-1.5 shadow" title="Ver en Lichess">
                    <i class="fas fa-external-link-alt text-[9px]"></i>
                </a>
                <button onclick="deleteGameFromHistory('${g.id}')" class="bg-red-950/40 hover:bg-red-900 border border-red-900/30 text-red-400 hover:text-white transition-colors py-1.5 px-2.5 rounded-lg text-xs font-bold flex justify-center items-center" title="Borrar del historial">
                    <i class="fas fa-trash-alt text-[9px]"></i>
                </button>
            </div>
        `;
        listEl.appendChild(card);
    });
}

// Eliminar una partida del historial
function deleteGameFromHistory(id) {
    if (!confirm("¿Estás seguro de que deseas eliminar esta partida del historial?")) return;
    
    let history = JSON.parse(localStorage.getItem('chess_bot_history') || '[]');
    history = history.filter(g => g.id !== id);
    localStorage.setItem('chess_bot_history', JSON.stringify(history));
    
    renderHistoryList();
}

// Vaciar el historial completo
function clearAllHistory() {
    if (!confirm("¿Estás seguro de que deseas borrar TODO el historial de partidas? Esta acción no se puede deshacer.")) return;
    
    localStorage.removeItem('chess_bot_history');
    renderHistoryList();
}

// Iniciar el modo repaso para una partida
function startReviewGame(id) {
    const history = JSON.parse(localStorage.getItem('chess_bot_history') || '[]');
    const gameData = history.find(g => g.id === id);
    if (!gameData) return;
    
    // Configurar estado de repaso
    reviewMode = true;
    reviewGame = gameData;
    reviewMoves = gameData.moves;
    reviewIndex = reviewMoves.length - 1; // Empezar en la última jugada
    userColor = gameData.userColor;
    isFlipped = (userColor === 'b');
    
    // Cargar posición final en el motor chess.js
    game.reset();
    for (let i = 0; i <= reviewIndex; i++) {
        game.move(reviewMoves[i]);
    }
    
    // Cambiar a la pestaña de análisis
    switchTab('analysis');
    
    // Mostrar controles de repaso y ocultar los de análisis
    document.getElementById('analysis-controls').classList.add('hidden');
    const reviewCtrl = document.getElementById('review-controls');
    reviewCtrl.classList.remove('hidden');
    
    // Actualizar texto del progreso
    const progressEl = document.getElementById('review-progress');
    if (progressEl) {
        progressEl.innerText = `${reviewIndex + 1} / ${reviewMoves.length}`;
    }
    
    selectedSquare = null;
    renderBoard();
}

// Cambiar el índice de movimiento en el repaso
function setReviewMoveIndex(index) {
    if (!reviewMode) return;
    
    reviewIndex = index;
    game.reset();
    for (let i = 0; i <= reviewIndex; i++) {
        game.move(reviewMoves[i]);
    }
    
    // Actualizar progreso
    const progressEl = document.getElementById('review-progress');
    if (progressEl) {
        progressEl.innerText = `${reviewIndex + 1} / ${reviewMoves.length}`;
    }
    
    selectedSquare = null;
    renderBoard();
}

// Retroceder un movimiento
function prevReviewMove() {
    if (!reviewMode) return;
    if (reviewIndex >= 0) {
        setReviewMoveIndex(reviewIndex - 1);
    }
}

// Avanzar un movimiento
function nextReviewMove() {
    if (!reviewMode) return;
    if (reviewIndex < reviewMoves.length - 1) {
        setReviewMoveIndex(reviewIndex + 1);
    }
}

// Salir del modo repaso
function exitReviewMode() {
    reviewMode = false;
    reviewGame = null;
    reviewMoves = [];
    reviewIndex = -1;
    
    document.getElementById('review-controls').classList.add('hidden');
    document.getElementById('analysis-controls').classList.remove('hidden');
    
    game.reset();
    selectedSquare = null;
    renderBoard();
}

// Desviar el análisis a partir de la posición actual del repaso
function forkAnalysis() {
    reviewMode = false;
    reviewGame = null;
    reviewMoves = [];
    reviewIndex = -1;
    
    document.getElementById('review-controls').classList.add('hidden');
    document.getElementById('analysis-controls').classList.remove('hidden');
    
    renderBoard();
    alert("Has salido del modo repaso. El tablero se ha mantenido en esta posición para que puedas analizar variantes libremente realizando jugadas manuales.");
}

// Navegación por teclado (Flechas izquierda y derecha)
window.addEventListener('keydown', function(e) {
    if (!reviewMode) return;
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevReviewMove();
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextReviewMove();
    }
});

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
    const geminiBtn = document.getElementById('tab-gemini-btn');
    const analysisContent = document.getElementById('tab-analysis');
    const lichessContent = document.getElementById('tab-lichess');
    const historyContent = document.getElementById('tab-history');
    const geminiContent = document.getElementById('tab-gemini');

    // Clases base desactivadas y activadas
    const inactiveClass = "flex-1 pb-2 font-bold text-[10px] sm:text-xs text-gray-400 border-b-2 border-transparent hover:text-white transition-colors whitespace-nowrap";
    const activeClass = "flex-1 pb-2 font-bold text-[10px] sm:text-xs text-blue-400 border-b-2 border-blue-500 transition-colors whitespace-nowrap";

    analysisBtn.className = inactiveClass;
    lichessBtn.className = inactiveClass;
    historyBtn.className = inactiveClass;
    if (geminiBtn) geminiBtn.className = inactiveClass;

    analysisContent.classList.add('hidden');
    lichessContent.classList.add('hidden');
    historyContent.classList.add('hidden');
    if (geminiContent) geminiContent.classList.add('hidden');

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
    } else if (tab === 'gemini') {
        if (geminiBtn && geminiContent) {
            geminiBtn.className = activeClass;
            geminiContent.classList.remove('hidden');
        }
    }
}


function toggleAnalysis(checked) {
    analysisEnabled = checked;
    renderBoard();
}

function toggleShowAllMoves(checked) {
    showAllMoves = checked;
    // Actualizar el texto informativo del tablero
    const infoText = document.getElementById('board-info-text');
    if (infoText) {
        infoText.innerHTML = checked
            ? `Se muestran todas las jugadas posibles. Las capturas se resaltan en <span class="text-red-400 font-bold">rojo</span>.`
            : `Haz clic en una pieza para ver sus jugadas posibles. Las capturas se resaltan en <span class="text-red-400 font-bold">rojo</span>.`;
    }
    // Actualizar color del label del switch
    const label = document.getElementById('show-moves-label');
    if (label) {
        label.className = checked
            ? 'ml-1.5 text-xs font-semibold text-blue-400 flex items-center gap-1'
            : 'ml-1.5 text-xs font-semibold text-slate-400 flex items-center gap-1';
    }
    renderBoard();
}

// ─── LÓGICA DE PIEZAS ELIMINADAS (CAPTURADAS) ───────────────────────────────

function getCapturedPieces() {
    const board = game.board();
    
    // Contar las piezas que están actualmente en el tablero
    const currentCounts = {
        w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
        b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }
    };
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece) {
                currentCounts[piece.color][piece.type]++;
            }
        }
    }
    
    // Cantidades iniciales estándar en ajedrez
    const startingCounts = {
        w: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
        b: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 }
    };
    
    const capturedByWhite = [];
    const capturedByBlack = [];
    
    const pieceTypes = ['p', 'n', 'b', 'r', 'q'];
    
    // Las piezas negras que faltan fueron capturadas por las Blancas (minúsculas)
    pieceTypes.forEach(t => {
        const missing = startingCounts.b[t] - currentCounts.b[t];
        for (let i = 0; i < missing; i++) {
            capturedByWhite.push(t);
        }
    });
    
    // Las piezas blancas que faltan fueron capturadas por las Negras (mayúsculas)
    pieceTypes.forEach(t => {
        const missing = startingCounts.w[t] - currentCounts.w[t];
        for (let i = 0; i < missing; i++) {
            capturedByBlack.push(t.toUpperCase());
        }
    });
    
    // Calcular la puntuación total del material en el tablero para determinar la ventaja
    const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    
    let whiteScore = 0;
    let blackScore = 0;
    
    for (const t in currentCounts.w) {
        whiteScore += currentCounts.w[t] * pieceValues[t];
    }
    for (const t in currentCounts.b) {
        blackScore += currentCounts.b[t] * pieceValues[t];
    }
    
    // Ordenar las listas por valor de pieza (Peones, Caballos, Alfiles, Torres, Damas)
    const pieceOrder = { p: 1, n: 2, b: 3, r: 4, q: 5, P: 1, N: 2, B: 3, R: 4, Q: 5 };
    capturedByWhite.sort((a, b) => pieceOrder[a] - pieceOrder[b]);
    capturedByBlack.sort((a, b) => pieceOrder[a] - pieceOrder[b]);
    
    return {
        capturedByWhite, // Piezas negras capturadas por las Blancas
        capturedByBlack, // Piezas blancas capturadas por las Negras
        whiteScore,
        blackScore
    };
}

function updateCapturedPieces() {
    const captured = getCapturedPieces();
    
    // Determinar quién está arriba y quién abajo según la orientación del tablero (isFlipped)
    const topColor = isFlipped ? 'w' : 'b';
    const bottomColor = isFlipped ? 'b' : 'w';
    
    const topLabel = topColor === 'w' ? 'Blancas' : 'Negras';
    const bottomLabel = bottomColor === 'w' ? 'Blancas' : 'Negras';
    
    const topIndicator = document.getElementById('captured-top-color-indicator');
    const bottomIndicator = document.getElementById('captured-bottom-color-indicator');
    
    if (topIndicator) {
        topIndicator.className = `w-3 h-3 rounded-full border border-slate-600 shadow-sm ${topColor === 'w' ? 'bg-white' : 'bg-slate-950'}`;
    }
    if (bottomIndicator) {
        bottomIndicator.className = `w-3 h-3 rounded-full border border-slate-600 shadow-sm ${bottomColor === 'w' ? 'bg-white' : 'bg-slate-950'}`;
    }
    
    const topLabelEl = document.getElementById('captured-top-label');
    const bottomLabelEl = document.getElementById('captured-bottom-label');
    if (topLabelEl) topLabelEl.innerText = topLabel;
    if (bottomLabelEl) bottomLabelEl.innerText = bottomLabel;
    
    // El jugador de arriba capturó las piezas del jugador de abajo, y viceversa
    const topPiecesList = topColor === 'b' ? captured.capturedByBlack : captured.capturedByWhite;
    const bottomPiecesList = bottomColor === 'b' ? captured.capturedByBlack : captured.capturedByWhite;
    
    // Renderizar piezas del panel superior
    const topPiecesContainer = document.getElementById('captured-top-pieces');
    if (topPiecesContainer) {
        topPiecesContainer.innerHTML = '';
        topPiecesList.forEach(p => {
            const img = document.createElement('img');
            img.src = pieceImages[p];
            img.className = 'w-5 h-5 md:w-6 md:h-6 object-contain';
            img.alt = p;
            topPiecesContainer.appendChild(img);
        });
    }
    
    // Renderizar piezas del panel inferior
    const bottomPiecesContainer = document.getElementById('captured-bottom-pieces');
    if (bottomPiecesContainer) {
        bottomPiecesContainer.innerHTML = '';
        bottomPiecesList.forEach(p => {
            const img = document.createElement('img');
            img.src = pieceImages[p];
            img.className = 'w-5 h-5 md:w-6 md:h-6 object-contain';
            img.alt = p;
            bottomPiecesContainer.appendChild(img);
        });
    }
    
    // Cálculo y muestra de la ventaja de material
    const topAdvantageEl = document.getElementById('captured-top-advantage');
    const bottomAdvantageEl = document.getElementById('captured-bottom-advantage');
    
    if (topAdvantageEl && bottomAdvantageEl) {
        topAdvantageEl.innerText = '';
        bottomAdvantageEl.innerText = '';
        topAdvantageEl.classList.add('hidden');
        bottomAdvantageEl.classList.add('hidden');
        
        const whiteAdv = captured.whiteScore - captured.blackScore;
        const blackAdv = captured.blackScore - captured.whiteScore;
        
        if (whiteAdv > 0) {
            // Las Blancas tienen ventaja
            if (bottomColor === 'w') {
                bottomAdvantageEl.innerText = `+${whiteAdv}`;
                bottomAdvantageEl.classList.remove('hidden');
            } else {
                topAdvantageEl.innerText = `+${whiteAdv}`;
                topAdvantageEl.classList.remove('hidden');
            }
        } else if (blackAdv > 0) {
            // Las Negras tienen ventaja
            if (bottomColor === 'b') {
                bottomAdvantageEl.innerText = `+${blackAdv}`;
                bottomAdvantageEl.classList.remove('hidden');
            } else {
                topAdvantageEl.innerText = `+${blackAdv}`;
                topAdvantageEl.classList.remove('hidden');
            }
        }
    }
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
                if (showAllMoves && globalCaptures.has(squareId)) squareEl.classList.add('global-capture');
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
    if (showAllMoves) {
        drawArrows(moves);
    } else if (selectedSquare) {
        // Si hay pieza seleccionada, mostrar solo sus movimientos
        const selectedMoves = game.moves({ square: selectedSquare, verbose: true });
        drawArrows(selectedMoves);
    } else {
        drawArrows([]);
    }

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
    updateCapturedPieces();
    animateBotMove();
    animateReviewMove();

    // Actualizar la respuesta o estado del panel de Gemini
    if (typeof updateGeminiResponseForCurrentMove === 'function') {
        updateGeminiResponseForCurrentMove();
    }
}

// ─── Arrow rendering helpers ────────────────────────────────────────────────

/**
 * Build an SVG path string for a chess-style filled arrow.
 * The arrow has a rectangular shaft and a bold triangular arrowhead.
 * All coordinates are in SVG board-space (0–8 units, 1 unit = 1 square).
 *
 * @param {number} x1  shaft start X
 * @param {number} y1  shaft start Y
 * @param {number} x2  arrowhead tip X
 * @param {number} y2  arrowhead tip Y
 * @param {number} shaftW   half-width of the shaft  (board units)
 * @param {number} headW    half-width of arrowhead base (board units)
 * @param {number} headLen  length of arrowhead        (board units)
 */
function buildArrowPath(x1, y1, x2, y2, shaftW, headW, headLen) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) return '';

    // Unit vector along the arrow
    const ux = dx / len;
    const uy = dy / len;
    // Perpendicular unit vector
    const px = -uy;
    const py = ux;

    // Arrowhead base sits headLen before the tip
    const bx = x2 - ux * headLen;
    const by = y2 - uy * headLen;

    // Eight polygon points (shaft rectangle + arrowhead triangle)
    const pts = [
        // Shaft left start
        [x1 + px * shaftW,  y1 + py * shaftW],
        // Shaft right start
        [x1 - px * shaftW,  y1 - py * shaftW],
        // Shaft right end (at head base)
        [bx  - px * shaftW, by  - py * shaftW],
        // Arrowhead right wing
        [bx  - px * headW,  by  - py * headW],
        // Arrowhead tip
        [x2,                y2              ],
        // Arrowhead left wing
        [bx  + px * headW,  by  + py * headW],
        // Shaft left end (at head base)
        [bx  + px * shaftW, by  + py * shaftW],
    ];

    return 'M ' + pts.map(p => p[0].toFixed(4) + ',' + p[1].toFixed(4)).join(' L ') + ' Z';
}

function drawArrows(moves) {
    const svgEl = document.getElementById('arrows-svg');
    const defsEl = document.getElementById('arrow-defs');

    // Clear only non-golden arrows
    defsEl.innerHTML = '';
    svgEl.querySelectorAll('.move-arrow').forEach(el => el.remove());

    const palette = [
        '#3b82f6', '#10b981', '#f59e0b', '#ec4899',
        '#8b5cf6', '#06b6d4', '#84cc16', '#f97316',
        '#14b8a6', '#d946ef', '#ef4444', '#eab308'
    ];

    // Group moves by origin square; filter if a piece is selected
    const movesByOrigin = {};
    moves.forEach(m => {
        if (selectedSquare && m.from !== selectedSquare) return;
        if (!movesByOrigin[m.from]) movesByOrigin[m.from] = [];
        movesByOrigin[m.from].push(m);
    });

    const arrowData = [];
    const originKeys = Object.keys(movesByOrigin);

    originKeys.forEach((origin, originIndex) => {
        // Each origin square gets one color from the palette
        const color = palette[originIndex % palette.length];

        movesByOrigin[origin].forEach(m => {
            const fromCoords = getCoords(m.from);
            const toCoords   = getCoords(m.to);

            const dx = toCoords.x - fromCoords.x;
            const dy = toCoords.y - fromCoords.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance === 0) return;

            // Shaft starts 0.38 units from piece center, tip lands 0.1 before square center
            const startOffset = 0.38;
            const tipOffset   = 0.1;

            const fromCx = fromCoords.x + 0.5;
            const fromCy = fromCoords.y + 0.5;
            const toCx   = toCoords.x   + 0.5;
            const toCy   = toCoords.y   + 0.5;

            const x1 = fromCx + (dx / distance) * startOffset;
            const y1 = fromCy + (dy / distance) * startOffset;
            const x2 = toCx   - (dx / distance) * tipOffset;
            const y2 = toCy   - (dy / distance) * tipOffset;

            arrowData.push({ x1, y1, x2, y2, distance, color });
        });
    });

    // Draw longest arrows first so shorter ones render on top
    arrowData.sort((a, b) => b.distance - a.distance);

    // Arrow dimensions (in board units)
    const shaftW  = 0.09;
    const headW   = 0.21;
    const headLen = 0.30;

    arrowData.forEach(ad => {
        const d = buildArrowPath(ad.x1, ad.y1, ad.x2, ad.y2, shaftW, headW, headLen);
        if (!d) return;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', ad.color);
        path.setAttribute('opacity', '0.82');
        path.classList.add('move-arrow');
        // Subtle drop-shadow glow
        path.style.filter = `drop-shadow(0 0 2px ${ad.color}88)`;

        svgEl.appendChild(path);
    });
}

// Dibuja las flechas doradas intermitentes sobre el SVG existente
function drawGoldArrows(bestMoves) {
    const svgEl = document.getElementById('arrows-svg');
    const goldColor = '#fbbf24';

    // Gold arrow dimensions — slightly bigger than regular arrows
    const shaftW  = 0.105;
    const headW   = 0.235;
    const headLen = 0.32;

    bestMoves.forEach(moveStr => {
        if (moveStr.length < 4) return;
        const fromSquare = moveStr.substring(0, 2);
        const toSquare   = moveStr.substring(2, 4);

        const fromCoords = getCoords(fromSquare);
        const toCoords   = getCoords(toSquare);

        const dx = toCoords.x - fromCoords.x;
        const dy = toCoords.y - fromCoords.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance === 0) return;

        const startOffset = 0.38;
        const tipOffset   = 0.10;

        const fromCx = fromCoords.x + 0.5;
        const fromCy = fromCoords.y + 0.5;
        const toCx   = toCoords.x   + 0.5;
        const toCy   = toCoords.y   + 0.5;

        const x1 = fromCx + (dx / distance) * startOffset;
        const y1 = fromCy + (dy / distance) * startOffset;
        const x2 = toCx   - (dx / distance) * tipOffset;
        const y2 = toCy   - (dy / distance) * tipOffset;

        const d = buildArrowPath(x1, y1, x2, y2, shaftW, headW, headLen);
        if (!d) return;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', goldColor);
        path.classList.add('golden-arrow');

        svgEl.appendChild(path);
    });
}

// Limpia y redibuja únicamente las flechas doradas en tiempo real
function redrawGoldArrowsOnly() {
    const svgEl = document.getElementById('arrows-svg');
    svgEl.querySelectorAll('.golden-arrow').forEach(el => el.remove());

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
            // Reset selected move index so panels show the latest move after playing
            selectedMoveIndex = -1;
            aiCommentPanelClosedForMoveIndex = -1;
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

    // During active game: track the selected move (defaults to last)
    const activeSelectedIdx = (lichessGameActive && !reviewMode && selectedMoveIndex !== -1)
        ? selectedMoveIndex
        : highlightIndex;

    // Update the move-list heading hint for active games
    const heading = document.getElementById('move-list-heading');
    if (heading && lichessGameActive && !reviewMode && movesToDisplay.length > 0) {
        heading.innerHTML = `Historial de Jugadas <span class="text-purple-400 font-normal normal-case tracking-normal text-[9px] ml-1 opacity-80"><i class="fas fa-mouse-pointer text-[8px]"></i> clic para analizar</span>`;
    } else if (heading && !document.getElementById('ai-comment-close-btn')?.classList.contains('flex')) {
        heading.innerText = 'Historial de Jugadas';
    }

    // Helper: check if a move index has a saved AI comment
    function hasAIComment(idx) {
        if (reviewMode && reviewGame) {
            return !!(reviewGame.geminiComments && reviewGame.geminiComments[idx] !== undefined);
        } else if (typeof activeGameGeminiComments !== 'undefined') {
            return !!(activeGameGeminiComments[idx] !== undefined);
        }
        return false;
    }
    
    for (let i = 0; i < movesToDisplay.length; i += 2) {
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center px-2 py-1.5 border-b border-slate-700/50 hover:bg-slate-800 transition-colors';
        
        const num = document.createElement('span');
        num.className = 'text-gray-500 w-8 font-bold';
        num.innerText = `${Math.floor(i/2) + 1}.`;

        // White move cell
        const wMove = document.createElement('span');
        wMove.className = 'w-20 cursor-pointer rounded px-1.5 py-0.5 transition-colors flex items-center gap-1';
        const wText = document.createElement('span');
        wText.innerText = movesToDisplay[i];
        wMove.appendChild(wText);
        if (hasAIComment(i)) {
            const badge = document.createElement('i');
            badge.className = 'fas fa-brain text-purple-400 text-[8px] opacity-90 flex-shrink-0';
            badge.title = 'Tiene análisis IA guardado';
            wMove.appendChild(badge);
        }

        // Highlight logic
        if (lichessGameActive && !reviewMode) {
            // Active game: purple for selected, normal for others
            if (i === activeSelectedIdx) {
                wMove.classList.add('bg-purple-600/40', 'text-purple-200', 'font-bold', 'border', 'border-purple-500/40');
            } else if (i === highlightIndex) {
                wMove.classList.add('bg-blue-500/20', 'text-blue-300', 'border', 'border-blue-500/20');
            } else {
                wMove.classList.add('text-white', 'hover:bg-slate-700');
            }
            // Make clickable to select this move for AI analysis
            wMove.addEventListener('click', () => selectMoveForAnalysis(i));
        } else if (i === highlightIndex) {
            wMove.classList.add('bg-blue-500/40', 'text-blue-300', 'font-bold', 'border', 'border-blue-500/30');
        } else {
            wMove.classList.add('text-white', 'hover:bg-slate-700');
        }
        if (reviewMode) {
            wMove.addEventListener('click', () => setReviewMoveIndex(i));
        }

        // Black move cell
        const bMove = document.createElement('span');
        bMove.className = 'w-20 text-right cursor-pointer rounded px-1.5 py-0.5 transition-colors flex items-center justify-end gap-1';
        if (movesToDisplay[i+1]) {
            if (hasAIComment(i + 1)) {
                const badge = document.createElement('i');
                badge.className = 'fas fa-brain text-purple-400 text-[8px] opacity-90 flex-shrink-0';
                badge.title = 'Tiene análisis IA guardado';
                bMove.appendChild(badge);
            }
            const bText = document.createElement('span');
            bText.innerText = movesToDisplay[i+1];
            bMove.appendChild(bText);

            if (lichessGameActive && !reviewMode) {
                if (i + 1 === activeSelectedIdx) {
                    bMove.classList.add('bg-purple-600/40', 'text-purple-200', 'font-bold', 'border', 'border-purple-500/40');
                } else if (i + 1 === highlightIndex) {
                    bMove.classList.add('bg-blue-500/20', 'text-blue-300', 'border', 'border-blue-500/20');
                } else {
                    bMove.classList.add('text-white', 'hover:bg-slate-700');
                }
                bMove.addEventListener('click', () => selectMoveForAnalysis(i + 1));
            } else if (i + 1 === highlightIndex) {
                bMove.classList.add('bg-blue-500/40', 'text-blue-300', 'font-bold', 'border', 'border-blue-500/30');
            } else {
                bMove.classList.add('text-white', 'hover:bg-slate-700');
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
    const activeEl = listEl.querySelector('.bg-purple-600\\/40') || listEl.querySelector('.bg-blue-500\\/40');
    if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
        listEl.scrollTop = listEl.scrollHeight;
    }
}

// Select a specific move from the history for AI analysis during an active game
function selectMoveForAnalysis(index) {
    if (!lichessGameActive || reviewMode) return;
    const moves = game.history();
    if (index < 0 || index >= moves.length) return;

    // Toggle off if clicking the already-selected move (go back to last)
    if (selectedMoveIndex === index) {
        selectedMoveIndex = -1;
    } else {
        selectedMoveIndex = index;
    }

    // Reset the 'closed' state for AI panel so it reacts to the new selection
    aiCommentPanelClosedForMoveIndex = -1;

    updateMoveHistory();
    if (typeof updateGeminiResponseForCurrentMove === 'function') {
        updateGeminiResponseForCurrentMove();
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

// Animar el movimiento en modo repaso (igual que animateBotMove)
function animateReviewMove() {
    if (typeof reviewTransition !== 'undefined' && reviewTransition) {
        const fromSquareEl = document.querySelector(`[data-square="${reviewTransition.from}"]`);
        const toSquareEl = document.querySelector(`[data-square="${reviewTransition.to}"]`);
        if (fromSquareEl && toSquareEl) {
            const pieceEl = toSquareEl.querySelector('.piece');
            if (pieceEl) {
                const fromRect = fromSquareEl.getBoundingClientRect();
                const toRect = toSquareEl.getBoundingClientRect();
                const deltaX = fromRect.left - toRect.left;
                const deltaY = fromRect.top - toRect.top;

                pieceEl.style.transition = 'none';
                pieceEl.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                pieceEl.style.zIndex = '50';

                // Forzar reflujo
                pieceEl.offsetHeight;

                pieceEl.style.transition = 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)';
                pieceEl.style.transform = 'translate(0, 0)';

                setTimeout(() => {
                    pieceEl.style.transition = '';
                    pieceEl.style.transform = '';
                    pieceEl.style.zIndex = '';
                }, 400);
            }
        }
        reviewTransition = null;
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
    
    // Inicializar Gemini
    if (typeof initGemini === 'function') {
        initGemini();
    }
    
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
function setReviewMoveIndex(index, animate = false) {
    if (!reviewMode) return;

    const prevIndex = reviewIndex;
    reviewIndex = index;

    // Si se va un paso adelante o atrás, capturamos el movimiento para animarlo
    if (animate) {
        const isForward = index === prevIndex + 1;
        const isBackward = index === prevIndex - 1;

        if (isForward && reviewMoves[index]) {
            // Avanzamos: reproducimos la jugada nueva
            game.reset();
            for (let i = 0; i < index; i++) game.move(reviewMoves[i]);
            const moveResult = game.move(reviewMoves[index]);
            if (moveResult) {
                reviewTransition = { from: moveResult.from, to: moveResult.to };
            }
        } else if (isBackward) {
            // Retrocedemos: la pieza viaja de 'to' → 'from' (movimiento inverso)
            const lastMove = reviewMoves[prevIndex];
            game.reset();
            for (let i = 0; i <= prevIndex; i++) game.move(reviewMoves[i]);
            // Obtenemos from/to del movimiento que acabamos de deshacer
            const hist = game.history({ verbose: true });
            const undoneMove = hist[prevIndex];
            if (undoneMove) {
                reviewTransition = { from: undoneMove.to, to: undoneMove.from };
            }
            game.reset();
            if (index >= 0) {
                for (let i = 0; i <= index; i++) game.move(reviewMoves[i]);
            }
        } else {
            // Salto directo sin animación
            game.reset();
            for (let i = 0; i <= index; i++) game.move(reviewMoves[i]);
        }
    } else {
        game.reset();
        if (index >= 0) {
            for (let i = 0; i <= index; i++) game.move(reviewMoves[i]);
        }
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
    if (reviewIndex > 0) {
        setReviewMoveIndex(reviewIndex - 1, true);
    } else if (reviewIndex === 0) {
        // Volver a posición inicial (antes de cualquier jugada)
        setReviewMoveIndex(-1, false);
    }
}

// Avanzar un movimiento
function nextReviewMove() {
    if (!reviewMode) return;
    if (reviewIndex < reviewMoves.length - 1) {
        setReviewMoveIndex(reviewIndex + 1, true);
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

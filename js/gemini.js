// State variables for Gemini AI Integration
let geminiApiKey = localStorage.getItem('gemini_api_key') || '';
let geminiModels = [];
try {
    const rawModels = localStorage.getItem('gemini_models');
    if (rawModels) {
        const parsed = JSON.parse(rawModels);
        if (Array.isArray(parsed)) {
            geminiModels = parsed.map(m => {
                if (typeof m === 'string') {
                    let displayName = m;
                    if (displayName.startsWith('models/')) {
                        displayName = displayName.substring('models/'.length);
                    }
                    return { name: m, displayName: displayName };
                }
                return m;
            });
        }
    }
} catch (e) {
    console.error("Error parsing gemini_models from localStorage:", e);
}

let currentGeminiResponseText = '';
// Track the move index that currentGeminiResponseText belongs to (so we know if it's already saved)
let currentGeminiResponseMoveIndex = -1;
let activeGameGeminiComments = {};

// Track if the user manually closed the AI comment panel for a specific move
// so we don't auto-reopen it on every renderBoard() call
let aiCommentPanelClosedForMoveIndex = -1;

function initGemini() {
    const keyInput = document.getElementById('gemini-api-key-input');

    // Load saved API Key
    if (keyInput) {
        keyInput.value = geminiApiKey;
    }

    // Populate models select dropdown and set its current value
    updateModelsDropdown();
}

function handleApiKeyInput(val) {
    geminiApiKey = val.trim();
    localStorage.setItem('gemini_api_key', geminiApiKey);
}

function toggleApiKeyVisibility() {
    const keyInput = document.getElementById('gemini-api-key-input');
    const eyeIcon = document.getElementById('gemini-key-eye-icon');
    if (keyInput && eyeIcon) {
        if (keyInput.type === 'password') {
            keyInput.type = 'text';
            eyeIcon.className = 'fas fa-eye-slash';
        } else {
            keyInput.type = 'password';
            eyeIcon.className = 'fas fa-eye';
        }
    }
}

function updateModelsDropdown() {
    const modelSelect = document.getElementById('gemini-model-select');
    if (!modelSelect) return;

    modelSelect.innerHTML = '';

    // If no models are configured, use a smart list of defaults
    if (geminiModels.length === 0) {
        geminiModels = [
            { name: "models/gemini-2.5-flash", displayName: "Gemini 2.5 Flash" },
            { name: "models/gemini-2.5-pro", displayName: "Gemini 2.5 Pro" },
            { name: "models/gemini-2.0-flash", displayName: "Gemini 2.0 Flash" },
            { name: "models/gemini-1.5-flash", displayName: "Gemini 1.5 Flash" }
        ];
        localStorage.setItem('gemini_models', JSON.stringify(geminiModels));
    }

    geminiModels.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.name;
        opt.innerText = m.displayName || m.name;
        modelSelect.appendChild(opt);
    });

    // Load saved current model or default to models/gemini-2.5-flash
    const savedCurrentModel = localStorage.getItem('gemini_current_model') || 'models/gemini-2.5-flash';
    
    // Ensure the saved model exists in the dropdown list, otherwise append it
    const exists = Array.from(modelSelect.options).some(opt => opt.value === savedCurrentModel);
    if (!exists) {
        const opt = document.createElement('option');
        opt.value = savedCurrentModel;
        let cleanName = savedCurrentModel;
        if (cleanName.startsWith('models/')) {
            cleanName = cleanName.substring('models/'.length);
        }
        opt.innerText = cleanName;
        modelSelect.appendChild(opt);
    }
    modelSelect.value = savedCurrentModel;
}

function handleModelSelectChange(val) {
    if (!val) return;
    localStorage.setItem('gemini_current_model', val);
}

function saveGeminiModel(modelName) {
    const trimmed = modelName.trim();
    if (!trimmed) return;

    localStorage.setItem('gemini_current_model', trimmed);

    const exists = geminiModels.some(m => m.name === trimmed);
    if (!exists) {
        let cleanName = trimmed;
        if (cleanName.startsWith('models/')) {
            cleanName = cleanName.substring('models/'.length);
        }
        geminiModels.push({ name: trimmed, displayName: cleanName });
        localStorage.setItem('gemini_models', JSON.stringify(geminiModels));
        updateModelsDropdown();
    }
}

async function updateAvailableModels() {
    const keyInput = document.getElementById('gemini-api-key-input');
    const apiKey = keyInput ? keyInput.value.trim() : '';

    if (!apiKey) {
        alert("Por favor, ingresa tu Gemini API Key primero para poder consultar los modelos disponibles.");
        return;
    }

    const btn = document.getElementById('gemini-update-models-btn');
    const icon = btn ? btn.querySelector('i') : null;

    if (btn) {
        btn.disabled = true;
    }
    if (icon) {
        icon.classList.add('fa-spin');
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData.error?.message || `Error HTTP ${response.status}`;
            throw new Error(errMsg);
        }

        const data = await response.json();
        if (!data.models || !Array.isArray(data.models)) {
            throw new Error("No se encontraron modelos en la respuesta de la API.");
        }

        // Filter models that support content generation
        const filtered = data.models
            .filter(m => {
                const methods = m.supportedGenerationMethods || m.supportedMethodNames || [];
                return methods.includes('generateContent');
            })
            .map(m => ({
                name: m.name,
                displayName: m.displayName || m.name
            }));

        if (filtered.length === 0) {
            throw new Error("No se encontraron modelos compatibles con 'generateContent'.");
        }

        geminiModels = filtered;
        localStorage.setItem('gemini_models', JSON.stringify(geminiModels));

        // Sync currently selected model
        const currentModel = localStorage.getItem('gemini_current_model');
        const currentExists = geminiModels.some(m => m.name === currentModel);
        if (!currentExists && geminiModels.length > 0) {
            // Pick a flash model if available, otherwise the first one
            const flashModel = geminiModels.find(m => m.name.toLowerCase().includes('flash'));
            const newDefault = flashModel ? flashModel.name : geminiModels[0].name;
            localStorage.setItem('gemini_current_model', newDefault);
        }

        updateModelsDropdown();
        alert(`Modelos actualizados correctamente. Se encontraron ${filtered.length} modelos compatibles.`);
    } catch (e) {
        console.error("Error al actualizar modelos de Gemini:", e);
        alert(`Error al actualizar modelos: ${e.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
        }
        if (icon) {
            icon.classList.remove('fa-spin');
        }
    }
}

// ─── Comment persistence helpers ────────────────────────────────────────────

function saveGeminiCommentToHistory(gameId, moveIndex, commentText) {
    let history = JSON.parse(localStorage.getItem('chess_bot_history') || '[]');
    let gameIndex = history.findIndex(g => g.id === gameId);
    if (gameIndex !== -1) {
        if (!history[gameIndex].geminiComments) {
            history[gameIndex].geminiComments = {};
        }
        history[gameIndex].geminiComments[moveIndex] = commentText;
        localStorage.setItem('chess_bot_history', JSON.stringify(history));

        // Sync with active reviewGame object
        if (reviewMode && reviewGame && reviewGame.id === gameId) {
            reviewGame.geminiComments = history[gameIndex].geminiComments;
        }
    }
}

function removeGeminiCommentFromHistory(gameId, moveIndex) {
    let history = JSON.parse(localStorage.getItem('chess_bot_history') || '[]');
    let gameIndex = history.findIndex(g => g.id === gameId);
    if (gameIndex !== -1) {
        if (history[gameIndex].geminiComments && history[gameIndex].geminiComments[moveIndex] !== undefined) {
            delete history[gameIndex].geminiComments[moveIndex];
            localStorage.setItem('chess_bot_history', JSON.stringify(history));

            // Sync with active reviewGame object
            if (reviewMode && reviewGame && reviewGame.id === gameId) {
                reviewGame.geminiComments = history[gameIndex].geminiComments;
            }
        }
    }
}

// Returns the current move index depending on mode
function _getCurrentMoveIndex() {
    if (reviewMode && reviewGame) {
        return reviewIndex;
    } else if (lichessGameActive && selectedMoveIndex !== -1) {
        return selectedMoveIndex;
    } else {
        return game.history().length - 1;
    }
}

// Returns the saved comment for the current move (or null)
function _getSavedCommentForCurrentMove() {
    if (reviewMode && reviewGame) {
        const comments = reviewGame.geminiComments || {};
        return comments[reviewIndex] || null;
    } else if (lichessGameActive) {
        const idx = _getCurrentMoveIndex();
        return activeGameGeminiComments[idx] || null;
    }
    return null;
}

// ─── Save / Delete current analysis ─────────────────────────────────────────

function saveCurrentGeminiAnalysis() {
    if (!currentGeminiResponseText) return;

    if (reviewMode && reviewGame) {
        saveGeminiCommentToHistory(reviewGame.id, reviewIndex, currentGeminiResponseText);
        currentGeminiResponseMoveIndex = reviewIndex;
    } else if (lichessGameActive) {
        const moveIndex = _getCurrentMoveIndex();
        activeGameGeminiComments[moveIndex] = currentGeminiResponseText;
        currentGeminiResponseMoveIndex = moveIndex;
    }

    // Refresh both panels
    renderGeminiSaveActionArea();
    updateAnalysisTabAIPanel();
    updateMoveHistory(); // refresh 🧠 icons
}

function deleteCurrentGeminiComment() {
    if (reviewMode && reviewGame) {
        removeGeminiCommentFromHistory(reviewGame.id, reviewIndex);
        // If the deleted comment was the one in the response area, clear the saved state
        if (currentGeminiResponseMoveIndex === reviewIndex) {
            currentGeminiResponseMoveIndex = -1;
        }
    } else if (lichessGameActive) {
        const moveIndex = _getCurrentMoveIndex();
        delete activeGameGeminiComments[moveIndex];
        if (currentGeminiResponseMoveIndex === moveIndex) {
            currentGeminiResponseMoveIndex = -1;
        }
    }

    // Refresh both panels
    renderGeminiSaveActionArea();
    updateAnalysisTabAIPanel();
    updateMoveHistory(); // refresh 🧠 icons
}

// ─── Gemini tab — dynamic save/delete action area ────────────────────────────

function renderGeminiSaveActionArea() {
    const area = document.getElementById('gemini-save-action-area');
    if (!area) return;

    area.innerHTML = '';

    if (!currentGeminiResponseText) return;

    const savedComment = _getSavedCommentForCurrentMove();
    const currentIdx = _getCurrentMoveIndex();
    const isSaved = savedComment !== null && currentGeminiResponseMoveIndex === currentIdx;

    if (isSaved) {
        // Show "already saved" badge + delete button
        area.innerHTML = `
            <div class="flex items-center gap-2 mt-2">
                <span class="flex-1 text-[10px] font-semibold text-emerald-400 flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1.5 rounded-lg">
                    <i class="fas fa-check-circle"></i> An\u00e1lisis guardado en este movimiento
                </span>
                <button onclick="deleteCurrentGeminiComment()"
                    class="bg-red-950/50 hover:bg-red-900 border border-red-800/50 text-red-400 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 shadow">
                    <i class="fas fa-trash-alt"></i> Borrar
                </button>
            </div>
        `;
    } else {
        // Show save button
        area.innerHTML = `
            <button onclick="saveCurrentGeminiAnalysis()"
                class="w-full mt-2 bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-600/60 text-white transition-colors p-2 rounded-lg text-xs font-bold flex justify-center items-center gap-2 shadow">
                <i class="fas fa-bookmark"></i> Guardar an\u00e1lisis en este movimiento
            </button>
        `;
    }
}

// ─── Analysis tab — contextual AI panel ─────────────────────────────────────

function _setMoveListVisible(visible) {
    const moveList = document.getElementById('move-list');
    const closeBtn = document.getElementById('ai-comment-close-btn');
    const heading = document.getElementById('move-list-heading');
    if (moveList) {
        if (visible) {
            moveList.classList.remove('hidden');
        } else {
            moveList.classList.add('hidden');
        }
    }
    if (closeBtn) {
        if (visible) {
            closeBtn.classList.add('hidden');
            closeBtn.classList.remove('flex');
        } else {
            closeBtn.classList.remove('hidden');
            closeBtn.classList.add('flex');
        }
    }
    if (heading) {
        heading.innerText = visible ? 'Historial de Jugadas' : 'Análisis IA';
    }
}

function updateAnalysisTabAIPanel() {
    const commentPanel = document.getElementById('ai-comment-panel');
    const requestPanel = document.getElementById('ai-request-panel');
    const commentText = document.getElementById('ai-comment-text');
    const requestBtn = document.getElementById('ai-request-btn');

    if (!commentPanel || !requestPanel) return;

    const moves = reviewMode && reviewGame ? reviewGame.moves : game.history();
    const hasMoves = moves.length > 0 && _getCurrentMoveIndex() >= 0;

    if (!hasMoves) {
        commentPanel.classList.add('hidden');
        commentPanel.classList.remove('flex');
        requestPanel.classList.add('hidden');
        _setMoveListVisible(true);
        return;
    }

    const savedComment = _getSavedCommentForCurrentMove();
    const currentIdx = _getCurrentMoveIndex();

    // Auto-reset the 'closed' flag if the user has navigated to a different move
    if (aiCommentPanelClosedForMoveIndex !== -1 && aiCommentPanelClosedForMoveIndex !== currentIdx) {
        aiCommentPanelClosedForMoveIndex = -1;
    }

    if (savedComment) {
        // If the user already manually closed this panel for the current move, don't reopen it
        if (aiCommentPanelClosedForMoveIndex === currentIdx) {
            // Keep the panel hidden, show the move list and request button
            _setMoveListVisible(true);
            commentPanel.classList.add('hidden');
            commentPanel.classList.remove('flex');
            requestPanel.classList.remove('hidden');
            if (requestBtn) {
                const hasKey = !!geminiApiKey;
                requestBtn.disabled = !hasKey;
                requestBtn.title = hasKey ? '' : 'Configura tu Gemini API Key en la pestaña Gemini AI';
                _updateRequestBtnLabel(requestBtn, currentIdx);
            }
            return;
        }

        // Hide move list, show AI comment panel in its place
        _setMoveListVisible(false);
        commentPanel.classList.remove('hidden');
        commentPanel.classList.add('flex');
        requestPanel.classList.add('hidden');
        if (commentText) {
            if (typeof marked !== 'undefined') {
                commentText.innerHTML = marked.parse(savedComment);
            } else {
                commentText.innerText = savedComment;
            }
        }
    } else {
        // Restore move list, hide comment panel, show request button
        _setMoveListVisible(true);
        commentPanel.classList.add('hidden');
        commentPanel.classList.remove('flex');
        requestPanel.classList.remove('hidden');

        // Disable button if no API key configured
        if (requestBtn) {
            const hasKey = !!geminiApiKey;
            requestBtn.disabled = !hasKey;
            requestBtn.title = hasKey ? '' : 'Configura tu Gemini API Key en la pestaña Gemini AI';
            _updateRequestBtnLabel(requestBtn, currentIdx);
        }
    }
}

// Helper: update the text label of the analysis-tab request button
function _updateRequestBtnLabel(btn, moveIdx) {
    if (!btn) return;
    const moves = lichessGameActive && !reviewMode ? game.history() :
                  (reviewMode && reviewGame ? reviewGame.moves : game.history());
    if (moveIdx >= 0 && moveIdx < moves.length) {
        const moveNum = Math.floor(moveIdx / 2) + 1;
        btn.innerHTML = `<i class="fas fa-brain"></i> Analizar: ${moveNum}. ${moves[moveIdx]}`;
    } else {
        btn.innerHTML = `<i class="fas fa-brain"></i> Solicitar An\u00e1lisis IA`;
    }
}

// Close the AI comment panel and go back to the move list (without deleting the comment)
function closeAICommentPanel() {
    const commentPanel = document.getElementById('ai-comment-panel');
    const requestPanel = document.getElementById('ai-request-panel');
    if (commentPanel) {
        commentPanel.classList.add('hidden');
        commentPanel.classList.remove('flex');
    }
    if (requestPanel) requestPanel.classList.add('hidden');
    _setMoveListVisible(true);

    // Remember that the user closed the panel for this specific move index
    // so we don't auto-reopen it when renderBoard() is called again
    aiCommentPanelClosedForMoveIndex = _getCurrentMoveIndex();
}

// ─── Quick analysis request from Analysis tab ────────────────────────────────

async function askGeminiFromAnalysisTab() {
    const requestBtn = document.getElementById('ai-request-btn');

    // Determine label for the move being analyzed
    const moves = game.history();
    const targetIdx = _getCurrentMoveIndex();
    const effectiveIdx = (targetIdx >= 0 && targetIdx < moves.length) ? targetIdx : moves.length - 1;
    const moveLabel = moves[effectiveIdx] ? `${Math.floor(effectiveIdx / 2) + 1}. ${moves[effectiveIdx]}` : 'este movimiento';

    // Show spinner on button
    if (requestBtn) {
        requestBtn.disabled = true;
        requestBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Consultando Gemini...`;
    }

    try {
        // Reset the 'manually closed' flag so the panel can show the new analysis result
        aiCommentPanelClosedForMoveIndex = -1;

        // Run the Gemini query (result lands in currentGeminiResponseText and auto-saves if active/review)
        await askGemini();
    } finally {
        // Restore button regardless (panels will update themselves)
        if (requestBtn) {
            requestBtn.disabled = false;
            requestBtn.innerHTML = `<i class="fas fa-brain"></i> Analizar: ${moveLabel}`;
        }
    }
}

// ─── Main response update (called on every board render) ─────────────────────

function updateGeminiResponseForCurrentMove() {
    const responseEl = document.getElementById('gemini-response');
    const badgeEl = document.getElementById('gemini-status-badge');
    const askBtn = document.getElementById('gemini-ask-btn');
    if (!responseEl) return;

    // Enable/disable ask button depending on history length
    const moves = game.history();
    if (askBtn) {
        askBtn.disabled = (moves.length === 0);
    }

    const currentIdx = _getCurrentMoveIndex();

    if (reviewMode && reviewGame) {
        const comments = reviewGame.geminiComments || {};
        if (comments[reviewIndex] !== undefined) {
            currentGeminiResponseText = comments[reviewIndex];
            currentGeminiResponseMoveIndex = reviewIndex;
            responseEl.innerHTML = marked.parse(currentGeminiResponseText);
            if (badgeEl) badgeEl.classList.remove('hidden');
        } else {
            // Clear the displayed response — but keep any in-memory response if the user
            // just generated it for a different move
            if (currentGeminiResponseMoveIndex !== reviewIndex) {
                currentGeminiResponseText = '';
                currentGeminiResponseMoveIndex = -1;
            }
            if (!currentGeminiResponseText) {
                responseEl.innerHTML = `<p class="text-slate-400 text-xs italic">No hay análisis guardado para este movimiento. Presiona "Pregunta predeterminada" para consultar a Gemini.</p>`;
                if (badgeEl) badgeEl.classList.add('hidden');
            }
        }
    } else if (lichessGameActive) {
        // Active game: show comment for the selectedMoveIndex (or latest)
        if (activeGameGeminiComments[currentIdx] !== undefined) {
            currentGeminiResponseText = activeGameGeminiComments[currentIdx];
            currentGeminiResponseMoveIndex = currentIdx;
            responseEl.innerHTML = marked.parse(currentGeminiResponseText);
            if (badgeEl) badgeEl.classList.remove('hidden');
        } else {
            if (currentGeminiResponseMoveIndex !== currentIdx) {
                currentGeminiResponseText = '';
                currentGeminiResponseMoveIndex = -1;
            }
            if (!currentGeminiResponseText) {
                const moveLabel = currentIdx >= 0 ? moves[currentIdx] : null;
                const moveLabelStr = moveLabel ? ` para <strong>${moveLabel}</strong>` : '';
                responseEl.innerHTML = `<p class="text-slate-400 text-xs italic">Presiona el botón para analizar el movimiento${moveLabelStr} con inteligencia artificial.</p>`;
                if (badgeEl) badgeEl.classList.add('hidden');
            }
        }

        // Update the ask button label to indicate which move will be analyzed
        if (askBtn && moves.length > 0) {
            const moveLabel = currentIdx >= 0 ? moves[currentIdx] : moves[moves.length - 1];
            const moveNum = currentIdx >= 0 ? Math.floor(currentIdx / 2) + 1 : Math.floor((moves.length - 1) / 2) + 1;
            askBtn.innerHTML = `<i class="fas fa-brain"></i> Analizar: ${moveNum}. ${moveLabel}`;
        }
    } else {
        // Free analysis mode
        const moveIndex = moves.length - 1;
        if (currentGeminiResponseMoveIndex !== moveIndex) {
            currentGeminiResponseText = '';
            currentGeminiResponseMoveIndex = -1;
        }
        if (!currentGeminiResponseText) {
            responseEl.innerHTML = `<p class="text-slate-400 text-xs italic">Presiona el botón para analizar el último movimiento con inteligencia artificial.</p>`;
            if (badgeEl) badgeEl.classList.add('hidden');
        }
        if (askBtn) {
            askBtn.innerHTML = `<i class="fas fa-brain"></i> Pregunta Predeterminada`;
        }
    }

    // Refresh the save/delete action area below the response
    renderGeminiSaveActionArea();

    // Refresh the contextual panel in the Analysis tab
    updateAnalysisTabAIPanel();
}

// ─── Main Gemini query ───────────────────────────────────────────────────────

async function askGemini() {
    const keyInput = document.getElementById('gemini-api-key-input');
    const modelSelect = document.getElementById('gemini-model-select');
    
    const apiKey = keyInput ? keyInput.value.trim() : '';
    const model = modelSelect ? modelSelect.value.trim() : '';

    if (!apiKey) {
        alert("Por favor, ingresa tu Gemini API Key.");
        return;
    }
    if (!model) {
        alert("Por favor, selecciona el modelo de Gemini a usar.");
        return;
    }

    const moves = game.history();
    if (moves.length === 0) {
        alert("No hay movimientos en la partida para analizar.");
        return;
    }

    // Determine which move index to analyze
    const targetIndex = _getCurrentMoveIndex();
    const effectiveIndex = (targetIndex >= 0 && targetIndex < moves.length) ? targetIndex : moves.length - 1;

    const askBtn = document.getElementById('gemini-ask-btn');
    const responseEl = document.getElementById('gemini-response');
    const badgeEl = document.getElementById('gemini-status-badge');
    const saveArea = document.getElementById('gemini-save-action-area');

    if (askBtn) askBtn.disabled = true;
    if (saveArea) saveArea.innerHTML = '';
    if (responseEl) {
        responseEl.innerHTML = `
            <div class="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                <i class="fas fa-circle-notch fa-spin text-2xl text-blue-500"></i>
                <span class="text-xs">Gemini está analizando la posición...</span>
            </div>
        `;
    }
    if (badgeEl) badgeEl.classList.add('hidden');

    // Build the move history up to effectiveIndex
    const movesUpTo = moves.slice(0, effectiveIndex + 1);

    // Format moves history list up to the target move
    let formattedHistory = "";
    for (let i = 0; i < movesUpTo.length; i += 2) {
        formattedHistory += `${Math.floor(i / 2) + 1}. ${movesUpTo[i]} ${movesUpTo[i + 1] || ""} `;
    }
    formattedHistory = formattedHistory.trim();

    const targetMove = movesUpTo[effectiveIndex];
    const prevMove = effectiveIndex >= 1 ? movesUpTo[effectiveIndex - 1] : "Ninguno (inicio de la partida)";

    // Construct prompt
    const prompt = `Quisiera entender a profundidad la posible intencionalidad detras del ultimo movimiento en esta partida, pon el codigo y la explicacion diciendo primero el movimiento previo que hicieron las oponentes y si el ultimo movimiento fue una respuesta directa o indirecta a ese movimiento de las oponentes.

Historial actual de movimientos de la partida:
${formattedHistory}

Detalles específicos del turno:
- Movimiento previo de las oponentes: ${prevMove}
- Último movimiento realizado: ${targetMove}

Por favor, escribe tu respuesta en español. Asegúrate de incluir el código/notación del movimiento en un formato claro (como bloques de código) y proporciona un análisis táctico o estratégico a profundidad.`;

    // Clean up model name
    let modelName = model;
    if (modelName.startsWith('models/')) {
        modelName = modelName.substring('models/'.length);
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData.error?.message || `Error HTTP ${response.status}`;
            throw new Error(errMsg);
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
            throw new Error("No se recibió texto en la respuesta de Gemini.");
        }

        // Successfully received a response — store in memory only (user must press Save to persist)
        currentGeminiResponseText = responseText;
        currentGeminiResponseMoveIndex = _getCurrentMoveIndex();

        // Render response
        if (responseEl) {
            if (typeof marked !== 'undefined') {
                responseEl.innerHTML = marked.parse(currentGeminiResponseText);
            } else {
                responseEl.innerText = currentGeminiResponseText;
            }
        }
        if (badgeEl) badgeEl.classList.remove('hidden');

        // Save the model since query succeeded
        saveGeminiModel(model);

        // Show the save action button
        renderGeminiSaveActionArea();

        // Auto-save the comment immediately if in an active game or review mode
        if (lichessGameActive || reviewMode) {
            saveCurrentGeminiAnalysis();
        }

    } catch (e) {
        console.error("Error al consultar Gemini:", e);
        currentGeminiResponseText = '';
        currentGeminiResponseMoveIndex = -1;
        if (responseEl) {
            responseEl.innerHTML = `
                <div class="bg-red-950/40 border border-red-800/60 rounded-lg p-3 text-red-300 text-xs flex gap-2.5 items-start">
                    <i class="fas fa-exclamation-circle text-base mt-0.5"></i>
                    <div class="flex-1">
                        <div class="font-bold mb-0.5">Error al consultar a Gemini</div>
                        <div class="opacity-90">${e.message}</div>
                    </div>
                </div>
            `;
        }
        if (saveArea) saveArea.innerHTML = '';
    } finally {
        if (askBtn) {
            askBtn.disabled = false;
        }
    }
}

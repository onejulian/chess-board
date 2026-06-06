// Inicializar instancia de Chess.js
const game = new Chess();
const boardEl = document.getElementById('board');
let selectedSquare = null;

// Variables de estado de Lichess y Análisis
let lichessToken = localStorage.getItem('lichess_token') || '';
let lichessGameActive = false;
let lichessGameId = null;
let userColor = 'w'; // 'w' o 'b'
let botTransition = null;
let reviewTransition = null; // Para animar movimientos en modo repaso

let analysisEnabled = false;
let showAllMoves = false; // Mostrar todas las jugadas posibles (desactivado por defecto)
let currentGoldSuggestion = null;
let lastAnalyzedFen = '';
let currentAnalysisAbortController = null;

// Variables de Historial y Repaso
let reviewMode = false;
let reviewGame = null;
let reviewIndex = -1;
let reviewMoves = [];
let lichessWhitePlayer = 'Blancas';
let lichessBlackPlayer = 'Negras';

// Índice del movimiento seleccionado durante partida activa (-1 = último movimiento)
let selectedMoveIndex = -1;

let streamAbortController = null;
let pollingIntervalId = null;

let isFlipped = false;

// Diccionario de imágenes SVG estándar de Wikimedia para las piezas
const pieceImages = {
    'P': 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
    'N': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
    'B': 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
    'R': 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
    'Q': 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
    'K': 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
    'p': 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
    'n': 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
    'b': 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
    'r': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
    'q': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
    'k': 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg'
};

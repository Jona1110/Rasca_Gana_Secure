/**
 * SNACKFLY - RASCA Y GANA (VERSIÓN SEGURA)
 * Dinámica virtual con verificación de fecha/hora y medidas anti-trampa
 * Desarrollado con HTML5 Canvas y JavaScript puro
 */

// ===== CONFIGURACIÓN GLOBAL =====
const CONFIG = {
    // Porcentaje mínimo para revelar automáticamente
    REVEAL_THRESHOLD: 70,
    
    // Tamaño del pincel de raspado
    BRUSH_SIZE: 30,
    
    // Premios disponibles con probabilidades
    PRIZES: [
        {
            text: "¡10% de descuento en tu próxima compra!",
            icon: "🎉",
            type: "discount",
            description: "Aplica el código SNACK10 al finalizar tu compra",
            probability: 0.25
        },
        {
            text: "¡Producto gratis en tu siguiente compra!",
            icon: "🆓",
            type: "free_product",
            description: "Válido para productos de hasta $50.000",
            probability: 0.20
        },
        {
            text: "¡Envío gratis a todo el país!",
            icon: "🚚",
            type: "free_shipping",
            description: "Sin monto mínimo de compra",
            probability: 0.15
        },
        {
            text: "Nada por hoy, ¡intenta de nuevo mañana!",
            icon: "😊",
            type: "try_again",
            description: "¡No te desanimes! Mañana tendrás otra oportunidad",
            probability: 0.40
        }
    ],
    
    // Clave para localStorage (ofuscada)
    STORAGE_KEY: btoa("snackfly_scratch_game_v2"),
    
    // Milisegundos en un día
    ONE_DAY_MS: 24 * 60 * 60 * 1000,
    
    // Clave de verificación de integridad
    INTEGRITY_KEY: "SF2025_SECURE"
};

// ===== VARIABLES GLOBALES =====
let canvas, ctx;
let isScratching = false;
let scratchedPixels = 0;
let totalPixels = 0;
let gameCompleted = false;
let currentPrize = null;
let gameSession = null;

// ===== FUNCIONES DE SEGURIDAD =====

/**
 * Genera un hash simple para verificación de integridad
 */
function generateHash(data) {
    let hash = 0;
    const str = JSON.stringify(data) + CONFIG.INTEGRITY_KEY;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convertir a 32bit
    }
    return Math.abs(hash).toString(36);
}

/**
 * Verifica la integridad de los datos almacenados
 */
function verifyDataIntegrity(data) {
    if (!data.hash || !data.payload) return false;
    const expectedHash = generateHash(data.payload);
    return data.hash === expectedHash;
}

/**
 * Crea un objeto de datos con verificación de integridad
 */
function createSecureData(payload) {
    const hash = generateHash(payload);
    return { payload, hash };
}

/**
 * Obtiene la fecha y hora actual con timezone
 */
function getCurrentDateTime() {
    const now = new Date();
    return {
        timestamp: now.getTime(),
        dateString: now.toLocaleDateString('es-ES'),
        timeString: now.toLocaleTimeString('es-ES'),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        isoString: now.toISOString()
    };
}

/**
 * Genera un ID único para la sesión de juego
 */
function generateSessionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return btoa(`${timestamp}_${random}`).substr(0, 16);
}

/**
 * Verifica si la fecha es válida (no manipulada)
 */
function isValidGameDate(gameDate, currentDate) {
    // Verificar que la fecha del juego no sea futura
    if (gameDate.timestamp > currentDate.timestamp + 60000) { // 1 minuto de tolerancia
        return false;
    }
    
    // Verificar que la fecha no sea muy antigua (más de 1 día)
    if (currentDate.timestamp - gameDate.timestamp > CONFIG.ONE_DAY_MS) {
        return false;
    }
    
    return true;
}

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', function() {
    initializeSecureGame();
});

/**
 * Inicializa el juego con medidas de seguridad
 */
function initializeSecureGame() {
    console.log('🔒 Inicializando Snackfly Rasca y Gana (Versión Segura)...');
    
    // Verificar si ya jugó hoy
    if (hasPlayedTodaySecure()) {
        showAlreadyPlayedSecure();
        return;
    }
    
    // Crear nueva sesión de juego
    gameSession = {
        id: generateSessionId(),
        startTime: getCurrentDateTime(),
        userAgent: navigator.userAgent.substr(0, 50), // Limitado por privacidad
        screenResolution: `${screen.width}x${screen.height}`
    };
    
    // Configurar canvas
    setupCanvas();
    
    // Generar premio aleatorio seguro
    generateSecurePrize();
    
    // Configurar eventos
    setupEventListeners();
    
    // Crear capa de raspado
    createScratchLayer();
    
    console.log('✅ Juego seguro inicializado correctamente');
}

/**
 * Genera un premio de forma segura con verificación
 */
function generateSecurePrize() {
    const currentTime = getCurrentDateTime();
    
    // Usar timestamp como semilla para mayor aleatoriedad
    const seed = currentTime.timestamp + Math.random();
    const random = (Math.sin(seed) * 10000) % 1;
    
    let cumulativeProbability = 0;
    let selectedPrize = CONFIG.PRIZES[CONFIG.PRIZES.length - 1]; // Default al último
    
    for (const prize of CONFIG.PRIZES) {
        cumulativeProbability += prize.probability;
        if (Math.abs(random) < cumulativeProbability) {
            selectedPrize = prize;
            break;
        }
    }
    
    // Crear objeto de premio con información de seguridad
    currentPrize = {
        ...selectedPrize,
        generatedAt: currentTime,
        sessionId: gameSession.id,
        prizeId: generateSessionId()
    };
    
    // Actualizar el mensaje de premio en el HTML
    const prizeText = document.getElementById('prizeText');
    const prizeIcon = document.querySelector('.prize-icon');
    
    prizeText.textContent = currentPrize.text;
    prizeIcon.textContent = currentPrize.icon;
    
    console.log('🎁 Premio seguro generado:', currentPrize.type);
}

/**
 * Configura todos los event listeners
 */
function setupEventListeners() {
    // Eventos de mouse
    canvas.addEventListener('mousedown', startScratching);
    canvas.addEventListener('mousemove', scratch);
    canvas.addEventListener('mouseup', stopScratching);
    canvas.addEventListener('mouseleave', stopScratching);
    
    // Eventos táctiles para móvil
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', stopScratching);
    
    // Botón del modal
    document.getElementById('modalBtn').addEventListener('click', closeModal);
    
    // Botón de reinicio (para demo)
    document.getElementById('resetBtn').addEventListener('click', resetSecureGame);
    
    // Detectar intentos de manipulación
    window.addEventListener('beforeunload', saveGameState);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    console.log('🎯 Event listeners seguros configurados');
}

/**
 * Maneja cambios de visibilidad para detectar manipulación
 */
function handleVisibilityChange() {
    if (document.hidden && isScratching) {
        // Usuario cambió de pestaña mientras raspaba - sospechoso
        console.warn('⚠️ Actividad sospechosa detectada: cambio de pestaña durante raspado');
    }
}

/**
 * Guarda el estado del juego antes de cerrar
 */
function saveGameState() {
    if (gameSession && !gameCompleted) {
        gameSession.interrupted = true;
        gameSession.endTime = getCurrentDateTime();
    }
}

/**
 * Configura el canvas para el raspado
 */
function setupCanvas() {
    canvas = document.getElementById('scratchCanvas');
    ctx = canvas.getContext('2d');
    
    // Configurar tamaño del canvas
    canvas.width = 300;
    canvas.height = 200;
    
    // Calcular total de píxeles
    totalPixels = canvas.width * canvas.height;
    
    console.log(`📐 Canvas configurado: ${canvas.width}x${canvas.height}`);
}

/**
 * Crea la capa gris de raspado con marca de agua de seguridad
 */
function createScratchLayer() {
    // Llenar con color gris
    ctx.fillStyle = '#95A5A6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Agregar patrón de textura
    ctx.fillStyle = '#7F8C8D';
    for (let i = 0; i < canvas.width; i += 20) {
        for (let j = 0; j < canvas.height; j += 20) {
            if ((i + j) % 40 === 0) {
                ctx.fillRect(i, j, 10, 10);
            }
        }
    }
    
    // Agregar texto principal
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Fredoka One, cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RASCA AQUÍ', canvas.width / 2, canvas.height / 2 - 20);
    
    ctx.font = '16px Poppins, sans-serif';
    ctx.fillText('🎁 ¡Descubre tu premio! 🎁', canvas.width / 2, canvas.height / 2 + 20);
    
    // Agregar marca de agua de seguridad (casi invisible)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.font = '8px monospace';
    ctx.fillText(`SF-${gameSession.id}`, canvas.width - 60, canvas.height - 10);
    
    console.log('🎨 Capa de raspado segura creada');
}

/**
 * Inicia el proceso de raspado
 */
function startScratching(e) {
    if (gameCompleted) return;
    
    isScratching = true;
    canvas.style.cursor = 'none';
    
    // Registrar inicio de raspado
    if (!gameSession.scratchStarted) {
        gameSession.scratchStarted = getCurrentDateTime();
    }
    
    // Reproducir sonido de raspado
    playSound('scratch');
    
    // Realizar primer raspado
    scratch(e);
}

/**
 * Realiza el raspado en la posición del cursor
 */
function scratch(e) {
    if (!isScratching || gameCompleted) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Configurar el pincel
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, CONFIG.BRUSH_SIZE, 0, 2 * Math.PI);
    ctx.fill();
    
    // Calcular porcentaje raspado
    calculateScratchedArea();
}

/**
 * Detiene el proceso de raspado
 */
function stopScratching() {
    isScratching = false;
    canvas.style.cursor = 'crosshair';
}

/**
 * Maneja el inicio del toque en móvil
 */
function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

/**
 * Maneja el movimiento del toque en móvil
 */
function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

/**
 * Calcula el área raspada y verifica si debe revelar automáticamente
 */
function calculateScratchedArea() {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    let transparentPixels = 0;
    
    // Contar píxeles transparentes (raspados)
    for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] === 0) { // Canal alpha = 0 (transparente)
            transparentPixels++;
        }
    }
    
    const percentage = (transparentPixels / totalPixels) * 100;
    
    // Si se raspó más del umbral, revelar automáticamente
    if (percentage >= CONFIG.REVEAL_THRESHOLD && !gameCompleted) {
        revealPrizeSecure();
    }
}

/**
 * Revela el premio de forma segura
 */
function revealPrizeSecure() {
    gameCompleted = true;
    
    // Registrar finalización del juego
    gameSession.completedAt = getCurrentDateTime();
    gameSession.scratchPercentage = CONFIG.REVEAL_THRESHOLD;
    
    // Limpiar completamente el canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Agregar animación a la tarjeta
    const card = document.querySelector('.scratch-card');
    card.classList.add('completed');
    
    // Ocultar instrucciones
    document.querySelector('.instructions').style.display = 'none';
    
    // Mostrar sección de reinicio
    document.getElementById('resetSection').style.display = 'block';
    
    // Guardar datos del juego de forma segura
    saveSecureGameData();
    
    // Mostrar modal con premio después de una pequeña pausa
    setTimeout(() => {
        showSecurePrizeModal();
        createConfetti();
    }, 800);
    
    console.log('🎊 Premio revelado de forma segura:', currentPrize.type);
}

/**
 * Muestra el modal con el premio de forma segura
 */
function showSecurePrizeModal() {
    const modal = document.getElementById('modalOverlay');
    const modalIcon = document.getElementById('modalIcon');
    const modalPrize = document.getElementById('modalPrize');
    const modalDescription = document.getElementById('modalDescription');
    
    // Configurar contenido del modal
    modalIcon.textContent = currentPrize.icon;
    modalPrize.textContent = currentPrize.text;
    
    // Agregar información de verificación de fecha/hora
    const dateInfo = `Generado el ${currentPrize.generatedAt.dateString} a las ${currentPrize.generatedAt.timeString}`;
    const sessionInfo = `ID de sesión: ${currentPrize.sessionId}`;
    
    modalDescription.innerHTML = `
        <div style="margin-bottom: 15px;">${currentPrize.description}</div>
        <div style="font-size: 0.9rem; color: #666; border-top: 1px solid #eee; padding-top: 10px;">
            <div style="margin-bottom: 5px;">📅 ${dateInfo}</div>
            <div style="font-family: monospace; font-size: 0.8rem;">🔒 ${sessionInfo}</div>
        </div>
    `;
    
    // Mostrar modal
    modal.classList.add('show');
    
    // Reproducir sonido de victoria
    playSound('win');
}

/**
 * Cierra el modal
 */
function closeModal() {
    const modal = document.getElementById('modalOverlay');
    modal.classList.remove('show');
}

/**
 * Crea efecto de confetti
 */
function createConfetti() {
    const colors = ['#FF6B35', '#F7931E', '#FFD23F', '#4CAF50', '#FF5722'];
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 2 + 's';
            
            document.body.appendChild(confetti);
            
            // Remover después de la animación
            setTimeout(() => {
                confetti.remove();
            }, 3000);
        }, i * 50);
    }
}

/**
 * Reproduce efectos sonoros
 */
function playSound(type) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        if (type === 'scratch') {
            // Sonido de raspado (ruido blanco corto)
            const bufferSize = audioContext.sampleRate * 0.1;
            const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
            const output = buffer.getChannelData(0);
            
            for (let i = 0; i < bufferSize; i++) {
                output[i] = (Math.random() * 2 - 1) * 0.1;
            }
            
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start();
            
        } else if (type === 'win') {
            // Sonido de victoria (secuencia de tonos ascendentes)
            const frequencies = [523.25, 659.25, 783.99, 1046.50];
            
            frequencies.forEach((freq, index) => {
                setTimeout(() => {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    
                    oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
                    oscillator.type = 'sine';
                    
                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                    
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.3);
                }, index * 150);
            });
        }
    } catch (error) {
        console.warn('Audio no disponible:', error);
    }
}

/**
 * Verifica si ya jugó hoy de forma segura
 */
function hasPlayedTodaySecure() {
    try {
        const savedData = localStorage.getItem(CONFIG.STORAGE_KEY);
        
        if (!savedData) return false;
        
        const data = JSON.parse(savedData);
        
        // Verificar integridad de los datos
        if (!verifyDataIntegrity(data)) {
            console.warn('⚠️ Datos corruptos detectados, limpiando localStorage');
            localStorage.removeItem(CONFIG.STORAGE_KEY);
            return false;
        }
        
        const gameData = data.payload;
        const lastPlayDate = new Date(gameData.lastPlayDate);
        const currentDate = getCurrentDateTime();
        
        // Verificar validez de la fecha
        if (!isValidGameDate({ timestamp: lastPlayDate.getTime() }, currentDate)) {
            console.warn('⚠️ Fecha inválida detectada, limpiando datos');
            localStorage.removeItem(CONFIG.STORAGE_KEY);
            return false;
        }
        
        // Verificar si es el mismo día
        return lastPlayDate.toDateString() === new Date(currentDate.timestamp).toDateString();
        
    } catch (error) {
        console.warn('Error verificando datos de juego:', error);
        localStorage.removeItem(CONFIG.STORAGE_KEY);
        return false;
    }
}

/**
 * Guarda los datos del juego de forma segura
 */
function saveSecureGameData() {
    try {
        const currentTime = getCurrentDateTime();
        
        const gameData = {
            lastPlayDate: currentTime.isoString,
            totalPlays: getTotalPlaysSecure() + 1,
            lastPrize: {
                type: currentPrize.type,
                generatedAt: currentPrize.generatedAt,
                sessionId: currentPrize.sessionId,
                prizeId: currentPrize.prizeId
            },
            session: gameSession,
            version: "2.0_secure"
        };
        
        const secureData = createSecureData(gameData);
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(secureData));
        
        console.log('💾 Datos del juego guardados de forma segura');
        
    } catch (error) {
        console.error('Error guardando datos del juego:', error);
    }
}

/**
 * Obtiene el total de veces que ha jugado de forma segura
 */
function getTotalPlaysSecure() {
    try {
        const savedData = localStorage.getItem(CONFIG.STORAGE_KEY);
        
        if (!savedData) return 0;
        
        const data = JSON.parse(savedData);
        
        if (!verifyDataIntegrity(data)) {
            return 0;
        }
        
        return data.payload.totalPlays || 0;
        
    } catch (error) {
        return 0;
    }
}

/**
 * Muestra mensaje cuando ya jugó hoy (versión segura)
 */
function showAlreadyPlayedSecure() {
    try {
        const savedData = localStorage.getItem(CONFIG.STORAGE_KEY);
        const data = JSON.parse(savedData);
        const gameData = data.payload;
        
        // Ocultar tarjeta de raspado
        document.querySelector('.scratch-card-container').style.display = 'none';
        
        // Mostrar mensaje con información de la última jugada
        const gameSection = document.querySelector('.game-section');
        const alreadyPlayedDiv = document.createElement('div');
        alreadyPlayedDiv.className = 'already-played';
        
        const lastPlayDate = new Date(gameData.lastPlayDate);
        const lastPrizeInfo = gameData.lastPrize || {};
        
        alreadyPlayedDiv.innerHTML = `
            <div style="text-align: center; color: white; padding: 40px;">
                <div style="font-size: 4rem; margin-bottom: 20px;">⏰</div>
                <h3 style="font-family: 'Fredoka One', cursive; font-size: 2rem; margin-bottom: 15px;">
                    ¡Ya jugaste hoy!
                </h3>
                <p style="font-size: 1.2rem; margin-bottom: 20px;">
                    Vuelve mañana para otra oportunidad de ganar
                </p>
                <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 15px; margin: 20px 0;">
                    <p style="font-size: 1rem; margin-bottom: 10px;">
                        <strong>Última jugada:</strong> ${lastPlayDate.toLocaleDateString('es-ES')} a las ${lastPlayDate.toLocaleTimeString('es-ES')}
                    </p>
                    ${lastPrizeInfo.type ? `
                        <p style="font-size: 0.9rem; opacity: 0.9;">
                            <strong>Último premio:</strong> ${lastPrizeInfo.type}
                        </p>
                    ` : ''}
                    <p style="font-size: 0.9rem; opacity: 0.8;">
                        <strong>Total de jugadas:</strong> ${gameData.totalPlays || 0}
                    </p>
                </div>
                <button onclick="resetSecureGame()" style="
                    background: white; 
                    color: #FF6B35; 
                    border: none; 
                    padding: 12px 24px; 
                    border-radius: 25px; 
                    font-size: 1rem; 
                    font-weight: 600; 
                    cursor: pointer; 
                    margin-top: 20px;
                    transition: all 0.3s ease;
                " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                    🔄 Probar Demo
                </button>
            </div>
        `;
        
        gameSection.appendChild(alreadyPlayedDiv);
        
        console.log('⏰ Usuario ya jugó hoy - información verificada');
        
    } catch (error) {
        console.error('Error mostrando información de juego anterior:', error);
        // Fallback a mensaje simple
        showAlreadyPlayed();
    }
}

/**
 * Reinicia el juego de forma segura (solo para demo)
 */
function resetSecureGame() {
    // Limpiar localStorage
    localStorage.removeItem(CONFIG.STORAGE_KEY);
    
    // Recargar página
    location.reload();
    
    console.log('🔄 Juego seguro reiniciado');
}

// ===== UTILIDADES ADICIONALES =====

/**
 * Detecta si es un dispositivo móvil
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Ajusta el tamaño del pincel según el dispositivo
 */
function adjustBrushSize() {
    if (isMobileDevice()) {
        CONFIG.BRUSH_SIZE = 40; // Pincel más grande para móvil
    }
}

/**
 * Detecta intentos de manipulación del tiempo del sistema
 */
function detectTimeManipulation() {
    const serverTime = Date.now(); // En producción, esto vendría del servidor
    const clientTime = new Date().getTime();
    const timeDiff = Math.abs(serverTime - clientTime);
    
    // Si la diferencia es mayor a 5 minutos, es sospechoso
    if (timeDiff > 5 * 60 * 1000) {
        console.warn('⚠️ Posible manipulación de tiempo detectada');
        return true;
    }
    
    return false;
}

// Ajustar configuración al cargar
adjustBrushSize();

// Detectar manipulación de tiempo (en producción conectar con servidor)
if (detectTimeManipulation()) {
    console.warn('⚠️ Sistema de tiempo posiblemente manipulado');
}

console.log('🔒 Script seguro de Snackfly Rasca y Gana cargado correctamente');


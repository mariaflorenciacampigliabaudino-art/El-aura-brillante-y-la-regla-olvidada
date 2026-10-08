// Ruta del worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const bookContainer = document.getElementById('flip-book');
const loading = document.getElementById('loading');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnRead = document.getElementById('btn-read');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');

let pageFlip = null;
let pdfDoc = null;
let zoomLevel = 1.0;
let isReading = false;
let pageTexts = []; // Almacena el texto extraído por página para lectura en voz alta

// Cargar automáticamente el cuento del repositorio
window.addEventListener('DOMContentLoaded', () => {
    loadPDF('cuento.pdf');
});

// Generar sonido sintético de pasar página (efecto de hoja arrugándose)
function playFlipSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const bufferSize = audioCtx.sampleRate * 0.15; // 150ms de sonido
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1; // Ruido blanco
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1000;

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        noise.start();
    } catch (e) {
        console.log('Audio no soportado o bloqueado por el navegador');
    }
}

async function loadPDF(pdfUrl) {
    loading.style.display = 'block';
    bookContainer.style.display = 'none';
    bookContainer.innerHTML = '';
    pageTexts = [];

    try {
        pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;
        const totalPages = pdfDoc.numPages;

        const firstPage = await pdfDoc.getPage(1);
        const viewportInfo = firstPage.getViewport({ scale: 1.5 });
        const pageWidth = viewportInfo.width;
        const pageHeight = viewportInfo.height;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            
            // Extraer texto para la lectura en voz alta
            const textContent = await page.getTextContent();
            const textString = textContent.items.map(item => item.str).join(' ');
            pageTexts.push(textString);

            // Renderizar la página en Canvas
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            const pageDiv = document.createElement('div');
            pageDiv.className = 'page';
            pageDiv.appendChild(canvas);
            bookContainer.appendChild(pageDiv);
        }

        bookContainer.style.display = 'block';

        // Inicializar PageFlip con animaciones atractivas
        pageFlip = new St.PageFlip(bookContainer, {
            width: pageWidth,
            height: pageHeight,
            size: "stretch",
            minWidth: 315,
            maxWidth: pageWidth,
            minHeight: 420,
            maxHeight: pageHeight,
            showCover: true,
            maxShadowOpacity: 0.7,
            flippingTime: 800, // Tiempo de animación suave
            usePortrait: true
        });

        const pages = document.querySelectorAll('.page');
        pageFlip.loadFromHTML(pages);

        // Evento al cambiar de página
        pageFlip.on('flip', (e) => {
            playFlipSound();
            if (isReading) {
                window.speechSynthesis.cancel();
                readCurrentPage();
            }
        });

        loading.style.display = 'none';

    } catch (error) {
        console.error('Error al cargar el archivo cuento.pdf:', error);
        loading.innerText = 'No se encontró el archivo "cuento.pdf" en el repositorio.';
    }
}

// Navegación con botones
btnPrev.addEventListener('click', () => {
    if (pageFlip) pageFlip.flipPrev();
});

btnNext.addEventListener('click', () => {
    if (pageFlip) pageFlip.flipNext();
});

// Lógica de Zoom / Agrandar vista
btnZoomIn.addEventListener('click', () => {
    if (zoomLevel < 1.6) {
        zoomLevel += 0.15;
        document.querySelector('.book-container').style.transform = `scale(${zoomLevel})`;
    }
});

btnZoomOut.addEventListener('click', () => {
    if (zoomLevel > 0.7) {
        zoomLevel -= 0.15;
        document.querySelector('.book-container').style.transform = `scale(${zoomLevel})`;
    }
});

// Lectura en Voz Alta (API Web Speech)
btnRead.addEventListener('click', () => {
    if (isReading) {
        window.speechSynthesis.cancel();
        isReading = false;
        btnRead.classList.remove('reading');
        btnRead.innerText = '🔊 Leer en Voz Alta';
    } else {
        isReading = true;
        btnRead.classList.add('reading');
        btnRead.innerText = '⏹ Detener Lectura';
        readCurrentPage();
    }
});

function readCurrentPage() {
    if (!pageFlip || !('speechSynthesis' in window)) return;

    const currentPageIndex = pageFlip.getCurrentPageIndex();
    const textToRead = pageTexts[currentPageIndex];

    if (!textToRead || textToRead.trim() === '') {
        const utterance = new SpeechSynthesisUtterance('Esta página no contiene texto.');
        utterance.lang = 'es-ES';
        window.speechSynthesis.speak(utterance);
        return;
    }

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = 'es-ES';
    utterance.rate = 0.9; // Velocidad pausada idónea para niños

    utterance.onend = () => {
        if (isReading) {
            btnRead.classList.remove('reading');
            btnRead.innerText = '🔊 Leer en Voz Alta';
            isReading = false;
        }
    };

    window.speechSynthesis.speak(utterance);
}
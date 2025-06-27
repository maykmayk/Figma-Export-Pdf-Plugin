// ui.js
console.log("UI script loaded");

// Variabile globale per tenere traccia dei frame
let currentFrames = [];

// Invia messaggio ready quando la pagina è completamente caricata
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, sending ready message");
    parent.postMessage({ pluginMessage: { type: "ready" } }, "*");
});

// Se il DOM è già caricato
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendReady);
} else {
    sendReady();
}

function sendReady() {
    console.log("Sending ready message");
    parent.postMessage({ pluginMessage: { type: "ready" } }, "*");
}

// Ascolta i messaggi dal plugin
window.addEventListener('message', (event) => {
    console.log("Message received in UI:", event.data);
    
    // Verifica che il messaggio venga dal plugin
    if (!event.data.pluginMessage) {
        console.log("Message without pluginMessage, ignoring");
        return;
    }
    
    const { type, frames, images } = event.data.pluginMessage;
    console.log("Message type:", type);

    if (type === "thumbnails") {
        console.log("Processing thumbnails:", frames);
        handleThumbnails(frames);
    } else if (type === "images") {
        console.log("Processing images for PDF:", images);
        generatePDF(images);
    } else if (type === "error") {
        console.error("Error from plugin:", event.data.pluginMessage.message);
        document.getElementById("status").textContent = "❌ Errore: " + event.data.pluginMessage.message;
    }
});

function handleThumbnails(frames) {
    currentFrames = frames || [];
    const framesContainer = document.getElementById("frames");
    
    if (!framesContainer) {
        console.error("Frames container not found");
        return;
    }
    
    framesContainer.innerHTML = "";

    if (currentFrames.length === 0) {
        document.getElementById("status").textContent = "❌ Nessun frame selezionato.";
        return;
    }

    document.getElementById("status").textContent = `✅ ${currentFrames.length} frames caricati`;

    currentFrames.forEach((frame) => {
        const div = document.createElement("div");
        div.className = "frame-preview";
        
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = true;
        checkbox.value = frame.id;
        
        const img = document.createElement("img");
        img.src = `data:image/png;base64,${frame.thumbnail}`;
        img.style.width = "60px";
        img.style.height = "40px";
        img.style.objectFit = "cover";
        img.style.border = "1px solid #ddd";
        img.style.marginRight = "10px";
        
        const textDiv = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = frame.name;
        textDiv.appendChild(strong);
        
        div.appendChild(checkbox);
        div.appendChild(img);
        div.appendChild(textDiv);
        
        framesContainer.appendChild(div);
    });
}

// Event listener per il bottone export
document.addEventListener('DOMContentLoaded', function() {
    const exportButton = document.getElementById("export");
    if (exportButton) {
        exportButton.addEventListener("click", handleExport);
        console.log("Export button listener added");
    } else {
        console.error("Export button not found");
    }
});

function handleExport() {
    console.log("Export button clicked");
    
    const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
    const selectedIds = Array.from(checkboxes).map((cb) => cb.value);
    
    console.log("Selected IDs:", selectedIds);
    
    if (selectedIds.length === 0) {
        alert("Nessun frame selezionato!");
        return;
    }
    
    const scaleSelect = document.getElementById("scale");
    const scale = scaleSelect ? parseFloat(scaleSelect.value) : 1;
    console.log("Scale:", scale);

    const message = {
        pluginMessage: {
            type: "export-selected",
            ids: selectedIds,
            scale: scale,
        }
    };
    
    console.log("Sending export message:", message);
    parent.postMessage(message, "*");

    document.getElementById("status").textContent = "⏳ Sto esportando...";
}

function generatePDF(images) {
    console.log("Generating PDF with", images.length, "images");
    
    if (!window.jspdf || !window.jspdf.jsPDF) {
        console.error("jsPDF not loaded");
        document.getElementById("status").textContent = "❌ Errore: jsPDF non caricato";
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    let doneCount = 0;

    if (images.length === 0) {
        console.error("No images to process");
        document.getElementById("status").textContent = "❌ Nessuna immagine da esportare";
        return;
    }

    images.forEach((frame, index) => {
        console.log(`Processing image ${index + 1} of ${images.length}: ${frame.name}`);
        
        try {
            const byteCharacters = atob(frame.data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let j = 0; j < byteCharacters.length; j++) {
                byteNumbers[j] = byteCharacters.charCodeAt(j);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: "image/png" });
            const url = URL.createObjectURL(blob);

            const img = new Image();
            img.onload = () => {
                console.log(`Image ${index + 1} loaded, adding to PDF`);
                
                try {
                    // Dimensioni pagina A4
                    const pdfWidth = 210;
                    const pdfHeight = 297;
                    const margin = 10;
                    
                    const maxWidth = pdfWidth - (margin * 2);
                    const maxHeight = pdfHeight - (margin * 2);
                    
                    // Converti px a mm (approssimativo)
                    let imgWidth = img.width * 0.264583;
                    let imgHeight = img.height * 0.264583;
                    
                    // Scala se troppo grande
                    if (imgWidth > maxWidth) {
                        const ratio = maxWidth / imgWidth;
                        imgWidth = maxWidth;
                        imgHeight = imgHeight * ratio;
                    }
                    
                    if (imgHeight > maxHeight) {
                        const ratio = maxHeight / imgHeight;
                        imgHeight = maxHeight;
                        imgWidth = imgWidth * ratio;
                    }
                    
                    // Centra l'immagine
                    const x = (pdfWidth - imgWidth) / 2;
                    const y = (pdfHeight - imgHeight) / 2;
                    
                    pdf.addImage(img, "PNG", x, y, imgWidth, imgHeight);
                    doneCount++;
                    
                    if (index < images.length - 1) {
                        pdf.addPage();
                    }
                    
                    if (doneCount === images.length) {
                        console.log("All images processed, downloading PDF");
                        const pdfBlob = pdf.output("blob");
                        const pdfUrl = URL.createObjectURL(pdfBlob);
                        const a = document.createElement("a");
                        a.href = pdfUrl;
                        a.download = "frames.pdf";
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        
                        document.getElementById("status").textContent = "✅ PDF esportato!";
                        
                        setTimeout(() => {
                            URL.revokeObjectURL(pdfUrl);
                        }, 1000);
                    }
                } catch (pdfError) {
                    console.error("Error adding image to PDF:", pdfError);
                    document.getElementById("status").textContent = "❌ Errore nella generazione PDF";
                }
                
                URL.revokeObjectURL(url);
            };
            
            img.onerror = () => {
                console.error("Error loading image", index);
                document.getElementById("status").textContent = "❌ Errore nel caricamento immagine";
                URL.revokeObjectURL(url);
            };
            
            img.src = url;
        } catch (error) {
            console.error("Error processing image data:", error);
            document.getElementById("status").textContent = "❌ Errore nel processamento immagine";
        }
    });
}

console.log("UI script setup complete");
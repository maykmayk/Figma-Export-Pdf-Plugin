console.log("Plugin started");

figma.showUI(__html__, { width: 480, height: 720 });

async function sendSelection() {
    console.log("sendSelection called");
    
    const selection = figma.currentPage.selection.filter(
        (node) => node.type === "FRAME"
    );

    console.log(`Found ${selection.length} frames in selection`);

    if (selection.length === 0) {
        console.log("No frames selected, sending empty array");
        figma.ui.postMessage({ type: "thumbnails", frames: [] });
        return;
    }

    try {
        console.log("Starting to process frames...");
        const thumbs = [];
        
        for (let i = 0; i < selection.length; i++) {
            const frame = selection[i];
            console.log(`Processing frame ${i + 1}: ${frame.name}`);
            
            const previewBytes = await frame.exportAsync({
                format: "PNG",
                constraint: { type: "SCALE", value: 0.15 },
            });
            
            const thumbnail = figma.base64Encode(previewBytes);
            
            thumbs.push({
                id: frame.id,
                name: frame.name,
                thumbnail: thumbnail,
                width: frame.width,
                height: frame.height,
                x: frame.x,
                y: frame.y
            });
        }

        console.log(`Sending ${thumbs.length} thumbnails to UI`);
        const message = { type: "thumbnails", frames: thumbs };
        figma.ui.postMessage(message);
        
    } catch (err) {
        console.error("Error in sendSelection:", err);
        figma.ui.postMessage({ type: "error", message: err.message });
    }
}

// Handler per i messaggi dall'UI
figma.ui.onmessage = async (msg) => {
    console.log("Message received from UI:", JSON.stringify(msg));
    
    if (msg.type === "ready") {
        console.log("UI is ready, sending initial selection");
        setTimeout(async () => {
            await sendSelection();
        }, 100);
        
    } else if (msg.type === "export-selected") {
        console.log("Export request received");
        const { ids, scale, quality, pageSize } = msg;
        console.log(`Exporting ${ids.length} frames with scale ${scale}, quality ${quality}, pageSize ${pageSize}`);

        try {
            const images = [];
            
            for (let i = 0; i < ids.length; i++) {
                const id = ids[i];
                console.log(`Exporting frame ${i + 1} with id: ${id}`);
                
                const node = figma.getNodeById(id);
                if (!node) {
                    console.warn(`Node with id ${id} not found`);
                    continue;
                }
                
                if (node.type !== "FRAME") {
                    console.warn(`Node ${id} is not a frame`);
                    continue;
                }
                
                const png = await node.exportAsync({
                    format: "PNG",
                    constraint: { type: "SCALE", value: scale },
                });
                
                const base64 = figma.base64Encode(png);
                images.push({
                    name: node.name,
                    data: base64,
                    width: node.width * scale,
                    height: node.height * scale,
                    originalWidth: node.width,
                    originalHeight: node.height
                });
                
                console.log(`Frame ${node.name} exported successfully`);
            }

            console.log(`Sending ${images.length} images to UI for PDF generation`);
            figma.ui.postMessage({ 
                type: "images", 
                images,
                exportSettings: { scale, quality, pageSize }
            });
            
        } catch (err) {
            console.error("Error during export:", err);
            figma.ui.postMessage({ type: "error", message: err.message });
        }
        
    } else if (msg.type === "close") {
        console.log("Closing plugin");
        figma.closePlugin();
    }
};

// Ascolta i cambiamenti di selezione
figma.on("selectionchange", () => {
    console.log("Selection changed");
    sendSelection();
});

// Invia la selezione iniziale dopo un breve delay
setTimeout(() => {
    console.log("Sending initial selection");
    sendSelection();
}, 500);

console.log("Plugin setup complete");
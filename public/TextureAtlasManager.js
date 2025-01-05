// TextureAtlasManager.js

class TextureAtlasManager {
    constructor(gl) {
        this.gl = gl;
        this.atlases = [];
        this.currentAtlasIndex = 0;
        this.currentBufferIndex = 0;
        this.frameBuffer = gl.createFramebuffer();
        
        // Create initial atlas
        this.addNewAtlas();
    }
    
    addNewAtlas() {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        // Create texture with space for 4 buffers in a 2x2 grid
        const totalWidth = gl.canvas.width * 2;   // Space for 2 buffers horizontally
        const totalHeight = gl.canvas.height * 2;  // Space for 2 buffers vertically
        gl.texImage2D(
            gl.TEXTURE_2D, 
            0, 
            gl.RGBA, 
            totalWidth,
            totalHeight,
            0, 
            gl.RGBA, 
            gl.UNSIGNED_BYTE, 
            null
        );
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        this.atlases.push(texture);
    }
    
    captureCurrentFrame() {
        const gl = this.gl;
        
        // If we've used all 4 buffers in current texture, move to next atlas
        if (this.currentBufferIndex >= 4) {
            this.currentBufferIndex = 0;
            this.currentAtlasIndex++;
            if (this.currentAtlasIndex >= this.atlases.length) {
                this.addNewAtlas();
            }
        }
        
        // Bind current atlas texture
        gl.bindTexture(gl.TEXTURE_2D, this.atlases[this.currentAtlasIndex]);
        
        // Calculate X and Y offsets for current buffer in 2x2 grid
        const xOffset = (this.currentBufferIndex % 2) * gl.canvas.width;
        const yOffset = Math.floor(this.currentBufferIndex / 2) * gl.canvas.height;
        
        // Copy the current framebuffer to the texture
        gl.copyTexSubImage2D(
            gl.TEXTURE_2D,
            0,                  // mipmap level
            xOffset,           // x offset
            yOffset,           // y offset
            0,                 // x
            0,                 // y
            gl.canvas.width,    // width
            gl.canvas.height    // height
        );
        
        this.currentBufferIndex++;
    }
    
    updateBuffer(data) {
        const gl = this.gl;
        
        // If we've used all 4 buffers in current texture, move to next atlas
        if (this.currentBufferIndex >= 4) {
            this.currentBufferIndex = 0;
            this.currentAtlasIndex++;
            if (this.currentAtlasIndex >= this.atlases.length) {
                this.addNewAtlas();
            }
        }
        
        // Bind current atlas texture
        gl.bindTexture(gl.TEXTURE_2D, this.atlases[this.currentAtlasIndex]);
        
        // Calculate X and Y offsets for current buffer in 2x2 grid
        const xOffset = (this.currentBufferIndex % 2) * gl.canvas.width;
        const yOffset = Math.floor(this.currentBufferIndex / 2) * gl.canvas.height;
        
        // Update specific portion of the texture for this buffer
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,                  // mipmap level
            xOffset,           // x offset
            yOffset,           // y offset
            gl.canvas.width,    // width
            gl.canvas.height,   // height
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            data
        );
        
        this.currentBufferIndex++;
    }
    
    bindTextures(shaderProgram) {
        const gl = this.gl;
        
        // Bind each atlas to a different texture unit
        for (let i = 0; i < this.atlases.length; i++) {
            const location = gl.getUniformLocation(shaderProgram, `textureAtlas[${i}]`);
            if (location) {
                gl.activeTexture(gl.TEXTURE0 + i + 6); // Start from TEXTURE6 to avoid conflicts
                gl.bindTexture(gl.TEXTURE_2D, this.atlases[i]);
                gl.uniform1i(location, i + 6);
            }
        }
    }
}
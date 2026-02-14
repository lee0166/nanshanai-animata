const fs = require('fs');
const path = require('path');

// 确保 public 目录存在
const publicDir = path.join(__dirname, '..', 'public');

// 创建 PNG 文件 - 使用简单的位图格式
function createPNG(width, height, pixelData) {
    // PNG 文件签名
    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    
    // 创建 IHDR 块
    function createChunk(type, data) {
        const typeBuffer = Buffer.from(type, 'ascii');
        const lengthBuffer = Buffer.alloc(4);
        lengthBuffer.writeUInt32BE(data.length, 0);
        
        // CRC32 计算
        function crc32(buffer) {
            let crc = 0xFFFFFFFF;
            const table = new Uint32Array(256);
            for (let i = 0; i < 256; i++) {
                let c = i;
                for (let j = 0; j < 8; j++) {
                    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                }
                table[i] = c;
            }
            for (let i = 0; i < buffer.length; i++) {
                crc = table[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
            }
            return (crc ^ 0xFFFFFFFF) >>> 0;
        }
        
        const crcInput = Buffer.concat([typeBuffer, data]);
        const crcBuffer = Buffer.alloc(4);
        crcBuffer.writeUInt32BE(crc32(crcInput), 0);
        
        return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
    }
    
    // IHDR 数据
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData.writeUInt8(8, 8); // 位深度
    ihdrData.writeUInt8(6, 9); // 颜色类型 (RGBA)
    ihdrData.writeUInt8(0, 10); // 压缩方法
    ihdrData.writeUInt8(0, 11); // 过滤方法
    ihdrData.writeUInt8(0, 12); // 交错方法
    
    // 准备图像数据
    const rowSize = width * 4 + 1;
    const imageData = Buffer.alloc(height * rowSize);
    
    for (let y = 0; y < height; y++) {
        const rowOffset = y * rowSize;
        imageData[rowOffset] = 0; // 过滤字节
        
        for (let x = 0; x < width; x++) {
            const pixelOffset = rowOffset + 1 + x * 4;
            const pixelIndex = (y * width + x) * 4;
            imageData[pixelOffset] = pixelData[pixelIndex];     // R
            imageData[pixelOffset + 1] = pixelData[pixelIndex + 1]; // G
            imageData[pixelOffset + 2] = pixelData[pixelIndex + 2]; // B
            imageData[pixelOffset + 3] = pixelData[pixelIndex + 3]; // A
        }
    }
    
    // 压缩图像数据 (使用简单的 zlib 压缩)
    const zlib = require('zlib');
    const compressed = zlib.deflateSync(imageData);
    
    const ihdr = createChunk('IHDR', ihdrData);
    const idat = createChunk('IDAT', compressed);
    const iend = createChunk('IEND', Buffer.alloc(0));
    
    return Buffer.concat([signature, ihdr, idat, iend]);
}

// 绘制圆角矩形
function drawRoundedRect(pixels, width, height, x, y, w, h, radius, r, g, b, a) {
    for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
            // 检查点是否在圆角矩形内
            let inside = false;
            
            if (px >= x && px < x + w && py >= y && py < y + h) {
                const dx = px - x;
                const dy = py - y;
                
                // 四个角
                if (dx < radius && dy < radius) {
                    // 左上角
                    const dist = Math.sqrt((radius - dx) ** 2 + (radius - dy) ** 2);
                    inside = dist <= radius;
                } else if (dx >= w - radius && dy < radius) {
                    // 右上角
                    const dist = Math.sqrt((dx - (w - radius)) ** 2 + (radius - dy) ** 2);
                    inside = dist <= radius;
                } else if (dx < radius && dy >= h - radius) {
                    // 左下角
                    const dist = Math.sqrt((radius - dx) ** 2 + (dy - (h - radius)) ** 2);
                    inside = dist <= radius;
                } else if (dx >= w - radius && dy >= h - radius) {
                    // 右下角
                    const dist = Math.sqrt((dx - (w - radius)) ** 2 + (dy - (h - radius)) ** 2);
                    inside = dist <= radius;
                } else {
                    inside = true;
                }
            }
            
            if (inside) {
                const idx = (py * width + px) * 4;
                pixels[idx] = r;
                pixels[idx + 1] = g;
                pixels[idx + 2] = b;
                pixels[idx + 3] = a;
            }
        }
    }
}

// 绘制填充圆角矩形
function fillRoundedRect(pixels, width, height, x, y, w, h, radius, r, g, b, a) {
    drawRoundedRect(pixels, width, height, x, y, w, h, radius, r, g, b, a);
}

// 绘制椭圆
function drawEllipse(pixels, width, height, cx, cy, rx, ry, r, g, b, a) {
    for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
            const dx = px - cx;
            const dy = py - cy;
            if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
                const idx = (py * width + px) * 4;
                pixels[idx] = r;
                pixels[idx + 1] = g;
                pixels[idx + 2] = b;
                pixels[idx + 3] = a;
            }
        }
    }
}

// 绘制三角形
function drawTriangle(pixels, width, height, x1, y1, x2, y2, x3, y3, r, g, b, a) {
    // 计算包围盒
    const minX = Math.max(0, Math.min(x1, x2, x3));
    const maxX = Math.min(width - 1, Math.max(x1, x2, x3));
    const minY = Math.max(0, Math.min(y1, y2, y3));
    const maxY = Math.min(height - 1, Math.max(y1, y2, y3));
    
    for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
            // 使用重心坐标判断点是否在三角形内
            const denom = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
            const a1 = ((y2 - y3) * (px - x3) + (x3 - x2) * (py - y3)) / denom;
            const a2 = ((y3 - y1) * (px - x3) + (x1 - x3) * (py - y3)) / denom;
            const a3 = 1 - a1 - a2;
            
            if (a1 >= 0 && a2 >= 0 && a3 >= 0) {
                const idx = (py * width + px) * 4;
                pixels[idx] = r;
                pixels[idx + 1] = g;
                pixels[idx + 2] = b;
                pixels[idx + 3] = a;
            }
        }
    }
}

// 绘制渐变背景
function drawGradientBackground(pixels, width, height, color1, color2) {
    for (let y = 0; y < height; y++) {
        const t = y / height;
        const r = Math.round(color1[0] * (1 - t) + color2[0] * t);
        const g = Math.round(color1[1] * (1 - t) + color2[1] * t);
        const b = Math.round(color1[2] * (1 - t) + color2[2] * t);
        
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            pixels[idx] = r;
            pixels[idx + 1] = g;
            pixels[idx + 2] = b;
            pixels[idx + 3] = 255;
        }
    }
}

// 生成 icon.png (512x512)
function generateIcon() {
    const width = 512;
    const height = 512;
    const pixels = new Uint8Array(width * height * 4);
    
    // 渐变背景 (从 #1e3a8a 到 #3870e7)
    drawGradientBackground(pixels, width, height, [30, 58, 138], [56, 112, 231]);
    
    // 胶片外框背景 (#0f172a)
    fillRoundedRect(pixels, width, height, 96, 144, 320, 224, 24, 15, 23, 42, 255);
    
    // 胶片边框 (#60a5fa)
    // 简化：只绘制内部内容
    
    // 胶片孔 (#3870e7)
    for (let i = 0; i < 6; i++) {
        const x = 120 + i * 48;
        fillRoundedRect(pixels, width, height, x, 160, 24, 16, 4, 56, 112, 231, 255);
        fillRoundedRect(pixels, width, height, x, 336, 24, 16, 4, 56, 112, 231, 255);
    }
    
    // 播放按钮背景 (渐变从 #60a5fa 到 #93c5fd)
    drawEllipse(pixels, width, height, 256, 256, 64, 64, 96, 165, 250, 255);
    
    // 播放三角形 (#1e3a8a)
    drawTriangle(pixels, width, height, 236, 226, 236, 286, 296, 256, 30, 58, 138, 255);
    
    const png = createPNG(width, height, pixels);
    fs.writeFileSync(path.join(publicDir, 'icon.png'), png);
    console.log('✓ icon.png (512x512) created');
}

// 生成 favicon.ico (32x32)
function generateFavicon() {
    const width = 32;
    const height = 32;
    const pixels = new Uint8Array(width * height * 4);
    
    // 渐变背景
    drawGradientBackground(pixels, width, height, [30, 58, 138], [56, 112, 231]);
    
    // 胶片外框
    fillRoundedRect(pixels, width, height, 6, 9, 20, 14, 3, 15, 23, 42, 255);
    
    // 胶片孔
    for (let i = 0; i < 4; i++) {
        const x = 8 + i * 4;
        pixels[(10 * width + x) * 4] = 56;
        pixels[(10 * width + x) * 4 + 1] = 112;
        pixels[(10 * width + x) * 4 + 2] = 231;
        pixels[(10 * width + x) * 4 + 3] = 255;
        pixels[(20 * width + x) * 4] = 56;
        pixels[(20 * width + x) * 4 + 1] = 112;
        pixels[(20 * width + x) * 4 + 2] = 231;
        pixels[(20 * width + x) * 4 + 3] = 255;
    }
    
    // 播放按钮
    drawEllipse(pixels, width, height, 16, 16, 4, 4, 96, 165, 250, 255);
    
    // 播放三角形
    drawTriangle(pixels, width, height, 14, 14, 14, 18, 18, 16, 30, 58, 138, 255);
    
    // 创建 ICO 文件
    const png = createPNG(width, height, pixels);
    
    // ICO 文件头
    const icoHeader = Buffer.alloc(6);
    icoHeader.writeUInt16LE(0, 0); // 保留
    icoHeader.writeUInt16LE(1, 2); // 类型 (ICO)
    icoHeader.writeUInt16LE(1, 4); // 图像数量
    
    // ICO 目录条目
    const icoEntry = Buffer.alloc(16);
    icoEntry.writeUInt8(width, 0);      // 宽度
    icoEntry.writeUInt8(height, 1);     // 高度
    icoEntry.writeUInt8(0, 2);          // 颜色调色板
    icoEntry.writeUInt8(0, 3);          // 保留
    icoEntry.writeUInt16LE(1, 4);       // 颜色平面
    icoEntry.writeUInt16LE(32, 6);      // 位深度
    icoEntry.writeUInt32LE(png.length, 8); // 图像大小
    icoEntry.writeUInt32LE(22, 12);     // 偏移量
    
    const ico = Buffer.concat([icoHeader, icoEntry, png]);
    fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico);
    console.log('✓ favicon.ico (32x32) created');
}

// 主函数
console.log('Generating icons...\n');
generateIcon();
generateFavicon();
console.log('\n✓ All icons generated successfully!');

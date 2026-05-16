const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const svgPath = path.join(__dirname, '../public/icons/icon.svg');
const outputDir = path.join(__dirname, '../public/icons');

async function generateIcons() {
    try {
        // Read SVG file
        const svgBuffer = fs.readFileSync(svgPath);
        
        // Generate icons for each size
        for (const size of sizes) {
            await sharp(svgBuffer)
                .resize(size, size)
                .png()
                .toFile(path.join(outputDir, `icon-${size}x${size}.png`));
            
            console.log(`Generated icon-${size}x${size}.png`);
        }
        
        // Generate maskable icons (with padding)
        const maskableSizes = [192, 512];
        for (const size of maskableSizes) {
            const padding = Math.floor(size * 0.1); // 10% padding for maskable
            
            await sharp(svgBuffer)
                .resize(size - (padding * 2), size - (padding * 2))
                .extend({
                    top: padding,
                    bottom: padding,
                    left: padding,
                    right: padding,
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .png()
                .toFile(path.join(outputDir, `icon-maskable-${size}x${size}.png`));
            
            console.log(`Generated icon-maskable-${size}x${size}.png`);
        }
        
        // Copy main icons to public root for backward compatibility
        await sharp(svgBuffer)
            .resize(192, 192)
            .png()
            .toFile(path.join(__dirname, '../public/icon-192x192.png'));
        
        await sharp(svgBuffer)
            .resize(512, 512)
            .png()
            .toFile(path.join(__dirname, '../public/icon-512x512.png'));
        
        console.log('All icons generated successfully!');
        
    } catch (error) {
        console.error('Error generating icons:', error);
        process.exit(1);
    }
}

generateIcons();
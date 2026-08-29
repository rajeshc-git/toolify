import os, re, subprocess, shutil

win_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(win_dir, "..", ".."))
base_dir = os.path.join(root_dir, "web")

print("🚀 Starting Windows Electron App build pipeline...")

# 1. Bundle web assets from web folder
index_path = os.path.join(base_dir, 'index.html')
css_path = os.path.join(base_dir, 'styles.css')
app_js_path = os.path.join(base_dir, 'app.js')
tools_dir = os.path.join(base_dir, 'js', 'tools')
vendor_dir = os.path.join(base_dir, 'js', 'vendor')

with open(index_path, 'r', encoding='utf-8') as f:
    html = f.read()

with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

js_content = ""
vendor_lib = os.path.join(vendor_dir, 'pdf-lib.min.js')
if os.path.exists(vendor_lib):
    with open(vendor_lib, 'r', encoding='utf-8') as f:
        js_content += "\n/* Vendor: pdf-lib.min.js */\n" + f.read()

for tf in sorted(os.listdir(tools_dir)):
    if tf.endswith('.js'):
        with open(os.path.join(tools_dir, tf), 'r', encoding='utf-8') as f:
            js_content += f"\n/* Tool: {tf} */\n" + f.read()

with open(app_js_path, 'r', encoding='utf-8') as f:
    js_content += "\n/* App Core */\n" + f.read()

html = html.replace('<link rel="stylesheet" href="styles.css">', f'<style>\n{css}\n</style>')
html = re.sub(r'<script src="js/vendor/[^"]+"></script>\s*', '', html)
html = re.sub(r'<script src="js/tools/[^"]+"></script>\s*', '', html)
html = html.replace('<script src="app.js?v=2.0.1"></script>', f'<script>\n{js_content}\n</script>')

# Write bundled HTML payload
with open(os.path.join(win_dir, "index.html"), "w", encoding="utf-8") as f:
    f.write(html)

# 2. Write package.json dynamically
package_json = """{
  "name": "toolify",
  "version": "2.0.0",
  "main": "main.js",
  "scripts": {
    "build-win": "electron-builder --win portable --x64"
  },
  "build": {
    "appId": "com.toolify.app",
    "win": {
      "target": ["portable"],
      "icon": "AppIcon.ico"
    },
    "portable": {
      "artifactName": "Toolify.exe"
    },
    "files": [
      "main.js",
      "index.html"
    ],
    "directories": {
      "output": "dist"
    }
  },
  "dependencies": {},
  "devDependencies": {
    "electron": "^31.0.0",
    "electron-builder": "^24.13.3"
  }
}
"""
with open(os.path.join(win_dir, "package.json"), "w", encoding="utf-8") as f:
    f.write(package_json)

# 3. Write main.js dynamically
main_js = """const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Toolify',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
"""
with open(os.path.join(win_dir, "main.js"), "w", encoding="utf-8") as f:
    f.write(main_js)

# 4. Generate temporary AppIcon.ico using PIL for embedding
from PIL import Image, ImageDraw
import math

img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)
draw.rounded_rectangle([28, 28, 228, 228], radius=60, fill=(18, 18, 18, 255))
draw.line([(80, 176), (144, 112)], fill=(255, 255, 255, 255), width=18)
draw.ellipse([67, 163, 93, 189], fill=(255, 255, 255, 255))
draw.ellipse([75, 171, 85, 181], fill=(18, 18, 18, 255))
draw.ellipse([109, 77, 179, 147], fill=(255, 255, 255, 255))

cx, cy = 144 + 7, 112 - 7
w, h = 20, 32
angle = math.radians(-45)
cos_a = math.cos(angle)
sin_a = math.sin(angle)
half_w, half_h = w / 2, h / 2
p1 = (cx - half_w * cos_a - half_h * sin_a, cy - half_w * (-sin_a) - half_h * cos_a)
p2 = (cx + half_w * cos_a - half_h * sin_a, cy + half_w * (-sin_a) - half_h * cos_a)
p3 = (cx + half_w * cos_a + half_h * sin_a, cy + half_w * (-sin_a) + half_h * cos_a)
p4 = (cx - half_w * cos_a + half_h * sin_a, cy - half_w * (-sin_a) + half_h * cos_a)
draw.polygon([p1, p2, p3, p4], fill=(18, 18, 18, 255))

img.save(os.path.join(win_dir, "AppIcon.ico"), format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (32, 32), (16, 16)])

print("✓ Wrote config templates. Installing dependencies and packaging EXE...")

# 5. Run compilation and package target
subprocess.check_call(["npm", "install"], cwd=win_dir)
subprocess.check_call(["npm", "run", "build-win"], cwd=win_dir)

# 6. Copy final compiled EXE output
compiled_exe = os.path.join(win_dir, "dist", "Toolify.exe")
shutil.copy(compiled_exe, os.path.join(win_dir, "Toolify.exe"))
shutil.copy(compiled_exe, os.path.join(base_dir, "downloads", "Toolify.exe"))

print("✓ Copying compiled binary outputs.")

# 7. Clean up all temporary files to keep the directory clean
for f in ["package.json", "package-lock.json", "main.js", "index.html", "AppIcon.ico"]:
    p = os.path.join(win_dir, f)
    if os.path.exists(p):
        os.remove(p)

for d in ["node_modules", "dist"]:
    p = os.path.join(win_dir, d)
    if os.path.exists(p):
        shutil.rmtree(p)

print("✓ Cleanup completed. Windows folder remains clean containing only build_exe.py and Toolify.exe!")
print("✓ Windows build pipeline successfully completed!")

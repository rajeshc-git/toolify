import os, base64, re, subprocess, shutil, math
from PIL import Image, ImageDraw

mac_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(mac_dir, "..", ".."))
win_dir = os.path.join(root_dir, "standalone", "windows")
base_dir = os.path.join(root_dir, "web")
web_downloads_dir = os.path.join(base_dir, "downloads")
app_dir = os.path.join(mac_dir, "Toolify.app")

# 1. Recreate the App bundle directories
shutil.rmtree(app_dir, ignore_errors=True)
os.makedirs(os.path.join(app_dir, "Contents", "MacOS"), exist_ok=True)
os.makedirs(os.path.join(app_dir, "Contents", "Resources"), exist_ok=True)

# 2. Write Info.plist
plist_content = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>Toolify</string>
    <key>CFBundleIdentifier</key>
    <string>com.toolify.app</string>
    <key>CFBundleName</key>
    <string>Toolify</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>2.0.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
</dict>
</plist>
"""
with open(os.path.join(app_dir, "Contents", "Info.plist"), "w", encoding="utf-8") as f:
    f.write(plist_content)

# 3. Create the 1024x1024 base squircle wrench icon
img = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Premium dark squircle background (macOS rounded rect style)
draw.rounded_rectangle([112, 112, 912, 912], radius=240, fill=(18, 18, 18, 255))

# Draw the white Wrench shape
# Handle line: (320, 704) to (576, 448), width 70
draw.line([(320, 704), (576, 448)], fill=(255, 255, 255, 255), width=70)

# Rounded end of handle: circle at (320, 704), radius 50
draw.ellipse([270, 654, 370, 754], fill=(255, 255, 255, 255))
# Small keyhole in handle: circle at (320, 704), radius 18, filled with background color
draw.ellipse([302, 686, 338, 722], fill=(18, 18, 18, 255))

# Wrench Head: circle at (576, 448), radius 140
draw.ellipse([436, 308, 716, 588], fill=(255, 255, 255, 255))

# Wrench Jaw Cut-out: Polygon representing a tilted rectangle at 45 degrees
# Center of the cut-out shifted slightly along 45 degrees to the top-right
cx = 576 + 30
cy = 448 - 30
w = 80
h = 130
angle = math.radians(-45) # 45 degrees top-right

cos_a = math.cos(angle)
sin_a = math.sin(angle)

half_w = w / 2
half_h = h / 2

# Calculate the 4 rotated corner coordinates of the jaw cut-out
p1 = (cx - half_w * cos_a - half_h * sin_a, cy - half_w * (-sin_a) - half_h * cos_a)
p2 = (cx + half_w * cos_a - half_h * sin_a, cy + half_w * (-sin_a) - half_h * cos_a)
p3 = (cx + half_w * cos_a + half_h * sin_a, cy + half_w * (-sin_a) + half_h * cos_a)
p4 = (cx - half_w * cos_a + half_h * sin_a, cy - half_w * (-sin_a) + half_h * cos_a)

draw.polygon([p1, p2, p3, p4], fill=(18, 18, 18, 255))

# Save base image
base_png = os.path.join(mac_dir, "AppIcon_1024.png")
img.save(base_png)

# 4. Generate AppIcon.icns using iconutil
iconset_dir = os.path.join(mac_dir, "AppIcon.iconset")
os.makedirs(iconset_dir, exist_ok=True)

sizes = {
    "icon_16x16.png": 16,
    "icon_16x16@2x.png": 32,
    "icon_32x32.png": 32,
    "icon_32x32@2x.png": 64,
    "icon_128x128.png": 128,
    "icon_128x128@2x.png": 256,
    "icon_256x256.png": 256,
    "icon_256x256@2x.png": 512,
    "icon_512x512.png": 512,
    "icon_512x512@2x.png": 1024
}

for name, size in sizes.items():
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(os.path.join(iconset_dir, name))

icns_path = os.path.join(app_dir, "Contents", "Resources", "AppIcon.icns")
subprocess.check_call(["iconutil", "-c", "icns", iconset_dir, "-o", icns_path])

# Clean up temp icon files
for f in os.listdir(iconset_dir):
    os.remove(os.path.join(iconset_dir, f))
os.rmdir(iconset_dir)
os.remove(base_png)

print("✓ Recreated AppIcon.icns icon.")

# 5. Bundle web assets
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

html_bytes = html.encode('utf-8')
b64_html = base64.b64encode(html_bytes).decode('ascii')

# 6. Write Cocoa Swift code and compile the binary
swift_code = f"""
import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKUIDelegate {{
    var window: NSWindow!
    var webView: WKWebView!
    
    let base64Payload = "{b64_html}"

    func applicationDidFinishLaunching(_ notification: Notification) {{
        let fileManager = FileManager.default
        let cacheDir = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first!
            .appendingPathComponent("Toolify")
        try? fileManager.createDirectory(at: cacheDir, withIntermediateDirectories: true, attributes: nil)
        
        let htmlPath = cacheDir.appendingPathComponent("index.html")
        if let decodedData = Data(base64Encoded: base64Payload) {{
            try? decodedData.write(to: htmlPath)
        }}

        let screenRect = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1200, height: 800)
        let windowWidth: CGFloat = min(1200, screenRect.width * 0.85)
        let windowHeight: CGFloat = min(800, screenRect.height * 0.85)
        let windowRect = NSRect(
            x: (screenRect.width - windowWidth) / 2,
            y: (screenRect.height - windowHeight) / 2,
            width: windowWidth,
            height: windowHeight
        )

        window = NSWindow(
            contentRect: windowRect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Toolify"
        window.delegate = self

        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        
        webView = WKWebView(frame: .zero, configuration: config)
        webView.uiDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        
        let contentView = window.contentView!
        contentView.addSubview(webView)
        
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: contentView.topAnchor),
            webView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor)
        ])

        webView.loadFileURL(htmlPath, allowingReadAccessTo: htmlPath.deletingLastPathComponent())

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }}

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {{
        return true
    }}

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {{
        let openPanel = NSOpenPanel()
        openPanel.allowsMultipleSelection = parameters.allowsMultipleSelection
        openPanel.canChooseDirectories = parameters.allowsDirectories
        openPanel.canChooseFiles = true
        
        openPanel.beginSheetModal(for: self.window) {{ response in
            if response == .OK {{
                completionHandler(openPanel.urls)
            }} else {{
                completionHandler(nil)
            }}
        }}
    }}
}}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
"""

swift_file_path = os.path.join(mac_dir, "launcher.swift")
with open(swift_file_path, "w", encoding="utf-8") as f:
    f.write(swift_code)

sdk_path = subprocess.check_output(["xcrun", "--show-sdk-path", "--sdk", "macosx"]).decode('utf-8').strip()
macos_bin = os.path.join(app_dir, "Contents", "MacOS", "Toolify")

# Compile using Swift Compiler
subprocess.check_call(["swiftc", "-O", "-sdk", sdk_path, "-o", macos_bin, swift_file_path])

# Clean up swift code
if os.path.exists(swift_file_path):
    os.remove(swift_file_path)

print("✓ Native Swift binary compiled.")

# Ad-hoc sign the app bundle to allow Right-Click 'Open' bypass on web downloads
print("✓ Ad-hoc signing the App Bundle...")
subprocess.check_call(["codesign", "--force", "--deep", "--sign", "-", app_dir])

# 7. Create a beautiful styled installer DMG using create-dmg!
dmg_output = os.path.join(mac_dir, "Toolify.dmg")
if os.path.exists(dmg_output):
    os.remove(dmg_output)

temp_src = os.path.join(mac_dir, "temp_src")
shutil.rmtree(temp_src, ignore_errors=True)
os.makedirs(temp_src, exist_ok=True)

# Copy the app to the temp source directory
shutil.copytree(app_dir, os.path.join(temp_src, "Toolify.app"))

print("✓ Building styled installer DMG using create-dmg...")

# Call create-dmg
# This places Toolify.app at (175, 190) and Applications drop link at (425, 190)
create_dmg_cmd = [
    "create-dmg",
    "--volname", "Toolify",
    "--window-pos", "200", "120",
    "--window-size", "600", "400",
    "--icon-size", "100",
    "--icon", "Toolify.app", "175", "190",
    "--hide-extension", "Toolify.app",
    "--app-drop-link", "425", "190",
    dmg_output,
    temp_src
]
subprocess.check_call(create_dmg_cmd)

# Clean up temp source folder and intermediate app bundle
shutil.rmtree(temp_src, ignore_errors=True)
shutil.rmtree(app_dir, ignore_errors=True)

# Copy output DMG into web downloads folder
os.makedirs(web_downloads_dir, exist_ok=True)
shutil.copy(dmg_output, os.path.join(web_downloads_dir, "Toolify.dmg"))

print("✓ Cleanup completed. macOS folder remains clean containing only build_dmg.py and Toolify.dmg!")
print("✓ Beautiful styled macOS DMG installer compiled and copied to web downloads!")

# ESP32 Subway Display - Hardware Assembly Plan

## Goal
Give the ESP32 independent power, mount it to the LED panel, and create an enclosure.

---

## Step 1: Independent Power for ESP32

### Option A: Separate USB Power (Simplest)
- Use any USB-C phone charger (5V, 500mA+ is plenty)
- Plug ESP32 into wall adapter
- Panel keeps its existing 5V power supply
- **Pros:** Simple, no modifications
- **Cons:** Two power cables

### Option B: Shared 5V Power Supply (Cleaner)
- Use a single 5V 3A+ power supply for both panel and ESP32
- Wire panel power as you have now
- Add a second pair of wires from the same 5V supply to ESP32's 5V/GND pins
- **Pros:** Single power source
- **Cons:** Requires soldering or more screw terminals

### Recommendation
Start with Option A (separate USB charger). It's working now and requires no changes. You can consolidate to a single power supply later when building the final case.

---

## Step 2: Mount ESP32 to Display

### Panel Back Layout
The HUB75 panel has:
- Metal frame with mounting holes in corners
- HUB75 data connector (where your wires go)
- Power connector

### Where to Tape on ESP32
The metal shield on top of the ESP32-WROOM module is a good surface for tape. **Avoid covering the antenna area** - it's the section at the very end of the module (opposite the USB port) with no components underneath. Taping on the center/chip area is safe.

### Mounting Options

**Option A: Double-sided foam tape**
- Clean, simple, removable
- Use 3M VHB tape or thick foam mounting tape
- Apply tape to the metal shield on the ESP32 module (not the antenna end)
- Place ESP32 on the back of the panel frame
- Leave USB-C port accessible at edge

**Option B: 3D printed bracket**
- Design a bracket that screws into panel's mounting holes
- Bracket holds ESP32 with clips or standoffs
- More secure, allows easy removal

**Option C: Standoffs**
- If ESP32 has mounting holes, use M2 or M2.5 standoffs
- Attach to panel frame with small screws or adhesive standoffs

### Wire Management
- Bundle the 13 jumper wires with a small zip tie or cable sleeve
- Keep wires short and tidy against the panel back
- Leave some slack for USB-C access

### Reducing Connector Depth
DuPont connectors add ~20mm of depth (10mm on each end). Options to reduce:

| Option | Depth Reduction | Difficulty |
|--------|-----------------|------------|
| **Solder directly** | Maximum - wires flush to boards | Permanent, requires soldering |
| **Right-angle headers** | ~50% - wires exit sideways | Replace headers on ESP32 |
| **Ribbon cable + IDC** | Good on HUB75 side | Buy 16-pin IDC ribbon cable |
| **Bend connectors 90°** | ~50% - wires exit sideways | Careful bending, can break |
| **Shorter jumper wires** | Reduces bulk, not depth | Buy 5-10cm jumpers |

For the thinnest build, soldering wires directly to both the ESP32 and HUB75 header is the typical approach.

### Recommendation
Start with foam tape for prototyping. It's quick and reversible. Move to a 3D printed bracket when you finalize the case design.

---

## Step 3: Create Enclosure

### Dimensions
- Panel: 160mm x 80mm (visible area)
- Panel frame: ~170mm x 90mm (with mounting tabs)
- Depth needed: ~30-40mm for ESP32 + wiring

### Enclosure Requirements
1. **Front opening** - 160x80mm cutout for display
2. **Diffuser recess** (optional) - Slot to hold frosted acrylic 5-10mm in front of panel
3. **Back compartment** - Space for ESP32 and wiring
4. **USB-C access** - Hole or slot on side/bottom for power cable
5. **Ventilation** - Small slots or holes for airflow
6. **Wall mount** - Keyhole slots or mounting tabs on back

### Construction Options

**Option A: 3D Printed (Best for custom fit)**
- Design in Fusion 360, TinkerCAD, or similar
- Print in PLA or PETG
- Can include integrated diffuser slot, cable channels, mount points
- Typical print time: 4-8 hours

**Option B: Laser Cut (Clean look)**
- Design box with finger joints in wood or acrylic
- Frosted acrylic front doubles as diffuser
- Requires access to laser cutter

**Option C: Project Box + Modification**
- Buy a plastic project enclosure close to size
- Cut front opening with rotary tool
- Simple but less polished

**Option D: Simple Frame (Minimal, No 3D Printer)**
- Just a frame around the panel edges
- ESP32 exposed on back
- Quick, functional, not enclosed

#### Frame Materials (No 3D Printer)

| Material | Pros | Cons | Tools Needed |
|----------|------|------|--------------|
| **Wood strips** | Durable, paintable, professional look | Requires cutting | Saw, sandpaper, wood glue |
| **Shadow box frame** | Ready-made, deep enough for wiring | May need size adjustment | None or craft knife |
| **Foam board** | Easy to cut, lightweight, cheap | Less durable | Craft knife, ruler |
| **Acrylic strips** | Clean modern look | Harder to cut | Scoring tool or saw |
| **Cardboard** | Free, fast prototyping | Temporary only | Scissors, tape |

**Recommended: Wood strips** - Get 1/2" x 1/2" wood strips from hardware store. Cut to size with miter saw or hand saw. Glue with wood glue, clamp until dry. Paint matte black. Mount panel with small screws or adhesive.

### Recommendation
For no 3D printer: Build a simple wood frame, tape ESP32 to panel back, and use Command strips to wall mount. This gets you a functional display quickly.

---

## Suggested Order of Operations

1. **Now:** Unplug from computer, plug ESP32 into USB wall charger - verify it works independently

2. **Prototype mount:** Use foam tape to stick ESP32 to panel back, tidy up wires with zip tie

3. **Test placement:** Prop it up where you want to mount it, live with it for a few days

4. **Decide on diffuser:** Try paper/vellum in front, see if you like the effect

5. **Design case:** Once you know the final form factor, design or acquire enclosure

6. **Final assembly:** Mount everything in case, add wall mount hardware

---

## Materials Checklist

### For Independent Power
- [ ] USB-C wall charger (any phone charger works)

### For Mounting
- [ ] 3M foam mounting tape or VHB tape
- [ ] Small zip ties or cable sleeve
- [ ] (Optional) M2/M2.5 standoffs if using screw mount

### For Case

**If 3D printing:**
- [ ] PLA or PETG filament

**If building wood frame:**
- [ ] 1/2" x 1/2" wood strips (~2 feet total)
- [ ] Wood glue
- [ ] Sandpaper
- [ ] Matte black spray paint or acrylic paint

**Optional:**
- [ ] Frosted acrylic sheet ~3mm thick, 180x100mm (if adding diffuser)
- [ ] Wall mounting hardware (Command strips, screws, or keyhole hangers)

---

## Reference: Current Wiring

| HUB75 Pin | ESP32 GPIO |
|-----------|------------|
| R1        | GPIO 25    |
| G1        | GPIO 26    |
| B1        | GPIO 27    |
| R2        | GPIO 14    |
| G2        | GPIO 12    |
| B2        | GPIO 13    |
| A         | GPIO 23    |
| B         | GPIO 19    |
| C         | GPIO 5     |
| D         | GPIO 17    |
| CLK       | GPIO 16    |
| LAT       | GPIO 4     |
| OE        | GPIO 15    |
| GND       | GND        |

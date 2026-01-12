/*
 * HUB75 Test Pattern
 *
 * Cycles through solid colors to verify all pixels and wiring.
 * If you see the correct colors, your wiring is good!
 */

#include <ESP32-HUB75-MatrixPanel-I2S-DMA.h>

#define PANEL_WIDTH 64
#define PANEL_HEIGHT 32

MatrixPanel_I2S_DMA *display = nullptr;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("HUB75 Test Pattern Starting...");

  // Configure the display
  HUB75_I2S_CFG mxconfig(PANEL_WIDTH, PANEL_HEIGHT, 1);

  // Create display object
  display = new MatrixPanel_I2S_DMA(mxconfig);

  if (!display->begin()) {
    Serial.println("Display setup failed!");
    while (1);
  }

  Serial.println("Display initialized!");

  // Start at low brightness (safer for 1.5A supply)
  display->setBrightness8(64);  // 25% brightness
  display->clearScreen();

  Serial.println("Starting color test...");
}

void loop() {
  // Red
  Serial.println("RED");
  display->fillScreenRGB888(255, 0, 0);
  delay(2000);

  // Green
  Serial.println("GREEN");
  display->fillScreenRGB888(0, 255, 0);
  delay(2000);

  // Blue
  Serial.println("BLUE");
  display->fillScreenRGB888(0, 0, 255);
  delay(2000);

  // White
  Serial.println("WHITE");
  display->fillScreenRGB888(255, 255, 255);
  delay(2000);

  // Black (off)
  Serial.println("BLACK (off)");
  display->fillScreenRGB888(0, 0, 0);
  delay(1000);
}

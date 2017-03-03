/**
 * Copyright(C), 2016-2038, KenRobot.com
 * FileName: toneKeyboard.ino
 * Author: 啃萝卜
 * Create: 2017/03/03
 * Modify: 2017/03/03
 */

int button_0 = 2;
int button_1 = 3;
int button_2 = 4;
int buzzer_0 = 8;

void setup() {
    pinMode(button_0, INPUT);
    pinMode(button_1, INPUT);
    pinMode(button_2, INPUT);
    pinMode(buzzer_0, OUTPUT);
}

void loop() {
    if (digitalRead(button_0) == 1) {
        tone(buzzer_0, 261, 200);
        delay(200);
    }
    if (digitalRead(button_1) == 1) {
        tone(buzzer_0, 293, 200);
        delay(200);
    }
    if (digitalRead(button_2) == 1) {
        tone(buzzer_0, 329, 200);
        delay(200);
    }
}
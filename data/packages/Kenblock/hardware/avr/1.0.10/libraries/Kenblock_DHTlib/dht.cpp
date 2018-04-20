 /**
 * \著作权 
 * @名称：  dht.cpp
 * @作者：  Rob Tillaart
 * @版本：  V0.1.22
 * @URL: 	http://arduino.cc/playground/Main/DHTLib
 * @维护：  Kenblock
 * @时间：  2017/09/11
 * @描述：  DTH 温湿度传感器驱动函数。
 *
 * \说明
 * DTH 温湿度传感器驱动函数，包含DHT11、21, 22, 33 和 44。
 *
 * \公有方法列表
 * 
 * 		1. int8_t dht::read11(uint8_t pin)
 * 		2. int8_t dht::read(uint8_t pin)
 * 		3. int8_t dht::read21(uint8_t pin)
 * 		4. int8_t dht::read22(uint8_t pin)
 * 		5. int8_t dht::read33(uint8_t pin)
 * 		6. int8_t dht::read44(uint8_t pin)
 * 		7. double humidity
 * 		8. double temperature
 *
 * \修订历史
 * `<Author>`      `<Time>`        `<Version>`        `<Descr>`
 *  KING            2017/09/11      0.1.22              做汉化修订注释。
 *  
 * \示例
 *  
 * 		1.dht11_test.ino 		//DHT11测试
 * 		2.dht21_test.ino		//DHT21测试
 * 		3.dht22_test.ino 		//DHT11测试
 * 		4.dht33_test.ino		//DHT21测试
 * 		5.dht44_test.ino 		//DHT11测试
 * 		6.dht_test1.ino			//DHT11、DHT21、DHT22测试
 * 		7.dht_tuning.ino		//DHT22 寻找读取的最小时间。
 */

#include "dht.h"

/////////////////////////////////////////////////////
//
// PUBLIC
//

int8_t dht::read11(uint8_t pin)
{
    // READ VALUES
    int8_t result = _readSensor(pin, DHTLIB_DHT11_WAKEUP, DHTLIB_DHT11_LEADING_ZEROS);

    // these bits are always zero, masking them reduces errors.
    bits[0] &= 0x7F;
    bits[2] &= 0x7F;

    // CONVERT AND STORE
    humidity    = bits[0];  // bits[1] == 0;
    temperature = bits[2];  // bits[3] == 0;

    // TEST CHECKSUM
    // bits[1] && bits[3] both 0
    uint8_t sum = bits[0] + bits[1] + bits[2] + bits[3];
    if (bits[4] != sum)
    {
        return DHTLIB_ERROR_CHECKSUM;
    }
    return result;
}

int8_t dht::read(uint8_t pin)
{
    // READ VALUES
    int8_t result = _readSensor(pin, DHTLIB_DHT_WAKEUP, DHTLIB_DHT_LEADING_ZEROS);

    // these bits are always zero, masking them reduces errors.
    bits[0] &= 0x03;
    bits[2] &= 0x83;

    // CONVERT AND STORE
    humidity = (bits[0]*256 + bits[1]) * 0.1;
    temperature = ((bits[2] & 0x7F)*256 + bits[3]) * 0.1;
    if (bits[2] & 0x80)  // negative temperature
    {
        temperature = -temperature;
    }

    // TEST CHECKSUM
    uint8_t sum = bits[0] + bits[1] + bits[2] + bits[3];
    if (bits[4] != sum)
    {
        return DHTLIB_ERROR_CHECKSUM;
    }
    return result;
}

/////////////////////////////////////////////////////
//
// PRIVATE
//

int8_t dht::_readSensor(uint8_t pin, uint8_t wakeupDelay, uint8_t leadingZeroBits)
{
    // INIT BUFFERVAR TO RECEIVE DATA
    uint8_t mask = 128;
    uint8_t idx = 0;

    uint8_t data = 0;
    uint8_t state = LOW;
    uint8_t pstate = LOW;
    uint16_t zeroLoop = DHTLIB_TIMEOUT;
    uint16_t delta = 0;

    leadingZeroBits = 40 - leadingZeroBits; // reverse counting...

    // replace digitalRead() with Direct Port Reads.
    // reduces footprint ~100 bytes => portability issue?
    // direct port read is about 3x faster
    uint8_t bit = digitalPinToBitMask(pin);
    uint8_t port = digitalPinToPort(pin);
    volatile uint8_t *PIR = portInputRegister(port);

    // REQUEST SAMPLE
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW); // T-be
    if (wakeupDelay > 8) delay(wakeupDelay);
    else delayMicroseconds(wakeupDelay * 1000UL);
    // digitalWrite(pin, HIGH); // T-go
    pinMode(pin, INPUT);

    uint16_t loopCount = DHTLIB_TIMEOUT * 2;  // 200uSec max
    // while(digitalRead(pin) == HIGH)
    while ((*PIR & bit) != LOW )
    {
        if (--loopCount == 0) return DHTLIB_ERROR_CONNECT;
    }

    // GET ACKNOWLEDGE or TIMEOUT
    loopCount = DHTLIB_TIMEOUT;
    // while(digitalRead(pin) == LOW)
    while ((*PIR & bit) == LOW )  // T-rel
    {
        if (--loopCount == 0) return DHTLIB_ERROR_ACK_L;
    }

    loopCount = DHTLIB_TIMEOUT;
    // while(digitalRead(pin) == HIGH)
    while ((*PIR & bit) != LOW )  // T-reh
    {
        if (--loopCount == 0) return DHTLIB_ERROR_ACK_H;
    }

    loopCount = DHTLIB_TIMEOUT;

    // READ THE OUTPUT - 40 BITS => 5 BYTES
    for (uint8_t i = 40; i != 0; )
    {
        // WAIT FOR FALLING EDGE
        state = (*PIR & bit);
        if (state == LOW && pstate != LOW)
        {
            if (i > leadingZeroBits) // DHT22 first 6 bits are all zero !!   DHT11 only 1
            {
                zeroLoop = min(zeroLoop, loopCount);
                delta = (DHTLIB_TIMEOUT - zeroLoop)/4;
            }
            else if ( loopCount <= (zeroLoop - delta) ) // long -> one
            {
                data |= mask;
            }
            mask >>= 1;
            if (mask == 0)   // next byte
            {
                mask = 128;
                bits[idx] = data;
                idx++;
                data = 0;
            }
            // next bit
            --i;

            // reset timeout flag
            loopCount = DHTLIB_TIMEOUT;
        }
        pstate = state;
        // Check timeout
        if (--loopCount == 0)
        {
            return DHTLIB_ERROR_TIMEOUT;
        }

    }
    // pinMode(pin, OUTPUT);
    // digitalWrite(pin, HIGH);

    return DHTLIB_OK;
}
//
// END OF FILE
//
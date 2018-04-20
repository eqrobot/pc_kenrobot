 /**
 * \著作权 Copyright (C), 2016-2020, LZRobot
 * @名称：  Kenblock_Joystick.h
 * @作者：  Kenblock
 * @版本：  V0.1.0
 * @时间：  2017/07/21
 * @描述：  摇杆模块驱动函数。Joystick.c 的头文件。
 *
 * \说明
 * 摇杆模块驱动函数。
 *
 * \方法列表
 * 
 * 		1. void 	Joystick::setPin(uint8_t port)
 * 		2. void 	Joystick::setPin(uint8_t x_pin,uint8_t y_pin)
 * 		3. int16_t 	Joystick::readX(void)
 * 		4. int16_t 	Joystick::readY(void)
 * 		5. int16_t 	Joystick::read(uint8_t index)
 * 		6. void 	Joystick::calCenterValue(int16_t x_offset,int16_t y_offset)
 * 		7. float 	Joystick::angle(void)
 * 		8. float 	Joystick::offcenter(void)
 *
 * \修订历史
 * `<Author>`      `<Time>`        `<Version>`        `<Descr>`
 *  KING            2017/07/21      0.1.0              新建库文件。
 *  
 * \示例
 *  
 * 		1.JoystickTest.ino
 */
 
#ifndef Kenblock_Joystick_H
#define Kenblock_Joystick_H

#include <stdint.h>
#include <stdbool.h>
#include <Arduino.h>
#include "KenblockConfig.h"

#define CENTER_VALUE    (500)  //中心值

/**
 * Class: Joystick
 * \说明：Class Joystick 的声明
 */
class Joystick
{
	public:
		/**
		 * \函数：Joystick
		 * \说明：初始化，不做任何操作
		 * \输入参数：无
		 * \输出参数：无
		 * \返回值：无
		 * \其他：无
		 */
		Joystick(void);
	
		/**
		 * \函数：Joystick
		 * \说明：替代构造函数，映射摇杆模块引脚设置函数，设置输入引脚
		 * \输入参数：
		 *   port : Ex_Double_Analog  双路模拟接口（4P接口）
		 *   	a1 - 摇杆模块 X轴 引脚
		 *   	a2 - 摇杆模块 Y轴 引脚
		 * \输出参数：无
		 * \返回值：无
		 * \其他：无
		 */
		Joystick(uint8_t port);
	
		/**
		 * \函数：Joystick
		 * \说明：替代构造函数，映射摇杆模块引脚设置函数，设置输入引脚
		 * \输入参数：
		 *   x_pin - 摇杆模块 X轴 引脚
		 *   y_pin - 摇杆模块 Y轴 引脚
		 * \输出参数：无
		 * \返回值：无
		 * \其他：无
		 */	
		Joystick(uint8_t x_pin,uint8_t y_pin);
		
		/**
		 * \函数：setpin
		 * \说明：设置摇杆模块输入引脚
		 * \输入参数：
		 *   port : Ex_Double_Analog  双路模拟接口（4P接口）
		 *   	a1 - 摇杆模块 X轴 引脚
		 *   	a2 - 摇杆模块 Y轴 引脚
		 * \输出参数：无
		 * \返回值：无
		 * \其他：无
		 */
		void setPin(uint8_t port);
		
		/**
		 * \函数：setpin
		 * \说明：设置摇杆模块输入引脚
		 * \输入参数：
		 *   x_pin - 摇杆模块 X轴 引脚
		 *   y_pin - 摇杆模块 Y轴 引脚
		 * \输出参数：无
		 * \返回值：无
		 * \其他：无
		 */
		void setPin(uint8_t x_pin,uint8_t y_pin);

 		/**
		 * \函数：readX
		 * \说明：读取摇杆模块 X轴 的值
		 * \输入参数：无
		 * \输出参数：无
		 * \返回值：摇杆模块 X轴 的值：-500 - 500
		 * \其他：无
		 */
		int16_t readX(void);

  		/**
		 * \函数：readY
		 * \说明：读取摇杆模块 Y轴 的值
		 * \输入参数：无
		 * \输出参数：无
		 * \返回值：摇杆模块 Y轴 的值：-500 - 500
		 * \其他：无
		 */
		int16_t readY(void);
		
		/**
		 * \函数：read
		 * \说明：读取摇杆模块 X轴或Y轴 的值
		 * \输入参数：
		 *   index - '1'表示 X轴，'2'表示 Y轴
		 * \输出参数：无
		 * \返回值：摇杆模块 X轴或Y轴 的值：-500 - 500
		 * \其他：无
		 */
		int16_t read(uint8_t index);
		
		/**
		 * \函数：calCenterValue
		 * \说明：如果摇杆在没有触动的状态（默认中间），X轴、Y轴的输出值不为0，则需要将其值校正为0。
		 * \输入参数：
		 *   x_offset - X轴校正为0所需的偏移量
		 *   y_offset - Y轴校正为0所需的偏移量		 
		 * \输出参数：无
		 * \返回值：无
		 * \其他：无
		 */
		void calCenterValue(int16_t x_offset,int16_t y_offset);
		
		/**
		 * \函数：angle
		 * \说明：输出操作杆的角度
		 * \输入参数：无
		 * \输出参数：无
		 * \返回值：操作杆的角度值： -180 - 180 度
		 * \其他：无
		 */
		float angle(void);
		
		/**
		 * \函数：offcenter
		 * \说明：输出操作杆的离中心距离
		 * \输入参数：无
		 * \输出参数：无
		 * \返回值：操作杆的离中心距离值： 0 - 700
		 * \其他：无
		 */
		float offcenter(void);
		
	private:
		volatile uint8_t _X_axis_pin;
		volatile uint8_t _Y_axis_pin;
		volatile int16_t _X_offset;
		volatile int16_t _Y_offset;
};
#endif // Kenblock_Joystick_H

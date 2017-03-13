/**
 * \著作权 Copyright (C), 2016-2020, LZRobot
 * @名称：  SoundSensorTest.ino
 * @作者：  RoSys
 * @版本：  V1.0.0
 * @时间：  2016/10/10
 * @描述：  声音传感模块测试示例。
 * 
 * \说明
 *  声音传感模块测试示例。
 * 
 * \函数列表
 * 
 * 
 * \修订历史
 * `<Author>`      `<Time>`        `<Version>`        `<Descr>`
 *  KING            2016/10/10      1.0.0              新建程序。
 * 
 */
int soundSensor = A0;       //声音传感模块接口
void setup()
{
	Serial.begin(9600);    	//设置串口波特率为9600
}

void loop()
{
	int value = analogRead(soundSensor);         //设置变量，读取数据
	Serial.print("Value: ");
	Serial.println(value);                       //发送数值
	delay(100);
}
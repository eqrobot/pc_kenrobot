#!/bin/bash
#export PATH=/usr/bin:$PATH

# 使用方法: upload.sh hex COM
# 使用示例: 1. upload.sh test.hex COM5 2. upload.sh /home/project/test.hex COM5

# hex文件路径
HEX_PATH=$1

DIR=$(dirname "$0")
LOCAL_ARDUINO_PATH=${DIR}/../arduino-linux

UPLOADER=${LOCAL_ARDUINO_PATH}/hardware/tools/avr/bin/avrdude
UPLOADER_CONF=${LOCAL_ARDUINO_PATH}/hardware/tools/avr/etc/avrdude.conf

# COM端口
ARDUINO_COMPORT=%2

ARDUINO_MCU=atmega328p
ARDUINO_PROGRAMMER=arduino
ARDUINO_BURNRATE=115200

${UPLOADER} -C ${UPLOADER_CONF} -p ${ARDUINO_MCU} -P ${ARDUINO_COMPORT} -c ${ARDUINO_PROGRAMMER} -b ${ARDUINO_BURNRATE} -U "flash:w:${HEX_PATH}:i"

if [ $? -ne 0 ]; then
	echo build fail
    exit 2
fi

echo build success
exit 0